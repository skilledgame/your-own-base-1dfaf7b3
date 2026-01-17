import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBalanceStore } from '@/stores/balanceStore';

/**
 * Hook that ensures user has profiles/players/free_plays rows after login.
 * Runs automatically on auth state change and can be called manually.
 * 
 * PART E: Removed admin notification toast - no noisy notifications.
 */
export function useEnsureUser() {
  const hasRun = useRef(false);
  const isRunning = useRef(false);
  const { fetchBalance } = useBalanceStore();

  const ensureUser = useCallback(async (accessToken?: string) => {
    if (isRunning.current) {
      console.log('[useEnsureUser] Already running, skipping...');
      return null;
    }

    try {
      isRunning.current = true;
      
      // Get current session if token not provided
      let token = accessToken;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      }

      if (!token) {
        console.log('[useEnsureUser] No access token available');
        return null;
      }

      console.log('[useEnsureUser] Calling ensure-user edge function...');

      const { data, error } = await supabase.functions.invoke('ensure-user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) {
        console.error('[useEnsureUser] Edge function error:', error);
        return null;
      }

      console.log('[useEnsureUser] Result:', data);
      
      // Refresh balance after user provisioning
      if (data?.ok) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          fetchBalance(user.id);
        }
      }
      
      // REMOVED: Admin toast notification - Part E requirement
      // We no longer show "Admin Access Granted" toast
      
      return data;
    } catch (err) {
      console.error('[useEnsureUser] Unexpected error:', err);
      return null;
    } finally {
      isRunning.current = false;
    }
  }, [fetchBalance]);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[useEnsureUser] Auth state change:', event, 'hasSession:', !!session);

      // Run on SIGNED_IN or INITIAL_SESSION with valid session
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.access_token) {
        // Prevent running multiple times for the same session
        if (hasRun.current) {
          console.log('[useEnsureUser] Already ran for this session');
          return;
        }
        hasRun.current = true;

        const result = await ensureUser(session.access_token);
        if (result?.ok) {
          console.log('[useEnsureUser] User provisioning complete');
          // No toast for admin role - silent grant
        }
      }

      // Reset on sign out
      if (event === 'SIGNED_OUT') {
        hasRun.current = false;
      }
    });

    // Also run on mount if session exists
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && !hasRun.current) {
        hasRun.current = true;
        await ensureUser(session.access_token);
      }
    })();

    return () => subscription.unsubscribe();
  }, [ensureUser]);

  return { ensureUser };
}
