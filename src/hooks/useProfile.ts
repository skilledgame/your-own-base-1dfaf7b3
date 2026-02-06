/**
 * useProfile Hook
 * 
 * Convenience hook for components to access profile data.
 * Now uses the centralized UserDataStore for single source of truth.
 * 
 * NOTE: This hook no longer triggers fetches - data is initialized
 * in App.tsx via userDataStore. This prevents duplicate fetches.
 */

import { useUserDataStore } from '@/stores/userDataStore';

export function useProfile() {
  const store = useUserDataStore();
  
  // Get values from centralized store
  const profile = store.profile;
  const loading = store.loading;
  const error = store.error;
  
  // Derived values
  const skilledCoins = profile?.skilled_coins ?? 0;
  const totalWageredSc = profile?.total_wagered_sc ?? 0;
  const displayName = profile?.display_name ?? null;
  
  // Throttled refresh (min 30s between calls)
  const refresh = store.refresh;
  
  return {
    profile,
    skilledCoins,
    totalWageredSc,
    displayName,
    isLoading: loading && profile === null,
    isReady: profile !== null,
    error,
    refresh,
  };
}
