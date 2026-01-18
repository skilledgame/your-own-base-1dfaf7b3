/**
 * useBalance Hook
 * 
 * Convenience hook for components to access Skilled Coins balance.
 * Uses the BalanceStore internally.
 * 
 * SINGLE CURRENCY: Returns skilled_coins only.
 * - null = unknown/loading (show skeleton)
 * - 0 = actual zero balance
 */

import { useEffect } from 'react';
import { useBalanceStore } from '@/stores/balanceStore';
import { useAuth } from '@/contexts/AuthContext';

export function useBalance() {
  const { user, isAuthenticated } = useAuth();
  const { 
    skilledCoins, 
    lastKnownSkilledCoins,
    loading, 
    error,
    fetchBalance, 
    subscribeToBalance, 
    unsubscribe,
    reset,
  } = useBalanceStore();
  
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Initial fetch
      fetchBalance(user.id);
      // Set up realtime subscription
      subscribeToBalance(user.id);
    } else if (!isAuthenticated) {
      // Not authenticated - reset store
      reset();
    }
    
    return () => {
      // Keep subscription alive across component unmounts
      // Only cleanup on sign out (handled in reset)
    };
  }, [user?.id, isAuthenticated, fetchBalance, subscribeToBalance, reset]);
  
  // Provide a refresh function for manual refetch
  const refresh = () => {
    if (user?.id) {
      fetchBalance(user.id);
    }
  };
  
  // Display value: show last known while loading, or actual value
  const displayBalance = skilledCoins ?? lastKnownSkilledCoins;
  
  return {
    // The actual balance (null if unknown)
    skilledCoins,
    // Display-safe balance (uses last known while loading)
    balance: displayBalance ?? 0,
    // Is balance unknown/loading?
    isLoading: loading && skilledCoins === null,
    // Has the balance been fetched at least once?
    isReady: skilledCoins !== null,
    // Error state
    error,
    // Manual refresh
    refresh,
  };
}
