/**
 * useChessWebSocket Hook
 * 
 * React hook for the chess WebSocket server with auth and wager support.
 * Uses Zustand store for GLOBAL state that persists across navigation.
 * 
 * SINGLE SOURCE OF TRUTH for chess multiplayer - no other backends!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { wsClient } from '@/lib/wsClient';
import { useChessStore } from '@/stores/chessStore';
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
let balanceRefreshCallback: (() => Promise<void>) | null = null;

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
        break;
      }
      
      case "match_found": {
        const payload = msg as unknown as MatchFoundMessage;
        console.log("[Chess WS]", clientId, "Match found:", payload);
        
        // Update wsClient tracking
        wsClient.setSearching(false);
        wsClient.setInGame(true);
        
        // Get opponent name from payload (try new format first, then legacy)
        const opponentName = payload.opponent?.name || payload.opponentName || "Opponent";
        const wager = payload.wager || 0;
        
        // Atomically update store
        store.handleMatchFound({
          gameId: payload.gameId,
          dbGameId: payload.dbGameId,
          color: payload.color,
          fen: payload.fen,
          playerName: store.playerName,
          opponentName,
          wager,
        });
        
        toast.success(`Match found! You play as ${payload.color === "w" ? "White" : "Black"}. Wager: ${wager} SC`);
        
        // Navigate using the callback
        if (navigationCallback) {
          navigationCallback(`/game/live/${payload.gameId}`);
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
        console.log("[Chess WS]", clientId, "Game ended:", payload);
        
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
        
        // Refresh balance after game ends
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
        
        // Refresh balance after game ends
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
  
  // Read global state from store
  const { 
    phase, 
    gameState, 
    playerName,
    setPhase,
    setPlayerName,
    setPlayerCredits,
    setAuthenticated,
    resetAll 
  } = useChessStore();
  
  // Refresh balance from Supabase - uses profiles table
  const refreshBalance = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPlayerCredits(0);
        return;
      }
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('skilled_coins')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileData) {
        setPlayerCredits(profileData.skilled_coins || 0);
        console.log("[Chess WS] Balance refreshed:", profileData.skilled_coins);
        return;
      }
      
      // No balance found - set to 0
      setPlayerCredits(0);
    } catch (error) {
      console.error("[Chess WS] Failed to refresh balance:", error);
    }
  }, [setPlayerCredits]);
  
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
    
    // Subscribe to logs
    const unsubLog = wsClient.onLog((entry) => {
      setLogs(prev => {
        const next = [entry, ...prev];
        return next.slice(0, 40);
      });
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Chess WS] Auth state changed:", event);
      
      if (session?.access_token) {
        wsClient.setAuthToken(session.access_token);
        setIsAuthenticated(true);
        setAuthenticated(true);
        
        // Reconnect if disconnected
        if (wsClient.getStatus() === "disconnected") {
          wsClient.connect();
        }
        
        // Refresh balance on sign in
        refreshBalance();
      } else {
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

  // Actions
  const connect = useCallback(async () => {
    // Refresh auth token before connecting
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
      if (!isAuthenticated) {
        toast.error("Please sign in to play");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

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

      console.log("invoking find_match", { player_ids, userIdPresent: !!userId });
      console.log("[WS OUT]", wsClient.getClientId(), payload);

      setPhase("searching");
      wsClient.setSearching(true, finalName, wager, player_ids);
      wsClient.send(payload);
    })().catch((error) => {
      console.error("[Chess WS] findMatch failed:", error);
      toast.error("Please sign in again");
    });
  }, [isAuthenticated, playerName, setPlayerName, setPhase]);

  const cancelSearch = useCallback(() => {
    const payload = { type: "cancel_search" };
    console.log("[WS OUT]", wsClient.getClientId(), payload);
    wsClient.send(payload);
    wsClient.setSearching(false);
    setPhase("idle");
  }, [setPhase]);

  const sendMove = useCallback((from: string, to: string, promotion?: string) => {
    // Read latest state from store
    const currentGameState = useChessStore.getState().gameState;
    
    if (!currentGameState) {
      console.warn("[Chess WS] Cannot send move - no game state");
      return;
    }

    const payload = {
      type: "move",
      gameId: currentGameState.gameId,
      from,
      to,
      promotion,
    };

    console.log("[WS OUT]", wsClient.getClientId(), payload);
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

    console.log("[WS OUT]", wsClient.getClientId(), payload);
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

  return {
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
  };
}
