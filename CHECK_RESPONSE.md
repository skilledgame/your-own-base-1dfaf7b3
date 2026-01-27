# Check Network Response

I can see your network request is correctly selecting `total_wagered_sc`. 

## Next Step: Check the Response

1. In the Network tab, click on the `profiles?select=...` request
2. Click on the **"Response"** tab (next to "Headers")
3. You should see JSON like:
   ```json
   [
     {
       "user_id": "04d39de7-6912-4569-93a8-9645cdc4f35b",
       "skilled_coins": 1000,
       "total_wagered_sc": 200,  // <-- This should show your wagered amount
       "display_name": "...",
       "email": "..."
     }
   ]
   ```

## What to Look For:

- If `total_wagered_sc` is `0` in the response → The database value is 0 (check Supabase)
- If `total_wagered_sc` has a value (e.g., 200) but UI shows 0 → Frontend issue
- If `total_wagered_sc` is missing from response → Column might not exist or RLS issue

## If Response Shows Correct Value But UI Shows 0:

The profile store might not be updating. Check browser console for:
- `[ProfileStore] Fetched profile:` logs
- Any errors related to profile store

## Quick Test:

In browser console, run:
```javascript
// Check what the profile store has
// (This assumes the store is accessible - might need to expose it)
```

Or refresh the page and watch the console logs when the profile loads.
