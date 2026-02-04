import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Chess, Square as ChessSquare, Move } from 'chess.js';
import { cn } from '@/lib/utils';
import { PIECE_SYMBOLS, FILES, RANKS } from '@/lib/chessConstants';
import { X } from 'lucide-react';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  onPremove?: (from: string, to: string, promotion?: string) => void;
  premove?: { from: string; to: string } | null;
  isPlayerTurn: boolean;
  lastMove: { from: string; to: string } | null;
  isCheck: boolean;
  flipped?: boolean;
  isGameOver?: boolean;
  onMoveSound?: () => void;
  onCaptureSound?: () => void;
  onCheckSound?: () => void;
}

const ChessBoardComponent = ({ 
  game, 
  onMove, 
  onPremove,
  premove = null,
  isPlayerTurn, 
  lastMove, 
  isCheck, 
  flipped = false,
  isGameOver = false,
  onMoveSound,
  onCaptureSound,
  onCheckSound,
}: ChessBoardProps) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [captureAnimation, setCaptureAnimation] = useState<string | null>(null);
  const lastSoundRef = useRef<number>(0);

  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;

  const getSquareNotation = (row: number, col: number): ChessSquare => {
    const file = displayFiles[col];
    const rank = displayRanks[row];
    return `${file}${rank}` as ChessSquare;
  };

  const playerColor = flipped ? 'b' : 'w';

  // Clear selection when game ends or board position changes
  useEffect(() => {
    if (isGameOver) {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  }, [isGameOver, game.fen()]);

  // Get capture moves for highlighting
  const getCaptureMoves = (): string[] => {
    return validMoves
      .filter(move => move.captured)
      .map(move => move.to);
  };

  const captureMoves = getCaptureMoves();

  const handleSquareClick = useCallback((row: number, col: number) => {
    // Block moves if game is over
    if (isGameOver) return;
    // No premoves allowed and it's not your turn - block interaction
    if (!isPlayerTurn && !onPremove) return;

    const square = getSquareNotation(row, col);
    const piece = game.get(square);
    const isPremoveMode = !isPlayerTurn && !!onPremove;
    const moveGenGame = (() => {
      if (!isPremoveMode) return game;
      // In premove mode it's the opponent's turn in the real game.
      // Chess.js won't generate moves for our pieces unless it's our turn,
      // so we temporarily flip the active color in the FEN.
      const parts = game.fen().split(' ');
      if (parts.length >= 2) parts[1] = playerColor;
      return new Chess(parts.join(' '));
    })();

    if (selectedSquare) {
      // Try to make a move
      const targetPiece = game.get(square);
      const isCapture = targetPiece && targetPiece.color !== playerColor;
      
      if (isCapture) {
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

      const success = isPremoveMode
        ? (validMoves.some((m) => m.to === square) ? (onPremove(selectedSquare, square, promotion), true) : false)
        : onMove(selectedSquare, square, promotion);
      
      if (success) {
        // Play appropriate sound (prevent double-play)
        const now = Date.now();
        if (now - lastSoundRef.current > 50) {
          lastSoundRef.current = now;
          
          // Check if resulting position is check
          const testGame = new Chess(game.fen());
          try {
            testGame.move({ from: selectedSquare, to: square, promotion });
            if (testGame.isCheck()) {
              onCheckSound?.();
            } else if (isCapture) {
              onCaptureSound?.();
            } else {
              onMoveSound?.();
            }
          } catch {
            // Move was made optimistically, just play move sound
            if (isCapture) {
              onCaptureSound?.();
            } else {
              onMoveSound?.();
            }
          }
        }
      }
      
      setSelectedSquare(null);
      setValidMoves([]);
      
      if (!success && piece && piece.color === playerColor) {
        setSelectedSquare(square);
        const moves = moveGenGame.moves({ square, verbose: true });
        setValidMoves(moves);
      }
    } else if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      const moves = moveGenGame.moves({ square, verbose: true });
      setValidMoves(moves);
    }
  }, [selectedSquare, game, onMove, onPremove, premove, validMoves, isPlayerTurn, playerColor, flipped, isGameOver, onMoveSound, onCaptureSound, onCheckSound]);

  const isLightSquare = (row: number, col: number) => {
    const actualRow = flipped ? 7 - row : row;
    const actualCol = flipped ? 7 - col : col;
    return (actualRow + actualCol) % 2 === 0;
  };

  const getKingSquare = (color: 'w' | 'b') => {
    for (const file of FILES) {
      for (const rank of RANKS) {
        const square = `${file}${rank}` as ChessSquare;
        const piece = game.get(square);
        if (piece?.type === 'k' && piece.color === color) {
          return square;
        }
      }
    }
    return null;
  };

  // isCheck means the current side to move is in check.
  // Highlight that king (yours when you're checked; opponent's when you check them).
  const checkedKingSquare = isCheck ? getKingSquare(game.turn() as 'w' | 'b') : null;

  // Show opponent's last move highlight (now always shown since lastMove only contains opponent's move)
  const showLastMove = lastMove !== null;

  const validMoveSquares = validMoves.map(m => m.to);

  return (
    <div className="relative">
      <div className="grid grid-cols-8 gap-0 rounded-lg overflow-hidden shadow-xl border-2 border-border">
        {displayRanks.map((rank, row) => (
          displayFiles.map((file, col) => {
            const square = getSquareNotation(row, col);
            const piece = game.get(square);
            const isSelected = selectedSquare === square;
            const isValidMove = validMoveSquares.includes(square);
            const isCaptureMove = captureMoves.includes(square);
            const isLastMoveSquare = showLastMove && (lastMove.from === square || lastMove.to === square);
            const isKingInCheck = checkedKingSquare === square;
            const isCapturing = captureAnimation === square;
            const isPremoveFrom = premove?.from === square;
            const isPremoveTo = premove?.to === square;

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(row, col)}
                className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center cursor-pointer relative transition-all duration-150",
                  isLightSquare(row, col) ? "chess-square-light" : "chess-square-dark",
                  isSelected && "ring-4 ring-primary ring-inset",
                  // Gray highlight for opponent's last move
                  isLastMoveSquare && "bg-muted-foreground/30",
                  // Red highlight for the king that is currently in check
                  isKingInCheck && "bg-destructive/40",
                  // Premove highlight
                  isPremoveFrom && "ring-4 ring-emerald-400/70 ring-inset",
                  isPremoveTo && "ring-4 ring-emerald-200/70 ring-inset",
                  // Capture highlighting - red tint for capturable squares
                  isCaptureMove && "bg-red-500/30",
                  isGameOver && "cursor-not-allowed opacity-90"
                )}
              >
                {/* Valid move indicator (non-capture) */}
                {isValidMove && !piece && !isCaptureMove && (
                  <div className="absolute w-4 h-4 rounded-full bg-primary/40 animate-pulse" />
                )}
                
                {/* Valid move indicator for non-capture squares with pieces */}
                {isValidMove && piece && !isCaptureMove && (
                  <div className="absolute inset-1 rounded-full border-4 border-primary/50 animate-pulse" />
                )}
                
                {/* Capture indicator - Red X overlay */}
                {isCaptureMove && (
                  <>
                    <div className="absolute inset-0 bg-red-500/20 z-10" />
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      <X className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-red-500/70 stroke-[3]" />
                    </div>
                  </>
                )}

                {/* Piece - explicit colors for white and black pieces */}
                {piece && (
                  <span
                    className={cn(
                      "text-4xl sm:text-5xl md:text-6xl select-none transition-transform duration-200 z-30 drop-shadow-lg",
                      isSelected && "scale-110",
                      isCapturing && "animate-bounce-in"
                    )}
                    style={{
                      color: piece.color === 'w' ? '#FFFFFF' : '#1a1a1a',
                      textShadow: piece.color === 'w' 
                        ? '1px 1px 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.4)' 
                        : '1px 1px 2px rgba(255,255,255,0.3), 0 0 4px rgba(0,0,0,0.4)'
                    }}
                  >
                    {PIECE_SYMBOLS[`${piece.color}${piece.type}`]}
                  </span>
                )}

                {/* Coordinate labels */}
                {col === 0 && (
                  <span className="absolute top-0.5 left-1 text-xs font-bold text-muted-foreground/60 z-40">
                    {rank}
                  </span>
                )}
                {row === 7 && (
                  <span className="absolute bottom-0.5 right-1 text-xs font-bold text-muted-foreground/60 z-40">
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

// Memoize to prevent unnecessary re-renders
export const ChessBoard = memo(ChessBoardComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.game.fen() === nextProps.game.fen() &&
    prevProps.isPlayerTurn === nextProps.isPlayerTurn &&
    prevProps.lastMove?.from === nextProps.lastMove?.from &&
    prevProps.lastMove?.to === nextProps.lastMove?.to &&
    prevProps.premove?.from === nextProps.premove?.from &&
    prevProps.premove?.to === nextProps.premove?.to &&
    prevProps.isCheck === nextProps.isCheck &&
    prevProps.flipped === nextProps.flipped &&
    prevProps.isGameOver === nextProps.isGameOver
  );
});
