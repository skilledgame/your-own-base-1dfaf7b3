-- Add wagers table for audit trail and individual wager tracking
-- This ensures every wager is recorded and total_wagered_sc updates correctly

-- 1. Create wagers table to track individual wagers
CREATE TABLE IF NOT EXISTS public.wagers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wager_amount BIGINT NOT NULL,
  wager_locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_wagers_user_id ON public.wagers(user_id);
CREATE INDEX IF NOT EXISTS idx_wagers_game_id ON public.wagers(game_id);
CREATE INDEX IF NOT EXISTS idx_wagers_created_at ON public.wagers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wagers_user_created ON public.wagers(user_id, created_at DESC);

-- 3. Enable RLS on wagers
ALTER TABLE public.wagers ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for wagers (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view their own wagers" ON public.wagers;
CREATE POLICY "Users can view their own wagers" 
ON public.wagers FOR SELECT 
USING (auth.uid() = user_id);

-- System can insert wagers (via lock_wager function)
DROP POLICY IF EXISTS "System can insert wagers" ON public.wagers;
CREATE POLICY "System can insert wagers" 
ON public.wagers FOR INSERT 
WITH CHECK (true); -- Allow system to insert via SECURITY DEFINER function

-- 5. Update lock_wager function to:
--    - Insert into wagers table for audit trail
--    - Increment total_wagered_sc in profiles
--    - Deduct skilled_coins from profiles
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
  
  -- Increment total_wagered_sc for both players (lifetime wagered tracking for VIP ranking)
  UPDATE public.profiles
  SET total_wagered_sc = total_wagered_sc + v_wager
  WHERE user_id IN (v_white_user_id, v_black_user_id);
  
  -- Insert wager records for audit trail (one record per player)
  INSERT INTO public.wagers (game_id, user_id, wager_amount, wager_locked_at)
  VALUES 
    (p_game_id, v_white_user_id, v_wager, now()),
    (p_game_id, v_black_user_id, v_wager, now());
  
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
    'wager_locked_at', now(),
    'white_user_id', v_white_user_id,
    'black_user_id', v_black_user_id
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

-- 6. Create a view for easy wager history queries
CREATE OR REPLACE VIEW public.user_wager_history AS
SELECT 
  w.id,
  w.game_id,
  w.user_id,
  w.wager_amount,
  w.wager_locked_at,
  w.created_at,
  g.status as game_status,
  g.winner_id,
  CASE 
    WHEN g.winner_id IS NOT NULL AND p.id = g.winner_id THEN 'won'
    WHEN g.winner_id IS NOT NULL AND p.id != g.winner_id THEN 'lost'
    WHEN g.status = 'finished' AND g.winner_id IS NULL THEN 'draw'
    ELSE 'pending'
  END as result
FROM public.wagers w
JOIN public.games g ON g.id = w.game_id
LEFT JOIN public.players p ON p.user_id = w.user_id AND p.id IN (g.white_player_id, g.black_player_id);

-- 7. Grant access to the view
GRANT SELECT ON public.user_wager_history TO authenticated;

-- 8. RLS Policy for the view
ALTER VIEW public.user_wager_history SET (security_invoker = true);
