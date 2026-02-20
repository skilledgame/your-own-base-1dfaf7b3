import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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

  // Drag-and-drop state
  const [dragFrom, setDragFrom] = useState<string | null>(null);

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

  // ─── PREMOVE TARGET VALIDATION ──────────────────────────────────────
  // Compute legal squares for the premove-selected piece by temporarily
  // flipping the side-to-move in the FEN.  This ensures the user can only
  // queue premoves to squares the piece can actually reach.
  const currentFen = game.fen();

  const premoveTargets = useMemo<string[]>(() => {
    if (!premoveSelectedSquare) return [];
    try {
      const fenParts = currentFen.split(' ');
      fenParts[1] = playerColor; // force player's turn
      const tempChess = new Chess(fenParts.join(' '));
      const moves = tempChess.moves({ square: premoveSelectedSquare as ChessSquare, verbose: true });
      return moves.map(m => m.to);
    } catch {
      return [];
    }
  }, [premoveSelectedSquare, currentFen, playerColor]);

  // Subset of premoveTargets that are captures (opponent piece sits there now)
  const premoveCaptureTargets = useMemo<string[]>(() => {
    if (!premoveSelectedSquare || premoveTargets.length === 0) return [];
    return premoveTargets.filter(sq => {
      const p = game.get(sq as ChessSquare);
      return p && p.color !== playerColor;
    });
  }, [premoveTargets, premoveSelectedSquare, game, playerColor]);

  // Clear selection when game ends
  useEffect(() => {
    if (isGameOver) {
      setSelectedSquare(null);
      setValidMoves([]);
      clearPremove();
      setPremoveSelectedSquare(null);
      setDragFrom(null);
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

  // ─── DRAG HANDLERS ─────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, square: string) => {
    if (isGameOver) {
      e.preventDefault();
      return;
    }
    const piece = game.get(square as ChessSquare);
    if (!piece || piece.color !== playerColor) {
      e.preventDefault();
      return;
    }

    setDragFrom(square);

    // If it's our turn, show valid moves like click-select
    if (isPlayerTurn) {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as ChessSquare, verbose: true });
      setValidMoves(moves);
    } else if (enablePremove) {
      // Opponent's turn – start premove selection via drag
      setPremoveSelectedSquare(square);
      clearPremove();
    }

    e.dataTransfer.effectAllowed = 'move';
    // Use transparent 1×1 gif so the browser doesn't show a default drag ghost
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  }, [game, playerColor, isPlayerTurn, isGameOver, enablePremove, clearPremove]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    if (!dragFrom) return;

    const toSquare = getSquareNotation(row, col);

    // Dropping on the same square → cancel (no move, no premove)
    if (dragFrom === toSquare) {
      setDragFrom(null);
      setSelectedSquare(null);
      setValidMoves([]);
      setPremoveSelectedSquare(null);
      return;
    }

    // Determine promotion
    const movingPiece = game.get(dragFrom as ChessSquare);
    let promotion: string | undefined;
    const promotionRank = flipped ? 7 : 0;
    if (movingPiece?.type === 'p' && row === promotionRank) {
      promotion = 'q'; // Default queen (chess.com behavior)
    }

    if (isPlayerTurn) {
      // ── Normal move via drag ──
      const success = onMove(dragFrom, toSquare, promotion);
      if (success) {
        clearPremove();
        setPremoveSelectedSquare(null);
        // Play sound
        const now = Date.now();
        if (now - lastSoundRef.current > 50) {
          lastSoundRef.current = now;
          const targetPiece = game.get(toSquare as ChessSquare);
          if (targetPiece && targetPiece.color !== playerColor) {
            onCaptureSound?.();
          } else {
            onMoveSound?.();
          }
        }
      }
    } else if (enablePremove) {
      // ── Premove via drag — only if target is a valid premove square ──
      if (premoveTargets.includes(toSquare)) {
        setPremove({ from: dragFrom, to: toSquare, promotion });
      }
      setPremoveSelectedSquare(null);
    }

    setDragFrom(null);
    setSelectedSquare(null);
    setValidMoves([]);
  }, [dragFrom, isPlayerTurn, game, flipped, onMove, enablePremove, getSquareNotation, playerColor, clearPremove, setPremove, onMoveSound, onCaptureSound, premoveTargets]);

  const handleDragEnd = useCallback(() => {
    setDragFrom(null);
  }, []);

  // ─── CLICK HANDLER ─────────────────────────────────────────────────

  const handleSquareClick = (row: number, col: number) => {
    // Block all interaction if game is over
    if (isGameOver) return;

    const square = getSquareNotation(row, col);
    const piece = game.get(square);

    // ── CASE 0: Cancel existing premove by clicking its from-square ──
    // Chess.com behavior: clicking the premoved piece (= from-square) cancels the premove.
    if (premove && enablePremove && !isPlayerTurn && square === premove.from && !premoveSelectedSquare) {
      clearPremove();
      return;
    }

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
          return;
        }
        // Clicking different own piece - switch selection
        setPremoveSelectedSquare(square);
        clearPremove();
        return;
      }

      // ── Only allow premove to a valid target square ──
      if (!premoveTargets.includes(square)) {
        // Clicked an unreachable square → ignore (keep selection)
        return;
      }
      
      // Clicking on valid target – complete the premove
      const movingPiece = game.get(premoveSelectedSquare as ChessSquare);
      
      // Check for pawn promotion
      let promotion: string | undefined;
      const promotionRank = flipped ? 7 : 0;
      if (movingPiece?.type === 'p' && row === promotionRank) {
        promotion = 'q';
      }

      // If it's already our turn, execute immediately as a regular move
      if (isPlayerTurn) {
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
      return;
    }

    // CASE 2: Handle premove piece selection when it's NOT our turn
    if (!isPlayerTurn && enablePremove) {
      // Clicking on one of our own pieces - start premove selection
      if (piece && piece.color === playerColor) {
        setPremoveSelectedSquare(square);
        clearPremove();
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

  // ─── HELPERS ───────────────────────────────────────────────────────

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
    <div className="relative w-[384px] sm:w-[448px] md:w-[512px] max-w-full">
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
            
            // Premove highlighting – RED chess.com style
            const isPremoveSquare = isPremoveFrom === square || isPremoveTo === square;
            const isPremoveSelecting = isPremoveSelected === square;
            // Valid premove target dots (shown while selecting premove piece)
            const isPremoveTarget = premoveSelectedSquare !== null && premoveTargets.includes(square);
            const isPremoveCaptureTarget = premoveSelectedSquare !== null && premoveCaptureTargets.includes(square);

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(row, col)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, row, col)}
                className={cn(
                  "aspect-square flex items-center justify-center cursor-pointer relative",
                  // Base square color
                  isLightSquare(row, col) ? "chess-square-light" : "chess-square-dark",
                  // --- Highlight priority (lowest → highest): ---
                  // 1. Last move (gray) – skip if premove occupies the square
                  isLastMoveSquare && !isPremoveSquare && "!bg-muted-foreground/30",
                  // 2. Selected piece ring (normal turn)
                  isSelected && "ring-4 ring-primary ring-inset",
                  // 3. King in check (red tint)
                  isKingInCheck && "!bg-destructive/40",
                  // 4. Capture-move indicator (red overlay for valid targets)
                  isCaptureMove && "!bg-red-500/30",
                  // 5. PREMOVE highlights (RED, highest visual priority) ──────────
                  //    Solid red tint on both from & to squares (chess.com style)
                  isPremoveSquare && "!bg-red-500/40",
                  //    Premove piece selection ring (before destination chosen)
                  isPremoveSelecting && "ring-4 ring-red-500 ring-inset !bg-red-500/30",
                  // Cursor feedback
                  !isPlayerTurn && !enablePremove && "cursor-not-allowed",
                  isGameOver && "cursor-not-allowed opacity-90"
                )}
              >
                {/* ── Normal turn: valid move indicator (non-capture dot) ── */}
                {isValidMove && !piece && !isCaptureMove && (
                  <div className={`absolute w-5 h-5 rounded-full ${isLightSquare(row, col) ? 'bg-green-500/60' : 'bg-green-300/60'}`} />
                )}
                
                {/* Normal turn: valid move indicator for squares with pieces */}
                {isValidMove && piece && !isCaptureMove && (
                  <div className="absolute inset-1 rounded-full border-4 border-primary/50" />
                )}
                
                {/* Normal turn: capture indicator - Red X overlay */}
                {isCaptureMove && (
                  <>
                    <div className="absolute inset-0 bg-red-500/20 z-10" />
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      <X className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-red-500/70 stroke-[3]" />
                    </div>
                  </>
                )}

                {/* ── Premove: valid target dots (shown while selecting piece) ── */}
                {isPremoveTarget && !isPremoveCaptureTarget && !piece && (
                  <div className={`absolute w-5 h-5 rounded-full ${isLightSquare(row, col) ? 'bg-green-500/60' : 'bg-green-300/60'}`} />
                )}
                {/* Premove: capture ring around opponent pieces */}
                {isPremoveCaptureTarget && (
                  <div className="absolute inset-1 rounded-full border-4 border-red-500/50" />
                )}

                {/* Piece – supports drag for both normal moves and premoves */}
                {piece && (
                  <span
                    draggable={piece.color === playerColor && !isGameOver}
                    onDragStart={(e) => handleDragStart(e, square)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "text-4xl sm:text-5xl md:text-6xl select-none z-30 drop-shadow-lg",
                      isSelected && "scale-110",
                      isCapturing && "animate-bounce-in",
                      // While being dragged, fade the source piece
                      dragFrom === square && "opacity-40"
                    )}
                    style={{
                      color: piece.color === 'w' ? '#FFFFFF' : '#1a1a1a',
                      textShadow: piece.color === 'w' 
                        ? '1px 1px 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.4)' 
                        : '1px 1px 2px rgba(255,255,255,0.3), 0 0 4px rgba(0,0,0,0.4)',
                      fontFamily: '"Segoe UI Symbol", "Noto Sans Symbols 2", "Arial Unicode MS", sans-serif',
                      fontVariantEmoji: 'text' as never,
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
