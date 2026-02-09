/**
 * UI Loading Store
 * 
 * Global loading overlay state managed by Zustand.
 * Any component can call showLoading() / hideLoading() to control
 * the full-screen loader overlay.
 */

import { create } from 'zustand';

interface UILoadingState {
  isLoading: boolean;
  reason?: string;
  showLoading: (reason?: string) => void;
  hideLoading: () => void;
}

export const useUILoadingStore = create<UILoadingState>((set) => ({
  isLoading: false,
  reason: undefined,

  showLoading: (reason?: string) => {
    set({ isLoading: true, reason });
  },

  hideLoading: () => {
    set({ isLoading: false, reason: undefined });
  },
}));
