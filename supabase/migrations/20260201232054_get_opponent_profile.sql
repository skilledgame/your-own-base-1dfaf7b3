-- Create a security definer function to get opponent profile info
-- This bypasses RLS and allows authenticated users to view public profile info
CREATE OR REPLACE FUNCTION public.get_opponent_profile(p_user_id UUID)
RETURNS TABLE (
  display_name TEXT,
  total_wagered_sc BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.display_name,
    p.total_wagered_sc
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_opponent_profile(UUID) TO authenticated;
