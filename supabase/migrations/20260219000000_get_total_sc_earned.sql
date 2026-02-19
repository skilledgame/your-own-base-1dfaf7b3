-- Returns the total SC earned across the entire platform (all finished games with a winner).
-- Uses SECURITY DEFINER to bypass RLS so every user gets the full platform total.
CREATE OR REPLACE FUNCTION public.get_total_sc_earned()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(wager * 2), 0)::bigint
  FROM public.games
  WHERE status = 'finished'
    AND winner_id IS NOT NULL;
$$;

-- Allow both authenticated and anonymous users to call this
GRANT EXECUTE ON FUNCTION public.get_total_sc_earned() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_sc_earned() TO anon;
