-- Fix Wager Settlement to Use profiles.skilled_coins
-- This migration fixes the settlement system to:
-- 1. Lock wager upfront (deduct from profiles.skilled_coins when match starts)
-- 2. Use profiles.skilled_coins as single source of truth
-- 3. Pay winner 1.9x wager (since wager already deducted, net gain is +0.9x)
-- 4. Make settlement atomic and idempotent

-- 1. Add wager_locked_at column to games table
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS wager_locked_at TIMESTAMP WITH TIME ZONE;

-- 2. Create lock_wager function - deducts wager from both players' profiles.skilled_coins
CREATE OR REPLACE FUNCTION public.lock_wager(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game RECORD;
  v_white_profile RECORD;
  v_black_profile RECORD;
  v_wager INTEGER;
  v_already_locked BOOLEAN := false;
BEGIN
  -- Lock the game row for update (prevents concurrent locking)
  SELECT * INTO v_game 
  FROM public.games 
  WHERE id = p_game_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Game not found',
      'game_id', p_game_id
    );
  END IF;
  
  -- Check if already locked (idempotent)
  IF v_game.wager_locked_at IS NOT NULL THEN
    v_already_locked := true;
    
    -- Get current balances
    SELECT p.user_id, pr.skilled_coins INTO v_white_profile
    FROM public.players p
    JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.id = v_game.white_player_id;
    
    SELECT p.user_id, pr.skilled_coins INTO v_black_profile
    FROM public.players p
    JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.id = v_game.black_player_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'already_locked', true,
      'game_id', p_game_id,
      'wager_locked_at', v_game.wager_locked_at,
      'balances', jsonb_build_object(
        'white', jsonb_build_object('user_id', v_white_profile.user_id, 'skilled_coins', v_white_profile.skilled_coins),
        'black', jsonb_build_object('user_id', v_black_profile.user_id, 'skilled_coins', v_black_profile.skilled_coins)
      )
    );
  END IF;
  
  -- Ensure game is in 'created' or 'active' status
  IF v_game.status NOT IN ('created', 'active') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Game status does not allow wager locking',
      'game_id', p_game_id,
      'current_status', v_game.status
    );
  END IF;
  
  v_wager := COALESCE(v_game.wager, 0);
  
  IF v_wager <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid wager amount',
      'game_id', p_game_id,
      'wager', v_wager
    );
  END IF;
  
  -- Get player records with user_ids
  SELECT p.id, p.user_id INTO v_white_profile
  FROM public.players p
  WHERE p.id = v_game.white_player_id;
  
  SELECT p.id, p.user_id INTO v_black_profile
  FROM public.players p
  WHERE p.id = v_game.black_player_id;
  
  IF v_white_profile.user_id IS NULL OR v_black_profile.user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Player user_id not found',
      'game_id', p_game_id
    );
  END IF;
  
  -- Lock profiles rows for update and check balances
  SELECT user_id, skilled_coins INTO v_white_profile
  FROM public.profiles
  WHERE user_id = v_white_profile.user_id
  FOR UPDATE;
  
  SELECT user_id, skilled_coins INTO v_black_profile
  FROM public.profiles
  WHERE user_id = v_black_profile.user_id
  FOR UPDATE;
  
  IF v_white_profile.user_id IS NULL OR v_black_profile.user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found',
      'game_id', p_game_id
    );
  END IF;
  
  -- Check if both players have sufficient skilled_coins
  IF v_white_profile.skilled_coins < v_wager THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient skilled_coins',
      'game_id', p_game_id,
      'player', 'white',
      'required', v_wager,
      'available', v_white_profile.skilled_coins
    );
  END IF;
  
  IF v_black_profile.skilled_coins < v_wager THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient skilled_coins',
      'game_id', p_game_id,
      'player', 'black',
      'required', v_wager,
      'available', v_black_profile.skilled_coins
    );
  END IF;
  
  -- Deduct wager from both players' profiles.skilled_coins
  UPDATE public.profiles
  SET skilled_coins = skilled_coins - v_wager
  WHERE user_id = v_white_profile.user_id;
  
  UPDATE public.profiles
  SET skilled_coins = skilled_coins - v_wager
  WHERE user_id = v_black_profile.user_id;
  
  -- Record in ledger (ON CONFLICT DO NOTHING makes it idempotent)
  INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
  VALUES (v_white_profile.user_id, v_game.white_player_id, p_game_id, -v_wager, 'wager_lock')
  ON CONFLICT (game_id, type, player_id) DO NOTHING;
  
  INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
  VALUES (v_black_profile.user_id, v_game.black_player_id, p_game_id, -v_wager, 'wager_lock')
  ON CONFLICT (game_id, type, player_id) DO NOTHING;
  
  -- Update game status
  UPDATE public.games
  SET 
    wager_locked_at = now(),
    status = CASE WHEN status = 'created' THEN 'active' ELSE status END,
    updated_at = now()
  WHERE id = p_game_id;
  
  -- Get updated balances
  SELECT skilled_coins INTO v_white_profile.skilled_coins FROM public.profiles WHERE user_id = v_white_profile.user_id;
  SELECT skilled_coins INTO v_black_profile.skilled_coins FROM public.profiles WHERE user_id = v_black_profile.user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'already_locked', false,
    'game_id', p_game_id,
    'wager', v_wager,
    'wager_locked_at', now(),
    'balances', jsonb_build_object(
      'white', jsonb_build_object('user_id', v_white_profile.user_id, 'skilled_coins', v_white_profile.skilled_coins),
      'black', jsonb_build_object('user_id', v_black_profile.user_id, 'skilled_coins', v_black_profile.skilled_coins)
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'game_id', p_game_id
    );
END;
$$;

-- 3. Fix settle_game function to use profiles.skilled_coins and pay 1.9x wager to winner
CREATE OR REPLACE FUNCTION public.settle_game(
  p_game_id UUID,
  p_winner_id UUID,  -- player_id of winner, NULL for draw
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game RECORD;
  v_white_player RECORD;
  v_black_player RECORD;
  v_white_profile RECORD;
  v_black_profile RECORD;
  v_settlement_tx_id UUID;
  v_wager INTEGER;
  v_payout INTEGER;  -- 1.9x wager = wager * 19 / 10
  v_already_settled BOOLEAN := false;
BEGIN
  -- Generate unique settlement transaction ID
  v_settlement_tx_id := gen_random_uuid();
  
  -- Lock the game row for update (prevents concurrent settlement)
  SELECT * INTO v_game 
  FROM public.games 
  WHERE id = p_game_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Game not found',
      'game_id', p_game_id
    );
  END IF;
  
  -- Check if already settled (idempotent - return success with existing state)
  IF v_game.settled_at IS NOT NULL OR v_game.settlement_tx_id IS NOT NULL THEN
    v_already_settled := true;
    
    -- Get current balances from profiles.skilled_coins
    SELECT p.id, p.user_id, p.name INTO v_white_player 
    FROM public.players p WHERE id = v_game.white_player_id;
    
    SELECT p.id, p.user_id, p.name INTO v_black_player 
    FROM public.players p WHERE id = v_game.black_player_id;
    
    SELECT skilled_coins INTO v_white_profile.skilled_coins
    FROM public.profiles WHERE user_id = v_white_player.user_id;
    
    SELECT skilled_coins INTO v_black_profile.skilled_coins
    FROM public.profiles WHERE user_id = v_black_player.user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'already_settled', true,
      'game_id', p_game_id,
      'winner_id', v_game.winner_id,
      'settlement_tx_id', v_game.settlement_tx_id,
      'balances', jsonb_build_object(
        'white', jsonb_build_object('user_id', v_white_player.user_id, 'skilled_coins', v_white_profile.skilled_coins),
        'black', jsonb_build_object('user_id', v_black_player.user_id, 'skilled_coins', v_black_profile.skilled_coins)
      )
    );
  END IF;
  
  -- Ensure wager was locked
  IF v_game.wager_locked_at IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wager not locked. Call lock_wager() first.',
      'game_id', p_game_id
    );
  END IF;
  
  v_wager := COALESCE(v_game.wager, 0);
  
  -- Calculate payout: 1.9x wager (winner gets back their wager + 0.9x profit)
  -- Using integer math: wager * 19 / 10
  v_payout := (v_wager * 19) / 10;
  
  -- Get player records with lock
  SELECT p.id, p.user_id, p.name INTO v_white_player 
  FROM public.players p
  WHERE p.id = v_game.white_player_id;
  
  SELECT p.id, p.user_id, p.name INTO v_black_player 
  FROM public.players p
  WHERE p.id = v_game.black_player_id;
  
  IF v_white_player.id IS NULL OR v_black_player.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Player not found',
      'game_id', p_game_id
    );
  END IF;
  
  -- Lock profiles for update
  SELECT user_id, skilled_coins INTO v_white_profile
  FROM public.profiles
  WHERE user_id = v_white_player.user_id
  FOR UPDATE;
  
  SELECT user_id, skilled_coins INTO v_black_profile
  FROM public.profiles
  WHERE user_id = v_black_player.user_id
  FOR UPDATE;
  
  -- Transfer skilled_coins based on winner
  -- Winner gets payout (1.9x wager), loser gets nothing (already lost wager when locked)
  IF p_winner_id IS NOT NULL AND v_wager > 0 THEN
    IF p_winner_id = v_white_player.id THEN
      -- White wins: white gets payout (1.9x wager)
      UPDATE public.profiles 
      SET skilled_coins = skilled_coins + v_payout 
      WHERE user_id = v_white_player.user_id;
      
      -- Record in ledger (ON CONFLICT DO NOTHING makes it idempotent)
      INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
      VALUES (v_white_player.user_id, v_white_player.id, p_game_id, v_payout, 'payout')
      ON CONFLICT (game_id, type, player_id) DO NOTHING;
      
      -- Black already lost wager when locked, no additional deduction needed
      -- But record the loss in ledger for audit
      INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
      VALUES (v_black_player.user_id, v_black_player.id, p_game_id, 0, 'payout')
      ON CONFLICT (game_id, type, player_id) DO NOTHING;
      
    ELSIF p_winner_id = v_black_player.id THEN
      -- Black wins: black gets payout (1.9x wager)
      UPDATE public.profiles 
      SET skilled_coins = skilled_coins + v_payout 
      WHERE user_id = v_black_player.user_id;
      
      INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
      VALUES (v_black_player.user_id, v_black_player.id, p_game_id, v_payout, 'payout')
      ON CONFLICT (game_id, type, player_id) DO NOTHING;
      
      -- White already lost wager when locked, no additional deduction needed
      INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
      VALUES (v_white_player.user_id, v_white_player.id, p_game_id, 0, 'payout')
      ON CONFLICT (game_id, type, player_id) DO NOTHING;
    END IF;
  END IF;
  -- Draw: no additional transfer (both already lost wager when locked)
  
  -- Update game status
  UPDATE public.games
  SET 
    status = 'finished',
    winner_id = p_winner_id,
    settled_at = now(),
    settlement_tx_id = v_settlement_tx_id,
    updated_at = now()
  WHERE id = p_game_id;
  
  -- Get updated balances
  SELECT skilled_coins INTO v_white_profile.skilled_coins FROM public.profiles WHERE user_id = v_white_player.user_id;
  SELECT skilled_coins INTO v_black_profile.skilled_coins FROM public.profiles WHERE user_id = v_black_player.user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'already_settled', false,
    'game_id', p_game_id,
    'winner_id', p_winner_id,
    'reason', p_reason,
    'wager', v_wager,
    'payout', v_payout,
    'settlement_tx_id', v_settlement_tx_id,
    'balances', jsonb_build_object(
      'white', jsonb_build_object('user_id', v_white_player.user_id, 'skilled_coins', v_white_profile.skilled_coins),
      'black', jsonb_build_object('user_id', v_black_player.user_id, 'skilled_coins', v_black_profile.skilled_coins)
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'game_id', p_game_id
    );
END;
$$;

-- 4. Create index for wager_locked_at
CREATE INDEX IF NOT EXISTS idx_games_wager_locked_at ON public.games(wager_locked_at) WHERE wager_locked_at IS NULL;
