/**
 * Profile Store - Real-time Profile Data Management
 * 
 * Manages profile data including:
 * - skilled_coins (balance)
 * - total_wagered_sc (VIP ranking)
 * - display_name
 * 
 * Single source of truth: profiles table
 * Realtime subscription for instant updates
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ProfileData {
  user_id: string;
  skilled_coins: number;
  total_wagered_sc: number;
  display_name: string | null;
  email: string | null;
}

interface ProfileStore {
  // State
  profile: ProfileData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  userId: string | null;
  
  // Realtime subscription
  subscription: RealtimeChannel | null;
  
  // Actions
  fetchProfile: (userId: string) => Promise<void>;
  subscribeToProfile: (userId: string) => void;
  unsubscribe: () => void;
  reset: () => void;
  
  // Computed
  get skilledCoins(): number;
  get totalWageredSc(): number;
  get displayName(): string | null;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  loading: true,
  error: null,
  lastUpdated: null,
  userId: null,
  subscription: null,
  
  get skilledCoins() {
    return get().profile?.skilled_coins ?? 0;
  },
  
  get totalWageredSc() {
    return get().profile?.total_wagered_sc ?? 0;
  },
  
  get displayName() {
    return get().profile?.display_name ?? null;
  },
  
  fetchProfile: async (userId: string) => {
    if (!userId) {
      console.log('[ProfileStore] No userId provided');
      return;
    }
    
    const currentState = get();
    
    // Avoid refetch if we already have data for this user and it's recent (< 5s)
    if (currentState.userId === userId && 
        currentState.lastUpdated && 
        currentState.profile !== null &&
        Date.now() - currentState.lastUpdated < 5000) {
      console.log('[ProfileStore] Skipping refetch - data is fresh');
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      // Fetch from profiles table - THE source of truth
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, skilled_coins, total_wagered_sc, display_name, email')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('[ProfileStore] Fetch error:', error);
        set({ loading: false, error: error.message });
        return;
      }
      
      if (data) {
        console.log('[ProfileStore] Fetched profile:', {
          skilled_coins: data.skilled_coins,
          total_wagered_sc: (data as any).total_wagered_sc,
        });
        
        set({
          profile: {
            user_id: data.user_id,
            skilled_coins: data.skilled_coins ?? 0,
            total_wagered_sc: (data as any).total_wagered_sc ?? 0,
            display_name: data.display_name,
            email: data.email,
          },
          userId,
          lastUpdated: Date.now(),
          loading: false,
          error: null,
        });
      } else {
        console.log('[ProfileStore] No profile found for user');
        set({ profile: null, loading: false, userId });
      }
    } catch (error) {
      console.error('[ProfileStore] Unexpected error:', error);
      set({ loading: false, error: 'Failed to fetch profile' });
    }
  },
  
  subscribeToProfile: (userId: string) => {
    const currentState = get();
    
    // Already subscribed for this user
    if (currentState.subscription && currentState.userId === userId) {
      console.log('[ProfileStore] Already subscribed');
      return;
    }
    
    // Cleanup existing subscription
    if (currentState.subscription) {
      currentState.subscription.unsubscribe();
    }
    
    console.log('[ProfileStore] Setting up realtime subscription for user:', userId);
    
    // Subscribe to changes on this user's profile row
    const channel = supabase
      .channel(`profile-data-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[ProfileStore] Realtime update:', payload.new);
          const newData = payload.new as Partial<ProfileData>;
          
          // Update profile state
          const currentProfile = get().profile;
          if (currentProfile && currentProfile.user_id === userId) {
            set({
              profile: {
                ...currentProfile,
                skilled_coins: newData.skilled_coins ?? currentProfile.skilled_coins,
                total_wagered_sc: newData.total_wagered_sc ?? currentProfile.total_wagered_sc,
                display_name: newData.display_name ?? currentProfile.display_name,
                email: newData.email ?? currentProfile.email,
              },
              lastUpdated: Date.now(),
            });
          } else {
            // Profile not loaded yet, fetch it
            get().fetchProfile(userId);
          }
        }
      )
      .subscribe((status) => {
        console.log('[ProfileStore] Subscription status:', status);
      });
    
    set({ subscription: channel, userId });
  },
  
  unsubscribe: () => {
    const { subscription } = get();
    if (subscription) {
      console.log('[ProfileStore] Unsubscribing from realtime');
      subscription.unsubscribe();
      set({ subscription: null });
    }
  },
  
  reset: () => {
    const { subscription } = get();
    if (subscription) {
      subscription.unsubscribe();
    }
    set({
      profile: null,
      loading: false,
      error: null,
      lastUpdated: null,
      userId: null,
      subscription: null,
    });
  },
}));
