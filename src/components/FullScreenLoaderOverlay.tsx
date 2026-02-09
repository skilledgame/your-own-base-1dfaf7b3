/**
 * FullScreenLoaderOverlay
 * 
 * Minimal blank loading overlay: site background + centered spinner.
 * Controlled by the global uiLoadingStore.
 * No text, no icons, no drama — just a clean loading state.
 */

import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { Loader2 } from 'lucide-react';

export function FullScreenLoaderOverlay() {
  const isLoading = useUILoadingStore((s) => s.isLoading);

  if (!isLoading) return null;

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
