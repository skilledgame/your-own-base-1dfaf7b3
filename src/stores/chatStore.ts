/**
 * Chat Store - Zustand store for DM and clan chat messages
 * 
 * Manages active channel, messages, and real-time subscriptions.
 * Supports both DM (1:1) and clan channels.
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  channel_type: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

interface ChatStore {
  activeChannelType: string | null;
  activeChannelId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  subscription: RealtimeChannel | null;

  setActiveChannel: (type: string, channelId: string) => void;
  loadMessages: (type: string, channelId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  reset: () => void;
}

/** Generate a deterministic DM channel ID from two user IDs */
export function getDmChannelId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

export const useChatStore = create<ChatStore>((set, get) => ({
  activeChannelType: null,
  activeChannelId: null,
  messages: [],
  loading: false,
  subscription: null,

  setActiveChannel: (type: string, channelId: string) => {
    const state = get();

    // Clean up previous subscription
    if (state.subscription) {
      supabase.removeChannel(state.subscription);
    }

    set({
      activeChannelType: type,
      activeChannelId: channelId,
      messages: [],
      loading: true,
    });

    // Load messages
    get().loadMessages(type, channelId);

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-${type}-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Fetch sender name
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', newMsg.sender_id)
            .maybeSingle();

          const enrichedMsg: ChatMessage = {
            ...newMsg,
            sender_name: profile?.display_name || 'Unknown',
          };

          set({ messages: [...get().messages, enrichedMsg] });
        }
      )
      .subscribe();

    set({ subscription: channel });
  },

  loadMessages: async (type: string, channelId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_type', type)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Enrich with sender names
      const senderIds = new Set((data || []).map(m => m.sender_id));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', Array.from(senderIds));

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach(p => {
        nameMap[p.user_id] = p.display_name || 'Unknown';
      });

      const enriched: ChatMessage[] = (data || []).map(m => ({
        ...m,
        sender_name: nameMap[m.sender_id] || 'Unknown',
      }));

      set({ messages: enriched, loading: false });
    } catch (error) {
      console.error('[ChatStore] Error loading messages:', error);
      set({ loading: false });
    }
  },

  sendMessage: async (content: string) => {
    const { activeChannelType, activeChannelId } = get();
    if (!activeChannelType || !activeChannelId || !content.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase.from('messages').insert({
        channel_type: activeChannelType,
        channel_id: activeChannelId,
        sender_id: user.id,
        content: content.trim(),
      });

      if (error) throw error;
    } catch (error) {
      console.error('[ChatStore] Error sending message:', error);
    }
  },

  reset: () => {
    const state = get();
    if (state.subscription) {
      supabase.removeChannel(state.subscription);
    }
    set({
      activeChannelType: null,
      activeChannelId: null,
      messages: [],
      loading: false,
      subscription: null,
    });
  },
}));
