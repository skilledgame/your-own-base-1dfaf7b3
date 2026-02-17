/**
 * useChat Hook - Manages chat for a specific DM or clan channel
 */

import { useEffect } from 'react';
import { useChatStore, getDmChannelId } from '@/stores/chatStore';
import { useAuth } from '@/contexts/AuthContext';

export function useChat(channelType: string | null, channelId: string | null) {
  const messages = useChatStore(state => state.messages);
  const loading = useChatStore(state => state.loading);
  const sendMessage = useChatStore(state => state.sendMessage);
  const setActiveChannel = useChatStore(state => state.setActiveChannel);
  const activeChannelId = useChatStore(state => state.activeChannelId);

  useEffect(() => {
    if (channelType && channelId && channelId !== activeChannelId) {
      setActiveChannel(channelType, channelId);
    }
  }, [channelType, channelId, activeChannelId, setActiveChannel]);

  return {
    messages,
    loading,
    sendMessage,
  };
}

export function useDmChat(friendUserId: string | null) {
  const { user } = useAuth();
  const channelId = user && friendUserId ? getDmChannelId(user.id, friendUserId) : null;
  return useChat(friendUserId ? 'dm' : null, channelId);
}

export { getDmChannelId };
