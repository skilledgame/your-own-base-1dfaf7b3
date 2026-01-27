-- Step 1: Add total_wagered_sc column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN total_wagered_sc INTEGER NOT NULL DEFAULT 0;

-- Step 2: Backfill existing data from historical games
UPDATE public.profiles p
SET total_wagered_sc = COALESCE((
  SELECT SUM(g.wager)
  FROM public.games g
  JOIN public.players wp ON wp.id = g.white_player_id
  JOIN public.players bp ON bp.id = g.black_player_id
  WHERE g.wager_locked_at IS NOT NULL
    AND (wp.user_id = p.user_id OR bp.user_id = p.user_id)
), 0);

-- Step 3: Update lock_wager() function to track total_wagered_sc
CREATE OR REPLACE FUNCTION public.lock_wager(p_game_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- AND increment total_wagered_sc for VIP tracking
  UPDATE public.profiles
  SET 
    skilled_coins = skilled_coins - v_wager,
    total_wagered_sc = total_wagered_sc + v_wager
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
$function$;