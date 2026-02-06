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
  // Use individual selectors to prevent infinite re-renders
  const profile = useUserDataStore(state => state.profile);
  const cachedBalance = useUserDataStore(state => state.cachedSkilledCoins);
  const loading = useUserDataStore(state => state.loading);
  const error = useUserDataStore(state => state.error);
  const refresh = useUserDataStore(state => state.refresh);
  
  // Compute derived values
  const skilledCoins = profile?.skilled_coins ?? null;
  const displayBalance = skilledCoins ?? cachedBalance;
  
  return {
    // The actual balance (null if unknown)
    skilledCoins,
    // Display-safe balance (uses cached while loading)
    balance: displayBalance ?? 0,
    // Is balance unknown/loading?
    isLoading: loading && skilledCoins === null,
    // Has the balance been fetched at least once?
    isReady: profile !== null,
    // Error state
    error,
    // Manual refresh (throttled to 30s)
    refresh,
  };
}
