/**
 * SINGLE SUPABASE CLIENT - THE ONLY createClient() IN THE APP
 * 
 * All imports should use this file or @/integrations/supabase/client
 * (which re-exports from here).
 * 
 * Key settings:
 * - storageKey: "skilled-auth" (stable across builds)
 * - persistSession: true
 * - autoRefreshToken: true
 * - detectSessionInUrl: true (for OAuth redirects)
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Hardcoded Supabase project credentials
const SUPABASE_URL = "https://jkzbrlslzwaojxtjzpdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpremJybHNsendhb2p4dGp6cGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MDk3NDMsImV4cCI6MjA4MzE4NTc0M30.bIDrKcplT8PmUrE0UU2mp3i9finwB-2lFGjN_qqdWxE";

// Create the SINGLE Supabase client instance
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    storageKey: 'skilled-auth', // Stable key across builds
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

// Export URL for debugging
export const CURRENT_SUPABASE_URL = SUPABASE_URL;

// Helper to clear all auth-related storage (for hard reset)
export function clearAuthStorage() {
  try {
    // Remove our auth key
    localStorage.removeItem('skilled-auth');
    
    // Remove any legacy Supabase keys (sb-*)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Also remove balance cache
    localStorage.removeItem('skilled_coins_last_known');
    
    console.log('[Auth] Cleared auth storage:', ['skilled-auth', ...keysToRemove]);
  } catch (error) {
    console.error('[Auth] Error clearing storage:', error);
  }
}

// Helper to check if auth storage exists
export function hasAuthStorage(): boolean {
  try {
    return localStorage.getItem('skilled-auth') !== null;
  } catch {
    return false;
  }
}

// Helper to get auth storage size (for debugging)
export function getAuthStorageInfo(): { exists: boolean; size: number } {
  try {
    const data = localStorage.getItem('skilled-auth');
    return {
      exists: data !== null,
      size: data ? data.length : 0,
    };
  } catch {
    return { exists: false, size: 0 };
  }
}
