/**
 * useProfile Hook
 * 
 * Convenience hook for components to access profile data.
 * Uses the ProfileStore internally.
 */

import { useEffect } from 'react';
import { useProfileStore } from '@/stores/profileStore';
import { useAuth } from '@/contexts/AuthContext';

export function useProfile() {
  const { user, isAuthenticated } = useAuth();
  const { 
    profile,
    skilledCoins,
    totalWageredSc,
    displayName,
    loading, 
    error,
    fetchProfile, 
    subscribeToProfile, 
    reset,
  } = useProfileStore();
  
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Initial fetch
      fetchProfile(user.id);
      // Set up realtime subscription
      subscribeToProfile(user.id);
    } else if (!isAuthenticated) {
      // Not authenticated - reset store
      reset();
    }
    
    return () => {
      // Keep subscription alive across component unmounts
      // Only cleanup on sign out (handled in reset)
    };
  }, [user?.id, isAuthenticated, fetchProfile, subscribeToProfile, reset]);

  // Refresh profile when tab becomes visible (user comes back)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useProfile] Tab visible, refreshing profile...');
        fetchProfile(user.id);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, user?.id, fetchProfile]);
  
  // Provide a refresh function for manual refetch
  const refresh = () => {
    if (user?.id) {
      fetchProfile(user.id);
    }
  };
  
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
