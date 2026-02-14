/**
 * UI Loading / Transition Store
 * 
 * Global overlay state managed by Zustand.
 * Supports two modes:
 *   - "spinner": blank background + spinning loader (default)
 *   - "versus": dramatic Player VS Opponent splash animation
 *
 * Any component can call showLoading() / hideLoading() to control
 * the full-screen overlay.
 */

import { create } from 'zustand';
import type { RankInfo } from '@/lib/rankSystem';

export type OverlayMode = "spinner" | "versus";

export interface VersusData {
  playerName: string;
  opponentName: string;
  playerColor: 'white' | 'black';
  wager: number;
  playerRank?: RankInfo;
  opponentRank?: RankInfo;
}

interface UILoadingState {
  isLoading: boolean;
  mode: OverlayMode;
  reason?: string;
  versusData?: VersusData;
  /** Timestamp (ms) when the overlay was shown — used to enforce minimum display time */
  shownAt: number | null;

  showLoading: (reason?: string) => void;
  showVersus: (data: VersusData) => void;
  patchVersusData: (patch: Partial<VersusData>) => void;
  hideLoading: () => void;
}

export const useUILoadingStore = create<UILoadingState>((set, get) => ({
  isLoading: false,
  mode: "spinner",
  reason: undefined,
  versusData: undefined,
  shownAt: null,

  showLoading: (reason?: string) => {
    set({ isLoading: true, mode: "spinner", reason, versusData: undefined, shownAt: Date.now() });
  },

  showVersus: (data: VersusData) => {
    console.log("[UILoadingStore] showVersus:", data.playerName, "vs", data.opponentName);
    set({ isLoading: true, mode: "versus", reason: undefined, versusData: data, shownAt: Date.now() });
  },

  patchVersusData: (patch: Partial<VersusData>) => {
    const current = get().versusData;
    if (current) {
      set({ versusData: { ...current, ...patch } });
    }
  },

  hideLoading: () => {
    set({ isLoading: false, mode: "spinner", reason: undefined, versusData: undefined, shownAt: null });
  },
}));
