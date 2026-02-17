/**
 * usePresence Hook - Convenience hook for online status tracking
 */

import { usePresenceStore, type UserStatus } from '@/stores/presenceStore';

export function usePresence() {
  const statusMap = usePresenceStore(state => state.statusMap);
  const setStatus = usePresenceStore(state => state.setStatus);
  const getStatus = usePresenceStore(state => state.getStatus);

  const onlineCount = Object.values(statusMap).filter(s => s !== 'offline').length;

  return {
    statusMap,
    setStatus,
    getStatus,
    onlineCount,
  };
}

export function useUserStatus(userId: string): UserStatus {
  return usePresenceStore(state => state.statusMap[userId] || 'offline');
}
