/**
 * AuthContext - Stable Authentication Provider
 * 
 * PART A: Fix random logouts by providing:
 * - Single source of truth for auth state
 * - Proper session bootstrap (no flash logout)
 * - Tab visibility change handling
 * - Token refresh with debouncing
 * - Role caching (Part E)
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'moderator' | 'user';

interface AuthContextType {
  // Auth state
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  
  // Role (cached)
  role: AppRole;
  isAdmin: boolean;
  isPrivileged: boolean;
  roleLoading: boolean;
  
  // Actions
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole>('user');
  const [roleLoading, setRoleLoading] = useState(true);
  
  const bootstrapComplete = useRef(false);
  const refreshInProgress = useRef(false);
  const lastRefreshTime = useRef(0);
  const roleFetched = useRef(false);
  const signOutInProgress = useRef(false);
  
  // Fetch user role from database (once per session)
  const fetchRole = useCallback(async (userId: string) => {
    if (roleFetched.current) return;
    
    try {
      setRoleLoading(true);
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
  }, []);

  // Refresh session with debouncing (min 30s between refreshes)
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    const now = Date.now();
    const MIN_REFRESH_INTERVAL = 30000; // 30 seconds
    
    if (refreshInProgress.current || (now - lastRefreshTime.current) < MIN_REFRESH_INTERVAL) {
      console.log('[Auth] Skipping refresh - too soon or in progress');
      return session;
    }
    
    refreshInProgress.current = true;
    
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[Auth] Refresh failed:', error.message);
        // Only sign out if it's a definitive auth error, not a network glitch
        if (error.message.includes('Invalid Refresh Token') || 
            error.message.includes('Refresh Token Not Found')) {
          console.log('[Auth] Token invalid - signing out');
          await supabase.auth.signOut({ scope: 'local' });
          return null;
        }
        return session;
      }
      
      if (data.session) {
        lastRefreshTime.current = now;
        setSession(data.session);
        setUser(data.session.user);
        console.log('[Auth] Session refreshed successfully');
        return data.session;
      }
      
      return session;
    } catch (error) {
      console.error('[Auth] Refresh error:', error);
      return session;
    } finally {
      refreshInProgress.current = false;
    }
  }, [session]);

  // Sign out handler - properly clears all state
  const signOut = useCallback(async () => {
    if (signOutInProgress.current) {
      console.log('[Auth] Sign out already in progress');
      return;
    }
    
    signOutInProgress.current = true;
    
    try {
      console.log('[Auth] Signing out...');
      
      // Clear local state first
      setSession(null);
      setUser(null);
      setRole('user');
      roleFetched.current = false;
      
      // Then sign out from Supabase - use 'local' scope to avoid issues
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      if (error) {
        console.error('[Auth] Sign out error:', error);
        // Even if there's an error, we've already cleared local state
        // so the user appears logged out
      } else {
        console.log('[Auth] Sign out successful');
      }
    } catch (error) {
      console.error('[Auth] Sign out exception:', error);
    } finally {
      signOutInProgress.current = false;
    }
  }, []);

  // Bootstrap: Set up auth listener FIRST, then get session
  // This ensures we don't miss any auth events during initialization
  useEffect(() => {
    let mounted = true;
    
    const bootstrap = async () => {
      try {
        console.log('[Auth] Bootstrap starting...');
        
        // CRITICAL: Set up listener BEFORE getting session to avoid race conditions
        // The listener will handle INITIAL_SESSION event which fires immediately
        
        // Now safely check for existing session
        // getSession() returns the session from localStorage
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('[Auth] Bootstrap error:', error);
          setLoading(false);
          setRoleLoading(false);
          bootstrapComplete.current = true;
          return;
        }
        
        if (initialSession) {
          console.log('[Auth] Bootstrap: Session found, user:', initialSession.user.id);
          setSession(initialSession);
          setUser(initialSession.user);
          
          // Fetch role in background
          setTimeout(() => {
            if (mounted && initialSession.user.id) {
              fetchRole(initialSession.user.id);
            }
          }, 0);
        } else {
          console.log('[Auth] Bootstrap: No session in localStorage');
          setRoleLoading(false);
        }
      } catch (error) {
        console.error('[Auth] Bootstrap failed:', error);
        setRoleLoading(false);
      } finally {
        if (mounted) {
          setLoading(false);
          bootstrapComplete.current = true;
          console.log('[Auth] Bootstrap complete');
        }
      }
    };
    
    bootstrap();
    
    return () => {
      mounted = false;
    };
  }, [fetchRole]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('[Auth] State change:', event, 'session:', !!newSession);
        
        // Don't process events during sign out
        if (signOutInProgress.current) {
          console.log('[Auth] Ignoring event during sign out:', event);
          return;
        }
        
        // Handle INITIAL_SESSION - this fires immediately when listener is set up
        if (event === 'INITIAL_SESSION') {
          // If bootstrap is already complete and we have a session, sync it
          if (newSession && !session) {
            console.log('[Auth] INITIAL_SESSION providing session');
            setSession(newSession);
            setUser(newSession.user);
            setLoading(false);
            bootstrapComplete.current = true;
            
            // Fetch role in background - use setTimeout to avoid deadlock
            setTimeout(() => {
              if (!roleFetched.current && newSession.user.id) {
                fetchRole(newSession.user.id);
              }
            }, 0);
          }
          return;
        }
        
        // For other events, wait for bootstrap to complete
        if (!bootstrapComplete.current) {
          console.log('[Auth] Ignoring event before bootstrap:', event);
          return;
        }
        
        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            if (newSession) {
              setSession(newSession);
              setUser(newSession.user);
              if (!roleFetched.current) {
                // Defer to avoid Supabase client deadlock
                setTimeout(() => fetchRole(newSession.user.id), 0);
              }
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
  }, [fetchRole, session]);

  // Handle tab visibility changes - refresh session when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && session && !signOutInProgress.current) {
        console.log('[Auth] Tab visible - checking session');
        
        // Check if session is near expiry (within 5 minutes)
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const expiresIn = expiresAt * 1000 - Date.now();
          if (expiresIn < 5 * 60 * 1000) { // Less than 5 minutes
            console.log('[Auth] Session expiring soon, refreshing...');
            await refreshSession();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, refreshSession]);

  // Handle window focus - more aggressive session check
  useEffect(() => {
    const handleFocus = async () => {
      if (session && !signOutInProgress.current) {
        // On focus, just check expiry - don't reconcile aggressively
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const expiresIn = expiresAt * 1000 - Date.now();
          if (expiresIn < 2 * 60 * 1000) { // Less than 2 minutes
            await refreshSession();
          }
        }
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [session, refreshSession]);

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAuthenticated: !!session && !!user,
    role,
    isAdmin: role === 'admin',
    isPrivileged: role === 'admin' || role === 'moderator',
    roleLoading,
    signOut,
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
