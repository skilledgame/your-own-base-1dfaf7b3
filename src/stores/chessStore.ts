/**
 * Chess Game Zustand Store
 * 
 * GLOBAL state for chess multiplayer that persists across navigation.
 * This solves the state desync between the matchmaking flow and LiveGame page.
 * 
 * Extended to support wager-based matchmaking and balance tracking.
 */

import { create } from 'zustand';

export interface TimerSnapshot {
  /** White remaining time in milliseconds (server-authoritative at snapshot time) */
  wMs: number;
  /** Black remaining time in milliseconds */
  bMs: number;
  /** Whose turn to move — the running clock side */
  turn: 'w' | 'b';
  /** False until the first move is made; when false, clocks are frozen */
  clockRunning: boolean;
  /** Server's Date.now() when this snapshot was created */
  serverNow: number;
  /** Server timestamp when current turn began (null before first move) */
  lastTurnStartedAt: number | null;
  /**
   * Estimated offset between server and client clocks:
   *   serverTimeOffsetMs = serverNow - clientDateNowAtReceipt
   * Use: serverNowEstimate = Date.now() + serverTimeOffsetMs
   * This keeps the display tied to SERVER time, not client time.
   */
  serverTimeOffsetMs: number;
}

export type GamePhase = "idle" | "searching" | "in_game" | "game_over";

// Normalized matchmaking state (primitives only, no raw objects)
export type MatchmakingStatus = "idle" | "connecting" | "searching" | "matched" | "error";

export interface MatchmakingState {
  status: MatchmakingStatus;
  wager: number | null;
  matchId: string | null;           // WS game ID
  dbMatchId: string | null;         // Supabase game ID (for settlement)
  opponentUserId: string | null;    // Normalized: always user_id, never raw opponent object
  color: "w" | "b" | null;
  error?: string;
}

export interface GameState {
  gameId: string;          // WS game ID
  dbGameId?: string;       // Supabase game ID for credits
  color: "w" | "b";
  fen: string;
  turn: "w" | "b";
  isMyTurn: boolean;
  playerName: string;
  opponentName: string;
  wager: number;           // Wager amount for this game
}

export interface GameEndResult {
  reason: string;
  winnerColor: "w" | "b" | null;
  isWin: boolean;
  isDraw: boolean;
  isOpponentLeft: boolean;
  message: string;
  creditsChange?: number;  // How much credits changed (+ or -)
}

// Premove state - stored at store level for persistence
export interface PremoveState {
  from: string;
  to: string;
  promotion?: string;
}

interface ChessStore {
  // State
  phase: GamePhase;
  gameState: GameState | null;
  gameEndResult: GameEndResult | null;
  playerName: string;
  // Removed playerCredits - use balanceStore.skilledCoins instead
  selectedWager: number;       // Selected wager for next match
  isAuthenticated: boolean;    // Whether user is signed in
  matchmaking: MatchmakingState;  // Normalized matchmaking state
  timerSnapshot: TimerSnapshot | null;  // Server-authoritative timer snapshot
  premove: PremoveState | null;  // Queued premove (only one at a time)
  versusScreenPending: boolean;  // True when match_found fires — consumed once by LiveGame
  
  // Actions
  setPhase: (phase: GamePhase) => void;
  setGameState: (gameState: GameState | null) => void;
  setGameEndResult: (result: GameEndResult | null) => void;
  setPlayerName: (name: string) => void;
  // Removed setPlayerCredits - balance managed by balanceStore
  setSelectedWager: (wager: number) => void;
  setAuthenticated: (auth: boolean) => void;
  
  // Update FEN and turn from server
  updateFromServer: (fen: string, turn: "w" | "b") => void;
  
  // Clear game end result
  clearGameEnd: () => void;
  // Full reset
  resetAll: () => void;
  
  // Convenience: set match found state atomically
  handleMatchFound: (data: {
    gameId: string;
    dbGameId?: string;
    color: "w" | "b";
    fen: string;
    playerName: string;
    opponentName: string;
    wager: number;
  }) => void;
  
  // Convenience: handle game end
  handleGameEnd: (data: {
    reason: string;
    winnerColor: "w" | "b" | null;
    isOpponentLeft: boolean;
    creditsChange?: number;
  }) => void;
  
  // Matchmaking state management (normalized)
  setMatchmakingStatus: (status: MatchmakingStatus) => void;
  setMatchmakingMatch: (data: { matchId: string; dbMatchId?: string; opponentUserId?: string; color?: "w" | "b"; wager?: number }) => void;
  setMatchmakingError: (error: string) => void;
  resetMatchmaking: () => void;
  
  // Timer snapshot (server-authoritative)
  updateTimerSnapshot: (snapshot: TimerSnapshot) => void;
  clearTimerSnapshot: () => void;
  
  // Premove management
  setPremove: (premove: PremoveState | null) => void;
  clearPremove: () => void;
  
  // Versus screen
  consumeVersusScreen: () => void;
}

export const useChessStore = create<ChessStore>((set, get) => ({
  // Initial state
  phase: "idle",
  gameState: null,
  gameEndResult: null,
  playerName: "Player",
  // Removed playerCredits - use balanceStore.skilledCoins instead
  selectedWager: 10,  // Default wager
  isAuthenticated: false,
  matchmaking: {
    status: "idle",
    wager: null,
    matchId: null,
    dbMatchId: null,
    opponentUserId: null,
    color: null,
  },
  timerSnapshot: null,
  premove: null,
  versusScreenPending: false,
  
  // Actions
  setPhase: (phase) => {
    console.log("[ChessStore] setPhase:", phase);
    set({ phase });
  },
  
  setGameState: (gameState) => {
    console.log("[ChessStore] setGameState:", gameState);
    set({ gameState });
  },
  
  setGameEndResult: (gameEndResult) => {
    console.log("[ChessStore] setGameEndResult:", gameEndResult);
    set({ gameEndResult });
  },
  
  setPlayerName: (playerName) => {
    set({ playerName });
  },
  
  // Removed setPlayerCredits - balance managed by balanceStore
  
  setSelectedWager: (selectedWager) => {
    console.log("[ChessStore] setSelectedWager:", selectedWager);
    set({ selectedWager });
  },
  
  setAuthenticated: (isAuthenticated) => {
    console.log("[ChessStore] setAuthenticated:", isAuthenticated);
    set({ isAuthenticated });
  },
  
  updateFromServer: (fen, turn) => {
    const { gameState } = get();
    if (!gameState) {
      console.warn("[ChessStore] updateFromServer called but no gameState");
      return;
    }
    
    set({
      gameState: {
        ...gameState,
        fen,
        turn,
        isMyTurn: gameState.color === turn,
      },
    });
  },
  
  resetAll: () => {
    console.log("[ChessStore] resetAll - clearing all game state, timestamp:", new Date().toISOString());
    set({
      phase: "idle",
      gameState: null,
      gameEndResult: null,
      timerSnapshot: null,
      premove: null,  // Clear premove on reset
      versusScreenPending: false,
      matchmaking: {
        status: "idle",
        wager: null,
        matchId: null,
        dbMatchId: null,
        opponentUserId: null,
        color: null,
      },
    });
  },
  
  // Matchmaking state management
  setMatchmakingStatus: (status) => {
    set((state) => ({
      matchmaking: { ...state.matchmaking, status },
    }));
  },
  
  setMatchmakingMatch: (data) => {
    set((state) => {
      const newState = {
        matchmaking: {
          ...state.matchmaking,
          status: "matched" as const,
          matchId: data.matchId || null,
          dbMatchId: data.dbMatchId || null,
          opponentUserId: data.opponentUserId || null,
          color: data.color || null,
          wager: data.wager ?? state.matchmaking.wager,
          error: undefined, // Clear error on successful match
        },
      };
      return newState;
    });
  },
  
  setMatchmakingError: (error) => {
    set((state) => ({
      matchmaking: {
        ...state.matchmaking,
        status: "error",
        error,
      },
    }));
  },
  
  resetMatchmaking: () => {
    set({
      matchmaking: {
        status: "idle",
        wager: null,
        matchId: null,
        dbMatchId: null,
        opponentUserId: null,
        color: null,
      },
    });
  },
  
  updateTimerSnapshot: (snapshot) => {
    set({ timerSnapshot: snapshot });
  },
  
  clearTimerSnapshot: () => {
    set({ timerSnapshot: null });
  },
  
  setPremove: (premove) => {
    console.log("[ChessStore] setPremove:", premove);
    set({ premove });
  },
  
  clearPremove: () => {
    console.log("[ChessStore] clearPremove");
    set({ premove: null });
  },
  
  consumeVersusScreen: () => {
    set({ versusScreenPending: false });
  },
  
  clearGameEnd: () => {
    console.log("[ChessStore] clearGameEnd");
    set({ gameEndResult: null });
  },
  
  handleMatchFound: ({ gameId, dbGameId, color, fen, playerName, opponentName, wager }) => {
    console.log("[ChessStore] handleMatchFound - SETTING phase=in_game:", { gameId, dbGameId, color, fen, playerName, opponentName, wager, timestamp: new Date().toISOString() });
    
    const isMyTurn = color === "w"; // White moves first
    
    // IMPORTANT: Clear any previous game end result FIRST
    set({
      phase: "in_game",
      gameEndResult: null,  // Clear previous game result
      gameState: {
        gameId,
        dbGameId,
        color,
        fen,
        turn: "w",
        isMyTurn,
        playerName,
        opponentName,
        wager,
      },
    });
    
    console.log("[ChessStore] State transition: searching/idle -> in_game", {
      gameId,
      color,
      playerName,
      timestamp: new Date().toISOString(),
    });
    
    console.log("[ChessStore] handleMatchFound - state updated, phase is now:", get().phase);
  },
  
  handleGameEnd: ({ reason, winnerColor, isOpponentLeft, creditsChange }) => {
    const { gameState, phase: currentPhase, gameEndResult } = get();
    
    // GUARD: If we're already in game_over phase, ignore duplicate game_ended messages
    if (currentPhase === "game_over") {
      console.warn("[ChessStore] handleGameEnd IGNORED - already in game_over phase, reason:", reason);
      return;
    }
    
    // GUARD: If we're not in a game, ignore stale game_ended messages
    if (currentPhase !== "in_game") {
      console.warn("[ChessStore] handleGameEnd IGNORED - not in_game phase, current phase:", currentPhase);
      return;
    }
    
    // GUARD: Ensure gameState exists
    if (!gameState) {
      console.warn("[ChessStore] handleGameEnd IGNORED - no gameState");
      return;
    }
    
    // GUARD: If gameEndResult already exists, this is a duplicate - ignore
    if (gameEndResult) {
      console.warn("[ChessStore] handleGameEnd IGNORED - gameEndResult already exists:", gameEndResult);
      return;
    }
    
    const myColor = gameState.color || null;
    
    // Safely determine win/loss/draw
    const isWin = myColor !== null && myColor === winnerColor;
    const isDraw = winnerColor === null && reason !== "disconnect" && reason !== "opponent_disconnect";
    
    // Format message safely
    let message = reason || "Game ended";
    if (isOpponentLeft) {
      message = "Opponent left the game - you win!";
    } else if (isDraw) {
      message = `Draw: ${message}`;
    } else if (isWin) {
      message = `You won! ${message}`;
    } else {
      message = `You lost: ${message}`;
    }
    
    console.log("[ChessStore] handleGameEnd - SETTING phase=game_over:", { 
      reason, 
      winnerColor, 
      isWin, 
      isDraw, 
      isOpponentLeft, 
      message, 
      creditsChange, 
      gameId: gameState.gameId,
      timestamp: new Date().toISOString() 
    });
    
    // Batch all state updates in a single set() call for performance
    // Clear timer snapshot immediately to prevent any further timer calculations
    set({
      phase: "game_over",
      gameEndResult: {
        reason: reason || "game_over",  // Ensure reason is never undefined
        winnerColor: winnerColor ?? null,  // Ensure null if undefined
        isWin,
        isDraw,
        isOpponentLeft: isOpponentLeft ?? false,  // Ensure boolean
        message,
        creditsChange: creditsChange ?? 0,  // Ensure number
      },
      timerSnapshot: null, // Clear timer snapshot on game end
      premove: null,  // Clear premove on game end
      versusScreenPending: false,  // Never show VS screen on game end
      // Keep gameState so we can still render the final board position
    });
  },
}));
