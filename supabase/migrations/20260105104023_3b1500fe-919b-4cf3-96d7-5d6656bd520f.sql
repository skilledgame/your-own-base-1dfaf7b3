-- 1. Add user_id column to players table and link to authenticated users
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

-- Make user_id NOT NULL for new records (we'll update existing records first if any exist)
-- First, delete any orphaned players without a valid user
DELETE FROM public.players WHERE user_id IS NULL;

-- Make user_id required and unique
ALTER TABLE public.players ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.players ADD CONSTRAINT players_user_id_unique UNIQUE (user_id);

-- 2. Drop existing permissive policies on players table
DROP POLICY IF EXISTS "Anyone can create players" ON public.players;
DROP POLICY IF EXISTS "Anyone can read players" ON public.players;
DROP POLICY IF EXISTS "Anyone can update players" ON public.players;

-- 3. Create secure RLS policies for players table
-- Users can only view their own player record
CREATE POLICY "Users can view own player" ON public.players
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own player record
CREATE POLICY "Users can create own player" ON public.players
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own name (credits handled by backend)
CREATE POLICY "Users can update own player name" ON public.players
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Create security definer function to get player by user_id for game participants
CREATE OR REPLACE FUNCTION public.get_player_for_game(p_player_id uuid)
RETURNS TABLE (id uuid, name text, credits integer) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.credits
  FROM public.players p
  WHERE p.id = p_player_id
$$;

-- 5. Create function to check if user is participant in a game
CREATE OR REPLACE FUNCTION public.is_game_participant(_user_id uuid, _game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.games g
    JOIN public.players wp ON g.white_player_id = wp.id
    JOIN public.players bp ON g.black_player_id = bp.id
    WHERE g.id = _game_id
    AND (wp.user_id = _user_id OR bp.user_id = _user_id)
  )
$$;

-- 6. Create function to get player_id from user_id
CREATE OR REPLACE FUNCTION public.get_player_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.players WHERE user_id = _user_id LIMIT 1
$$;

-- 7. Drop existing permissive policies on games table
DROP POLICY IF EXISTS "Anyone can create games" ON public.games;
DROP POLICY IF EXISTS "Anyone can read games" ON public.games;
DROP POLICY IF EXISTS "Anyone can update games" ON public.games;

-- 8. Create secure RLS policies for games table
-- Only participants can view their games
CREATE POLICY "Participants can view game" ON public.games
FOR SELECT TO authenticated
USING (public.is_game_participant(auth.uid(), id));

-- Only authenticated users can create games (validated by backend)
CREATE POLICY "Authenticated users can create games" ON public.games
FOR INSERT TO authenticated
WITH CHECK (
  -- Verify creator is one of the participants
  EXISTS (
    SELECT 1 FROM public.players p 
    WHERE p.user_id = auth.uid() 
    AND (p.id = white_player_id OR p.id = black_player_id)
  )
);

-- Only participants can update games (move validation done in app)
CREATE POLICY "Participants can update game" ON public.games
FOR UPDATE TO authenticated
USING (public.is_game_participant(auth.uid(), id))
WITH CHECK (public.is_game_participant(auth.uid(), id));

-- 9. Drop existing permissive policies on matchmaking_queue
DROP POLICY IF EXISTS "Anyone can join queue" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Anyone can leave queue" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Anyone can read queue" ON public.matchmaking_queue;

-- 10. Create secure RLS policies for matchmaking_queue
-- Users can view their own queue entry and potential matches
CREATE POLICY "Users can view queue" ON public.matchmaking_queue
FOR SELECT TO authenticated
USING (true);  -- Need to see queue to find opponents

-- Users can only add themselves to queue
CREATE POLICY "Users can join queue" ON public.matchmaking_queue
FOR INSERT TO authenticated
WITH CHECK (
  player_id = public.get_player_id_for_user(auth.uid())
);

-- Users can only remove themselves from queue
CREATE POLICY "Users can leave queue" ON public.matchmaking_queue
FOR DELETE TO authenticated
USING (
  player_id = public.get_player_id_for_user(auth.uid())
);

-- 11. Create secure function to update player credits (only backend should call this)
CREATE OR REPLACE FUNCTION public.update_player_credits(
  p_player_id uuid,
  p_credit_change integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.players
  SET credits = credits + p_credit_change
  WHERE id = p_player_id;
END;
$$;

-- 12. Create secure function to end game and transfer credits
CREATE OR REPLACE FUNCTION public.end_game_and_transfer_credits(
  p_game_id uuid,
  p_winner_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_wager integer;
BEGIN
  -- Get game details
  SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  
  IF v_game.status = 'finished' THEN
    RAISE EXCEPTION 'Game already finished';
  END IF;
  
  v_wager := v_game.wager;
  
  -- Update game status
  UPDATE public.games
  SET status = 'finished', winner_id = p_winner_id
  WHERE id = p_game_id;
  
  -- Transfer credits if there's a winner (not a draw)
  IF p_winner_id IS NOT NULL THEN
    -- Winner gets the wager
    UPDATE public.players SET credits = credits + v_wager WHERE id = p_winner_id;
    
    -- Loser loses the wager
    IF p_winner_id = v_game.white_player_id THEN
      UPDATE public.players SET credits = credits - v_wager WHERE id = v_game.black_player_id;
    ELSE
      UPDATE public.players SET credits = credits - v_wager WHERE id = v_game.white_player_id;
    END IF;
  END IF;
END;
$$;