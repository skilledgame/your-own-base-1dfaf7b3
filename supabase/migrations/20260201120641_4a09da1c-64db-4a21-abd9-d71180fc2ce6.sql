-- Create a function to get the weekly leaderboard
-- Returns top 20 players by total wagered amount since the start of the current week (Monday)
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard()
RETURNS TABLE (
  rank bigint,
  player_name text,
  user_id uuid,
  total_wagered bigint,
  games_played bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH week_start AS (
    -- Get the start of the current week (Monday 00:00:00 UTC)
    SELECT date_trunc('week', now()) AS start_date
  ),
  weekly_wagers AS (
    SELECT 
      w.user_id,
      SUM(w.wager_amount) AS total_wagered,
      COUNT(DISTINCT w.game_id) AS games_played
    FROM public.wagers w, week_start ws
    WHERE w.wager_locked_at >= ws.start_date
    GROUP BY w.user_id
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY ww.total_wagered DESC) AS rank,
    COALESCE(p.display_name, 'Anonymous') AS player_name,
    ww.user_id,
    ww.total_wagered,
    ww.games_played
  FROM weekly_wagers ww
  LEFT JOIN public.profiles p ON p.user_id = ww.user_id
  ORDER BY ww.total_wagered DESC
  LIMIT 20;
$$;