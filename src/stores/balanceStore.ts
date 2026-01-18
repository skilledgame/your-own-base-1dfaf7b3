/**
 * Balance Store - Real-time Skilled Coins Management
 * 
 * SINGLE CURRENCY: SKILLED COINS only (from profiles table)
 * 
 * Key features:
 * - Single source of truth: profiles.skilled_coins
 * - null = unknown (loading), show skeleton
 * - 0 = actual zero balance from DB
 * - LocalStorage persistence for last known value
 * - Realtime subscription for instant updates
 * - No aggressive polling
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_KEY = 'skilled_coins_last_known';

// Helper to get last known balance from localStorage
const getLastKnownBalance = (): number | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      return isNaN(parsed) ? null : parsed;
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
};

// Helper to save last known balance to localStorage
const saveLastKnownBalance = (balance: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(balance));
  } catch {
    // Ignore localStorage errors
  }
};

// Helper to clear last known balance
const clearLastKnownBalance = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore localStorage errors
  }
};

interface BalanceStore {
  // State - null means unknown/loading, not 0
  skilledCoins: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  userId: string | null;
  
  // Last known value (for showing during loading)
  lastKnownSkilledCoins: number | null;
  
  // Realtime subscription
  subscription: RealtimeChannel | null;
  
  // Actions
  fetchBalance: (userId: string) => Promise<void>;
  subscribeToBalance: (userId: string) => void;
  unsubscribe: () => void;
  reset: () => void;
  
  // For server response reconciliation (after wagers, settlements)
  setBalance: (balance: number) => void;
  
  // Legacy alias for compatibility
  balance: number;
}

export const useBalanceStore = create<BalanceStore>((set, get) => ({
  skilledCoins: null,
  loading: true, // Start as loading
  error: null,
  lastUpdated: null,
  userId: null,
  lastKnownSkilledCoins: getLastKnownBalance(),
  subscription: null,
  
  // Computed property for backward compatibility
  get balance() {
    const state = get();
    // Return last known while loading, or current value
    if (state.skilledCoins === null) {
      return state.lastKnownSkilledCoins ?? 0;
    }
    return state.skilledCoins;
  },
  
  fetchBalance: async (userId: string) => {
    if (!userId) {
      console.log('[Balance] No userId provided');
      return;
    }
    
    const currentState = get();
    
    // Avoid refetch if we already have data for this user and it's recent (< 5s)
    if (currentState.userId === userId && 
        currentState.lastUpdated && 
        currentState.skilledCoins !== null &&
        Date.now() - currentState.lastUpdated < 5000) {
      console.log('[Balance] Skipping refetch - data is fresh');
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      // Fetch from profiles table (THE source of truth for skilled_coins)
      const { data, error } = await supabase
        .from('profiles')
        .select('skilled_coins')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('[Balance] Fetch error:', error);
        set({ loading: false, error: error.message });
        return;
      }
      
      if (data) {
        const coins = data.skilled_coins;
        console.log('[Balance] Fetched skilled_coins:', coins);
        
        // Save to localStorage for next session
        saveLastKnownBalance(coins);
        
        set({
          skilledCoins: coins,
          lastKnownSkilledCoins: coins,
          userId,
          lastUpdated: Date.now(),
          loading: false,
          error: null,
        });
      } else {
        // Player doesn't exist yet - ensure-user should create it
        console.log('[Balance] No player found for user, will be created by ensure-user');
        set({ skilledCoins: null, loading: false, userId });
      }
    } catch (error) {
      console.error('[Balance] Unexpected error:', error);
      set({ loading: false, error: 'Failed to fetch balance' });
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
    
    // Subscribe to changes on this user's profile row
    const channel = supabase
      .channel(`profile-balance-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[Balance] Realtime update:', payload.new);
          const newCoins = (payload.new as { skilled_coins: number }).skilled_coins;
          
          // Guard: only update if value actually changed
          const currentCoins = get().skilledCoins;
          if (currentCoins === newCoins) {
            console.log('[Balance] Value unchanged, skipping update');
            return;
          }
          
          saveLastKnownBalance(newCoins);
          set({
            skilledCoins: newCoins,
            lastKnownSkilledCoins: newCoins,
            lastUpdated: Date.now(),
          });
        }
      )
      .subscribe((status) => {
        console.log('[Balance] Subscription status:', status);
      });
    
    set({ subscription: channel, userId });
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
    clearLastKnownBalance();
    set({
      skilledCoins: null,
      loading: false,
      error: null,
      lastUpdated: null,
      userId: null,
      lastKnownSkilledCoins: null,
      subscription: null,
    });
  },
  
  setBalance: (balance: number) => {
    const currentBalance = get().skilledCoins;
    
    // Guard: only update if value actually changed
    if (currentBalance === balance) {
      console.log('[Balance] setBalance - value unchanged, skipping');
      return;
    }
    
    console.log('[Balance] Manual set:', balance);
    saveLastKnownBalance(balance);
    set({ 
      skilledCoins: balance, 
      lastKnownSkilledCoins: balance,
      lastUpdated: Date.now(),
      loading: false,
    });
  },
}));
