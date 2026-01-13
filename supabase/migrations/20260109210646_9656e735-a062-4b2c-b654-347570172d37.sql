-- Update the games table RLS policy to allow users to see waiting lobbies they could join
-- First, drop the existing SELECT policy
DROP POLICY IF EXISTS "Participants can view game" ON public.games;

-- Create a new policy that allows:
-- 1. Participants to view their own games (any status)
-- 2. Anyone to view 'waiting' games (open lobbies)
CREATE POLICY "Users can view games" 
ON public.games 
FOR SELECT 
USING (
  is_game_participant(auth.uid(), id) 
  OR status = 'waiting'
);

-- Allow users to update their own waiting lobbies (to cancel them)
DROP POLICY IF EXISTS "Participants can update game" ON public.games;

CREATE POLICY "Participants can update game" 
ON public.games 
FOR UPDATE 
USING (is_game_participant(auth.uid(), id))
WITH CHECK (is_game_participant(auth.uid(), id));