/**
 * Chess Game Constants
 * Centralized configuration for time control, material values, and game rules
 */

// ============ Time Control ============
export const CHESS_TIME_CONTROL = {
  /** Base time in seconds (1 minute) */
  BASE_TIME: 60,
  /** Increment per move in seconds */
  INCREMENT: 5,
  /** Low time warning threshold in seconds */
  LOW_TIME_THRESHOLD: 10,
  /** Critical time threshold in seconds */
  CRITICAL_TIME_THRESHOLD: 5,
} as const;

// ============ Material Values ============
export const PIECE_VALUES: Record<string, number> = {
  p: 1,  // Pawn
  n: 3,  // Knight
  b: 3,  // Bishop
  r: 5,  // Rook
  q: 9,  // Queen
  k: 0,  // King (infinite, but 0 for material calc)
} as const;

// ============ Piece Symbols ============
export const PIECE_SYMBOLS: Record<string, string> = {
  'wp': '♙', 'wn': '♘', 'wb': '♗', 'wr': '♖', 'wq': '♕', 'wk': '♔',
  'bp': '♟', 'bn': '♞', 'bb': '♝', 'br': '♜', 'bq': '♛', 'bk': '♚',
} as const;

// Small piece symbols for captured pieces display
export const PIECE_SYMBOLS_SMALL: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
} as const;

// ============ Board Constants ============
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

// ============ Initial Piece Counts ============
export const INITIAL_PIECE_COUNT: Record<string, number> = {
  p: 8,  // 8 pawns
  n: 2,  // 2 knights
  b: 2,  // 2 bishops
  r: 2,  // 2 rooks
  q: 1,  // 1 queen
  k: 1,  // 1 king
} as const;

// ============ Game End Reasons ============
export type GameEndReason = 
  | 'checkmate'
  | 'stalemate'
  | 'time_loss'
  | 'resignation'
  | 'draw_by_repetition'
  | 'draw_by_insufficient_material'
  | 'draw_by_fifty_moves'
  | 'disconnect';
