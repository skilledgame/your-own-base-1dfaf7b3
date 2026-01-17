-- Sync profiles.skilled_coins FROM players.credits (players is source of truth)
UPDATE profiles p
SET skilled_coins = pl.credits
FROM players pl
WHERE p.user_id = pl.user_id
AND pl.credits IS NOT NULL
AND p.skilled_coins != pl.credits;

-- Also sync any players that might be missing credits from profiles
UPDATE players pl
SET credits = p.skilled_coins
FROM profiles p
WHERE pl.user_id = p.user_id
AND p.skilled_coins > pl.credits;