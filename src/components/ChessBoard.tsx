import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess, Square as ChessSquare, Move } from 'chess.js';
import { cn } from '@/lib/utils';
import { PIECE_SYMBOLS, FILES, RANKS } from '@/lib/chessConstants';
import { useChessStore } from '@/stores/chessStore';
import { X } from 'lucide-react';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  isPlayerTurn: boolean;
  lastMove: { from: string; to: string } | null;
  isCheck: boolean;
  flipped?: boolean;
  isGameOver?: boolean;
  onMoveSound?: () => void;
  onCaptureSound?: () => void;
  onCheckSound?: () => void;
  enablePremove?: boolean;
}

const ChessBoardComponent = ({ 
  game, 
  onMove, 
  isPlayerTurn, 
  lastMove, 
  isCheck, 
  flipped = false,
  isGameOver = false,
  onMoveSound,
  onCaptureSound,
  onCheckSound,
  enablePremove = true,
}: ChessBoardProps) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [captureAnimation, setCaptureAnimation] = useState<string | null>(null);
  const lastSoundRef = useRef<number>(0);
  
  // Premove state - from Zustand store (persists across re-renders and navigation)
  const premove = useChessStore((state) => state.premove);
  const setPremove = useChessStore((state) => state.setPremove);
  const clearPremove = useChessStore((state) => state.clearPremove);
  
  // Local state for premove piece selection (which piece is selected for premove)
  const [premoveSelectedSquare, setPremoveSelectedSquare] = useState<string | null>(null);

  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;

  // Use useCallback for getSquareNotation to avoid stale closures
  const getSquareNotation = useCallback((row: number, col: number): ChessSquare => {
    const files = flipped ? [...FILES].reverse() : FILES;
    const ranks = flipped ? [...RANKS].reverse() : RANKS;
    const file = files[col];
    const rank = ranks[row];
    return `${file}${rank}` as ChessSquare;
  }, [flipped]);

  const playerColor = flipped ? 'b' : 'w';

  // Clear selection when game ends
  useEffect(() => {
    if (isGameOver) {
      setSelectedSquare(null);
      setValidMoves([]);
      clearPremove();
      setPremoveSelectedSquare(null);
    }
  }, [isGameOver, clearPremove]);

  // Clear regular selection when turn changes to opponent's turn
  // Note: Do NOT clear premoveSelectedSquare here - let user complete their premove even if turn changes
  useEffect(() => {
    if (!isPlayerTurn) {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  }, [isPlayerTurn]);

  // Get capture moves for highlighting
  const getCaptureMoves = (): string[] => {
    return validMoves
      .filter(move => move.captured)
      .map(move => move.to);
  };

  const captureMoves = getCaptureMoves();

  // Handle square click for moves and premoves
  const handleSquareClick = (row: number, col: number) => {
    // Block all interaction if game is over
    if (isGameOver) return;

    const square = getSquareNotation(row, col);
    const piece = game.get(square);

    // CASE 1: Handle completing a premove when we had selected a piece earlier
    // This handles the case where you select a piece during opponent's turn,
    // then the turn changes before you click the target
    if (premoveSelectedSquare && enablePremove) {
      // Clicking on one of our own pieces - switch selection or cancel
      if (piece && piece.color === playerColor) {
        if (premoveSelectedSquare === square) {
          // Clicking same piece - cancel selection
          setPremoveSelectedSquare(null);
          clearPremove();
          console.log("[ChessBoard] Premove selection cancelled");
          return;
        }
        // Clicking different own piece - switch selection
        setPremoveSelectedSquare(square);
        clearPremove();
        console.log("[ChessBoard] Premove piece switched to:", square);
        return;
      }
      
      // Clicking on empty square or opponent's piece - complete the premove
      const movingPiece = game.get(premoveSelectedSquare as ChessSquare);
      
      // Check for pawn promotion
      let promotion: string | undefined;
      const promotionRank = flipped ? 7 : 0;
      if (movingPiece?.type === 'p' && row === promotionRank) {
        promotion = 'q';
      }

      // If it's already our turn, execute immediately as a regular move
      if (isPlayerTurn) {
        console.log("[ChessBoard] Turn already ours, executing as regular move:", premoveSelectedSquare, "->", square);
        const success = onMove(premoveSelectedSquare, square, promotion);
        setPremoveSelectedSquare(null);
        clearPremove();
        if (success) {
          // Play sound
          const now = Date.now();
          if (now - lastSoundRef.current > 50) {
            lastSoundRef.current = now;
            const targetPiece = game.get(square);
            if (targetPiece && targetPiece.color !== playerColor) {
              onCaptureSound?.();
            } else {
              onMoveSound?.();
            }
          }
        }
        return;
      }
      
      // Not our turn yet - set the premove in the store for later execution
      const newPremove = { from: premoveSelectedSquare, to: square, promotion };
      setPremove(newPremove);
      setPremoveSelectedSquare(null);
      console.log("[ChessBoard] Premove set in store:", premoveSelectedSquare, "->", square);
      return;
    }

    // CASE 2: Handle premove piece selection when it's NOT our turn
    if (!isPlayerTurn && enablePremove) {
      // Clicking on one of our own pieces - start premove selection
      if (piece && piece.color === playerColor) {
        setPremoveSelectedSquare(square);
        clearPremove();
        console.log("[ChessBoard] Premove piece selected:", square);
        return;
      }
      
      // Clicking elsewhere with no selection - cancel any existing premove
      if (premove) {
        clearPremove();
      }
      return;
    }

    // CASE 3: Normal move handling when it IS our turn (no premove selected)
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

      const success = onMove(selectedSquare, square, promotion);
      
      if (success) {
        // Clear any premove when we make a regular move
        clearPremove();
        setPremoveSelectedSquare(null);
        
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
        const moves = game.moves({ square, verbose: true });
        setValidMoves(moves);
      }
    } else if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setValidMoves(moves);
    }
  };

  const isLightSquare = (row: number, col: number) => {
    const actualRow = flipped ? 7 - row : row;
    const actualCol = flipped ? 7 - col : col;
    return (actualRow + actualCol) % 2 === 0;
  };

  // Get king square for a specific color
  const getKingSquare = (color: 'w' | 'b') => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = getSquareNotation(row, col);
        const piece = game.get(square);
        if (piece?.type === 'k' && piece.color === color) {
          return square;
        }
      }
    }
    return null;
  };

  // isCheck means current player to move is in check
  // Highlight the king that is in check (could be ours or opponent's)
  const kingInCheckSquare = isCheck ? getKingSquare(game.turn()) : null;

  // Show opponent's last move highlight (now always shown since lastMove only contains opponent's move)
  const showLastMove = lastMove !== null;

  const validMoveSquares = validMoves.map(m => m.to);

  // Premove visual indicators
  const isPremoveFrom = premove?.from;
  const isPremoveTo = premove?.to;
  const isPremoveSelected = premoveSelectedSquare;

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
            const isKingInCheck = kingInCheckSquare === square;
            const isCapturing = captureAnimation === square;
            
            // Premove highlighting
            const isPremoveSquare = isPremoveFrom === square || isPremoveTo === square;
            const isPremoveSelecting = isPremoveSelected === square;

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(row, col)}
                className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center cursor-pointer relative transition-all duration-150",
                  isLightSquare(row, col) ? "chess-square-light" : "chess-square-dark",
                  isSelected && "ring-4 ring-primary ring-inset",
                  // Gray highlight for opponent's last move
                  isLastMoveSquare && !isPremoveSquare && "bg-muted-foreground/30",
                  // Red highlight for king in check (either player's)
                  isKingInCheck && "bg-destructive/40",
                  // Capture highlighting - red tint for capturable squares
                  isCaptureMove && "bg-red-500/30",
                  // Premove highlighting - cyan/blue color
                  isPremoveSquare && "bg-cyan-500/40",
                  isPremoveSelecting && "ring-4 ring-cyan-400 ring-inset",
                  // Only show not-allowed cursor if premove is disabled
                  !isPlayerTurn && !enablePremove && "cursor-not-allowed",
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

// Export component directly (no memo to avoid stale state issues with premove)
export const ChessBoard = ChessBoardComponent;
