/**
 * Presence Store - Tracks online/offline/in-game status via Supabase Realtime Presence
 * 
 * Uses a shared Presence channel to broadcast and track user statuses.
 * Status values: 'online' | 'in_game' | 'offline' (offline = not in channel)
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export type UserStatus = 'online' | 'in_game' | 'offline';

interface PresenceState {
  user_id: string;
  status: UserStatus;
}

interface PresenceStore {
  statusMap: Record<string, UserStatus>;
  channel: RealtimeChannel | null;
  currentUserId: string | null;

  initialize: (userId: string) => void;
  setStatus: (status: UserStatus) => void;
  getStatus: (userId: string) => UserStatus;
  reset: () => void;
}

export const usePresenceStore = create<PresenceStore>((set, get) => ({
  statusMap: {},
  channel: null,
  currentUserId: null,

  initialize: (userId: string) => {
    const state = get();
    if (state.channel) return;

    const channel = supabase.channel('online-users', {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState<PresenceState>();
        const newMap: Record<string, UserStatus> = {};

        for (const key of Object.keys(presenceState)) {
          const entries = presenceState[key] as PresenceState[];
          if (entries && entries.length > 0) {
            newMap[key] = entries[0].status || 'online';
          }
        }

        set({ statusMap: newMap });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            status: 'online' as UserStatus,
          });
        }
      });

    set({ channel, currentUserId: userId });
  },

  setStatus: (status: UserStatus) => {
    const { channel, currentUserId } = get();
    if (channel && currentUserId) {
      channel.track({
        user_id: currentUserId,
        status,
      });
    }
  },

  getStatus: (userId: string) => {
    return get().statusMap[userId] || 'offline';
  },

  reset: () => {
    const state = get();
    if (state.channel) {
      supabase.removeChannel(state.channel);
    }
    set({ statusMap: {}, channel: null, currentUserId: null });
  },
}));
