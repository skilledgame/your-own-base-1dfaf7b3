/**
 * usePrivateGame Hook
 * 
 * Manages private games using Supabase Realtime instead of WebSocket.
 * Handles move sending, timer synchronization, and game state updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Chess } from 'chess.js';
import { toast } from 'sonner';

interface PrivateGameState {
  fen: string;
  currentTurn: 'w' | 'b';
  whiteTime: number;
  blackTime: number;
  status: string;
  isMyTurn: boolean;
}

interface UsePrivateGameOptions {
  gameId: string;
  playerColor: 'white' | 'black';
  playerId: string; // player.id from players table
  onGameEnd?: (winnerId: string | null, reason: string) => void;
}

interface UsePrivateGameReturn {
  gameState: PrivateGameState | null;
  sendMove: (from: string, to: string, promotion?: string) => Promise<boolean>;
  resign: () => Promise<void>;
  loading: boolean;
}

const TIME_INCREMENT = 3; // seconds added per move

export function usePrivateGame({
  gameId,
  playerColor,
  playerId,
  onGameEnd,
}: UsePrivateGameOptions): UsePrivateGameReturn {
  const [gameState, setGameState] = useState<PrivateGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now());

  const isWhite = playerColor === 'white';
  const myColor = isWhite ? 'w' : 'b';

  // Load initial game state
  useEffect(() => {
    const loadGame = async () => {
      try {
        const { data: game, error } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .maybeSingle();

        if (error || !game) {
          console.error('[usePrivateGame] Error loading game:', error);
          toast.error('Failed to load game');
          setLoading(false);
          return;
        }

        setGameState({
          fen: game.fen,
          currentTurn: game.current_turn as 'w' | 'b',
          whiteTime: game.white_time,
          blackTime: game.black_time,
          status: game.status,
          isMyTurn: (game.current_turn as 'w' | 'b') === myColor,
        });
        setLoading(false);
      } catch (error) {
        console.error('[usePrivateGame] Error:', error);
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId, myColor]);

  // Subscribe to game updates via Realtime
  useEffect(() => {
    if (!gameId) return;

    console.log('[usePrivateGame] Setting up Realtime subscription for game:', gameId);
    
    const channel = supabase
      .channel(`private-game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          console.log('[usePrivateGame] Game updated via Realtime:', updated);
          
          setGameState(prev => {
            if (!prev) return prev;
            
            const newState = {
              fen: updated.fen || prev.fen,
              currentTurn: (updated.current_turn || prev.currentTurn) as 'w' | 'b',
              whiteTime: updated.white_time ?? prev.whiteTime,
              blackTime: updated.black_time ?? prev.blackTime,
              status: updated.status || prev.status,
              isMyTurn: (updated.current_turn || prev.currentTurn) === myColor,
            };

            // Check for game end
            if (updated.status === 'finished' || updated.status === 'cancelled') {
              const winnerId = updated.winner_id || null;
              onGameEnd?.(winnerId, updated.status === 'finished' ? 'Game finished' : 'Game cancelled');
            }

            return newState;
          });
        }
      )
      .subscribe((status) => {
        console.log('[usePrivateGame] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('[usePrivateGame] Cleaning up Realtime subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [gameId, myColor, onGameEnd]);

  // Timer countdown - syncs with database every 5 seconds
  useEffect(() => {
    if (!gameState || gameState.status !== 'active') {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(async () => {
      const now = Date.now();
      
      // Update local timer every second
      setGameState(prev => {
        if (!prev) return prev;
        
        let newWhiteTime = prev.whiteTime;
        let newBlackTime = prev.blackTime;
        
        // Decrement the time for the player whose turn it is
        if (prev.currentTurn === 'w') {
          newWhiteTime = Math.max(0, prev.whiteTime - 1);
          
          // Check for timeout
          if (newWhiteTime === 0) {
            // White loses on time - need to get black player ID from game
            // Call end-game Edge Function to handle timeout
            supabase.functions.invoke('end-game', {
              body: {
                gameId,
                winnerId: null, // Will be determined by server based on timeout
                reason: 'timeout',
              },
            }).catch(err => console.error('[usePrivateGame] Error ending game on timeout:', err));
            onGameEnd?.(null, 'timeout');
            return prev;
          }
        } else {
          newBlackTime = Math.max(0, prev.blackTime - 1);
          
          // Check for timeout
          if (newBlackTime === 0) {
            // Black loses on time - need to get white player ID from game
            // Call end-game Edge Function to handle timeout
            supabase.functions.invoke('end-game', {
              body: {
                gameId,
                winnerId: null, // Will be determined by server based on timeout
                reason: 'timeout',
              },
            }).catch(err => console.error('[usePrivateGame] Error ending game on timeout:', err));
            onGameEnd?.(null, 'timeout');
            return prev;
          }
        }

        // Sync with database every 5 seconds
        if (now - lastSyncTimeRef.current > 5000) {
          lastSyncTimeRef.current = now;
          
          // Update database with current time values
          supabase
            .from('games')
            .update({
              white_time: newWhiteTime,
              black_time: newBlackTime,
              updated_at: new Date().toISOString(),
            })
            .eq('id', gameId)
            .then(({ error }) => {
              if (error) {
                console.error('[usePrivateGame] Error syncing timer:', error);
              }
            });
        }

        return {
          ...prev,
          whiteTime: newWhiteTime,
          blackTime: newBlackTime,
        };
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [gameState, gameId, onGameEnd]);

  // Send move via Edge Function
  const sendMove = useCallback(async (from: string, to: string, promotion?: string): Promise<boolean> => {
    if (!gameState || !gameState.isMyTurn || gameState.status !== 'active') {
      console.warn('[usePrivateGame] Cannot send move - not your turn or game not active');
      return false;
    }

    try {
      // Validate move locally first
      const chess = new Chess(gameState.fen);
      const move = chess.move({ from, to, promotion: promotion || 'q' });
      
      if (!move) {
        console.warn('[usePrivateGame] Invalid move:', from, to);
        return false;
      }

      // Calculate new time (add increment to current player)
      const newWhiteTime = isWhite 
        ? gameState.whiteTime + TIME_INCREMENT 
        : gameState.whiteTime;
      const newBlackTime = !isWhite 
        ? gameState.blackTime + TIME_INCREMENT 
        : gameState.blackTime;

      // Send move via Edge Function
      const { data, error } = await supabase.functions.invoke('make-move', {
        body: {
          gameId,
          from,
          to,
          promotion: promotion || 'q',
          whiteTime: newWhiteTime,
          blackTime: newBlackTime,
        },
      });

      if (error || !data?.success) {
        console.error('[usePrivateGame] Error sending move:', error || data?.error);
        toast.error(data?.error || 'Failed to make move');
        return false;
      }

      // Move will be updated via Realtime subscription
      return true;
    } catch (error) {
      console.error('[usePrivateGame] Exception sending move:', error);
      toast.error('Failed to make move');
      return false;
    }
  }, [gameState, gameId, isWhite]);

  // Resign game
  const resign = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('end-game', {
        body: {
          gameId,
          winnerId: null, // Opponent wins
          reason: 'resignation',
        },
      });

      if (error) {
        console.error('[usePrivateGame] Error resigning:', error);
        toast.error('Failed to resign');
      }
    } catch (error) {
      console.error('[usePrivateGame] Exception resigning:', error);
      toast.error('Failed to resign');
    }
  }, [gameId]);

  return {
    gameState,
    sendMove,
    resign,
    loading,
  };
}
