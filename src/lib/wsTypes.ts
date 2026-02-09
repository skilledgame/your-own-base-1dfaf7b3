/**
 * WebSocket Message Types
 * Protocol for the chess server with wager-based matchmaking
 */

// ============ Connection Status ============
export type WSConnectionStatus = 
  | "disconnected" 
  | "connecting" 
  | "connected" 
  | "reconnecting";

// ============ Game State Machine ============
export type GamePhase = 
  | "idle" 
  | "searching" 
  | "in_game" 
  | "game_over";

// ============ Outbound Messages ============

/**
 * Find a match - sent when user clicks "Find Match"
 * Now requires wager amount
 */
export interface FindMatchMessage {
  type: "find_match";
  wager: number;            // Required wager amount (integer)
  player_ids: string[];     // REQUIRED: current user UUID(s) (never empty)
  playerName?: string;      // Display name to show opponent
}

/**
 * Cancel search - sent when user clicks "Cancel Search"
 */
export interface CancelSearchMessage {
  type: "cancel_search";
}

/**
 * Move - sent when user makes a move
 * Server expects UCI format string
 */
export interface MoveMessage {
  type: "move";
  move: string;  // UCI format: "e2e4" or "e7e8q" for promotion
}

/**
 * Resign - sent when user clicks "Exit" or "Resign"
 * Includes dbGameId (Supabase games.id) for wager settlement
 */
export interface ResignMessage {
  type: "resign";
  dbGameId?: string;  // Supabase games.id for credit transfer
  gameId?: string;    // WS game ID (optional, for logging)
}

/**
 * Leave game - alternative to resign
 */
export interface LeaveGameMessage {
  type: "leave_game";
}

/**
 * Request game sync - sent when client needs to resync game state
 * (e.g., after reconnect, tab focus, or refresh)
 */
export interface SyncGameMessage {
  type: "sync_game";
  gameId: string;
}

// All outbound message types
export type OutboundMessage =
  | FindMatchMessage
  | CancelSearchMessage
  | MoveMessage
  | ResignMessage
  | LeaveGameMessage
  | SyncGameMessage;

// ============ Inbound Messages ============

/**
 * Welcome - server acknowledges connection with user info
 */
export interface WelcomeMessage {
  type: "welcome";
  userId: string;
  playerName?: string;
}

/**
 * Searching - server confirms user is in queue
 */
export interface SearchingMessage {
  type: "searching";
  wager?: number;
}

/**
 * Match found - game is starting
 * Contains opponent info from server
 */
export interface MatchFoundMessage {
  type: "match_found";
  gameId: string;           // WS game ID
  dbGameId?: string;        // Supabase game ID for credits
  color: "w" | "b";         // "w" for white, "b" for black
  fen: string;
  wager: number;            // Wager amount for this game
  // New ms-precision clock snapshot
  wMs?: number;             // White remaining ms
  bMs?: number;             // Black remaining ms
  clockRunning?: boolean;   // false until first move is made
  serverNow?: number;       // Server Date.now() at send time
  lastMoveAt?: number | null; // Server timestamp when current turn started
  whiteId?: string;         // White player user ID
  blackId?: string;         // Black player user ID
  // Legacy seconds fields
  whiteTime?: number;       // Initial white time in seconds
  blackTime?: number;       // Initial black time in seconds
  serverTimeMs?: number;    // Server timestamp (legacy)
  opponent?: {
    name: string;
    playerId?: string;
  };
  opponentName?: string;    // Legacy field - use opponent.name if available
}

/**
 * Move applied - server has applied a move
 * Replace board state with this FEN (server is authoritative)
 */
export interface MoveAppliedMessage {
  type: "move_applied";
  gameId?: string;
  dbGameId?: string;
  fen: string;
  move: {
    from: string;
    to: string;
    promotion?: string;
  } | string;
  turn: "w" | "b";
  // New ms-precision clock snapshot
  wMs?: number;
  bMs?: number;
  clockRunning?: boolean;
  serverNow?: number;
  lastMoveAt?: number | null;
  whiteId?: string;
  blackId?: string;
  // Legacy seconds fields
  whiteTime?: number;
  blackTime?: number;
  serverTimeMs?: number;
}

/**
 * Game sync - server response to sync_game request
 * Contains full authoritative game state including clocks
 */
export interface GameSyncMessage {
  type: "game_sync";
  gameId: string;
  dbGameId?: string;
  fen: string;
  turn: "w" | "b";
  status: "active" | "ended";
  wager?: number;
  color?: "w" | "b";
  // New ms-precision clock snapshot
  wMs?: number;
  bMs?: number;
  clockRunning?: boolean;
  serverNow?: number;
  lastMoveAt?: number | null;
  whiteId?: string;
  blackId?: string;
  // Legacy seconds fields
  whiteTime: number;
  blackTime: number;
  serverTimeMs: number;
}

/**
 * Game ended - game is over
 */
export interface GameEndedMessage {
  type: "game_ended";
  gameId?: string;                // Optional WS game ID for logging
  reason: string;
  winnerColor: "w" | "b" | null;  // null = draw
  dbGameId?: string;              // For refreshing credits
  wager?: number;                 // Wager amount (for optimistic balance delta)
  creditsUpdated?: boolean;       // true = DB credits already updated, safe to refresh
}

/**
 * Opponent left - opponent disconnected or resigned
 */
export interface OpponentLeftMessage {
  type: "opponent_left";
  reason?: string;
}

/**
 * Error - something went wrong
 */
export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

// All inbound message types
export type InboundMessage =
  | WelcomeMessage
  | SearchingMessage
  | MatchFoundMessage
  | MoveAppliedMessage
  | GameSyncMessage
  | GameEndedMessage
  | OpponentLeftMessage
  | ErrorMessage
  | { type: string; [key: string]: unknown };  // Catch-all for unknown types

// ============ Debug Log Entry ============
export interface WSLogEntry {
  id: string;
  timestamp: Date;
  direction: "inbound" | "outbound";
  raw: string;
  parsed: unknown;
}
