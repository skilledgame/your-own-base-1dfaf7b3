/**
 * Balance Store - Real-time Balance Management
 * 
 * PART B: Fix balance sync by providing:
 * - Single source of truth for user credits (from players table)
 * - Realtime subscription for instant updates
 * - No aggressive polling
 * - Action-triggered refetch for known balance-changing operations
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface BalanceStore {
  // State
  balance: number;
  loading: boolean;
  lastUpdated: number | null;
  playerId: string | null;
  userId: string | null;
  
  // Realtime subscription
  subscription: RealtimeChannel | null;
  
  // Actions
  fetchBalance: (userId: string) => Promise<void>;
  subscribeToBalance: (userId: string) => void;
  unsubscribe: () => void;
  reset: () => void;
  
  // For server response reconciliation
  setBalance: (balance: number) => void;
}

export const useBalanceStore = create<BalanceStore>((set, get) => ({
  balance: 0,
  loading: false,
  lastUpdated: null,
  playerId: null,
  userId: null,
  subscription: null,
  
  fetchBalance: async (userId: string) => {
    if (!userId) {
      console.log('[Balance] No userId provided');
      return;
    }
    
    const currentState = get();
    
    // Avoid refetch if we already have data for this user and it's recent (< 5s)
    if (currentState.userId === userId && 
        currentState.lastUpdated && 
        Date.now() - currentState.lastUpdated < 5000) {
      console.log('[Balance] Skipping refetch - data is fresh');
      return;
    }
    
    set({ loading: true });
    
    try {
      // Fetch from players table (the source of truth for game credits)
      const { data, error } = await supabase
        .from('players')
        .select('id, credits')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('[Balance] Fetch error:', error);
        set({ loading: false });
        return;
      }
      
      if (data) {
        console.log('[Balance] Fetched:', data.credits, 'for player:', data.id);
        set({
          balance: data.credits,
          playerId: data.id,
          userId,
          lastUpdated: Date.now(),
          loading: false,
        });
      } else {
        // Player doesn't exist yet - ensure-user should create it
        console.log('[Balance] No player found for user');
        set({ balance: 0, loading: false, userId });
      }
    } catch (error) {
      console.error('[Balance] Unexpected error:', error);
      set({ loading: false });
    }
  },
  
  subscribeToBalance: (userId: string) => {
    const currentState = get();
    
    // Already subscribed for this user
    if (currentState.subscription && currentState.userId === userId) {
      console.log('[Balance] Already subscribed');
      return;
    }
    
    // Cleanup existing subscription
    if (currentState.subscription) {
      currentState.subscription.unsubscribe();
    }
    
    console.log('[Balance] Setting up realtime subscription for user:', userId);
    
    // First fetch the player ID
    supabase
      .from('players')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data: playerData }) => {
        if (!playerData?.id) {
          console.log('[Balance] No player found, skipping subscription');
          return;
        }
        
        const playerId = playerData.id;
        set({ playerId, userId });
        
        // Subscribe to changes on this player's row
        const channel = supabase
          .channel(`player-balance-${playerId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'players',
              filter: `id=eq.${playerId}`,
            },
            (payload) => {
              console.log('[Balance] Realtime update:', payload.new);
              const newCredits = (payload.new as { credits: number }).credits;
              set({
                balance: newCredits,
                lastUpdated: Date.now(),
              });
            }
          )
          .subscribe((status) => {
            console.log('[Balance] Subscription status:', status);
          });
        
        set({ subscription: channel });
      });
  },
  
  unsubscribe: () => {
    const { subscription } = get();
    if (subscription) {
      console.log('[Balance] Unsubscribing from realtime');
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
      balance: 0,
      loading: false,
      lastUpdated: null,
      playerId: null,
      userId: null,
      subscription: null,
    });
  },
  
  setBalance: (balance: number) => {
    console.log('[Balance] Manual set:', balance);
    set({ balance, lastUpdated: Date.now() });
  },
}));
