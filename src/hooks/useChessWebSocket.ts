/**
 * useChessWebSocket Hook
 * 
 * React hook for the chess WebSocket server with auth and wager support.
 * Uses Zustand store for GLOBAL state that persists across navigation.
 * 
 * PART D: Performance improvements:
 * - Memoized callbacks with useCallback
 * - Throttled balance refresh
 * - No unnecessary rerenders
 * - Uses AuthContext instead of redundant auth checks
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { wsClient } from '@/lib/wsClient';
import { useChessStore } from '@/stores/chessStore';
import { useBalanceStore } from '@/stores/balanceStore';
import { supabase } from '@/integrations/supabase/client';
import type { 
  WSConnectionStatus, 
  MatchFoundMessage,
  MoveAppliedMessage,
  GameEndedMessage,
  OpponentLeftMessage,
  ErrorMessage,
  WelcomeMessage,
  WSLogEntry
} from '@/lib/wsTypes';

interface UseChessWebSocketReturn {
  // Connection
  status: WSConnectionStatus;
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Auth state
  isAuthenticated: boolean;
  refreshAuth: () => Promise<boolean>;
  
  // Matchmaking
  findMatch: (wager: number, playerName?: string) => void;
  cancelSearch: () => void;
  
  // Game actions
  sendMove: (from: string, to: string, promotion?: string) => void;
  resignGame: () => void;
  clearGameEnd: () => void;
  
  // Balance
  refreshBalance: () => Promise<void>;
  
  // Debug
  logs: WSLogEntry[];
  clearLogs: () => void;
  sendRaw: (json: string) => void;
  reconnectAttempts: number;
}

// Track if message handler has been registered globally
let messageHandlerRegistered = false;
let navigationCallback: ((path: string) => void) | null = null;
let balanceRefreshCallback: (() => void) | null = null;

/**
 * Initialize the global message handler ONCE
 * This is called from the hook but only registers once
 */
function initializeGlobalMessageHandler(): void {
  if (messageHandlerRegistered) {
    return;
  }
  
  messageHandlerRegistered = true;
  console.log("[Chess WS] Registering global message handler");
  
  wsClient.onMessage((data: unknown) => {
    if (typeof data !== 'object' || data === null || !('type' in data)) {
      console.warn("[Chess WS] Unknown message format:", data);
      return;
    }

    const msg = data as { type: string; [key: string]: unknown };
    const clientId = wsClient.getClientId();
    
    // ALWAYS read current state from store via getState() - never closures!
    const store = useChessStore.getState();
    
    switch (msg.type) {
      case "welcome": {
        const payload = msg as unknown as WelcomeMessage;
        console.log("[Chess WS]", clientId, "Welcome from server:", payload);
        toast.success("Connected to game server");
        break;
      }
      
      case "searching": {
        console.log("[Chess WS]", clientId, "Searching for opponent...");
        store.setPhase("searching");
        store.setMatchmakingStatus("searching");
        break;
      }
      
      case "match_found": {
        const payload = msg as unknown as MatchFoundMessage;
        
        // STEP D: Normalize IDs immediately from various possible fields
        const matchId = payload?.gameId ?? payload?.game_id ?? (payload as any)?.matchId ?? (payload as any)?.match_id ?? null;
        const dbMatchId = payload?.dbGameId ?? (payload as any)?.dbGameId ?? (payload as any)?.db_game_id ?? null;
        const color = payload?.color ?? null;
        const fen = payload?.fen ?? null;
        
        // Normalize opponent userId (profiles uses user_id, not id)
        const opponentUserId = 
          (payload as any)?.opponentUserId ??
          (payload as any)?.opponent_user_id ??
          payload?.opponent?.user_id ??
          payload?.opponent?.userId ??
          payload?.opponent?.playerId ??
          payload?.opponent?.player_id ??
          payload?.opponent?.id ??
          null;
        
        const wager = typeof payload?.wager === 'number' ? payload.wager : 0;
        
        // STEP D: Validate required fields before updating state
        if (!matchId || !color || !fen) {
          const errorMsg = `MATCH_FOUND missing required fields: matchId=${!!matchId}, color=${!!color}, fen=${!!fen}`;
          console.error("[Chess WS] Invalid match_found payload:", payload, errorMsg);
          store.setMatchmakingError(errorMsg);
          break;
        }
        
        console.log("[Chess WS] MATCH_FOUND received (normalized):", {
          clientId,
          matchId,
          dbMatchId,
          color,
          opponentUserId,
          wager,
          timestamp: new Date().toISOString()
        });
        
        // Update wsClient tracking
        wsClient.setSearching(false);
        wsClient.setInGame(true);
        
        // Get opponent name from payload (try new format first, then legacy)
        const opponentName = payload.opponent?.name || (payload as any).opponentName || "Opponent";
        
        // STEP D: Update normalized matchmaking state
        store.setMatchmakingMatch({
          matchId,
          dbMatchId: dbMatchId || undefined,
          opponentUserId: opponentUserId || undefined,
          color,
          wager,
        });
        
        // Atomically update game store
        store.handleMatchFound({
          gameId: matchId,
          dbGameId: dbMatchId || undefined,
          color,
          fen,
          playerName: store.playerName,
          opponentName,
          wager,
        });
        
        toast.success(`Match found! You play as ${color === "w" ? "White" : "Black"}. Wager: ${wager} SC`);
        
        // Navigate using the callback - CRITICAL: WS must stay open during navigation
        if (navigationCallback && matchId) {
          console.log("[Chess WS] NAVIGATING to game:", `/game/live/${matchId}`);
          navigationCallback(`/game/live/${matchId}`);
        }
        break;
      }
      
      case "move_applied": {
        const payload = msg as unknown as MoveAppliedMessage;
        console.log("[Chess WS]", clientId, "Move applied:", payload);
        
        // Update FEN from server (server is authoritative)
        store.updateFromServer(payload.fen, payload.turn);
        break;
      }
      
      case "game_ended": {
        const payload = msg as unknown as GameEndedMessage;
        console.log("[Chess WS] GAME_ENDED received:", {
          clientId,
          reason: payload.reason,
          winnerColor: payload.winnerColor,
          timestamp: new Date().toISOString()
        });
        
        wsClient.setSearching(false);
        wsClient.setInGame(false);
        
        const isOpponentLeft = payload.reason === "disconnect" || 
                               payload.reason === "opponent_disconnect" ||
                               payload.reason === "opponent_resigned";
        
        // Calculate credits change based on outcome
        const currentState = useChessStore.getState();
        const myColor = currentState.gameState?.color || null;
        const wager = currentState.gameState?.wager || 0;
        let creditsChange = 0;
        
        if (payload.winnerColor === myColor) {
          creditsChange = wager;  // Won the wager
        } else if (payload.winnerColor !== null) {
          creditsChange = -wager;  // Lost the wager
        }
        // Draw = no change
        
        store.handleGameEnd({
          reason: payload.reason,
          winnerColor: payload.winnerColor,
          isOpponentLeft,
          creditsChange,
        });
        
        // Trigger balance refresh via callback (throttled)
        if (balanceRefreshCallback) {
          balanceRefreshCallback();
        }
        
        if (isOpponentLeft) {
          toast.info("Opponent left the game");
        } else if (payload.winnerColor === null) {
          toast.info(`Game over: ${payload.reason}`);
        }
        break;
      }
      
      case "opponent_left": {
        const payload = msg as unknown as OpponentLeftMessage;
        console.log("[Chess WS]", clientId, "Opponent left:", payload);
        
        wsClient.setSearching(false);
        wsClient.setInGame(false);
        
        // Current player wins by default when opponent leaves
        const currentState = useChessStore.getState();
        const myColor = currentState.gameState?.color || null;
        const wager = currentState.gameState?.wager || 0;
        
        store.handleGameEnd({
          reason: payload.reason || "opponent_disconnect",
          winnerColor: myColor,
          isOpponentLeft: true,
          creditsChange: wager,  // Win the wager
        });
        
        // Trigger balance refresh
        if (balanceRefreshCallback) {
          balanceRefreshCallback();
        }
        
        toast.info("Opponent left the game - you win!");
        break;
      }
      
      case "error": {
        const payload = msg as unknown as ErrorMessage;
        console.log("[Chess WS]", clientId, "Error:", payload.code, payload.message);
        
        // Handle "already in a game" desync
        if (payload.message?.toLowerCase().includes("already in") || 
            payload.code === "ALREADY_IN_GAME") {
          const currentPhase = useChessStore.getState().phase;
          
          if (currentPhase !== "in_game") {
            // Desync detected! Reset and reconnect
            console.log("[Chess WS] Desync detected - resetting");
            toast.error("Desynced with server. Reconnecting...");
            
            wsClient.disconnect();
            useChessStore.getState().resetAll();
            
            // Reconnect after short delay
            setTimeout(() => {
              wsClient.connect();
              toast.info("Reconnected. Please find match again.");
            }, 500);
            return;
          }
        }
        
        // Handle insufficient balance error
        if (payload.code === "INSUFFICIENT_BALANCE" || 
            payload.message?.toLowerCase().includes("insufficient")) {
          toast.error("Insufficient balance for this wager");
          useChessStore.getState().setPhase("idle");
          wsClient.setSearching(false);
          return;
        }
        
        toast.error(payload.message);
        break;
      }
      
      default:
        console.log("[Chess WS]", clientId, "Unknown message type:", msg.type, msg);
    }
  });
}

export function useChessWebSocket(): UseChessWebSocketReturn {
  const navigate = useNavigate();
  
  // Local state only for connection-related things
  const [status, setStatus] = useState<WSConnectionStatus>(wsClient.getStatus());
  const [logs, setLogs] = useState<WSLogEntry[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Refs for throttling
  const lastBalanceRefresh = useRef(0);
  const balanceRefreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Read global state from store
  const { 
    phase, 
    gameState, 
    playerName,
    setPhase,
    setPlayerName,
    // Removed setPlayerCredits - balance managed by balanceStore
    setAuthenticated,
    resetAll 
  } = useChessStore();
  
  const { fetchBalance } = useBalanceStore();
  
  // Throttled balance refresh - max once per 2 seconds
  const refreshBalance = useCallback(async () => {
    const now = Date.now();
    const MIN_INTERVAL = 2000;
    
    // Clear any pending refresh
    if (balanceRefreshTimeout.current) {
      clearTimeout(balanceRefreshTimeout.current);
      balanceRefreshTimeout.current = null;
    }
    
    // If recently refreshed, schedule for later
    if (now - lastBalanceRefresh.current < MIN_INTERVAL) {
      balanceRefreshTimeout.current = setTimeout(() => {
        refreshBalance();
      }, MIN_INTERVAL - (now - lastBalanceRefresh.current));
      return;
    }
    
    lastBalanceRefresh.current = now;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.id) {
        // Balance managed by balanceStore
        return;
      }
      
      // Use the balance store
      fetchBalance(user.id);
      
      // Balance is managed by balanceStore via profiles.skilled_coins realtime subscription
    } catch (error) {
      console.error("[Chess WS] Failed to refresh balance:", error);
    }
  }, [fetchBalance]);
  
  // Set up navigation and balance refresh callbacks for the global message handler
  useEffect(() => {
    navigationCallback = navigate;
    balanceRefreshCallback = refreshBalance;
    return () => {
      // Only clear if this is the one that set it
      if (navigationCallback === navigate) {
        navigationCallback = null;
      }
      if (balanceRefreshCallback === refreshBalance) {
        balanceRefreshCallback = null;
      }
    };
  }, [navigate, refreshBalance]);

  // Refresh auth token and set on wsClient
  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        console.log("[Chess WS] No session - user not authenticated");
        wsClient.setAuthToken(null);
        setIsAuthenticated(false);
        setAuthenticated(false);
        return false;
      }
      
      // Use access_token
      const token = data.session.access_token;
      wsClient.setAuthToken(token);
      setIsAuthenticated(true);
      setAuthenticated(true);
      console.log("[Chess WS] Auth token refreshed");
      return true;
    } catch (error) {
      console.error("[Chess WS] Failed to refresh auth:", error);
      wsClient.setAuthToken(null);
      setIsAuthenticated(false);
      setAuthenticated(false);
      return false;
    }
  }, [setAuthenticated]);

  // Initialize global message handler and subscribe to wsClient events
  useEffect(() => {
    // Initialize the global message handler (only once globally)
    initializeGlobalMessageHandler();
    
    // Subscribe to status changes
    const unsubStatus = wsClient.onStatus((newStatus) => {
      setStatus(newStatus);
      
      if (newStatus === "reconnecting") {
        setReconnectAttempts(prev => prev + 1);
      } else if (newStatus === "connected") {
        setReconnectAttempts(0);
      }
    });
    
    // Subscribe to logs (limit updates for performance)
    const unsubLog = wsClient.onLog((entry) => {
      setLogs(prev => {
        const next = [entry, ...prev];
        return next.slice(0, 30); // Reduced from 40 to 30
      });
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Chess WS] Auth state changed:", event);
      
      if (session?.access_token) {
        // Update token on wsClient
        wsClient.setAuthToken(session.access_token);
        setIsAuthenticated(true);
        setAuthenticated(true);
        
        // Reconnect if disconnected - with new token
        if (wsClient.getStatus() === "disconnected") {
          wsClient.connect();
        } else if (wsClient.getStatus() === "connected") {
          // CRITICAL: Do NOT reconnect if we're in a game - that would end the game!
          const currentPhase = useChessStore.getState().phase;
          if (currentPhase === "in_game" || currentPhase === "searching") {
            console.log("[Chess WS] Token updated but in game/searching - NOT reconnecting");
          } else {
            // Only reconnect if idle/game_over
            console.log("[Chess WS] Token updated - reconnecting (phase:", currentPhase, ")");
            wsClient.disconnect();
            setTimeout(() => wsClient.connect(), 100);
          }
        }
        
        // Refresh balance (throttled)
        refreshBalance();
      } else {
        console.log("[Chess WS] No session - clearing auth");
        wsClient.setAuthToken(null);
        setIsAuthenticated(false);
        setAuthenticated(false);
        wsClient.disconnect();
        resetAll();
      }
    });
    
    // Initial auth check and connect
    refreshAuth().then(hasAuth => {
      if (hasAuth) {
        wsClient.connect();
        refreshBalance();
      }
    });

    return () => {
      unsubStatus();
      unsubLog();
      subscription.unsubscribe();
      // DON'T disconnect on unmount - keep singleton alive
    };
  }, [refreshAuth, refreshBalance, setAuthenticated, resetAll]);

  // Memoized actions
  const connect = useCallback(async () => {
    const hasAuth = await refreshAuth();
    if (!hasAuth) {
      toast.error("Please sign in to play");
      return;
    }
    wsClient.connect();
  }, [refreshAuth]);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
    resetAll();
    wsClient.setSearching(false);
    wsClient.setInGame(false);
  }, [resetAll]);

  const findMatch = useCallback((wager: number, name?: string) => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.access_token) {
        console.log("[Chess WS] findMatch blocked - no valid session");
        toast.error("Please sign in again");
        wsClient.setAuthToken(null);
        setIsAuthenticated(false);
        setAuthenticated(false);
        return;
      }
      
      wsClient.setAuthToken(session.access_token);
      
      if (!isAuthenticated) {
        toast.error("Please sign in to play");
        return;
      }

      const userId = session.user?.id;

      if (!userId) {
        toast.error("Please sign in again");
        return;
      }

      const player_ids = [userId];
      const finalName = name || playerName || "Player";
      setPlayerName(finalName);

      const payload = {
        type: "find_match" as const,
        wager,
        player_ids,
        playerName: finalName,
      };

      console.log("[Chess WS] findMatch:", { wager, player_ids });

      setPhase("searching");
      wsClient.setSearching(true, finalName, wager, player_ids);
      wsClient.send(payload);
    })().catch((error) => {
      console.error("[Chess WS] findMatch failed:", error);
      toast.error("Please sign in again");
    });
  }, [isAuthenticated, playerName, setPlayerName, setPhase, setAuthenticated]);

  const cancelSearch = useCallback(() => {
    const payload = { type: "cancel_search" };
    wsClient.send(payload);
    wsClient.setSearching(false);
    setPhase("idle");
    useChessStore.getState().resetMatchmaking();
  }, [setPhase]);

  const sendMove = useCallback((from: string, to: string, promotion?: string) => {
    const currentGameState = useChessStore.getState().gameState;
    
    if (!currentGameState) {
      console.warn("[Chess WS] Cannot send move - no game state");
      return;
    }

    // Build UCI string: "e2e4" or "e7e8q" for promotion
    const uci = `${from.toLowerCase()}${to.toLowerCase()}${promotion ? promotion.toLowerCase() : ""}`;

    const payload = {
      type: "move" as const,
      move: uci,
    };

    console.log("[WS] sending move", { type: "move", move: uci });
    wsClient.send(payload);
  }, []);

  const resignGame = useCallback(() => {
    const currentGameState = useChessStore.getState().gameState;
    
    if (!currentGameState) {
      console.warn("[Chess WS] Cannot resign - no game state");
      return;
    }

    const payload = {
      type: "resign",
      gameId: currentGameState.gameId,
    };

    wsClient.send(payload);
  }, []);

  const clearGameEnd = useCallback(() => {
    useChessStore.getState().clearGameEnd();
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const sendRaw = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      wsClient.send(parsed);
    } catch (e) {
      console.error("[Chess WS] Invalid JSON:", e);
      toast.error("Invalid JSON");
    }
  }, []);

  // Memoize return object to prevent unnecessary rerenders
  return useMemo(() => ({
    status,
    connect,
    disconnect,
    isAuthenticated,
    refreshAuth,
    findMatch,
    cancelSearch,
    sendMove,
    resignGame,
    clearGameEnd,
    refreshBalance,
    logs,
    clearLogs,
    sendRaw,
    reconnectAttempts,
  }), [
    status,
    connect,
    disconnect,
    isAuthenticated,
    refreshAuth,
    findMatch,
    cancelSearch,
    sendMove,
    resignGame,
    clearGameEnd,
    refreshBalance,
    logs,
    clearLogs,
    sendRaw,
    reconnectAttempts,
  ]);
}
