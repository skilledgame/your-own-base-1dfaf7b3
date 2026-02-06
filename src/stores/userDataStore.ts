/**
 * Centralized User Data Store
 * 
 * SINGLE SOURCE OF TRUTH for all user-related data during a session.
 * Combines profile and balance management to prevent duplicate fetches.
 * 
 * KEY PRINCIPLES:
 * 1. One fetch per session/user change - not per component mount
 * 2. Components READ from store, never fetch directly
 * 3. Realtime subscription handles live updates
 * 4. Throttled refresh (min 30s between fetches)
 * 5. Optimistic updates via applyBalanceDelta()
 * 
 * Replaces: useBalance + useProfile hooks for most use cases
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { trackQuery } from '@/lib/supabaseInstrumentation';

// LocalStorage key for persisting last known balance
const STORAGE_KEY = 'user_data_cache';

export interface UserProfile {
  user_id: string;
  skilled_coins: number;
  total_wagered_sc: number;
  display_name: string | null;
  email: string | null;
}

interface CachedUserData {
  userId: string;
  skilledCoins: number;
  timestamp: number;
}

// Helpers for localStorage persistence
function getCachedData(): CachedUserData | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached) as CachedUserData;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function setCachedData(data: CachedUserData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

function clearCachedData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

interface UserDataStore {
  // State
  userId: string | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  lastFetchTime: number | null;
  
  // Cached values for display during loading
  cachedSkilledCoins: number | null;
  
  // Subscription
  subscription: RealtimeChannel | null;
  
  // Computed getters (for convenience)
  skilledCoins: number | null;
  totalWageredSc: number;
  displayName: string | null;
  
  // Actions
  initialize: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
  applyBalanceDelta: (delta: number) => void;
  setBalance: (balance: number) => void;
  reset: () => void;
  
  // Internal
  _setupSubscription: (userId: string) => void;
  _minRefreshInterval: number;
}

// Minimum time between refreshes (30 seconds)
const MIN_REFRESH_INTERVAL = 30000;

export const useUserDataStore = create<UserDataStore>((set, get) => {
  // Load cached data on store creation
  const cached = getCachedData();
  
  return {
    userId: null,
    profile: null,
    loading: false,
    error: null,
    lastFetchTime: null,
    cachedSkilledCoins: cached?.skilledCoins ?? null,
    subscription: null,
    _minRefreshInterval: MIN_REFRESH_INTERVAL,
    
    // Computed getters
    get skilledCoins() {
      const state = get();
      return state.profile?.skilled_coins ?? state.cachedSkilledCoins ?? null;
    },
    
    get totalWageredSc() {
      return get().profile?.total_wagered_sc ?? 0;
    },
    
    get displayName() {
      return get().profile?.display_name ?? null;
    },
    
    initialize: async (userId: string) => {
      const state = get();
      
      // If already initialized for this user and data is fresh (< 5s), skip
      if (state.userId === userId && 
          state.profile !== null && 
          state.lastFetchTime && 
          Date.now() - state.lastFetchTime < 5000) {
        console.log('[UserDataStore] Skipping initialize - data is fresh');
        return;
      }
      
      // If different user, reset first
      if (state.userId && state.userId !== userId) {
        console.log('[UserDataStore] User changed, resetting');
        get().reset();
      }
      
      set({ userId, loading: true, error: null });
      
      try {
        trackQuery('profiles', 'select');
        
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, skilled_coins, total_wagered_sc, display_name, email')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) {
          console.error('[UserDataStore] Fetch error:', error);
          set({ loading: false, error: error.message });
          return;
        }
        
        if (data) {
          const profile: UserProfile = {
            user_id: data.user_id,
            skilled_coins: data.skilled_coins ?? 0,
            total_wagered_sc: data.total_wagered_sc ?? 0,
            display_name: data.display_name,
            email: data.email,
          };
          
          // Cache for next session
          setCachedData({
            userId,
            skilledCoins: profile.skilled_coins,
            timestamp: Date.now(),
          });
          
          set({
            profile,
            cachedSkilledCoins: profile.skilled_coins,
            loading: false,
            lastFetchTime: Date.now(),
          });
          
          // Set up realtime subscription
          get()._setupSubscription(userId);
          
          console.log('[UserDataStore] Initialized:', { 
            skilled_coins: profile.skilled_coins, 
            total_wagered_sc: profile.total_wagered_sc 
          });
        } else {
          // No profile found - might need to be created by ensure-user
          console.log('[UserDataStore] No profile found for user');
          set({ loading: false });
        }
      } catch (error) {
        console.error('[UserDataStore] Unexpected error:', error);
        set({ loading: false, error: 'Failed to load user data' });
      }
    },
    
    refresh: async () => {
      const state = get();
      
      if (!state.userId) {
        console.log('[UserDataStore] Cannot refresh - no userId');
        return;
      }
      
      // Throttle refreshes
      if (state.lastFetchTime && Date.now() - state.lastFetchTime < state._minRefreshInterval) {
        console.log('[UserDataStore] Refresh throttled - too soon');
        return;
      }
      
      set({ loading: true, error: null });
      
      try {
        trackQuery('profiles', 'select');
        
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, skilled_coins, total_wagered_sc, display_name, email')
          .eq('user_id', state.userId)
          .maybeSingle();
        
        if (error) {
          console.error('[UserDataStore] Refresh error:', error);
          set({ loading: false, error: error.message });
          return;
        }
        
        if (data) {
          const profile: UserProfile = {
            user_id: data.user_id,
            skilled_coins: data.skilled_coins ?? 0,
            total_wagered_sc: data.total_wagered_sc ?? 0,
            display_name: data.display_name,
            email: data.email,
          };
          
          setCachedData({
            userId: state.userId,
            skilledCoins: profile.skilled_coins,
            timestamp: Date.now(),
          });
          
          set({
            profile,
            cachedSkilledCoins: profile.skilled_coins,
            loading: false,
            lastFetchTime: Date.now(),
          });
        }
      } catch (error) {
        console.error('[UserDataStore] Refresh error:', error);
        set({ loading: false, error: 'Failed to refresh' });
      }
    },
    
    applyBalanceDelta: (delta: number) => {
      const state = get();
      if (!state.profile) return;
      
      const newBalance = Math.max(0, state.profile.skilled_coins + delta);
      
      console.log('[UserDataStore] Applying balance delta:', { delta, newBalance });
      
      set({
        profile: {
          ...state.profile,
          skilled_coins: newBalance,
        },
        cachedSkilledCoins: newBalance,
      });
      
      // Update cache
      if (state.userId) {
        setCachedData({
          userId: state.userId,
          skilledCoins: newBalance,
          timestamp: Date.now(),
        });
      }
    },
    
    setBalance: (balance: number) => {
      const state = get();
      if (!state.profile) return;
      
      // Guard: only update if value actually changed
      if (state.profile.skilled_coins === balance) {
        return;
      }
      
      console.log('[UserDataStore] Setting balance:', balance);
      
      set({
        profile: {
          ...state.profile,
          skilled_coins: balance,
        },
        cachedSkilledCoins: balance,
      });
      
      if (state.userId) {
        setCachedData({
          userId: state.userId,
          skilledCoins: balance,
          timestamp: Date.now(),
        });
      }
    },
    
    _setupSubscription: (userId: string) => {
      const state = get();
      
      // Already subscribed
      if (state.subscription) {
        return;
      }
      
      console.log('[UserDataStore] Setting up realtime subscription');
      
      const channel = supabase
        .channel(`user-data-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newData = payload.new as Partial<UserProfile>;
            const currentProfile = get().profile;
            
            if (!currentProfile) return;
            
            console.log('[UserDataStore] Realtime update:', newData);
            
            const updatedProfile = {
              ...currentProfile,
              skilled_coins: newData.skilled_coins ?? currentProfile.skilled_coins,
              total_wagered_sc: newData.total_wagered_sc ?? currentProfile.total_wagered_sc,
              display_name: newData.display_name ?? currentProfile.display_name,
              email: newData.email ?? currentProfile.email,
            };
            
            // Update cache
            const currentUserId = get().userId;
            if (currentUserId) {
              setCachedData({
                userId: currentUserId,
                skilledCoins: updatedProfile.skilled_coins,
                timestamp: Date.now(),
              });
            }
            
            set({
              profile: updatedProfile,
              cachedSkilledCoins: updatedProfile.skilled_coins,
              lastFetchTime: Date.now(),
            });
          }
        )
        .subscribe();
      
      set({ subscription: channel });
    },
    
    reset: () => {
      const state = get();
      
      // Cleanup subscription
      if (state.subscription) {
        supabase.removeChannel(state.subscription);
      }
      
      clearCachedData();
      
      set({
        userId: null,
        profile: null,
        loading: false,
        error: null,
        lastFetchTime: null,
        cachedSkilledCoins: null,
        subscription: null,
      });
      
      console.log('[UserDataStore] Reset complete');
    },
  };
});

/**
 * Hook for components to read user data
 * This is a convenience wrapper - components should use this instead of direct store access
 */
export function useUserData() {
  const store = useUserDataStore();
  
  return {
    // Balance
    skilledCoins: store.skilledCoins,
    balance: store.skilledCoins ?? 0,
    
    // Profile
    totalWageredSc: store.totalWageredSc,
    displayName: store.displayName,
    profile: store.profile,
    
    // Loading states
    isLoading: store.loading,
    isReady: store.profile !== null,
    error: store.error,
    
    // Actions
    refresh: store.refresh,
    applyBalanceDelta: store.applyBalanceDelta,
  };
}
