export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export interface Square {
  piece: Piece | null;
  row: number;
  col: number;
}

export interface Move {
  from: string;
  to: string;
  promotion?: string;
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface GameState {
  status: GameStatus;
  balance: number;
  wager: number;
  timeLeft: number;
  isPlayerTurn: boolean;
}
