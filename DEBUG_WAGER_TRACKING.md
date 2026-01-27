# Debug Wager Tracking

If the frontend shows 0 wagered but Supabase has the correct data, try these steps:

## 1. Check Browser Console
Open browser DevTools (F12) and look for:
- `[ProfileStore] Fetched profile:` logs
- `[ProfileStore] Realtime update:` logs
- Any errors related to `total_wagered_sc`

## 2. Force Refresh Profile Store
Add this to browser console to manually refresh:
```javascript
// In browser console
window.location.reload()
```

Or check the profile store state:
```javascript
// Check if profile store has data (if you expose it)
// The store should have total_wagered_sc in the profile object
```

## 3. Verify Database
Run this in Supabase SQL Editor:
```sql
SELECT user_id, total_wagered_sc, skilled_coins 
FROM profiles 
WHERE user_id = 'YOUR_USER_ID_HERE';
```

## 4. Check Realtime Subscription
The profile store should subscribe to profile updates. Check browser console for:
- `[ProfileStore] Setting up realtime subscription for user:`
- `[ProfileStore] Subscription status: SUBSCRIBED`

## 5. Manual Refresh
If realtime isn't working, the profile should refresh on:
- Page load
- Tab focus (if we add that)
- Manual refresh button (if we add that)

## Common Issues:
1. **TypeScript types not updated**: Run `supabase gen types typescript` to regenerate types
2. **Realtime not enabled**: Check Supabase Dashboard → Database → Replication
3. **RLS blocking**: Make sure RLS policies allow users to read their own profiles
4. **Cache issue**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
