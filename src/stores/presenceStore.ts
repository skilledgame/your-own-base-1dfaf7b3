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
  game_started_at?: number;
  db_game_id?: string;
}

export interface PresenceInfo {
  status: UserStatus;
  game_started_at?: number;
  db_game_id?: string;
}

interface PresenceStore {
  statusMap: Record<string, UserStatus>;
  presenceInfoMap: Record<string, PresenceInfo>;
  channel: RealtimeChannel | null;
  currentUserId: string | null;

  initialize: (userId: string) => void;
  setStatus: (status: UserStatus, opts?: { gameStartedAt?: number; dbGameId?: string }) => void;
  getStatus: (userId: string) => UserStatus;
  getPresenceInfo: (userId: string) => PresenceInfo;
  reset: () => void;
}

export const usePresenceStore = create<PresenceStore>((set, get) => ({
  statusMap: {},
  presenceInfoMap: {},
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
        const newInfoMap: Record<string, PresenceInfo> = {};

        for (const key of Object.keys(presenceState)) {
          const entries = presenceState[key] as PresenceState[];
          if (entries && entries.length > 0) {
            const entry = entries[0];
            newMap[key] = entry.status || 'online';
            newInfoMap[key] = {
              status: entry.status || 'online',
              game_started_at: entry.game_started_at,
              db_game_id: entry.db_game_id,
            };
          }
        }

        set({ statusMap: newMap, presenceInfoMap: newInfoMap });
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

  setStatus: (status: UserStatus, opts?: { gameStartedAt?: number; dbGameId?: string }) => {
    const { channel, currentUserId } = get();
    if (channel && currentUserId) {
      const payload: Record<string, unknown> = {
        user_id: currentUserId,
        status,
      };
      if (opts?.gameStartedAt) payload.game_started_at = opts.gameStartedAt;
      if (opts?.dbGameId) payload.db_game_id = opts.dbGameId;
      channel.track(payload);
    }
  },

  getStatus: (userId: string) => {
    return get().statusMap[userId] || 'offline';
  },

  getPresenceInfo: (userId: string) => {
    return get().presenceInfoMap[userId] || { status: 'offline' };
  },

  reset: () => {
    const state = get();
    if (state.channel) {
      supabase.removeChannel(state.channel);
    }
    set({ statusMap: {}, presenceInfoMap: {}, channel: null, currentUserId: null });
  },
}));
