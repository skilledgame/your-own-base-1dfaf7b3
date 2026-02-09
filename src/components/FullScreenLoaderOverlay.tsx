/**
 * FullScreenLoaderOverlay
 * 
 * Global overlay that renders on top of the entire app.
 * Two modes:
 *   - "spinner" (default): site background + centered spinning loader
 *   - "versus": the dramatic Player VS Opponent animation
 *
 * Controlled by the global uiLoadingStore.
 */

import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { VersusScreen } from '@/components/VersusScreen';
import { Loader2 } from 'lucide-react';

export function FullScreenLoaderOverlay() {
  const isLoading = useUILoadingStore((s) => s.isLoading);
  const mode = useUILoadingStore((s) => s.mode);
  const versusData = useUILoadingStore((s) => s.versusData);
  const hideLoading = useUILoadingStore((s) => s.hideLoading);

  if (!isLoading) return null;

  // ── Versus mode ──
  if (mode === "versus" && versusData) {
    return (
      <VersusScreen
        playerName={versusData.playerName}
        opponentName={versusData.opponentName}
        playerColor={versusData.playerColor}
        wager={versusData.wager}
        playerRank={versusData.playerRank}
        opponentRank={versusData.opponentRank}
        onComplete={hideLoading}
      />
    );
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
