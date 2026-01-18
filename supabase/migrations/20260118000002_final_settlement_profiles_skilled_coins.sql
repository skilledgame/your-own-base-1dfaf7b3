-- FINAL SETTLEMENT FIX: Use profiles.skilled_coins ONLY
-- This migration ensures ALL wager logic modifies profiles.skilled_coins only
-- Removes dependency on players.credits completely

-- 0. Ensure extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Ensure games table has required columns
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS wager_locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS settlement_id UUID UNIQUE;

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_wager_locked_at ON public.games(wager_locked_at) WHERE wager_locked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- 3. RPC: lock_wager - Hold wager on game start (deduct from both players)
CREATE OR REPLACE FUNCTION public.lock_wager(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game RECORD;
  v_white_user_id UUID;
  v_black_user_id UUID;
  v_wager INTEGER;
BEGIN
  -- Lock the game row for update (prevents concurrent locking)
  SELECT g.*, 
         pw.user_id as white_user_id,
         pb.user_id as black_user_id
  INTO v_game
  FROM public.games g
  JOIN public.players pw ON pw.id = g.white_player_id
  JOIN public.players pb ON pb.id = g.black_player_id
  WHERE g.id = p_game_id
  FOR UPDATE OF g;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Game not found',
      'game_id', p_game_id
    );
  END IF;
  
  -- Check if already locked (idempotent)
  IF v_game.wager_locked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_locked', true,
      'game_id', p_game_id,
      'wager_locked_at', v_game.wager_locked_at
    );
  END IF;
  
  -- Ensure game is in 'created' status
  IF v_game.status NOT IN ('created', 'active') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Game status does not allow wager locking',
      'game_id', p_game_id,
      'current_status', v_game.status
    );
  END IF;
  
  v_wager := COALESCE(v_game.wager, 0);
  v_white_user_id := v_game.white_user_id;
  v_black_user_id := v_game.black_user_id;
  
  IF v_wager <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid wager amount',
      'game_id', p_game_id,
      'wager', v_wager
    );
  END IF;
  
  -- Check if both players have sufficient skilled_coins
  IF (SELECT skilled_coins FROM public.profiles WHERE user_id = v_white_user_id) < v_wager THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient skilled_coins',
      'game_id', p_game_id,
      'player', 'white',
      'required', v_wager,
      'available', (SELECT skilled_coins FROM public.profiles WHERE user_id = v_white_user_id)
    );
  END IF;
  
  IF (SELECT skilled_coins FROM public.profiles WHERE user_id = v_black_user_id) < v_wager THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient skilled_coins',
      'game_id', p_game_id,
      'player', 'black',
      'required', v_wager,
      'available', (SELECT skilled_coins FROM public.profiles WHERE user_id = v_black_user_id)
    );
  END IF;
  
  -- Hold wager: subtract from both players' profiles.skilled_coins
  UPDATE public.profiles
  SET skilled_coins = skilled_coins - v_wager
  WHERE user_id IN (v_white_user_id, v_black_user_id);
  
  -- Update game status
  UPDATE public.games
  SET 
    wager_locked_at = now(),
    status = CASE WHEN status = 'created' THEN 'active' ELSE status END,
    updated_at = now()
  WHERE id = p_game_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'already_locked', false,
    'game_id', p_game_id,
    'wager', v_wager,
    'wager_locked_at', now()
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

-- 4. RPC: settle_match - Settle match on game end (pay winner 1.9x wager)
CREATE OR REPLACE FUNCTION public.settle_match(
  p_game_id UUID,
  p_winner_user_id UUID  -- user_id of winner, NULL for draw
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game RECORD;
  v_white_user_id UUID;
  v_black_user_id UUID;
  v_wager INTEGER;
  v_payout INTEGER;  -- 1.9x wager = wager * 19 / 10
BEGIN
  -- Lock the game row for update (prevents concurrent settlement)
  SELECT g.*,
         pw.user_id as white_user_id,
         pb.user_id as black_user_id
  INTO v_game
  FROM public.games g
  JOIN public.players pw ON pw.id = g.white_player_id
  JOIN public.players pb ON pb.id = g.black_player_id
  WHERE g.id = p_game_id
  FOR UPDATE OF g;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Game not found',
      'game_id', p_game_id
    );
  END IF;
  
  -- Check if already settled (idempotent)
  IF v_game.settled_at IS NOT NULL OR v_game.settlement_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_settled', true,
      'game_id', p_game_id,
      'winner_user_id', v_game.winner_id
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
  v_white_user_id := v_game.white_user_id;
  v_black_user_id := v_game.black_user_id;
  
  -- Calculate payout: 1.9x wager (winner gets back their wager + 0.9x profit)
  -- Using integer math: wager * 19 / 10
  v_payout := (v_wager * 19) / 10;
  
  -- Pay winner (loser already lost wager when locked)
  IF p_winner_user_id IS NOT NULL AND v_wager > 0 THEN
    -- Validate winner is one of the two players
    IF p_winner_user_id NOT IN (v_white_user_id, v_black_user_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Winner user_id does not match game participants',
        'game_id', p_game_id,
        'winner_user_id', p_winner_user_id
      );
    END IF;
    
    -- Pay winner: add payout to winner's profiles.skilled_coins
    UPDATE public.profiles
    SET skilled_coins = skilled_coins + v_payout
    WHERE user_id = p_winner_user_id;
  END IF;
  -- Draw: no payout (both already lost wager when locked)
  
  -- Update game status
  UPDATE public.games
  SET 
    status = 'finished',
    winner_id = (SELECT id FROM public.players WHERE user_id = p_winner_user_id LIMIT 1),
    settled_at = now(),
    settlement_id = gen_random_uuid(),
    updated_at = now()
  WHERE id = p_game_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'already_settled', false,
    'game_id', p_game_id,
    'winner_user_id', p_winner_user_id,
    'wager', v_wager,
    'payout', v_payout,
    'settlement_id', (SELECT settlement_id FROM public.games WHERE id = p_game_id)
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
