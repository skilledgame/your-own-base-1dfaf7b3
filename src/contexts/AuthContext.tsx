/**
 * AuthContext - Deterministic Authentication Provider
 * 
 * GOALS:
 * 1. isAuthReady blocks rendering until bootstrap complete
 * 2. No "half logged-in" state on refresh
 * 3. onAuthStateChange is SYNC-ONLY (no awaits in callback)
 * 4. Single source of truth for auth state
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, clearAuthStorage } from '@/integrations/supabase/client';
import { clearEmailMfaVerified } from '@/lib/mfaStorage';

export type AppRole = 'admin' | 'moderator' | 'user';

export type AuthEvent = AuthChangeEvent | 'BOOTSTRAP_START' | 'BOOTSTRAP_COMPLETE' | 'BOOTSTRAP_ERROR';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthReady: boolean;
  authError: string | null;
  isAuthenticated: boolean;
  role: AppRole;
  isAdmin: boolean;
  isPrivileged: boolean;
  roleLoading: boolean;
  lastAuthEvent: AuthEvent | null;
  signOut: () => Promise<void>;
  hardReset: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastAuthEvent, setLastAuthEvent] = useState<AuthEvent | null>(null);
  const [role, setRole] = useState<AppRole>('user');
  const [roleLoading, setRoleLoading] = useState(false);
  
  const bootstrapComplete = useRef(false);
  const roleFetched = useRef(false);
  const signOutInProgress = useRef(false);
  
  // Fetch role - deferred, not blocking
  const fetchRole = useCallback((userId: string) => {
    if (roleFetched.current) return;
    
    setRoleLoading(true);
    
    setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data?.role) {
          setRole(data.role as AppRole);
        } else {
          setRole('user');
        }
        roleFetched.current = true;
      } catch {
        setRole('user');
      } finally {
        setRoleLoading(false);
      }
    }, 0);
  }, []);

  // Refresh session
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) return session;
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setLastAuthEvent('TOKEN_REFRESHED');
        return data.session;
      }
      
      return session;
    } catch {
      return session;
    }
  }, [session]);

  // Sign out - clears state first, then calls Supabase
  const signOut = useCallback(async () => {
    if (signOutInProgress.current) return;
    signOutInProgress.current = true;
    
    try {
      setSession(null);
      setUser(null);
      setRole('user');
      setRoleLoading(false);
      roleFetched.current = false;
      setLastAuthEvent('SIGNED_OUT');
      
      // Clear email 2FA verification so user must re-verify on next login
      clearEmailMfaVerified();
      
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Sign out error - state already cleared
    } finally {
      signOutInProgress.current = false;
    }
  }, []);

  // Hard reset - nuclear option for stuck states
  const hardReset = useCallback(async () => {
    try {
      setSession(null);
      setUser(null);
      setRole('user');
      setRoleLoading(false);
      roleFetched.current = false;
      bootstrapComplete.current = false;
      signOutInProgress.current = false;
      
      // Clear email 2FA verification
      clearEmailMfaVerified();
      
      await supabase.auth.signOut({ scope: 'local' });
      clearAuthStorage();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  }, []);

  // BOOTSTRAP: Run once on mount
  useEffect(() => {
    let mounted = true;
    
    const bootstrap = async () => {
      if (bootstrapComplete.current) return;
      
      setLastAuthEvent('BOOTSTRAP_START');
      
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          setAuthError(error.message);
          setIsAuthReady(true);
          bootstrapComplete.current = true;
          setLastAuthEvent('BOOTSTRAP_ERROR');
          return;
        }
        
        let activeSession = initialSession;
        
        if (initialSession) {
          // Check if the access token is expired or about to expire (within 60s)
          const expiresAt = initialSession.expires_at;
          const isExpiredOrExpiring = expiresAt 
            ? (expiresAt * 1000 - Date.now()) < 60 * 1000 
            : false;
          
          if (isExpiredOrExpiring) {
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              if (!mounted) return;
              
              if (!refreshError && refreshData.session) {
                activeSession = refreshData.session;
              }
              // If refresh fails, KEEP the existing session — don't null it.
              // autoRefreshToken will retry, and the user stays "logged in"
              // with the stale token until it succeeds.
            } catch {
              // Network error — keep existing session, don't log out
            }
          }
          
          // Always set the session if we had one — never discard it on refresh failure
          setSession(activeSession);
          setUser(activeSession.user);
          fetchRole(activeSession.user.id);
        }
        
        setIsAuthReady(true);
        bootstrapComplete.current = true;
        setLastAuthEvent('BOOTSTRAP_COMPLETE');
        
      } catch (error) {
        if (mounted) {
          setAuthError(error instanceof Error ? error.message : 'Unknown error');
          setIsAuthReady(true);
          bootstrapComplete.current = true;
          setLastAuthEvent('BOOTSTRAP_ERROR');
        }
      }
    };
    
    bootstrap();
    
    return () => {
      mounted = false;
    };
  }, [fetchRole]);

  // AUTH STATE LISTENER: SYNC-ONLY (no awaits!)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setLastAuthEvent(event);
        
        if (signOutInProgress.current) return;
        
        if (event === 'INITIAL_SESSION') {
          if (bootstrapComplete.current && newSession) {
            setSession(newSession);
            setUser(newSession.user);
          }
          return;
        }
        
        switch (event) {
          case 'SIGNED_IN':
            if (newSession) {
              setSession(newSession);
              setUser(newSession.user);
              if (!roleFetched.current) {
                fetchRole(newSession.user.id);
              }
            }
            break;
            
          case 'TOKEN_REFRESHED':
            if (newSession) {
              setSession(newSession);
              setUser(newSession.user);
            }
            break;
            
          case 'SIGNED_OUT':
            if (!signOutInProgress.current) {
              setSession(null);
              setUser(null);
              setRole('user');
              setRoleLoading(false);
              roleFetched.current = false;
            }
            break;
            
          case 'USER_UPDATED':
            if (newSession) {
              setSession(newSession);
              setUser(newSession.user);
            }
            break;
        }
      }
    );
    
    return () => subscription.unsubscribe();
  }, [fetchRole]);

  // Tab visibility: ALWAYS refresh when tab becomes visible again
  // This is critical because browsers suspend JS timers in background tabs,
  // so autoRefreshToken may not fire. We aggressively refresh on return.
  useEffect(() => {
    let lastVisible = Date.now();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session && !signOutInProgress.current) {
        const now = Date.now();
        const timeSinceLastVisible = now - lastVisible;
        lastVisible = now;
        
        // Refresh if away for more than 30 seconds — very aggressive
        // This prevents "logged out" state after any period of inactivity
        if (timeSinceLastVisible > 30 * 1000) {
          refreshSession();
        }
      } else if (document.visibilityState === 'hidden') {
        lastVisible = Date.now();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, refreshSession]);

  // Periodic session refresh as safety net — every 10 minutes while tab is active
  // This ensures the token never fully expires even during long active sessions
  useEffect(() => {
    if (!session || signOutInProgress.current) return;
    
    const interval = setInterval(() => {
      if (!signOutInProgress.current && document.visibilityState === 'visible') {
        refreshSession();
      }
    }, 10 * 60 * 1000); // 10 minutes
    
    return () => clearInterval(interval);
  }, [session, refreshSession]);

  const value: AuthContextType = {
    user,
    session,
    isAuthReady,
    authError,
    isAuthenticated: !!session && !!user,
    role,
    isAdmin: role === 'admin',
    isPrivileged: role === 'admin' || role === 'moderator',
    roleLoading,
    lastAuthEvent,
    signOut,
    hardReset,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
