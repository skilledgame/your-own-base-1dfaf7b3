/**
 * useSpectate Hook
 * 
 * Manages spectator WebSocket communication:
 * - Sends `spectate_game` to join as spectator
 * - Listens for `spectate_started`, `move_applied`, `clock_snapshot`, `game_ended`
 * - Returns game state (FEN, clocks, player info, isGameOver)
 * - Sends `leave_spectate` on unmount
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { wsClient } from '@/lib/wsClient';
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
  const targetRef = useRef(targetUserId);
  targetRef.current = targetUserId;

  useEffect(() => {
    if (!targetUserId) return;

    const handleMessage = (data: unknown) => {
      if (typeof data !== 'object' || data === null || !('type' in data)) return;
      const msg = data as { type: string; [key: string]: unknown };

      switch (msg.type) {
        case 'spectate_started': {
          const payload = msg as any;
          setGameState({
            gameId: payload.gameId || '',
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
          const snapshot = buildTimerSnapshot(payload);
          setTimerSnapshot(snapshot);
          break;
        }

        case 'game_ended': {
          if (!spectatingRef.current) return;
          const payload = msg as any;
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

    // Register message callback
    const unsubscribe = wsClient.onMessage(handleMessage);

    // Send spectate_game
    const sendSpectate = () => {
      if (wsClient.getStatus() === 'connected') {
        wsClient.send({ type: 'spectate_game', targetUserId });
      } else {
        // Wait for connection
        const checkInterval = setInterval(() => {
          if (wsClient.getStatus() === 'connected') {
            wsClient.send({ type: 'spectate_game', targetUserId });
            clearInterval(checkInterval);
          }
        }, 500);
        // Timeout after 10s
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!spectatingRef.current) {
            setError('Failed to connect to game server');
            setLoading(false);
          }
        }, 10000);
      }
    };

    sendSpectate();

    return () => {
      unsubscribe();
      // Send leave_spectate on unmount
      if (spectatingRef.current) {
        wsClient.send({ type: 'leave_spectate' });
        spectatingRef.current = false;
      }
    };
  }, [targetUserId]);

  return { gameState, timerSnapshot, loading, error, lastMove };
}
