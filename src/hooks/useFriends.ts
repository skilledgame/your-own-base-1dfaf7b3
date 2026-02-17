/**
 * useFriends Hook - Convenience hook for friend system data
 * 
 * Reads from friendStore, provides derived computed values.
 */

import { useFriendStore } from '@/stores/friendStore';
import { useAuth } from '@/contexts/AuthContext';

export function useFriends() {
  const friends = useFriendStore(state => state.friends);
  const pendingRequests = useFriendStore(state => state.pendingRequests);
  const loading = useFriendStore(state => state.loading);
  const error = useFriendStore(state => state.error);
  const sendRequest = useFriendStore(state => state.sendRequest);
  const acceptRequest = useFriendStore(state => state.acceptRequest);
  const declineRequest = useFriendStore(state => state.declineRequest);
  const removeFriend = useFriendStore(state => state.removeFriend);
  const inviteToGame = useFriendStore(state => state.inviteToGame);
  const fetchFriends = useFriendStore(state => state.fetchFriends);
  const fetchPendingRequests = useFriendStore(state => state.fetchPendingRequests);
  const { user } = useAuth();

  const incomingRequests = pendingRequests.filter(r => r.receiver_id === user?.id);
  const outgoingRequests = pendingRequests.filter(r => r.sender_id === user?.id);
  const friendCount = friends.length;
  const pendingCount = incomingRequests.length;

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    friendCount,
    pendingCount,
    loading,
    error,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    inviteToGame,
    fetchFriends,
    fetchPendingRequests,
  };
}
