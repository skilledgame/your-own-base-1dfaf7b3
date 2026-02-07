/**
 * Server-Authoritative Timer Hook
 * 
 * Timer that uses server timestamps to calculate remaining time.
 * Never counts down locally - only calculates based on server time.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface TimerSnapshot {
  whiteTimeSeconds: number;
  blackTimeSeconds: number;
  serverTimeMs: number;
  currentTurn: 'w' | 'b';
}

export function useServerAuthoritativeTimer(
  initialSnapshot: TimerSnapshot | null,
  isGameOver: boolean,
  onTimeLoss?: (loserColor: 'w' | 'b') => void
) {
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(initialSnapshot);
  const renderFrameRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(Date.now());

  // Update snapshot from server
  const updateSnapshot = useCallback((newSnapshot: TimerSnapshot) => {
    setSnapshot(newSnapshot);
    lastRenderTimeRef.current = Date.now();
  }, []);

  // Calculate effective time for a color based on client-local time (no clock drift)
  const getEffectiveTime = useCallback((color: 'w' | 'b'): number => {
    if (!snapshot || isGameOver) {
      return snapshot?.whiteTimeSeconds ?? 60;
    }

    const elapsedMs = Date.now() - lastRenderTimeRef.current;
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

    // Only count down for the side whose turn it is
    if (snapshot.currentTurn === color) {
      const remaining = (color === 'w' ? snapshot.whiteTimeSeconds : snapshot.blackTimeSeconds) - elapsedSeconds;
      return Math.max(0, remaining);
    } else {
      // Not their turn - return stored value
      return color === 'w' ? snapshot.whiteTimeSeconds : snapshot.blackTimeSeconds;
    }
  }, [snapshot, isGameOver]);

  // Render loop - just triggers re-render, doesn't mutate time
  useEffect(() => {
    if (isGameOver || !snapshot) {
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
      return;
    }

    const render = () => {
      // Check for time loss
      const whiteTime = getEffectiveTime('w');
      const blackTime = getEffectiveTime('b');

      if (snapshot.currentTurn === 'w' && whiteTime <= 0) {
        onTimeLoss?.('w');
      } else if (snapshot.currentTurn === 'b' && blackTime <= 0) {
        onTimeLoss?.('b');
      }

      // Schedule next render
      renderFrameRef.current = requestAnimationFrame(render);
    };

    renderFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, [snapshot, isGameOver, getEffectiveTime, onTimeLoss]);

  return {
    whiteTime: getEffectiveTime('w'),
    blackTime: getEffectiveTime('b'),
    updateSnapshot,
    snapshot,
  };
}
