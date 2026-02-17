/**
 * Friend Store - Zustand store for friend system state
 * 
 * Manages friends list, pending requests, and friend actions.
 * Uses Supabase RPC functions for all mutations.
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Friend {
  friend_user_id: string;
  display_name: string;
  chess_elo: number;
  clan_name: string | null;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender_name?: string;
  receiver_name?: string;
}

interface FriendStore {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  loading: boolean;
  error: string | null;
  subscription: RealtimeChannel | null;

  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  sendRequest: (targetUserId: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  removeFriend: (targetUserId: string) => Promise<void>;
  inviteToGame: (friendUserId: string, gameId: string) => Promise<void>;
  initialize: (userId: string) => void;
  reset: () => void;
}

export const useFriendStore = create<FriendStore>((set, get) => ({
  friends: [],
  pendingRequests: [],
  loading: false,
  error: null,
  subscription: null,

  fetchFriends: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('get_friends_list');
      if (error) throw error;
      set({ friends: data || [], loading: false });
    } catch (error: any) {
      set({ loading: false, error: error.message });
    }
  },

  fetchPendingRequests: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('status', 'pending')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with display names
      const userIds = new Set<string>();
      (data || []).forEach(r => {
        userIds.add(r.sender_id);
        userIds.add(r.receiver_id);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', Array.from(userIds));

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach(p => {
        nameMap[p.user_id] = p.display_name || 'Unknown';
      });

      const enriched: FriendRequest[] = (data || []).map(r => ({
        ...r,
        sender_name: nameMap[r.sender_id] || 'Unknown',
        receiver_name: nameMap[r.receiver_id] || 'Unknown',
      }));

      set({ pendingRequests: enriched });
    } catch (error: any) {
      console.error('[FriendStore] Error fetching pending requests:', error);
    }
  },

  sendRequest: async (targetUserId: string) => {
    try {
      const { error } = await supabase.rpc('send_friend_request', {
        target_user_id: targetUserId,
      });
      if (error) throw error;
      await get().fetchPendingRequests();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  acceptRequest: async (requestId: string) => {
    try {
      const { error } = await supabase.rpc('accept_friend_request', {
        request_id: requestId,
      });
      if (error) throw error;
      await Promise.all([get().fetchFriends(), get().fetchPendingRequests()]);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  declineRequest: async (requestId: string) => {
    try {
      const { error } = await supabase.rpc('decline_friend_request', {
        request_id: requestId,
      });
      if (error) throw error;
      await get().fetchPendingRequests();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  removeFriend: async (targetUserId: string) => {
    try {
      const { error } = await supabase.rpc('remove_friend', {
        target_user_id: targetUserId,
      });
      if (error) throw error;
      set({ friends: get().friends.filter(f => f.friend_user_id !== targetUserId) });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  inviteToGame: async (friendUserId: string, gameId: string) => {
    try {
      const { error } = await supabase.rpc('invite_friend_to_game', {
        friend_user_id: friendUserId,
        game_id: gameId,
      });
      if (error) throw error;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  initialize: (userId: string) => {
    const state = get();
    if (state.subscription) return;

    // Fetch initial data
    get().fetchFriends();
    get().fetchPendingRequests();

    // Subscribe to friend_requests changes for live updates
    const channel = supabase
      .channel(`friend-requests-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          get().fetchPendingRequests();
          get().fetchFriends();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${userId}`,
        },
        () => {
          get().fetchPendingRequests();
        }
      )
      .subscribe();

    set({ subscription: channel });
  },

  reset: () => {
    const state = get();
    if (state.subscription) {
      supabase.removeChannel(state.subscription);
    }
    set({
      friends: [],
      pendingRequests: [],
      loading: false,
      error: null,
      subscription: null,
    });
  },
}));
