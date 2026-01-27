
# Fix VIP Progress Bar to Track Wagered Amount

## Problem Summary
The VIP progress bar is designed to track total wagered amount (`total_wagered_sc`), but this column doesn't exist in the `profiles` table. Currently, the progress bar always shows 0 SC wagered because:

1. The `profiles` table only has: `id`, `user_id`, `display_name`, `skilled_coins`, `created_at`, `updated_at`, `email`
2. The `total_wagered_sc` column is missing
3. The `lock_wager()` RPC function subtracts wagers from `skilled_coins` but doesn't track cumulative wagered amounts

## Solution Overview
Add the `total_wagered_sc` column to the `profiles` table and update the `lock_wager()` function to increment this value each time a player wagers in a game.

---

## Implementation Steps

### Step 1: Add Database Column
Add `total_wagered_sc` column to the `profiles` table with a default of 0.

```sql
ALTER TABLE public.profiles 
ADD COLUMN total_wagered_sc INTEGER NOT NULL DEFAULT 0;
```

### Step 2: Backfill Existing Data
Calculate and populate `total_wagered_sc` for existing users based on their historical game wagers.

```sql
UPDATE public.profiles p
SET total_wagered_sc = COALESCE((
  SELECT SUM(g.wager)
  FROM public.games g
  JOIN public.players wp ON wp.id = g.white_player_id
  JOIN public.players bp ON bp.id = g.black_player_id
  WHERE g.wager_locked_at IS NOT NULL
    AND (wp.user_id = p.user_id OR bp.user_id = p.user_id)
), 0);
```

### Step 3: Update lock_wager() Function
Modify the `lock_wager()` PostgreSQL function to increment `total_wagered_sc` for both players when a wager is locked.

```sql
CREATE OR REPLACE FUNCTION public.lock_wager(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_game RECORD;
  v_white_user_id UUID;
  v_black_user_id UUID;
  v_wager INTEGER;
BEGIN
  -- (existing game lookup and validation code stays the same)
  
  -- Hold wager: subtract from both players' profiles.skilled_coins
  -- AND increment total_wagered_sc for VIP tracking
  UPDATE public.profiles
  SET 
    skilled_coins = skilled_coins - v_wager,
    total_wagered_sc = total_wagered_sc + v_wager
  WHERE user_id IN (v_white_user_id, v_black_user_id);
  
  -- (rest of function stays the same)
END;
$$;
```

### Step 4: Update Frontend Profile Store
Modify `src/stores/profileStore.ts` to fetch `total_wagered_sc` from the database instead of defaulting to 0.

```typescript
// In fetchProfile function:
const { data, error } = await supabase
  .from('profiles')
  .select('user_id, skilled_coins, total_wagered_sc, display_name, email')
  .eq('user_id', userId)
  .maybeSingle();

// And use the actual value:
set({
  profile: {
    user_id: data.user_id,
    skilled_coins: data.skilled_coins ?? 0,
    total_wagered_sc: data.total_wagered_sc ?? 0,  // Now from DB
    display_name: data.display_name,
    email: data.email,
  },
  // ...
});
```

---

## Technical Details

### Database Flow After Changes
```text
Game starts
    |
    v
lock_wager() called
    |
    +-- Subtract wager from skilled_coins (existing)
    +-- Add wager to total_wagered_sc (new)
    |
    v
VIP Progress updated in real-time
via Postgres subscription
```

### Real-time Updates
The existing real-time subscription in `profileStore.ts` will automatically pick up changes to `total_wagered_sc` since it listens to all UPDATE events on the profiles table.

### VIP Rank Calculation
The `getRankFromTotalWagered()` function in `src/lib/rankSystem.ts` is already implemented and will work correctly once `total_wagered_sc` contains real data:
- 0 - 4,999 SC = Unranked
- 5,000 - 24,999 SC = Bronze
- 25,000 - 99,999 SC = Silver
- 100,000 - 249,999 SC = Gold
- 250,000 - 999,999 SC = Platinum
- 1,000,000+ SC = Diamond

---

## Files to Modify
1. **Database Migration** - Add column and update RPC function
2. **src/stores/profileStore.ts** - Fetch `total_wagered_sc` from database

## Verification
After implementation, playing a game with a wager should:
1. Immediately update the progress bar to show the new wagered amount
2. Persist across page refreshes
3. Accumulate across multiple games
