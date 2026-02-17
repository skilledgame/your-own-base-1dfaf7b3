/**
 * useClan Hook - Convenience hook for clan system data
 */

import { useClanStore } from '@/stores/clanStore';

export function useClan() {
  const clan = useClanStore(state => state.clan);
  const members = useClanStore(state => state.members);
  const leaderboard = useClanStore(state => state.leaderboard);
  const loading = useClanStore(state => state.loading);
  const error = useClanStore(state => state.error);
  const createClan = useClanStore(state => state.createClan);
  const joinClan = useClanStore(state => state.joinClan);
  const leaveClan = useClanStore(state => state.leaveClan);
  const fetchLeaderboard = useClanStore(state => state.fetchLeaderboard);
  const searchClans = useClanStore(state => state.searchClans);
  const fetchClan = useClanStore(state => state.fetchClan);
  const fetchMembers = useClanStore(state => state.fetchMembers);

  const isInClan = clan !== null;
  const isLeader = clan !== null && members.some(m => m.role === 'leader' && m.user_id === clan.leader_id);
  const memberCount = clan?.member_count ?? 0;

  return {
    clan,
    members,
    leaderboard,
    isInClan,
    isLeader,
    memberCount,
    loading,
    error,
    createClan,
    joinClan,
    leaveClan,
    fetchLeaderboard,
    searchClans,
    fetchClan,
    fetchMembers,
  };
}
