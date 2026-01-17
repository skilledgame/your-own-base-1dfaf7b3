-- PART C: Wager Settlement - Idempotent, Transaction-Safe
-- Create ledger table for audit trail of all credit movements

-- 1. Create ledger table for transaction tracking
CREATE TABLE IF NOT EXISTS public.game_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  player_id UUID NOT NULL REFERENCES public.players(id),
  game_id UUID NOT NULL REFERENCES public.games(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('wager_lock', 'payout', 'refund', 'fee')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- UNIQUE constraint prevents duplicate entries
  UNIQUE(game_id, type, player_id)
);

-- Enable RLS
ALTER TABLE public.game_ledger ENABLE ROW LEVEL SECURITY;

-- Users can view their own ledger entries
CREATE POLICY "Users can view their own ledger entries"
ON public.game_ledger
FOR SELECT
USING (user_id = auth.uid());

-- Service role only for inserts (done by RPC)
CREATE POLICY "Service role can insert ledger entries"
ON public.game_ledger
FOR INSERT
WITH CHECK (false);

-- 2. Add settlement columns to games table if not exists
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS settlement_tx_id UUID UNIQUE;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_ledger_game_id ON public.game_ledger(game_id);
CREATE INDEX IF NOT EXISTS idx_game_ledger_user_id ON public.game_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_game_ledger_player_id ON public.game_ledger(player_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_settled_at ON public.games(settled_at) WHERE settled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

-- 4. Create idempotent settlement RPC
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
  v_settlement_tx_id UUID;
  v_wager INTEGER;
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
    
    -- Get current player balances
    SELECT id, credits, user_id, name INTO v_white_player 
    FROM public.players WHERE id = v_game.white_player_id;
    
    SELECT id, credits, user_id, name INTO v_black_player 
    FROM public.players WHERE id = v_game.black_player_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'already_settled', true,
      'game_id', p_game_id,
      'winner_id', v_game.winner_id,
      'settlement_tx_id', v_game.settlement_tx_id,
      'balances', jsonb_build_object(
        'white', jsonb_build_object('player_id', v_white_player.id, 'credits', v_white_player.credits),
        'black', jsonb_build_object('player_id', v_black_player.id, 'credits', v_black_player.credits)
      )
    );
  END IF;
  
  v_wager := COALESCE(v_game.wager, 0);
  
  -- Get player records with lock
  SELECT id, credits, user_id, name INTO v_white_player 
  FROM public.players 
  WHERE id = v_game.white_player_id
  FOR UPDATE;
  
  SELECT id, credits, user_id, name INTO v_black_player 
  FROM public.players 
  WHERE id = v_game.black_player_id
  FOR UPDATE;
  
  IF v_white_player.id IS NULL OR v_black_player.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Player not found',
      'game_id', p_game_id
    );
  END IF;
  
  -- Transfer credits based on winner
  IF p_winner_id IS NOT NULL AND v_wager > 0 THEN
    IF p_winner_id = v_white_player.id THEN
      -- White wins: white +wager, black -wager
      UPDATE public.players SET credits = credits + v_wager WHERE id = v_white_player.id;
      UPDATE public.players SET credits = credits - v_wager WHERE id = v_black_player.id;
      
      -- Record in ledger (ON CONFLICT DO NOTHING makes it idempotent)
      INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
      VALUES (v_white_player.user_id, v_white_player.id, p_game_id, v_wager, 'payout')
      ON CONFLICT (game_id, type, player_id) DO NOTHING;
      
      INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
      VALUES (v_black_player.user_id, v_black_player.id, p_game_id, -v_wager, 'payout')
      ON CONFLICT (game_id, type, player_id) DO NOTHING;
      
    ELSIF p_winner_id = v_black_player.id THEN
      -- Black wins: black +wager, white -wager
      UPDATE public.players SET credits = credits + v_wager WHERE id = v_black_player.id;
      UPDATE public.players SET credits = credits - v_wager WHERE id = v_white_player.id;
      
      INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
      VALUES (v_black_player.user_id, v_black_player.id, p_game_id, v_wager, 'payout')
      ON CONFLICT (game_id, type, player_id) DO NOTHING;
      
      INSERT INTO public.game_ledger (user_id, player_id, game_id, amount, type)
      VALUES (v_white_player.user_id, v_white_player.id, p_game_id, -v_wager, 'payout')
      ON CONFLICT (game_id, type, player_id) DO NOTHING;
    END IF;
  END IF;
  -- Draw: no credit transfer
  
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
  SELECT credits INTO v_white_player.credits FROM public.players WHERE id = v_white_player.id;
  SELECT credits INTO v_black_player.credits FROM public.players WHERE id = v_black_player.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'already_settled', false,
    'game_id', p_game_id,
    'winner_id', p_winner_id,
    'reason', p_reason,
    'wager', v_wager,
    'settlement_tx_id', v_settlement_tx_id,
    'balances', jsonb_build_object(
      'white', jsonb_build_object('player_id', v_white_player.id, 'credits', v_white_player.credits),
      'black', jsonb_build_object('player_id', v_black_player.id, 'credits', v_black_player.credits)
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