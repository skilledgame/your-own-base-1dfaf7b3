/**
 * useBalance Hook
 * 
 * Convenience hook for components to access balance with auto-subscription.
 * Uses the BalanceStore internally.
 */

import { useEffect } from 'react';
import { useBalanceStore } from '@/stores/balanceStore';
import { useAuth } from '@/contexts/AuthContext';

export function useBalance() {
  const { user, isAuthenticated } = useAuth();
  const { balance, loading, fetchBalance, subscribeToBalance, unsubscribe } = useBalanceStore();
  
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Initial fetch
      fetchBalance(user.id);
      // Set up realtime subscription
      subscribeToBalance(user.id);
    } else {
      // Not authenticated - cleanup
      unsubscribe();
    }
    
    return () => {
      // Keep subscription alive across component unmounts
      // Only cleanup on sign out (handled in reset)
    };
  }, [user?.id, isAuthenticated, fetchBalance, subscribeToBalance, unsubscribe]);
  
  // Provide a refresh function for manual refetch
  const refresh = () => {
    if (user?.id) {
      fetchBalance(user.id);
    }
  };
  
  return {
    balance,
    loading,
    refresh,
  };
}
