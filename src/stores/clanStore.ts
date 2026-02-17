/**
 * Clan Store - Zustand store for clan system state
 * 
 * Manages clan info, members, and clan leaderboard.
 * Uses Supabase RPC functions for mutations.
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface Clan {
  id: string;
  name: string;
  description: string | null;
  badge_url: string | null;
  leader_id: string;
  member_count: number;
  total_trophies: number;
  created_at: string;
}

export interface ClanMember {
  id: string;
  clan_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  display_name?: string;
  chess_elo?: number;
}

export interface ClanLeaderboardEntry {
  rank: number;
  clan_id: string;
  clan_name: string;
  description: string | null;
  leader_name: string | null;
  member_count: number;
  total_trophies: number;
}

interface ClanStore {
  clan: Clan | null;
  members: ClanMember[];
  leaderboard: ClanLeaderboardEntry[];
  loading: boolean;
  error: string | null;

  fetchClan: (userId: string) => Promise<void>;
  fetchMembers: (clanId: string) => Promise<void>;
  createClan: (name: string, description?: string) => Promise<string>;
  joinClan: (clanId: string) => Promise<void>;
  leaveClan: () => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  searchClans: (query: string) => Promise<Clan[]>;
  reset: () => void;
}

export const useClanStore = create<ClanStore>((set, get) => ({
  clan: null,
  members: [],
  leaderboard: [],
  loading: false,
  error: null,

  fetchClan: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      // Check if user has a clan via profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('clan_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile?.clan_id) {
        set({ clan: null, members: [], loading: false });
        return;
      }

      // Fetch clan details
      const { data: clan, error } = await supabase
        .from('clans')
        .select('*')
        .eq('id', profile.clan_id)
        .maybeSingle();

      if (error) throw error;

      set({ clan: clan as Clan | null, loading: false });

      if (clan) {
        get().fetchMembers(clan.id);
      }
    } catch (error: any) {
      set({ loading: false, error: error.message });
    }
  },

  fetchMembers: async (clanId: string) => {
    try {
      const { data: members, error } = await supabase
        .from('clan_members')
        .select('*')
        .eq('clan_id', clanId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      // Enrich with profile info
      const userIds = (members || []).map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, chess_elo')
        .in('user_id', userIds);

      const profileMap: Record<string, { display_name: string | null; chess_elo: number }> = {};
      (profiles || []).forEach(p => {
        profileMap[p.user_id] = { display_name: p.display_name, chess_elo: p.chess_elo };
      });

      const enriched: ClanMember[] = (members || []).map(m => ({
        ...m,
        display_name: profileMap[m.user_id]?.display_name || 'Unknown',
        chess_elo: profileMap[m.user_id]?.chess_elo || 800,
      }));

      set({ members: enriched });
    } catch (error: any) {
      console.error('[ClanStore] Error fetching members:', error);
    }
  },

  createClan: async (name: string, description?: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('create_clan', {
        p_name: name,
        p_description: description,
      });
      if (error) throw error;

      const clanId = data as string;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await get().fetchClan(user.id);
      }
      set({ loading: false });
      return clanId;
    } catch (error: any) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  joinClan: async (clanId: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.rpc('join_clan', { p_clan_id: clanId });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await get().fetchClan(user.id);
      }
      set({ loading: false });
    } catch (error: any) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  leaveClan: async () => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.rpc('leave_clan');
      if (error) throw error;
      set({ clan: null, members: [], loading: false });
    } catch (error: any) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  fetchLeaderboard: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('get_clan_leaderboard');
      if (error) throw error;
      set({ leaderboard: (data || []) as ClanLeaderboardEntry[], loading: false });
    } catch (error: any) {
      set({ loading: false, error: error.message });
    }
  },

  searchClans: async (query: string) => {
    try {
      const { data, error } = await supabase
        .from('clans')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('member_count', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Clan[];
    } catch {
      return [];
    }
  },

  reset: () => {
    set({
      clan: null,
      members: [],
      leaderboard: [],
      loading: false,
      error: null,
    });
  },
}));
