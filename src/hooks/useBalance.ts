/**
 * useBalance Hook
 * 
 * Convenience hook for components to access Skilled Coins balance.
 * Now uses the centralized UserDataStore for single source of truth.
 * 
 * SINGLE CURRENCY: Returns skilled_coins only.
 * - null = unknown/loading (show skeleton)
 * - 0 = actual zero balance
 * 
 * NOTE: This hook no longer triggers fetches - data is initialized
 * in App.tsx via userDataStore. This prevents duplicate fetches.
 */

import { useUserDataStore } from '@/stores/userDataStore';

export function useBalance() {
  const store = useUserDataStore();
  
  // Get values from centralized store
  const skilledCoins = store.profile?.skilled_coins ?? null;
  const cachedBalance = store.cachedSkilledCoins;
  const loading = store.loading;
  const error = store.error;
  
  // Display value: show cached while loading, or actual value
  const displayBalance = skilledCoins ?? cachedBalance;
  
  // Throttled refresh (min 30s between calls)
  const refresh = store.refresh;
  
  return {
    // The actual balance (null if unknown)
    skilledCoins,
    // Display-safe balance (uses cached while loading)
    balance: displayBalance ?? 0,
    // Is balance unknown/loading?
    isLoading: loading && skilledCoins === null,
    // Has the balance been fetched at least once?
    isReady: store.profile !== null,
    // Error state
    error,
    // Manual refresh (throttled to 30s)
    refresh,
  };
}
