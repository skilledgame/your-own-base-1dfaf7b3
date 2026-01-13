-- Create table for tracking free plays per user per game
CREATE TABLE public.free_plays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  game_slug TEXT NOT NULL,
  plays_remaining INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_slug)
);

-- Enable Row Level Security
ALTER TABLE public.free_plays ENABLE ROW LEVEL SECURITY;

-- Users can view their own free play records
CREATE POLICY "Users can view their own free plays"
ON public.free_plays
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own free play records
CREATE POLICY "Users can insert their own free plays"
ON public.free_plays
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own free plays
CREATE POLICY "Users can update their own free plays"
ON public.free_plays
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_free_plays_updated_at
BEFORE UPDATE ON public.free_plays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get or create free plays record
CREATE OR REPLACE FUNCTION public.get_or_create_free_plays(p_user_id UUID, p_game_slug TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plays_remaining INTEGER;
BEGIN
  -- Try to get existing record
  SELECT plays_remaining INTO v_plays_remaining
  FROM public.free_plays
  WHERE user_id = p_user_id AND game_slug = p_game_slug;
  
  -- If not found, create new record with 3 free plays
  IF NOT FOUND THEN
    INSERT INTO public.free_plays (user_id, game_slug, plays_remaining)
    VALUES (p_user_id, p_game_slug, 3)
    RETURNING plays_remaining INTO v_plays_remaining;
  END IF;
  
  RETURN v_plays_remaining;
END;
$$;

-- Create function to use a free play (with locking to prevent abuse)
CREATE OR REPLACE FUNCTION public.use_free_play(p_user_id UUID, p_game_slug TEXT)
RETURNS TABLE(success BOOLEAN, plays_remaining INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plays_remaining INTEGER;
BEGIN
  -- Lock the row for update to prevent concurrent usage
  SELECT fp.plays_remaining INTO v_plays_remaining
  FROM public.free_plays fp
  WHERE fp.user_id = p_user_id AND fp.game_slug = p_game_slug
  FOR UPDATE;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.free_plays (user_id, game_slug, plays_remaining)
    VALUES (p_user_id, p_game_slug, 3)
    RETURNING public.free_plays.plays_remaining INTO v_plays_remaining;
  END IF;
  
  -- Check if user has free plays remaining
  IF v_plays_remaining <= 0 THEN
    RETURN QUERY SELECT false, 0, 'No free plays remaining'::TEXT;
    RETURN;
  END IF;
  
  -- Deduct one free play
  UPDATE public.free_plays fp
  SET plays_remaining = fp.plays_remaining - 1
  WHERE fp.user_id = p_user_id AND fp.game_slug = p_game_slug
  RETURNING fp.plays_remaining INTO v_plays_remaining;
  
  RETURN QUERY SELECT true, v_plays_remaining, 'Free play used successfully'::TEXT;
END;
$$;