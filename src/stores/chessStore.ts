/**
 * Chess Game Zustand Store
 * 
 * GLOBAL state for chess multiplayer that persists across navigation.
 * This solves the state desync between QuickPlay and LiveGame pages.
 * 
 * Extended to support wager-based matchmaking and balance tracking.
 */

import { create } from 'zustand';

export type GamePhase = "idle" | "searching" | "in_game" | "game_over";

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

interface ChessStore {
  // State
  phase: GamePhase;
  gameState: GameState | null;
  gameEndResult: GameEndResult | null;
  playerName: string;
  playerCredits: number;       // Current user's balance
  selectedWager: number;       // Selected wager for next match
  isAuthenticated: boolean;    // Whether user is signed in
  
  // Actions
  setPhase: (phase: GamePhase) => void;
  setGameState: (gameState: GameState | null) => void;
  setGameEndResult: (result: GameEndResult | null) => void;
  setPlayerName: (name: string) => void;
  setPlayerCredits: (credits: number) => void;
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
}

export const useChessStore = create<ChessStore>((set, get) => ({
  // Initial state
  phase: "idle",
  gameState: null,
  gameEndResult: null,
  playerName: "Player",
  playerCredits: 0,
  selectedWager: 10,  // Default wager
  isAuthenticated: false,
  
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
  
  setPlayerCredits: (playerCredits) => {
    console.log("[ChessStore] setPlayerCredits:", playerCredits);
    set({ playerCredits });
  },
  
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
    });
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
    
    console.log("[ChessStore] handleMatchFound - state updated, phase is now:", get().phase);
  },
  
  handleGameEnd: ({ reason, winnerColor, isOpponentLeft, creditsChange }) => {
    const { gameState, phase: currentPhase } = get();
    
    // GUARD: If we're not in a game, ignore stale game_ended messages
    if (currentPhase !== "in_game") {
      console.warn("[ChessStore] handleGameEnd IGNORED - not in_game phase, current phase:", currentPhase);
      return;
    }
    
    const myColor = gameState?.color || null;
    
    const isWin = myColor !== null && myColor === winnerColor;
    const isDraw = winnerColor === null && reason !== "disconnect" && reason !== "opponent_disconnect";
    
    let message = reason;
    if (isOpponentLeft) {
      message = "Opponent left the game - you win!";
    } else if (isDraw) {
      message = `Draw: ${reason}`;
    } else if (isWin) {
      message = `You won! ${reason}`;
    } else {
      message = `You lost: ${reason}`;
    }
    
    console.log("[ChessStore] handleGameEnd - SETTING phase=game_over:", { reason, winnerColor, isWin, isDraw, isOpponentLeft, message, creditsChange, timestamp: new Date().toISOString() });
    
    set({
      phase: "game_over",
      gameEndResult: {
        reason,
        winnerColor,
        isWin,
        isDraw,
        isOpponentLeft,
        message,
        creditsChange,
      },
      // Keep gameState so we can still render the final board position
    });
  },
}));
