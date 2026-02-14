/**
 * usePageAnalytics Hook
 * 
 * Tracks page views and active visitors for admin analytics.
 * - Records each page view to the page_views table
 * - Sends heartbeats to the active_visitors table every 30s
 * - Cleans up on unmount / page close
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Generate a unique session ID per browser tab
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

export function usePageAnalytics() {
  const location = useLocation();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPathRef = useRef<string>('');

  // Track page view on route change
  useEffect(() => {
    const path = location.pathname;

    // Skip duplicate tracking for same path
    if (path === lastPathRef.current) return;
    lastPathRef.current = path;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('page_views').insert({
          user_id: session?.user?.id || null,
          session_id: SESSION_ID,
          page_path: path,
        });
      } catch (err) {
        // Silent fail - analytics should never break the app
      }
    })();
  }, [location.pathname]);

  // Heartbeat for active visitors
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('active_visitors').upsert(
          {
            session_id: SESSION_ID,
            user_id: session?.user?.id || null,
            page_path: location.pathname,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' }
        );
      } catch (err) {
        // Silent fail
      }
    };

    // Initial heartbeat
    sendHeartbeat();

    // Regular heartbeat
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);

      // Best-effort cleanup when hook unmounts (e.g., full SPA teardown)
      // Stale entries are also cleaned by the clean_stale_visitors() DB function
      supabase
        .from('active_visitors')
        .delete()
        .eq('session_id', SESSION_ID)
        .then(() => {})
        .catch(() => {});
    };
  }, [location.pathname]);
}
