-- 1. Drop existing queue policies
DROP POLICY IF EXISTS "Users can view queue" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Users can join queue" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Users can leave queue" ON public.matchmaking_queue;

-- 2. Create restrictive policies - queue operations only via backend
-- Users can only see their own queue entry (for status checking)
CREATE POLICY "Users can view own queue entry" ON public.matchmaking_queue
FOR SELECT TO authenticated
USING (
  player_id = public.get_player_id_for_user(auth.uid())
);

-- No direct INSERT/DELETE from client - all through backend with service role
-- These policies are intentionally restrictive

-- 3. Update games policy - remove client-side game creation
DROP POLICY IF EXISTS "Authenticated users can create games" ON public.games;

-- Only allow viewing games you're a participant in (already exists)
-- Game creation happens via service role in join-queue function

-- 4. Create a view for safe opponent info (name only, no credits)
CREATE OR REPLACE VIEW public.safe_player_info AS
SELECT id, name FROM public.players;

-- 5. Grant access to the view
GRANT SELECT ON public.safe_player_info TO authenticated;

-- 6. Enable leaked password protection via auth config
-- Note: This requires updating auth settings via the configure-auth tool or dashboard