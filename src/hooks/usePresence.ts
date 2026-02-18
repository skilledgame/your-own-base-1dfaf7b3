/**
 * usePresence Hook - Convenience hook for online status tracking
 */

import { usePresenceStore, type UserStatus, type PresenceInfo } from '@/stores/presenceStore';

export function usePresence() {
  const statusMap = usePresenceStore(state => state.statusMap);
  const presenceInfoMap = usePresenceStore(state => state.presenceInfoMap);
  const setStatus = usePresenceStore(state => state.setStatus);
  const getStatus = usePresenceStore(state => state.getStatus);
  const getPresenceInfo = usePresenceStore(state => state.getPresenceInfo);

  const onlineCount = Object.values(statusMap).filter(s => s !== 'offline').length;

  return {
    statusMap,
    presenceInfoMap,
    setStatus,
    getStatus,
    getPresenceInfo,
    onlineCount,
  };
}

export function useUserStatus(userId: string): UserStatus {
  return usePresenceStore(state => state.statusMap[userId] || 'offline');
}

export function useUserPresenceInfo(userId: string): PresenceInfo {
  return usePresenceStore(state => state.presenceInfoMap[userId] || { status: 'offline' });
}
