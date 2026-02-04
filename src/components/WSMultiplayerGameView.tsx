/**
 * WebSocket-based Multiplayer Game View
 * 
 * Uses the chess WebSocket for move sending and state synchronization.
 * Server is authoritative for all game state.
 * Displays wager, balance, captured pieces, and material advantage.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ChessBoard } from './ChessBoard';
import { GameTimer } from './GameTimer';
import { CapturedPieces } from './CapturedPieces';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Loader2, LogOut, Crown, Coins, Wallet } from 'lucide-react';
import { Chess } from 'chess.js';
import { CHESS_TIME_CONTROL } from '@/lib/chessConstants';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';
import { useChessSound } from '@/hooks/useChessSound';
import type { RankInfo } from '@/lib/rankSystem';
import { useChessStore } from '@/stores/chessStore';

interface WSMultiplayerGameViewProps {
  gameId: string;
  dbGameId?: string;
  playerColor: "white" | "black";
  playerName: string;
  playerSkilledCoins: number;
  opponentName: string;
  initialFen: string;
  wager: number;
  
  // From useChessWebSocket or usePrivateGame
  currentFen: string;
  isMyTurn: boolean;
  whiteTime?: number; // For private games
  blackTime?: number; // For private games
  isPrivateGame?: boolean; // Indicates if this is a private game using Realtime
  
  // Rank info
  playerRank?: RankInfo;
  opponentRank?: RankInfo;
  
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
  playerSkilledCoins,
  opponentName,
  initialFen,
  wager,
  currentFen,
  isMyTurn,
  whiteTime: propWhiteTime,
  blackTime: propBlackTime,
  isPrivateGame = false,
  playerRank,
  opponentRank,
  onSendMove,
  onExit,
  onBack,
  onTimeLoss,
}: WSMultiplayerGameViewProps) => {
  // Local chess instance for move validation
  const [chess] = useState(() => new Chess(currentFen || initialFen));
  const [localFen, setLocalFen] = useState(currentFen || initialFen);
  // Track OPPONENT's last move only (not your own)
  const [opponentLastMove, setOpponentLastMove] = useState<{ from: string; to: string } | null>(null);
  const [premove, setPremove] = useState<{ from: string; to: string; promotion?: string } | null>(null);
  
  // Get timer snapshot from store (server-authoritative for WebSocket games)
  const timerSnapshot = useChessStore((state) => state.timerSnapshot);
  
  // Timers - use props for private games, calculate from snapshot for WebSocket games
  const [isGameOver, setIsGameOver] = useState(false);
  
  // Track whose turn it was when they moved (for increment)
  const lastMoveByRef = useRef<'w' | 'b' | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timerTick, setTimerTick] = useState(0);
  
  // Calculate effective time from server snapshot (only for WebSocket games)
  const { whiteTime, blackTime } = useMemo(() => {
    if (isPrivateGame) {
      return {
        whiteTime: propWhiteTime ?? CHESS_TIME_CONTROL.BASE_TIME,
        blackTime: propBlackTime ?? CHESS_TIME_CONTROL.BASE_TIME,
      };
    }
    
    // For WebSocket games, calculate from server snapshot
    if (!timerSnapshot || isGameOver) {
      return {
        whiteTime: CHESS_TIME_CONTROL.BASE_TIME,
        blackTime: CHESS_TIME_CONTROL.BASE_TIME,
      };
    }
    
    const elapsedMs = Math.max(0, performance.now() - timerSnapshot.clientPerfNowMs);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    let whiteTime = timerSnapshot.whiteTimeSeconds;
    let blackTime = timerSnapshot.blackTimeSeconds;
    
    // Only count down for the side whose turn it is
    if (timerSnapshot.currentTurn === 'w') {
      whiteTime = Math.max(0, whiteTime - elapsedSeconds);
    } else {
      blackTime = Math.max(0, blackTime - elapsedSeconds);
    }
    
    return { whiteTime, blackTime };
  }, [isPrivateGame, propWhiteTime, propBlackTime, timerSnapshot, isGameOver, timerTick]);
  
  // Sound effects
  const { playMove, playCapture, playCheck, playGameEnd } = useChessSound();
  
  const isWhite = playerColor === "white";
  const myColor = isWhite ? 'w' : 'b';

  // Calculate captured pieces and material (memoized to prevent recalculation)
  const capturedPieces = useMemo(() => calculateCapturedPieces(chess), [chess.fen()]);
  const materialAdvantage = useMemo(() => calculateMaterialAdvantage(chess), [chess.fen()]);
  
  // My captured pieces (pieces I captured = opponent's missing pieces)
  const myCaptured = useMemo(() => 
    isWhite ? capturedPieces.white : capturedPieces.black,
    [isWhite, capturedPieces]
  );
  const opponentCaptured = useMemo(() => 
    isWhite ? capturedPieces.black : capturedPieces.white,
    [isWhite, capturedPieces]
  );
  
  // Material advantage from my perspective
  const myMaterialAdvantage = useMemo(() => 
    isWhite ? materialAdvantage.difference : -materialAdvantage.difference,
    [isWhite, materialAdvantage.difference]
  );
  const opponentMaterialAdvantage = useMemo(() => 
    -myMaterialAdvantage,
    [myMaterialAdvantage]
  );

  // Sync with server FEN (server is authoritative)
  useEffect(() => {
    if (currentFen && currentFen !== localFen) {
      try {
        const previousFen = localFen;
        
        // Try to detect what move the opponent made
        const prevChess = new Chess(previousFen);
        const prevTurn = prevChess.turn();
        
        chess.load(currentFen);
        setLocalFen(currentFen);
        
        const newTurn = chess.turn();
        
        // If turn changed AND it's now my turn, the opponent just moved
        // Try to figure out what move they made to highlight it
        if (prevTurn !== newTurn && newTurn === myColor) {
          // Opponent just moved - try to find their move
          const possibleMoves = prevChess.moves({ verbose: true });
          for (const move of possibleMoves) {
            const testChess = new Chess(previousFen);
            testChess.move(move);
            if (testChess.fen().split(' ')[0] === currentFen.split(' ')[0]) {
              // Found the opponent's move
              setOpponentLastMove({ from: move.from, to: move.to });
              break;
            }
          }
          
          // Track for increment (only apply once)
          // Note: Server handles increment, we just track for display
          if (lastMoveByRef.current !== prevTurn && !isPrivateGame) {
            lastMoveByRef.current = prevTurn;
            // Server will send updated timer snapshot in move_applied message
          }
        }
      } catch (e) {
        console.error("[Game] Invalid FEN from server:", currentFen);
      }
    }
  }, [currentFen, chess, localFen, myColor, isPrivateGame]);

  // Timer tick + time loss check (server-authoritative calculation, 4x/sec)
  useEffect(() => {
    if (isPrivateGame || isGameOver || !timerSnapshot) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimerTick((tick) => tick + 1);

      // Check for time loss (calculated from snapshot)
      const elapsedMs = Math.max(0, performance.now() - timerSnapshot.clientPerfNowMs);
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
        
      if (timerSnapshot.currentTurn === 'w') {
        const remaining = timerSnapshot.whiteTimeSeconds - elapsedSeconds;
        if (remaining <= 0 && !isGameOver) {
          setIsGameOver(true);
          playGameEnd();
          onTimeLoss?.('w');
          return;
        }
      } else {
        const remaining = timerSnapshot.blackTimeSeconds - elapsedSeconds;
        if (remaining <= 0 && !isGameOver) {
          setIsGameOver(true);
          playGameEnd();
          onTimeLoss?.('b');
          return;
        }
      }
    }, 250);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timerSnapshot, isGameOver, isPrivateGame, onTimeLoss, playGameEnd]);

  // Timer display is now server-authoritative - no local countdown needed
  // The render loop above handles time loss detection based on server snapshot

  // Premove: queue a move during opponent's turn and auto-play it when it's your turn (if still legal)
  const handlePremove = useCallback((from: string, to: string, promotion?: string) => {
    setPremove((prev) => {
      if (prev && prev.from === from && prev.to === to && prev.promotion === promotion) {
        return null; // Toggle off if selecting the same premove again
      }
      return { from, to, promotion };
    });
  }, []);

  // Handle local move with sound and increment
  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    // Block moves if game is over
    if (isGameOver) {
      console.log("[Game] Game is over, move blocked");
      return false;
    }

    // Only allow moves for the side-to-move according to the current board state.
    if (chess.turn() !== myColor) {
      console.log("[Game] Not your turn (board turn mismatch)");
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
      const testChess = new Chess(chess.fen());
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
      // Don't set opponent's last move for our own moves - we only highlight opponent's moves
      
      // Server handles increment - it will send updated timer snapshot in move_applied message
      lastMoveByRef.current = myColor;

      // Send to server
      onSendMove(from, to, promoChar);

      // Clear any queued premove once we make a real move
      setPremove(null);

      return true;
    } catch (e) {
      console.error("[Game] Move error:", e);
      return false;
    }
  }, [chess, onSendMove, isGameOver, myColor]);

  const myTime = isWhite ? whiteTime : blackTime;
  const opponentTime = isWhite ? blackTime : whiteTime;
  const myColorLabel = isWhite ? "White" : "Black";
  const opponentColorLabel = isWhite ? "Black" : "White";
  const isMyTurnForTimer = !isPrivateGame && timerSnapshot
    ? timerSnapshot.currentTurn === myColor
    : isMyTurn;

  // Auto-play queued premove when it's our turn
  useEffect(() => {
    if (!premove || isGameOver) return;
    if (!isMyTurnForTimer) return;

    const { from, to, promotion } = premove;
    setPremove(null);
    handleMove(from, to, promotion);
  }, [premove, isMyTurnForTimer, isGameOver, handleMove]);

  // Get rank display names
  const playerRankDisplay = playerRank?.displayName || 'Unranked';
  const opponentRankDisplay = opponentRank?.displayName || 'Unranked';
  
  // Get rank colors for styling
  const getRankColor = (rank: RankInfo | undefined) => {
    if (!rank) return 'text-muted-foreground';
    switch (rank.tierName) {
      case 'diamond': return 'text-cyan-400';
      case 'platinum': return 'text-slate-300';
      case 'gold': return 'text-yellow-400';
      case 'silver': return 'text-gray-300';
      case 'bronze': return 'text-orange-500';
      default: return 'text-muted-foreground';
    }
  };

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
              <span className="text-sm text-muted-foreground">{playerSkilledCoins} SC</span>
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
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{opponentName || "Opponent"}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getRankColor(opponentRank)}`}>
                    {opponentRankDisplay}
                  </span>
                </div>
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
            <GameTimer timeLeft={opponentTime} isActive={!isMyTurnForTimer && !isGameOver} />
          </div>

          {/* Chess Board with sound callbacks - only show opponent's last move */}
          <ChessBoard
            game={chess}
            onMove={handleMove}
            onPremove={handlePremove}
            premove={premove ? { from: premove.from, to: premove.to } : null}
            isPlayerTurn={isMyTurnForTimer && !isGameOver}
            lastMove={opponentLastMove}
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
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{playerName}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getRankColor(playerRank)}`}>
                    {playerRankDisplay}
                  </span>
                </div>
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
            <GameTimer timeLeft={myTime} isActive={isMyTurnForTimer && !isGameOver} />
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
