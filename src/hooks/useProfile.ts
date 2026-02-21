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
  // Use individual selectors to prevent infinite re-renders
  const profile = useUserDataStore(state => state.profile);
  const loading = useUserDataStore(state => state.loading);
  const error = useUserDataStore(state => state.error);
  const refresh = useUserDataStore(state => state.refresh);
  
  // Compute derived values
  const skilledCoins = profile?.skilled_coins ?? 0;
  const totalWageredSc = profile?.total_wagered_sc ?? 0;
  const displayName = profile?.display_name ?? null;
  const chessElo = profile?.chess_elo ?? 800;
  const dailyPlayStreak = profile?.daily_play_streak ?? 0;
  const skinColor = profile?.skin_color ?? 'normal';
  const skinIcon = profile?.skin_icon ?? 'default';
  
  return {
    profile,
    skilledCoins,
    totalWageredSc,
    displayName,
    chessElo,
    dailyPlayStreak,
    skinColor,
    skinIcon,
    isLoading: loading && profile === null,
    isReady: profile !== null,
    error,
    refresh,
  };
}
