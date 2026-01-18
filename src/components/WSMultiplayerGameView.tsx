/**
 * WebSocket-based Multiplayer Game View
 * 
 * Uses the chess WebSocket for move sending and state synchronization.
 * Server is authoritative for all game state.
 * Displays wager, balance, captured pieces, and material advantage.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChessBoard } from './ChessBoard';
import { GameTimer } from './GameTimer';
import { CapturedPieces } from './CapturedPieces';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Loader2, LogOut, Crown, Coins, Wallet } from 'lucide-react';
import { Chess } from 'chess.js';
import { CHESS_TIME_CONTROL } from '@/lib/chessConstants';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';
import { useChessSound } from '@/hooks/useChessSound';

interface WSMultiplayerGameViewProps {
  gameId: string;
  dbGameId?: string;
  playerColor: "white" | "black";
  playerName: string;
  playerCredits: number;
  opponentName: string;
  initialFen: string;
  wager: number;
  
  // From useChessWebSocket
  currentFen: string;
  isMyTurn: boolean;
  
  // Actions
  onSendMove: (from: string, to: string, promotion?: string) => void;
  onExit: () => void;
  onBack: () => void;
  onTimeLoss?: (loserColor: 'w' | 'b') => void;
}

export const WSMultiplayerGameView = ({
  gameId,
  dbGameId,
  playerColor,
  playerName,
  playerCredits,
  opponentName,
  initialFen,
  wager,
  currentFen,
  isMyTurn,
  onSendMove,
  onExit,
  onBack,
  onTimeLoss,
}: WSMultiplayerGameViewProps) => {
  // Local chess instance for move validation
  const [chess] = useState(() => new Chess(currentFen || initialFen));
  const [localFen, setLocalFen] = useState(currentFen || initialFen);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  
  // Timers using configured time control (1 min base + 3 sec increment)
  const [whiteTime, setWhiteTime] = useState<number>(CHESS_TIME_CONTROL.BASE_TIME);
  const [blackTime, setBlackTime] = useState<number>(CHESS_TIME_CONTROL.BASE_TIME);
  const [isGameOver, setIsGameOver] = useState(false);
  
  // Track whose turn it was when they moved (for increment)
  const lastMoveByRef = useRef<'w' | 'b' | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sound effects
  const { playMove, playCapture, playCheck, playGameEnd } = useChessSound();
  
  const isWhite = playerColor === "white";
  const myColor = isWhite ? 'w' : 'b';

  // Calculate captured pieces and material
  const capturedPieces = calculateCapturedPieces(chess);
  const materialAdvantage = calculateMaterialAdvantage(chess);
  
  // My captured pieces (pieces I captured = opponent's missing pieces)
  const myCaptured = isWhite ? capturedPieces.white : capturedPieces.black;
  const opponentCaptured = isWhite ? capturedPieces.black : capturedPieces.white;
  
  // Material advantage from my perspective
  const myMaterialAdvantage = isWhite ? materialAdvantage.difference : -materialAdvantage.difference;
  const opponentMaterialAdvantage = -myMaterialAdvantage;

  // Sync with server FEN (server is authoritative)
  useEffect(() => {
    if (currentFen && currentFen !== localFen) {
      try {
        const previousFen = localFen;
        chess.load(currentFen);
        setLocalFen(currentFen);
        
        // Detect if this was an opponent's move and apply increment to them
        const prevChess = new Chess(previousFen);
        const prevTurn = prevChess.turn();
        const newTurn = chess.turn();
        
        // If turn changed, the previous turn's player made a move
        if (prevTurn !== newTurn && lastMoveByRef.current !== prevTurn) {
          lastMoveByRef.current = prevTurn;
          
          // Apply increment to the player who just moved
          if (prevTurn === 'w') {
            setWhiteTime(prev => prev + CHESS_TIME_CONTROL.INCREMENT);
          } else {
            setBlackTime(prev => prev + CHESS_TIME_CONTROL.INCREMENT);
          }
        }
      } catch (e) {
        console.error("[Game] Invalid FEN from server:", currentFen);
      }
    }
  }, [currentFen, chess, localFen]);

  // Timer countdown with time loss handling
  useEffect(() => {
    if (isGameOver) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const currentTurn = chess.turn();
      
      if (currentTurn === 'w') {
        setWhiteTime(prev => {
          const newTime = Math.max(0, prev - 1);
          if (newTime === 0 && !isGameOver) {
            // White loses on time
            setIsGameOver(true);
            playGameEnd();
            onTimeLoss?.('w');
          }
          return newTime;
        });
      } else {
        setBlackTime(prev => {
          const newTime = Math.max(0, prev - 1);
          if (newTime === 0 && !isGameOver) {
            // Black loses on time
            setIsGameOver(true);
            playGameEnd();
            onTimeLoss?.('b');
          }
          return newTime;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [chess, isGameOver, onTimeLoss, playGameEnd]);

  // Handle local move with sound and increment
  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    // Block moves if game is over
    if (isGameOver) {
      console.log("[Game] Game is over, move blocked");
      return false;
    }
    
    // Block moves if time is 0
    const myTime = myColor === 'w' ? whiteTime : blackTime;
    if (myTime <= 0) {
      console.log("[Game] No time left, move blocked");
      return false;
    }
    
    if (!isMyTurn) {
      console.log("[Game] Not your turn");
      return false;
    }

    // Determine promotion (default to queen if pawn reaches last rank)
    const movingPiece = chess.get(from as any);
    let promoChar = promotion;
    if (movingPiece?.type === 'p') {
      const toRank = to[1];
      if ((movingPiece.color === 'w' && toRank === '8') || 
          (movingPiece.color === 'b' && toRank === '1')) {
        promoChar = promoChar || 'q';  // Default to queen
      }
    }

    // Validate move locally first
    try {
      const testChess = new Chess(localFen);
      const move = testChess.move({ from, to, promotion: promoChar });
      
      if (!move) {
        console.log("[Game] Invalid move:", from, to);
        return false;
      }

      // Check if it's a capture before applying
      const isCapture = !!move.captured;
      
      // Optimistic update - show move immediately
      chess.move({ from, to, promotion: promoChar });
      setLocalFen(chess.fen());
      setLastMove({ from, to });
      
      // Apply increment to the player who just moved (me)
      if (myColor === 'w') {
        setWhiteTime(prev => prev + CHESS_TIME_CONTROL.INCREMENT);
      } else {
        setBlackTime(prev => prev + CHESS_TIME_CONTROL.INCREMENT);
      }
      lastMoveByRef.current = myColor;

      // Send to server
      onSendMove(from, to, promoChar);

      return true;
    } catch (e) {
      console.error("[Game] Move error:", e);
      return false;
    }
  }, [chess, isMyTurn, localFen, onSendMove, isGameOver, whiteTime, blackTime, myColor]);

  const myTime = isWhite ? whiteTime : blackTime;
  const opponentTime = isWhite ? blackTime : whiteTime;
  const myColorLabel = isWhite ? "White" : "Black";
  const opponentColorLabel = isWhite ? "Black" : "White";

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Home
          </Button>
          
          <div className="flex items-center gap-4">
            {/* Wager Display */}
            {wager > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-950/50 border border-yellow-500/30">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-bold text-yellow-200">{wager} SC</span>
              </div>
            )}
            
            {/* Balance Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{playerCredits} SC</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={onExit} 
            className="gap-2 text-destructive hover:text-destructive"
            disabled={isGameOver}
          >
            <LogOut className="w-4 h-4" />
            Resign
          </Button>
        </div>

        {/* Game ID Display */}
        <div className="text-center mb-4">
          <span className="text-xs text-muted-foreground">
            Game: {gameId.slice(0, 8)}...
            {dbGameId && ` | DB: ${dbGameId.slice(0, 8)}...`}
          </span>
        </div>

        {/* Game Area */}
        <div className="flex flex-col items-center gap-4">
          {/* Opponent Info with Timer and Captured Pieces */}
          <div className="flex items-center justify-between w-full max-w-md">
            <div className="flex items-center gap-3 px-4 py-2 bg-secondary rounded-lg">
              <User className="w-5 h-5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-semibold">{opponentName}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {opponentColorLabel}
                </span>
                {/* Opponent's captured pieces (pieces they captured = my missing pieces) */}
                <CapturedPieces 
                  pieces={opponentCaptured} 
                  color={isWhite ? "black" : "white"}
                  materialAdvantage={opponentMaterialAdvantage > 0 ? opponentMaterialAdvantage : undefined}
                />
              </div>
            </div>
            <GameTimer timeLeft={opponentTime} isActive={!isMyTurn && !isGameOver} />
          </div>

          {/* Chess Board with sound callbacks */}
          <ChessBoard
            game={chess}
            onMove={handleMove}
            isPlayerTurn={isMyTurn && !isGameOver}
            lastMove={lastMove}
            isCheck={chess.isCheck()}
            flipped={!isWhite}
            isGameOver={isGameOver}
            onMoveSound={playMove}
            onCaptureSound={playCapture}
            onCheckSound={playCheck}
          />

          {/* Player Info with Timer and Captured Pieces */}
          <div className="flex items-center justify-between w-full max-w-md">
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <User className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold">{playerName}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {myColorLabel} (You)
                </span>
                {/* My captured pieces (pieces I captured = opponent's missing pieces) */}
                <CapturedPieces 
                  pieces={myCaptured} 
                  color={isWhite ? "white" : "black"}
                  materialAdvantage={myMaterialAdvantage > 0 ? myMaterialAdvantage : undefined}
                />
              </div>
            </div>
            <GameTimer timeLeft={myTime} isActive={isMyTurn && !isGameOver} />
          </div>

          {/* Wager Stakes Display */}
          {wager > 0 && (
            <div className="text-center mt-4 p-4 bg-gradient-to-r from-yellow-950/50 to-amber-950/50 border border-yellow-500/30 rounded-xl w-full max-w-md">
              <p className="text-sm text-yellow-200/60">Stakes</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Coins className="w-6 h-6 text-yellow-400" />
                <span className="text-2xl font-bold text-yellow-400">{wager} SC</span>
              </div>
              <p className="text-xs text-yellow-200/40 mt-1">Winner takes all</p>
            </div>
          )}

          {/* Turn Indicator / Game Over */}
          <div className="text-center mt-4 p-4 rounded-xl bg-secondary/30 w-full max-w-md">
            {isGameOver ? (
              <span className="text-lg font-semibold text-destructive">
                ⏱ Game Over
              </span>
            ) : isMyTurn ? (
              <span className="text-lg font-semibold text-primary animate-pulse">
                ♟ Your Move
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for {opponentName}...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
