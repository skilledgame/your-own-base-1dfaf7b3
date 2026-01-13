-- Add game_type column to matchmaking_queue for future game expansion
ALTER TABLE public.matchmaking_queue 
ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'chess';

-- Add game_type column to games table
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'chess';

-- Add index for faster matchmaking queries (game_type + wager)
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_game_wager 
ON public.matchmaking_queue(game_type, wager, created_at);

-- Add index for active games lookup
CREATE INDEX IF NOT EXISTS idx_games_status 
ON public.games(status) WHERE status = 'active';

-- Set REPLICA IDENTITY FULL for proper realtime updates
ALTER TABLE public.matchmaking_queue REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;

-- Drop the old restrictive policy and add one that allows viewing queue
DROP POLICY IF EXISTS "Users can view own queue entry" ON public.matchmaking_queue;

CREATE POLICY "Users can view queue for matchmaking"
ON public.matchmaking_queue
FOR SELECT
USING (true);

-- Create function to clean stale queue entries (older than 5 minutes)
CREATE OR REPLACE FUNCTION public.clean_stale_queue_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.matchmaking_queue
  WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$;