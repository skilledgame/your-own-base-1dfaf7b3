import { useState, useCallback } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import { cn } from '@/lib/utils';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  isPlayerTurn: boolean;
  lastMove: { from: string; to: string } | null;
  isCheck: boolean;
  flipped?: boolean;
}

const PIECE_SYMBOLS: Record<string, string> = {
  'wp': '♙', 'wn': '♘', 'wb': '♗', 'wr': '♖', 'wq': '♕', 'wk': '♔',
  'bp': '♟', 'bn': '♞', 'bb': '♝', 'br': '♜', 'bq': '♛', 'bk': '♚',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const ChessBoard = ({ game, onMove, isPlayerTurn, lastMove, isCheck, flipped = false }: ChessBoardProps) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [captureAnimation, setCaptureAnimation] = useState<string | null>(null);

  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;

  const getSquareNotation = (row: number, col: number): ChessSquare => {
    const file = displayFiles[col];
    const rank = displayRanks[row];
    return `${file}${rank}` as ChessSquare;
  };

  const playerColor = flipped ? 'b' : 'w';

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (!isPlayerTurn) return;

    const square = getSquareNotation(row, col);
    const piece = game.get(square);

    if (selectedSquare) {
      // Try to make a move
      const targetPiece = game.get(square);
      if (targetPiece && targetPiece.color !== playerColor) {
        setCaptureAnimation(square);
        setTimeout(() => setCaptureAnimation(null), 300);
      }

      // Check for pawn promotion
      const movingPiece = game.get(selectedSquare as ChessSquare);
      let promotion: string | undefined;
      const promotionRank = flipped ? 7 : 0;
      if (movingPiece?.type === 'p' && row === promotionRank) {
        promotion = 'q';
      }

      const success = onMove(selectedSquare, square, promotion);
      setSelectedSquare(null);
      setValidMoves([]);
      
      if (!success && piece && piece.color === playerColor) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setValidMoves(moves.map(m => m.to));
      }
    } else if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setValidMoves(moves.map(m => m.to));
    }
  }, [selectedSquare, game, onMove, isPlayerTurn, playerColor, flipped]);

  const isLightSquare = (row: number, col: number) => {
    const actualRow = flipped ? 7 - row : row;
    const actualCol = flipped ? 7 - col : col;
    return (actualRow + actualCol) % 2 === 0;
  };

  const getKingSquare = () => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = getSquareNotation(row, col);
        const piece = game.get(square);
        if (piece?.type === 'k' && piece.color === playerColor) {
          return square;
        }
      }
    }
    return null;
  };

  const kingSquare = isCheck ? getKingSquare() : null;

  return (
    <div className="relative">
      <div className="grid grid-cols-8 gap-0 rounded-lg overflow-hidden shadow-xl border-2 border-border">
        {displayRanks.map((rank, row) => (
          displayFiles.map((file, col) => {
            const square = getSquareNotation(row, col);
            const piece = game.get(square);
            const isSelected = selectedSquare === square;
            const isValidMove = validMoves.includes(square);
            const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
            const isKingInCheck = kingSquare === square;
            const isCapturing = captureAnimation === square;

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(row, col)}
                className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center cursor-pointer relative transition-all duration-150",
                  isLightSquare(row, col) ? "chess-square-light" : "chess-square-dark",
                  isSelected && "ring-4 ring-primary ring-inset",
                  isLastMoveSquare && "bg-primary/20",
                  isKingInCheck && "bg-destructive/40",
                  !isPlayerTurn && "cursor-not-allowed"
                )}
              >
                {/* Valid move indicator */}
                {isValidMove && !piece && (
                  <div className="absolute w-4 h-4 rounded-full bg-primary/40 animate-pulse" />
                )}
                {isValidMove && piece && (
                  <div className="absolute inset-1 rounded-full border-4 border-primary/50 animate-pulse" />
                )}

                {/* Piece */}
                {piece && (
                  <span
                    className={cn(
                      "text-4xl sm:text-5xl md:text-6xl select-none transition-transform duration-200",
                      piece.color === 'w' ? "text-foreground drop-shadow-lg" : "text-muted-foreground drop-shadow-lg",
                      isSelected && "scale-110",
                      isCapturing && "animate-bounce-in"
                    )}
                    style={{
                      textShadow: piece.color === 'w' 
                        ? '2px 2px 4px rgba(0,0,0,0.5)' 
                        : '2px 2px 4px rgba(0,0,0,0.3)'
                    }}
                  >
                    {PIECE_SYMBOLS[`${piece.color}${piece.type}`]}
                  </span>
                )}

                {/* Coordinate labels */}
                {col === 0 && (
                  <span className="absolute top-0.5 left-1 text-xs font-bold text-muted-foreground/60">
                    {rank}
                  </span>
                )}
                {row === 7 && (
                  <span className="absolute bottom-0.5 right-1 text-xs font-bold text-muted-foreground/60">
                    {file}
                  </span>
                )}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
};