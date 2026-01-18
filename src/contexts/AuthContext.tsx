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

export type AppRole = 'admin' | 'moderator' | 'user';

// Auth event for debugging
export type AuthEvent = AuthChangeEvent | 'BOOTSTRAP_START' | 'BOOTSTRAP_COMPLETE' | 'BOOTSTRAP_ERROR';

interface AuthContextType {
  // Core auth state
  user: User | null;
  session: Session | null;
  
  // Bootstrap state - CRITICAL for avoiding "in-between" state
  isAuthReady: boolean;
  authError: string | null;
  
  // Convenience flags
  isAuthenticated: boolean;
  
  // Role (fetched after bootstrap)
  role: AppRole;
  isAdmin: boolean;
  isPrivileged: boolean;
  roleLoading: boolean;
  
  // Last auth event (for debugging)
  lastAuthEvent: AuthEvent | null;
  
  // Actions
  signOut: () => Promise<void>;
  hardReset: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Core state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastAuthEvent, setLastAuthEvent] = useState<AuthEvent | null>(null);
  
  // Role state
  const [role, setRole] = useState<AppRole>('user');
  const [roleLoading, setRoleLoading] = useState(false);
  
  // Refs to prevent duplicate operations
  const bootstrapComplete = useRef(false);
  const roleFetched = useRef(false);
  const signOutInProgress = useRef(false);
  
  // Fetch role - deferred, not blocking
  const fetchRole = useCallback((userId: string) => {
    if (roleFetched.current) return;
    
    setRoleLoading(true);
    
    // Use setTimeout to avoid blocking the auth listener
    setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data?.role) {
          setRole(data.role as AppRole);
          console.log('[Auth] Role fetched:', data.role);
        } else {
          setRole('user');
        }
        roleFetched.current = true;
      } catch (error) {
        console.error('[Auth] Error fetching role:', error);
        setRole('user');
      } finally {
        setRoleLoading(false);
      }
    }, 0);
  }, []);

  // Refresh session (manual, debounced)
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[Auth] Refresh failed:', error.message);
        return session;
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setLastAuthEvent('TOKEN_REFRESHED');
        return data.session;
      }
      
      return session;
    } catch (error) {
      console.error('[Auth] Refresh error:', error);
      return session;
    }
  }, [session]);

  // Sign out - clears state first, then calls Supabase
  const signOut = useCallback(async () => {
    if (signOutInProgress.current) return;
    signOutInProgress.current = true;
    
    try {
      console.log('[Auth] Signing out...');
      
      // Clear local state FIRST (immediate UI update)
      setSession(null);
      setUser(null);
      setRole('user');
      setRoleLoading(false);
      roleFetched.current = false;
      setLastAuthEvent('SIGNED_OUT');
      
      // Then call Supabase (local scope to avoid cross-tab issues)
      await supabase.auth.signOut({ scope: 'local' });
      
      console.log('[Auth] Sign out complete');
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
    } finally {
      signOutInProgress.current = false;
    }
  }, []);

  // Hard reset - nuclear option for stuck states
  const hardReset = useCallback(async () => {
    console.log('[Auth] Hard reset initiated...');
    
    try {
      // Clear local state
      setSession(null);
      setUser(null);
      setRole('user');
      setRoleLoading(false);
      roleFetched.current = false;
      bootstrapComplete.current = false;
      signOutInProgress.current = false;
      
      // Sign out from Supabase
      await supabase.auth.signOut({ scope: 'local' });
      
      // Clear ALL auth storage
      clearAuthStorage();
      
      // Force reload
      window.location.reload();
    } catch (error) {
      console.error('[Auth] Hard reset error:', error);
      // Still try to reload even if there's an error
      window.location.reload();
    }
  }, []);

  // BOOTSTRAP: Run once on mount
  useEffect(() => {
    let mounted = true;
    
    const bootstrap = async () => {
      if (bootstrapComplete.current) return;
      
      setLastAuthEvent('BOOTSTRAP_START');
      console.log('[Auth] Bootstrap starting...');
      
      try {
        // Get session from localStorage
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('[Auth] Bootstrap error:', error);
          setAuthError(error.message);
          setIsAuthReady(true);
          bootstrapComplete.current = true;
          setLastAuthEvent('BOOTSTRAP_ERROR');
          return;
        }
        
        if (initialSession) {
          console.log('[Auth] Bootstrap: Session found for user:', initialSession.user.id);
          setSession(initialSession);
          setUser(initialSession.user);
          
          // Fetch role in background (non-blocking)
          fetchRole(initialSession.user.id);
        } else {
          console.log('[Auth] Bootstrap: No session found');
        }
        
        setIsAuthReady(true);
        bootstrapComplete.current = true;
        setLastAuthEvent('BOOTSTRAP_COMPLETE');
        console.log('[Auth] Bootstrap complete, hasSession:', !!initialSession);
        
      } catch (error) {
        console.error('[Auth] Bootstrap failed:', error);
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
        console.log('[Auth] Event:', event, 'hasSession:', !!newSession);
        
        // Record event for debugging
        setLastAuthEvent(event);
        
        // Ignore events during sign out
        if (signOutInProgress.current) {
          console.log('[Auth] Ignoring event during sign out');
          return;
        }
        
        // Handle INITIAL_SESSION specially
        if (event === 'INITIAL_SESSION') {
          // If bootstrap already handled this, skip
          if (bootstrapComplete.current) {
            console.log('[Auth] INITIAL_SESSION after bootstrap, syncing...');
            // Still sync the session in case it changed
            if (newSession) {
              setSession(newSession);
              setUser(newSession.user);
            }
          }
          return;
        }
        
        // For all other events, update state synchronously
        switch (event) {
          case 'SIGNED_IN':
            if (newSession) {
              setSession(newSession);
              setUser(newSession.user);
              // Fetch role in background
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
            // Only clear if not already cleared by our signOut function
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

  // Tab visibility: refresh if session near expiry
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session && !signOutInProgress.current) {
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const expiresIn = expiresAt * 1000 - Date.now();
          if (expiresIn < 5 * 60 * 1000) { // Less than 5 minutes
            console.log('[Auth] Tab visible, session expiring soon, refreshing...');
            refreshSession();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
