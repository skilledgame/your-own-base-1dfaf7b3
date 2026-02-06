-- Drop existing function and recreate with new return type
DROP FUNCTION IF EXISTS public.get_weekly_leaderboard();

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard()
 RETURNS TABLE(rank bigint, player_name text, user_id uuid, total_won bigint, games_won bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH week_start AS (
    SELECT date_trunc('week', now()) AS start_date
  ),
  weekly_wins AS (
    SELECT 
      w.user_id,
      SUM((w.wager_amount * 19) / 10) AS total_won,
      COUNT(DISTINCT w.game_id) AS games_won
    FROM public.wagers w
    JOIN public.games g ON g.id = w.game_id
    JOIN public.players p ON p.id = g.winner_id AND p.user_id = w.user_id
    CROSS JOIN week_start ws
    WHERE w.wager_locked_at >= ws.start_date
      AND g.status = 'finished'
      AND g.winner_id IS NOT NULL
    GROUP BY w.user_id
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY ww.total_won DESC) AS rank,
    COALESCE(pr.display_name, 'Anonymous') AS player_name,
    ww.user_id,
    ww.total_won,
    ww.games_won
  FROM weekly_wins ww
  LEFT JOIN public.profiles pr ON pr.user_id = ww.user_id
  ORDER BY ww.total_won DESC
  LIMIT 20;
$function$;