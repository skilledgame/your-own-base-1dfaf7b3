-- Allow authenticated users to view public profile information (display_name, total_wagered_sc)
-- for other users. This is needed for displaying opponent names and ranks in games.
CREATE POLICY "Users can view public profile info" 
ON public.profiles FOR SELECT 
TO authenticated
USING (true);
