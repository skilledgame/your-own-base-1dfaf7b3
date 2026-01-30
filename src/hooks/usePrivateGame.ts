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
  onGameEnd?: (winnerId: string | null, reason: string, winnerColor?: 'w' | 'b', creditsChange?: number) => void;
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
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now());
  const whiteTimeRef = useRef<number>(60);
  const blackTimeRef = useRef<number>(60);
  const currentTurnRef = useRef<'w' | 'b'>('w');
  const isGameActiveRef = useRef<boolean>(false);

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

        // Initialize refs with game times
        whiteTimeRef.current = game.white_time;
        blackTimeRef.current = game.black_time;
        currentTurnRef.current = game.current_turn as 'w' | 'b';
        isGameActiveRef.current = game.status === 'active';
        
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
            
            // Update refs when game state changes
            if (updated.white_time !== undefined) {
              whiteTimeRef.current = updated.white_time;
            }
            if (updated.black_time !== undefined) {
              blackTimeRef.current = updated.black_time;
            }
            if (updated.current_turn) {
              currentTurnRef.current = updated.current_turn as 'w' | 'b';
            }
            isGameActiveRef.current = (updated.status || prev.status) === 'active';
            
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
              const winnerColor = winnerId 
                ? (winnerId === updated.white_player_id ? 'w' : 'b')
                : null;
              // Credits change will be determined from settlement - reload game to get it
              onGameEnd?.(winnerId, updated.status === 'finished' ? 'Game finished' : 'Game cancelled', winnerColor as 'w' | 'b' | undefined);
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

  // Handle timeout - separate function to avoid async in interval
  // Must be defined before the useEffect that uses it
  const handleTimeout = useCallback(async (timedOutColor: 'w' | 'b') => {
    try {
      // Get game to find winner
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('white_player_id, black_player_id')
        .eq('id', gameId)
        .maybeSingle();

      if (gameError || !game) {
        console.error('[usePrivateGame] Error loading game for timeout:', gameError);
        return;
      }

      // Determine winner
      const winnerId = timedOutColor === 'w' ? game.black_player_id : game.white_player_id;
      const winnerColor = timedOutColor === 'w' ? 'b' : 'w';

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[usePrivateGame] No auth token for timeout');
        return;
      }

      // Call end-game Edge Function
      const { data, error } = await supabase.functions.invoke('end-game', {
        body: {
          gameId,
          winnerId,
          reason: 'timeout',
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || !data?.success) {
        console.error('[usePrivateGame] Error ending game on timeout:', error || data?.error);
        return;
      }

      const creditsChange = data.balances ? (data.balances.new_balance - data.balances.old_balance) : 0;
      onGameEnd?.(winnerId, 'timeout', winnerColor, creditsChange);
    } catch (error) {
      console.error('[usePrivateGame] Exception handling timeout:', error);
    }
  }, [gameId, onGameEnd]);

  // Timer countdown - uses refs to avoid race conditions
  useEffect(() => {
    if (!gameState || gameState.status !== 'active') {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      isGameActiveRef.current = false;
      return;
    }

    // Initialize refs from current state
    whiteTimeRef.current = gameState.whiteTime;
    blackTimeRef.current = gameState.blackTime;
    isGameActiveRef.current = true;

    // Countdown timer - updates refs and state every second
    timerIntervalRef.current = setInterval(() => {
      if (!isGameActiveRef.current) {
        return;
      }

      const currentTurn = currentTurnRef.current;
      
      // Decrement the time for the player whose turn it is
      if (currentTurn === 'w') {
        whiteTimeRef.current = Math.max(0, whiteTimeRef.current - 1);
        
        // Check for timeout
        if (whiteTimeRef.current === 0) {
          isGameActiveRef.current = false;
          // White loses on time - black wins
          handleTimeout('w');
          return;
        }
      } else {
        blackTimeRef.current = Math.max(0, blackTimeRef.current - 1);
        
        // Check for timeout
        if (blackTimeRef.current === 0) {
          isGameActiveRef.current = false;
          // Black loses on time - white wins
          handleTimeout('b');
          return;
        }
      }

      // Update state with ref values (for UI display)
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          whiteTime: whiteTimeRef.current,
          blackTime: blackTimeRef.current,
        };
      });
    }, 1000);

    // Sync timer with database every 5 seconds
    syncIntervalRef.current = setInterval(async () => {
      if (!isGameActiveRef.current) {
        return;
      }

      try {
        await supabase
          .from('games')
          .update({
            white_time: whiteTimeRef.current,
            black_time: blackTimeRef.current,
            updated_at: new Date().toISOString(),
          })
          .eq('id', gameId);
      } catch (error) {
        console.error('[usePrivateGame] Error syncing timer:', error);
      }
    }, 5000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [gameState?.status, gameId, handleTimeout]);

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

      // Get auth token for Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[usePrivateGame] No auth token available');
        toast.error('Please sign in again');
        return false;
      }

      // Send move via Edge Function
      let data, error;
      try {
        const response = await supabase.functions.invoke('make-move', {
          body: {
            gameId,
            from,
            to,
            promotion: promotion || 'q',
            whiteTime: newWhiteTime,
            blackTime: newBlackTime,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        data = response.data;
        error = response.error;
      } catch (networkError) {
        // Network error (function not reachable, CORS, etc.)
        console.error('[usePrivateGame] Network error calling Edge Function:', networkError);
        const networkErrorMessage = networkError instanceof Error 
          ? networkError.message 
          : 'Network error - please check your connection';
        toast.error(`Failed to connect to game server: ${networkErrorMessage}`);
        return false;
      }

      // Check for error in response.error or data.error
      if (error) {
        console.error('[usePrivateGame] Edge Function error:', error);
        // Check if it's a network/connection error
        if (error.message?.includes('Failed to send') || error.message?.includes('fetch')) {
          toast.error('Failed to connect to game server. Please check your internet connection.');
        } else {
          const errorMessage = error.message || 'Failed to make move';
          toast.error(errorMessage);
        }
        return false;
      }

      if (!data) {
        console.error('[usePrivateGame] No data in response');
        toast.error('Failed to make move - no response from server');
        return false;
      }

      if (!data.success) {
        const errorMessage = data.error || 'Failed to make move';
        console.error('[usePrivateGame] Move failed:', errorMessage, data);
        toast.error(errorMessage);
        return false;
      }

      // Move will be updated via Realtime subscription
      console.log('[usePrivateGame] Move sent successfully');
      return true;
    } catch (error) {
      console.error('[usePrivateGame] Exception sending move:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to make move';
      toast.error(errorMessage);
      return false;
    }
  }, [gameState, gameId, isWhite]);

  // Resign game
  const resign = useCallback(async () => {
    if (!gameState) {
      console.warn('[usePrivateGame] Cannot resign - no game state');
      return;
    }

    try {
      // Get current game to determine opponent
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('white_player_id, black_player_id')
        .eq('id', gameId)
        .maybeSingle();

      if (gameError || !game) {
        console.error('[usePrivateGame] Error loading game for resign:', gameError);
        toast.error('Failed to load game');
        return;
      }

      // Determine opponent as winner
      const opponentPlayerId = isWhite ? game.black_player_id : game.white_player_id;

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[usePrivateGame] No auth token for resign');
        toast.error('Please sign in again');
        return;
      }

      // Call end-game Edge Function
      const { data, error } = await supabase.functions.invoke('end-game', {
        body: {
          gameId,
          winnerId: opponentPlayerId, // Opponent wins
          reason: 'resignation',
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('[usePrivateGame] Error resigning:', error);
        toast.error(error.message || 'Failed to resign');
        return;
      }

      if (!data?.success) {
        console.error('[usePrivateGame] Resign failed:', data);
        toast.error(data?.error || 'Failed to resign');
        return;
      }

      // Determine winner color for callback
      const winnerColor = isWhite ? 'b' : 'w';
      const creditsChange = data.balances ? (data.balances.new_balance - data.balances.old_balance) : 0;

      // Call onGameEnd with proper winner info
      onGameEnd?.(opponentPlayerId, 'resignation', winnerColor, creditsChange);
    } catch (error) {
      console.error('[usePrivateGame] Exception resigning:', error);
      toast.error('Failed to resign');
    }
  }, [gameId, gameState, isWhite, onGameEnd]);

  return {
    gameState,
    sendMove,
    resign,
    loading,
  };
}
