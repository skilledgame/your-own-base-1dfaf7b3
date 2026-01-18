/**
 * Chess Material Calculation Utilities
 * Calculates captured pieces and material advantage
 */

import { Chess, PieceSymbol, Color } from 'chess.js';
import { PIECE_VALUES, INITIAL_PIECE_COUNT } from './chessConstants';

export interface CapturedPieces {
  white: PieceSymbol[];  // Pieces captured BY white (black pieces)
  black: PieceSymbol[];  // Pieces captured BY black (white pieces)
}

export interface MaterialAdvantage {
  white: number;
  black: number;
  difference: number;  // Positive = white ahead, negative = black ahead
}

/**
 * Count pieces on the board for a specific color
 */
const countPieces = (game: Chess, color: Color): Record<PieceSymbol, number> => {
  const counts: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  
  const board = game.board();
  for (const row of board) {
    for (const square of row) {
      if (square && square.color === color) {
        counts[square.type]++;
      }
    }
  }
  
  return counts;
};

/**
 * Calculate captured pieces based on what's missing from the board
 */
export const calculateCapturedPieces = (game: Chess): CapturedPieces => {
  const whiteCounts = countPieces(game, 'w');
  const blackCounts = countPieces(game, 'b');
  
  const capturedByWhite: PieceSymbol[] = [];
  const capturedByBlack: PieceSymbol[] = [];
  
  // Pieces missing from black's side were captured by white
  for (const piece of ['q', 'r', 'b', 'n', 'p'] as PieceSymbol[]) {
    const missing = INITIAL_PIECE_COUNT[piece] - blackCounts[piece];
    for (let i = 0; i < missing; i++) {
      capturedByWhite.push(piece);
    }
  }
  
  // Pieces missing from white's side were captured by black
  for (const piece of ['q', 'r', 'b', 'n', 'p'] as PieceSymbol[]) {
    const missing = INITIAL_PIECE_COUNT[piece] - whiteCounts[piece];
    for (let i = 0; i < missing; i++) {
      capturedByBlack.push(piece);
    }
  }
  
  return {
    white: capturedByWhite,
    black: capturedByBlack,
  };
};

/**
 * Calculate material totals and advantage
 */
export const calculateMaterialAdvantage = (game: Chess): MaterialAdvantage => {
  const whiteCounts = countPieces(game, 'w');
  const blackCounts = countPieces(game, 'b');
  
  let whiteMaterial = 0;
  let blackMaterial = 0;
  
  for (const piece of ['p', 'n', 'b', 'r', 'q'] as PieceSymbol[]) {
    whiteMaterial += whiteCounts[piece] * PIECE_VALUES[piece];
    blackMaterial += blackCounts[piece] * PIECE_VALUES[piece];
  }
  
  return {
    white: whiteMaterial,
    black: blackMaterial,
    difference: whiteMaterial - blackMaterial,
  };
};

/**
 * Sort captured pieces by value (highest first)
 */
export const sortCapturedPieces = (pieces: PieceSymbol[]): PieceSymbol[] => {
  return [...pieces].sort((a, b) => PIECE_VALUES[b] - PIECE_VALUES[a]);
};
