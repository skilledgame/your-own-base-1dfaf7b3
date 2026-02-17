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
import { useBalanceStore } from '@/stores/balanceStore';

// LocalStorage key for persisting last known balance
const STORAGE_KEY = 'user_data_cache';

export interface UserProfile {
  user_id: string;
  skilled_coins: number;
  total_wagered_sc: number;
  display_name: string | null;
  email: string | null;
  chess_elo: number;
  daily_play_streak: number;
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
  
  // Dedup: track which gameIds have already been synced
  _syncedGameIds: Set<string>;
  
  // Actions
  initialize: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
  applyBalanceDelta: (delta: number) => void;
  setBalance: (balance: number) => void;
  syncBalanceAfterGame: (params: { gameId: string; creditsChange: number; reason: string }) => void;
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
    _syncedGameIds: new Set<string>(),
    _minRefreshInterval: MIN_REFRESH_INTERVAL,
    
    initialize: async (userId: string) => {
      const state = get();
      
      // If already initialized for this user and data is fresh (< 5s), skip
      if (state.userId === userId && 
          state.profile !== null && 
          state.lastFetchTime && 
          Date.now() - state.lastFetchTime < 5000) {
        return;
      }
      
      // If different user, reset first
      if (state.userId && state.userId !== userId) {
        get().reset();
      }
      
      set({ userId, loading: true, error: null });
      
      try {

        
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, skilled_coins, total_wagered_sc, display_name, email, chess_elo, daily_play_streak')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) {
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
            chess_elo: data.chess_elo ?? 800,
            daily_play_streak: data.daily_play_streak ?? 0,
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
        } else {
          // No profile found - might need to be created by ensure-user

          set({ loading: false });
        }
      } catch (error) {
        set({ loading: false, error: 'Failed to load user data' });
      }
    },
    
    refresh: async () => {
      const state = get();
      
      if (!state.userId) {
        return;
      }
      
      // Throttle refreshes
      if (state.lastFetchTime && Date.now() - state.lastFetchTime < state._minRefreshInterval) {
        return;
      }
      
      set({ loading: true, error: null });
      
      try {

        
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, skilled_coins, total_wagered_sc, display_name, email, chess_elo, daily_play_streak')
          .eq('user_id', state.userId)
          .maybeSingle();
        
        if (error) {
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
            chess_elo: data.chess_elo ?? 800,
            daily_play_streak: data.daily_play_streak ?? 0,
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
        set({ loading: false, error: 'Failed to refresh' });
      }
    },
    
    applyBalanceDelta: (delta: number) => {
      const state = get();
      if (!state.profile) return;
      
      const newBalance = Math.max(0, state.profile.skilled_coins + delta);
      
      
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
    
    syncBalanceAfterGame: ({ gameId, creditsChange, reason }) => {
      const state = get();
      
      // DEDUP: Skip if we already synced for this gameId
      if (state._syncedGameIds.has(gameId)) {
        return;
      }
      
      // Mark this gameId as synced (prevent duplicate calls from rerenders / WS retries)
      const updatedSyncedIds = new Set(state._syncedGameIds);
      updatedSyncedIds.add(gameId);
      set({ _syncedGameIds: updatedSyncedIds });
      
      
      // Step 1: Optimistically apply the known delta immediately
      if (creditsChange !== 0 && state.profile) {
        const newBalance = Math.max(0, state.profile.skilled_coins + creditsChange);
        
        set({
          profile: {
            ...state.profile,
            skilled_coins: newBalance,
          },
          cachedSkilledCoins: newBalance,
        });
        
        // Cross-sync to legacy balanceStore (used by some /chess page components)
        useBalanceStore.getState().setBalance(newBalance);
        
        // Update cache
        if (state.userId) {
          setCachedData({
            userId: state.userId,
            skilledCoins: newBalance,
            timestamp: Date.now(),
          });
        }
      }
      
      // Step 2: Do ONE authoritative refresh from Supabase (bypasses throttle)
      // Delayed slightly to let DB settle after the server's end_game call
      const userId = state.userId;
      if (!userId) {
        return;
      }
      
      setTimeout(async () => {
        try {
  
          
          const { data, error } = await supabase
            .from('profiles')
            .select('user_id, skilled_coins, total_wagered_sc, display_name, email, chess_elo, daily_play_streak')
            .eq('user_id', userId)
            .maybeSingle();
          
          if (error) {
            return;
          }
          
          if (data) {
            const profile: UserProfile = {
              user_id: data.user_id,
              skilled_coins: data.skilled_coins ?? 0,
              total_wagered_sc: data.total_wagered_sc ?? 0,
              display_name: data.display_name,
              email: data.email,
              chess_elo: data.chess_elo ?? 800,
              daily_play_streak: data.daily_play_streak ?? 0,
            };
            
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
            
            // Cross-sync to legacy balanceStore
            useBalanceStore.getState().setBalance(profile.skilled_coins);
            
          }
        } catch (err) {
        }
      }, 500); // 500ms delay to let DB commit settle
    },
    
    _setupSubscription: (userId: string) => {
      const state = get();
      
      // Already subscribed
      if (state.subscription) {
        return;
      }
      
      
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
            
            
            const updatedProfile = {
              ...currentProfile,
              skilled_coins: newData.skilled_coins ?? currentProfile.skilled_coins,
              total_wagered_sc: newData.total_wagered_sc ?? currentProfile.total_wagered_sc,
              display_name: newData.display_name ?? currentProfile.display_name,
              email: newData.email ?? currentProfile.email,
              chess_elo: (newData as any).chess_elo ?? currentProfile.chess_elo,
              daily_play_streak: (newData as any).daily_play_streak ?? currentProfile.daily_play_streak,
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
        _syncedGameIds: new Set<string>(),
      });
      
    },
  };
});

/**
 * Hook for components to read user data
 * This is a convenience wrapper - components should use this instead of direct store access
 * Uses individual selectors to prevent unnecessary re-renders
 */
export function useUserData() {
  // Use individual selectors to avoid creating new objects
  const profile = useUserDataStore(state => state.profile);
  const loading = useUserDataStore(state => state.loading);
  const error = useUserDataStore(state => state.error);
  const cachedSkilledCoins = useUserDataStore(state => state.cachedSkilledCoins);
  const refresh = useUserDataStore(state => state.refresh);
  const applyBalanceDelta = useUserDataStore(state => state.applyBalanceDelta);
  
  // Compute derived values
  const skilledCoins = profile?.skilled_coins ?? cachedSkilledCoins ?? null;
  const totalWageredSc = profile?.total_wagered_sc ?? 0;
  const displayName = profile?.display_name ?? null;
  
  return {
    // Balance
    skilledCoins,
    balance: skilledCoins ?? 0,
    
    // Profile
    totalWageredSc,
    displayName,
    profile,
    
    // Loading states
    isLoading: loading,
    isReady: profile !== null,
    error,
    
    // Actions
    refresh,
    applyBalanceDelta,
  };
}
