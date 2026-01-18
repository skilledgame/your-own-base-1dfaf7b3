import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'moderator' | 'user';

interface UseUserRoleReturn {
  role: AppRole;
  isPrivileged: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  loading: boolean;
}

/**
 * useUserRole - Returns user role from centralized AuthContext
 * 
 * No longer has its own auth listener - uses the centralized AuthContext.
 */
export const useUserRole = (): UseUserRoleReturn => {
  const { role, isAdmin, isPrivileged, roleLoading, isAuthReady } = useAuth();

  return {
    role,
    isPrivileged,
    isModerator: role === 'moderator',
    isAdmin,
    loading: roleLoading || !isAuthReady,
  };
};
