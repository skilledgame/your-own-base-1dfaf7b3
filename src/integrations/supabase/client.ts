// Supabase client - uses NEW project (jkzbrlslzwaojxtjzpdf)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// HARDCODED to the new Supabase project - no env vars to avoid confusion
const SUPABASE_URL = "https://jkzbrlslzwaojxtjzpdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpremJybHNsendhb2p4dGp6cGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MDk3NDMsImV4cCI6MjA4MzE4NTc0M30.bIDrKcplT8PmUrE0UU2mp3i9finwB-2lFGjN_qqdWxE";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

// Export URL for debugging
export const CURRENT_SUPABASE_URL = SUPABASE_URL;