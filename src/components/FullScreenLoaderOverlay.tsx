/**
 * FullScreenLoaderOverlay
 * 
 * Global overlay that renders on top of the entire app.
 * Two modes:
 *   - "spinner" (default): site background + centered spinning loader
 *   - "versus": handled inside the game panel (ActiveGamePanel) — skipped here
 *
 * Controlled by the global uiLoadingStore.
 */

import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { Loader2 } from 'lucide-react';

export function FullScreenLoaderOverlay() {
  const isLoading = useUILoadingStore((s) => s.isLoading);
  const mode = useUILoadingStore((s) => s.mode);

  if (!isLoading) return null;

  // ── Versus mode ──
  // VersusScreen is now rendered inside the game panel (ActiveGamePanel)
  // so it overlays exactly the chess board, not the entire screen.
  if (mode === "versus") {
    return null;
  }

  // ── Spinner mode (default) ──
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0f1a]">
      {/* Subtle background pulse */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
      </div>
      {/* Spinner */}
      <Loader2 className="relative z-10 w-10 h-10 animate-spin text-blue-500/70" />
    </div>
  );
}
