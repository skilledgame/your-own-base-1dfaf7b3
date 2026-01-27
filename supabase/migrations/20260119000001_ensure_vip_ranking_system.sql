-- Ensure VIP ranking system is properly set up
-- This migration is idempotent and safe to run multiple times
-- It ensures total_wagered_sc column exists and lock_wager function is updated

-- 1. Add total_wagered_sc column to profiles (safe if already exists)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_wagered_sc BIGINT NOT NULL DEFAULT 0;

-- 2. Update any existing NULL values to 0 (safety check)
UPDATE public.profiles 
SET total_wagered_sc = 0 
WHERE total_wagered_sc IS NULL;

-- 3. Make sure column is NOT NULL (in case it was added as nullable)
ALTER TABLE public.profiles 
ALTER COLUMN total_wagered_sc SET NOT NULL,
ALTER COLUMN total_wagered_sc SET DEFAULT 0;

-- 4. Create index for faster lookups (safe if already exists)
CREATE INDEX IF NOT EXISTS idx_profiles_total_wagered_sc ON public.profiles(total_wagered_sc);

-- 5. Update lock_wager function to increment total_wagered_sc for both players
-- This REPLACES any previous version of the function
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
  
  -- Increment total_wagered_sc for both players (lifetime wagered tracking)
  -- This is the key addition for VIP ranking
  UPDATE public.profiles
  SET total_wagered_sc = total_wagered_sc + v_wager
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
