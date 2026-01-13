-- Fix security definer view issue by dropping it and using a function instead
DROP VIEW IF EXISTS public.safe_player_info;

-- Create a security definer function to get limited player info for games
-- This is safer than a view as it's explicitly security definer with proper search_path
CREATE OR REPLACE FUNCTION public.get_opponent_name(p_player_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.players WHERE id = p_player_id LIMIT 1
$$;