-- Fix invite_friend_to_game: change game_id from UUID to TEXT
-- so we can pass encoded values like "roomId::lobbyCode"

DROP FUNCTION IF EXISTS public.invite_friend_to_game(UUID, UUID);

CREATE OR REPLACE FUNCTION public.invite_friend_to_game(friend_user_id UUID, game_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inviter_name TEXT;
BEGIN
  SELECT display_name INTO v_inviter_name
  FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    friend_user_id,
    'Game Invite',
    COALESCE(v_inviter_name, 'A friend') || ' invited you to play!',
    'game_invite',
    jsonb_build_object('game_id', game_id, 'inviter_id', auth.uid(), 'inviter_name', COALESCE(v_inviter_name, 'Unknown'))
  );
END;
$$;
