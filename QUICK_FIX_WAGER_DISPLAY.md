# Quick Fix: Wager Display Showing 0

If Supabase has the correct `total_wagered_sc` but the frontend shows 0, try these steps:

## Step 1: Hard Refresh Browser
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

This clears any cached data.

## Step 2: Check Browser Console
Open DevTools (F12) → Console tab, and look for:
```
[ProfileStore] Fetched profile: { skilled_coins: X, total_wagered_sc: Y, user_id: ... }
```

If you see `total_wagered_sc: 0` but Supabase shows a different value, the issue is in the fetch.

## Step 3: Verify Database Value
Run this in Supabase SQL Editor:
```sql
SELECT user_id, total_wagered_sc, skilled_coins 
FROM profiles 
WHERE user_id = 'YOUR_USER_ID';
```

Replace `YOUR_USER_ID` with your actual user ID (from browser console or auth).

## Step 4: Force Profile Refresh
In browser console, run:
```javascript
// This will trigger a manual refresh
window.location.reload();
```

## Step 5: Check Realtime Subscription
In browser console, look for:
```
[ProfileStore] Setting up realtime subscription for user: ...
[ProfileStore] Subscription status: SUBSCRIBED
```

If you see `SUBSCRIBED`, realtime is working. If not, there might be a Supabase Realtime configuration issue.

## Step 6: Manual Test Query
If still not working, the profile store might not be initialized. Check if `useProfile` hook is being called in the components.

## Common Issues:

1. **TypeScript types outdated**: The `total_wagered_sc` column might not be in the generated types. Run:
   ```bash
   supabase gen types typescript --local > src/integrations/supabase/types.ts
   ```
   Or regenerate in Supabase Dashboard → Settings → API → Generate TypeScript types

2. **RLS blocking**: Make sure you can read your own profile:
   ```sql
   -- This should already be set, but verify:
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

3. **Realtime not enabled**: In Supabase Dashboard → Database → Replication, make sure `profiles` table has replication enabled.

## If Still Not Working:

The profile store should automatically fetch on page load. If it's still showing 0:
1. Check browser console for errors
2. Verify the profile store is being used (not a local state)
3. Try logging the profile store state:
   ```javascript
   // In browser console (if you expose the store)
   // Check what the store actually has
   ```
