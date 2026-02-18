/**
 * useSpectate Hook
 * 
 * Manages spectator WebSocket communication:
 * - Ensures wsClient is authenticated and connected
 * - Sends `spectate_game` to join as spectator
 * - Listens for `spectate_started`, `move_applied`, `clock_snapshot`, `game_ended`
 * - Returns game state (FEN, clocks, player info, isGameOver)
 * - Sends `leave_spectate` on unmount
 */

import { useState, useEffect, useRef } from 'react';
import { wsClient } from '@/lib/wsClient';
import { supabase } from '@/integrations/supabase/client';
import type { TimerSnapshot } from '@/stores/chessStore';

export interface SpectateGameState {
  gameId: string;
  dbGameId?: string;
  fen: string;
  turn: 'w' | 'b';
  whiteId: string;
  blackId: string;
  wager: number;
  isGameOver: boolean;
  gameEndReason?: string;
  winnerColor?: 'w' | 'b' | null;
}

function buildTimerSnapshot(payload: any, fallbackTurn: 'w' | 'b' = 'w'): TimerSnapshot {
  const wMs = payload.wMs ?? ((payload.whiteTime ?? 60) * 1000);
  const bMs = payload.bMs ?? ((payload.blackTime ?? 60) * 1000);
  const turn: 'w' | 'b' = payload.turn ?? payload.currentTurn ?? fallbackTurn;
  const clockRunning = payload.clockRunning === true;
  const serverNow = payload.serverNow ?? payload.serverTimeMs ?? Date.now();
  const lastTurnStartedAt = payload.lastMoveAt ?? null;
  const clientNow = Date.now();

  return {
    wMs,
    bMs,
    turn,
    clockRunning,
    serverNow,
    lastTurnStartedAt,
    serverTimeOffsetMs: serverNow - clientNow,
  };
}

interface UseSpectateReturn {
  gameState: SpectateGameState | null;
  timerSnapshot: TimerSnapshot | null;
  loading: boolean;
  error: string | null;
  lastMove: { from: string; to: string } | null;
}

export function useSpectate(targetUserId: string | undefined): UseSpectateReturn {
  const [gameState, setGameState] = useState<SpectateGameState | null>(null);
  const [timerSnapshot, setTimerSnapshot] = useState<TimerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const spectatingRef = useRef(false);
  const gameIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!targetUserId) {
      setError('No target user specified.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleMessage = (data: unknown) => {
      if (cancelled) return;
      if (typeof data !== 'object' || data === null || !('type' in data)) return;
      const msg = data as { type: string; [key: string]: unknown };

      switch (msg.type) {
        case 'spectate_started': {
          const payload = msg as any;
          const newGameId = payload.gameId || '';
          gameIdRef.current = newGameId;
          setGameState({
            gameId: newGameId,
            dbGameId: payload.dbGameId,
            fen: payload.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            turn: payload.turn || 'w',
            whiteId: payload.whiteId || '',
            blackId: payload.blackId || '',
            wager: payload.wager || 0,
            isGameOver: payload.isEnded === true,
          });
          const snapshot = buildTimerSnapshot(payload, payload.turn || 'w');
          setTimerSnapshot(snapshot);
          setLoading(false);
          setError(null);
          spectatingRef.current = true;
          break;
        }

        case 'move_applied': {
          if (!spectatingRef.current) return;
          const payload = msg as any;
          // Only process moves for the game we're spectating
          if (payload.gameId && gameIdRef.current && payload.gameId !== gameIdRef.current) return;
          setGameState(prev => {
            if (!prev) return prev;
            return { ...prev, fen: payload.fen, turn: payload.turn };
          });
          const moveSnapshot = buildTimerSnapshot(payload, payload.turn);
          setTimerSnapshot(moveSnapshot);

          // Extract last move
          if (payload.move) {
            if (typeof payload.move === 'object') {
              setLastMove({ from: payload.move.from, to: payload.move.to });
            } else if (typeof payload.move === 'string' && payload.move.length >= 4) {
              setLastMove({
                from: payload.move.substring(0, 2),
                to: payload.move.substring(2, 4),
              });
            }
          }
          break;
        }

        case 'clock_snapshot':
        case 'clock_update': {
          if (!spectatingRef.current) return;
          const payload = msg as any;
          // Only process clock for the game we're spectating
          if (payload.gameId && gameIdRef.current && payload.gameId !== gameIdRef.current) return;
          const snapshot = buildTimerSnapshot(payload);
          setTimerSnapshot(snapshot);
          break;
        }

        case 'game_ended': {
          if (!spectatingRef.current) return;
          const payload = msg as any;
          // Only process game_ended for the game we're spectating
          if (payload.gameId && gameIdRef.current && payload.gameId !== gameIdRef.current) return;
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              isGameOver: true,
              gameEndReason: payload.reason,
              winnerColor: payload.winnerColor ?? null,
            };
          });
          setTimerSnapshot(null);
          break;
        }

        case 'spectator_count_update': {
          // Ignore — only relevant for players, not spectators
          break;
        }

        case 'error': {
          const payload = msg as any;
          if (payload.code === 'NO_ACTIVE_GAME' || payload.code === 'MISSING_TARGET' || payload.code === 'NOT_AUTHENTICATED') {
            setError(payload.message || 'Unable to spectate');
            setLoading(false);
          }
          break;
        }
      }
    };

    // Register message callback FIRST (before sending anything)
    unsubscribe = wsClient.onMessage(handleMessage);

    const sendSpectateMessage = () => {
      wsClient.send({ type: 'spectate_game', targetUserId });
    };

    const waitForConnectionThenSend = () => {
      if (wsClient.getStatus() === 'connected') {
        sendSpectateMessage();
        return;
      }

      // Poll every 300ms until connected, timeout after 10s
      pollIntervalId = setInterval(() => {
        if (cancelled) {
          if (pollIntervalId) clearInterval(pollIntervalId);
          return;
        }
        if (wsClient.getStatus() === 'connected') {
          if (pollIntervalId) clearInterval(pollIntervalId);
          pollIntervalId = null;
          sendSpectateMessage();
        }
      }, 300);

      timeoutId = setTimeout(() => {
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
        if (!cancelled && !spectatingRef.current) {
          setError('Failed to connect to game server. Please try again.');
          setLoading(false);
        }
      }, 10000);
    };

    // CRITICAL: Ensure wsClient is authenticated and connected.
    // The wsClient singleton may not have an auth token if useChessWebSocket
    // hasn't been mounted yet (e.g. user came from friends list, not a game page).
    const ensureConnected = async () => {
      if (cancelled) return;

      // Step 1: Ensure auth token is set
      if (!wsClient.hasAuthToken()) {
        try {
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (data.session?.access_token) {
            wsClient.setAuthToken(data.session.access_token);
          } else {
            setError('Not signed in. Please log in to spectate.');
            setLoading(false);
            return;
          }
        } catch {
          if (cancelled) return;
          setError('Authentication failed. Please try again.');
          setLoading(false);
          return;
        }
      }

      // Step 2: Ensure WS is connected (connect() is a no-op if already open/connecting)
      if (wsClient.getStatus() !== 'connected') {
        wsClient.connect();
      }

      // Step 3: Wait for connection, then send spectate_game
      waitForConnectionThenSend();
    };

    ensureConnected();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (pollIntervalId) clearInterval(pollIntervalId);
      if (timeoutId) clearTimeout(timeoutId);
      // Send leave_spectate on unmount
      if (spectatingRef.current) {
        wsClient.send({ type: 'leave_spectate' });
        spectatingRef.current = false;
        gameIdRef.current = null;
      }
    };
  }, [targetUserId]);

  return { gameState, timerSnapshot, loading, error, lastMove };
}
