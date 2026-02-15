import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBalanceStore } from '@/stores/balanceStore';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook that ensures user has profiles/players/free_plays rows after login.
 * Now uses centralized AuthContext instead of its own listener.
 * 
 * IMPORTANT: No async operations in auth listener callback!
 */
export function useEnsureUser() {
  const hasRun = useRef(false);
  const isRunning = useRef(false);
  const { fetchBalance } = useBalanceStore();
  const { user, session, isAuthReady, isAuthenticated } = useAuth();

  const ensureUser = useCallback(async (accessToken?: string) => {
    if (isRunning.current) {
      return null;
    }

    try {
      isRunning.current = true;
      
      // Use provided token or get from session
      const token = accessToken || session?.access_token;

      if (!token) {
        return null;
      }


      const { data, error } = await supabase.functions.invoke('ensure-user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) {
        return null;
      }

      
      // Refresh balance after user provisioning
      if (data?.ok && user?.id) {
        fetchBalance(user.id);
      }
      
      return data;
    } catch (err) {
      return null;
    } finally {
      isRunning.current = false;
    }
  }, [fetchBalance, session?.access_token, user?.id]);

  // Run when auth becomes ready and user is authenticated
  useEffect(() => {
    if (!isAuthReady) return;
    
    if (isAuthenticated && session?.access_token && !hasRun.current) {
      hasRun.current = true;
      ensureUser(session.access_token);
    }
    
    // Reset on sign out
    if (!isAuthenticated) {
      hasRun.current = false;
    }
  }, [isAuthReady, isAuthenticated, session?.access_token, ensureUser]);

  return { ensureUser };
}
