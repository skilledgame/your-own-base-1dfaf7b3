-- Delete all games (they reference players that will be deleted)
DELETE FROM public.games;

-- Delete all matchmaking queue entries
DELETE FROM public.matchmaking_queue;

-- Delete all free plays except for your account
DELETE FROM public.free_plays WHERE user_id != 'a0ca033b-bba6-45ec-9238-8b0592c884ff';

-- Delete all players except your account
DELETE FROM public.players WHERE user_id != 'a0ca033b-bba6-45ec-9238-8b0592c884ff';

-- Delete all profiles except your account (if any exist)
DELETE FROM public.profiles WHERE user_id != 'a0ca033b-bba6-45ec-9238-8b0592c884ff';

-- Delete all user roles except for your account
DELETE FROM public.user_roles WHERE user_id != 'a0ca033b-bba6-45ec-9238-8b0592c884ff';

-- Reset your player credits to 1000 for a fresh start
UPDATE public.players SET credits = 1000 WHERE user_id = 'a0ca033b-bba6-45ec-9238-8b0592c884ff';