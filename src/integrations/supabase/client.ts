/**
 * Supabase Client Re-export
 * 
 * This file re-exports from the single supabase client in src/lib/supabaseClient.ts
 * to maintain backward compatibility with existing imports.
 * 
 * IMPORTANT: The actual client creation is in src/lib/supabaseClient.ts
 * This ensures there is exactly ONE Supabase client instance in the app.
 */

export { 
  supabase, 
  CURRENT_SUPABASE_URL,
  clearAuthStorage,
  hasAuthStorage,
  getAuthStorageInfo,
} from '@/lib/supabaseClient';
