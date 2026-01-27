-- ============================================
-- COMPLETE WAGER TRACKING SETUP
-- Run this in Supabase SQL Editor if migrations haven't been applied
-- ============================================

-- Step 1: Ensure total_wagered_sc column exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_wagered_sc BIGINT NOT NULL DEFAULT 0;

UPDATE public.profiles 
SET total_wagered_sc = 0 
WHERE total_wagered_sc IS NULL;

ALTER TABLE public.profiles 
ALTER COLUMN total_wagered_sc SET NOT NULL,
ALTER COLUMN total_wagered_sc SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_total_wagered_sc ON public.profiles(total_wagered_sc);

-- Step 2: Create wagers table for audit trail
CREATE TABLE IF NOT EXISTS public.wagers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wager_amount BIGINT NOT NULL,
  wager_locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wagers_user_id ON public.wagers(user_id);
CREATE INDEX IF NOT EXISTS idx_wagers_game_id ON public.wagers(game_id);
CREATE INDEX IF NOT EXISTS idx_wagers_created_at ON public.wagers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wagers_user_created ON public.wagers(user_id, created_at DESC);

ALTER TABLE public.wagers ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own wagers" 
ON public.wagers FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "System can insert wagers" 
ON public.wagers FOR INSERT 
WITH CHECK (true);

-- Step 3: Update lock_wager function with complete tracking
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
  
  -- ✅ INCREMENT total_wagered_sc for both players (VIP ranking tracking)
  UPDATE public.profiles
  SET total_wagered_sc = total_wagered_sc + v_wager
  WHERE user_id IN (v_white_user_id, v_black_user_id);
  
  -- ✅ INSERT wager records for audit trail (one per player)
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

-- Step 4: Create view for easy wager history
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

GRANT SELECT ON public.user_wager_history TO authenticated;

-- ============================================
-- VERIFICATION QUERIES (run these to test)
-- ============================================

-- Check if total_wagered_sc column exists:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'total_wagered_sc';

-- Check if wagers table exists:
-- SELECT * FROM information_schema.tables WHERE table_name = 'wagers';

-- View your wager history (replace YOUR_USER_ID):
-- SELECT * FROM user_wager_history WHERE user_id = 'YOUR_USER_ID' ORDER BY created_at DESC LIMIT 10;

-- Check your total wagered:
-- SELECT user_id, total_wagered_sc FROM profiles WHERE user_id = 'YOUR_USER_ID';
