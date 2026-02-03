-- Create a security definer function to get display_name from profiles for a player_id
-- This bypasses RLS and allows getting profile display_name from games.winner_id (player_id)
CREATE OR REPLACE FUNCTION public.get_display_name_from_player_id(p_player_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.display_name
  FROM public.profiles p
  INNER JOIN public.players pl ON p.user_id = pl.user_id
  WHERE pl.id = p_player_id
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_display_name_from_player_id(UUID) TO authenticated;
