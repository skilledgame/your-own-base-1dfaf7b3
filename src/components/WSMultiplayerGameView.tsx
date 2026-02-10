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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, User, Loader2, LogOut, Crown, Coins, Wallet } from 'lucide-react';
import { UserBadges } from '@/components/UserBadge';
import { Chess } from 'chess.js';
import { CHESS_TIME_CONTROL } from '@/lib/chessConstants';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';
import { useChessSound } from '@/hooks/useChessSound';
import { supabase } from '@/integrations/supabase/client';
import { getRankFromTotalWagered, type RankInfo } from '@/lib/rankSystem';
import { useChessStore } from '@/stores/chessStore';
import { wsClient } from '@/lib/wsClient';

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
  
  // Badges
  playerBadges?: string[];
  opponentBadges?: string[];
  
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
  playerBadges = [],
  opponentBadges = [],
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
  // Resign confirmation dialog
  const [showResignDialog, setShowResignDialog] = useState(false);
  
  // Get timer snapshot from store (server-authoritative for WebSocket games)
  const timerSnapshot = useChessStore((state) => state.timerSnapshot);
  // Read premove from store for the "Premove set" indicator
  const premove = useChessStore((state) => state.premove);
  
  // Sound effects (must be declared before the display clock effect that uses playGameEnd)
  const { playMove, playCapture, playCheck, playGameEnd } = useChessSound();
  
  const isWhite = playerColor === "white";
  const myColor = isWhite ? 'w' : 'b';
  
  // Timers - use props for private games, calculate from snapshot for WebSocket games
  const [isGameOver, setIsGameOver] = useState(false);
  
  // Track whose turn it was when they moved (for increment)
  const lastMoveByRef = useRef<'w' | 'b' | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // --- Smooth display clock loop ---
  // Keep the authoritative server snapshot in a ref for the display loop.
  // The ref avoids re-creating the interval on every snapshot update.
  const clockRef = useRef(timerSnapshot);
  useEffect(() => { clockRef.current = timerSnapshot; }, [timerSnapshot]);
  
  // Display state (updated by the interval — only when the *seconds* value changes)
  const [displayWhiteSec, setDisplayWhiteSec] = useState(CHESS_TIME_CONTROL.BASE_TIME);
  const [displayBlackSec, setDisplayBlackSec] = useState(CHESS_TIME_CONTROL.BASE_TIME);
  
  // Display clock tick (runs every 200ms for responsive countdown + time-loss detection)
  // IMPORTANT: Elapsed is computed in SERVER time (Date.now() + serverTimeOffsetMs)
  // so the display stays correct even after alt-tab / background throttling.
  useEffect(() => {
    if (isPrivateGame || isGameOver) {
      // For private games, derive from props
      setDisplayWhiteSec(propWhiteTime ?? CHESS_TIME_CONTROL.BASE_TIME);
      setDisplayBlackSec(propBlackTime ?? CHESS_TIME_CONTROL.BASE_TIME);
      return;
    }
    
    const tick = () => {
      const snap = clockRef.current;
      if (!snap) {
        setDisplayWhiteSec(CHESS_TIME_CONTROL.BASE_TIME);
        setDisplayBlackSec(CHESS_TIME_CONTROL.BASE_TIME);
        return;
      }
      
      let wMs = snap.wMs;
      let bMs = snap.bMs;
      
      if (snap.clockRunning) {
        // Compute elapsed in SERVER time since this snapshot was created
        // serverNowEstimate = Date.now() + serverTimeOffsetMs ≈ current server time
        const serverNowEstimate = Date.now() + snap.serverTimeOffsetMs;
        const elapsed = Math.max(0, serverNowEstimate - snap.serverNow);
        if (snap.turn === 'w') {
          wMs = Math.max(0, wMs - elapsed);
        } else {
          bMs = Math.max(0, bMs - elapsed);
        }
      }
      
      const wSec = Math.ceil(wMs / 1000);
      const bSec = Math.ceil(bMs / 1000);
      
      // Only set state when displayed seconds change (avoids unnecessary re-renders)
      setDisplayWhiteSec(prev => prev !== wSec ? wSec : prev);
      setDisplayBlackSec(prev => prev !== bSec ? bSec : prev);
      
      // Time-loss detection
      if (snap.clockRunning) {
        if (snap.turn === 'w' && wMs <= 0 && !isGameOver) {
          setIsGameOver(true);
          playGameEnd();
          onTimeLoss?.('w');
        } else if (snap.turn === 'b' && bMs <= 0 && !isGameOver) {
          setIsGameOver(true);
          playGameEnd();
          onTimeLoss?.('b');
        }
      }
    };
    
    tick(); // Run immediately
    timerIntervalRef.current = setInterval(tick, 200);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isPrivateGame, isGameOver, propWhiteTime, propBlackTime, playGameEnd, onTimeLoss]);
  
  // Alt-tab / focus resync: request fresh clock snapshot from server
  // when the tab becomes visible or window regains focus.
  useEffect(() => {
    if (isPrivateGame || isGameOver) return;
    
    const requestSync = () => {
      const state = useChessStore.getState();
      const currentGameId = state.gameState?.gameId;
      if (currentGameId && wsClient.getStatus() === 'connected') {
        wsClient.send({ type: "clock_sync_request", gameId: currentGameId });
      }
    };
    
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestSync();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', requestSync);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', requestSync);
    };
  }, [isPrivateGame, isGameOver]);
  
  // Final displayed times (seconds)
  const whiteTime = displayWhiteSec;
  const blackTime = displayBlackSec;

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

  // (Timer display loop + time loss detection is handled by the display clock effect above)

  // Note: Premove execution is handled in useChessWebSocket when move_applied message is received
  // This ensures premove executes synchronously when the turn switches, not via React effects

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
      // Don't set opponent's last move for our own moves - we only highlight opponent's moves
      
      // Server handles increment - it will send updated timer snapshot in move_applied message
      lastMoveByRef.current = myColor;

      // Send to server
      onSendMove(from, to, promoChar);

      return true;
    } catch (e) {
      console.error("[Game] Move error:", e);
      return false;
    }
  }, [chess, isMyTurn, localFen, onSendMove, isGameOver, myColor, isPrivateGame]);

  const myTime = isWhite ? whiteTime : blackTime;
  const opponentTime = isWhite ? blackTime : whiteTime;
  const myColorLabel = isWhite ? "White" : "Black";
  const opponentColorLabel = isWhite ? "Black" : "White";
  // Active clock indicator: the running clock is ALWAYS the side whose turn it is.
  // BOTH are false when clockRunning=false (before first move), so neither clock appears active.
  const isMyTurnForTimer = !isPrivateGame && timerSnapshot
    ? (timerSnapshot.clockRunning && timerSnapshot.turn === myColor)
    : isMyTurn;
  const isOpponentTurnForTimer = !isPrivateGame && timerSnapshot
    ? (timerSnapshot.clockRunning && timerSnapshot.turn !== myColor)
    : !isMyTurn;

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
          <Button 
            variant="ghost" 
            onClick={() => {
              if (isGameOver) {
                onBack();
              } else {
                setShowResignDialog(true);
              }
            }} 
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {isGameOver ? 'Home' : 'Leave'}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{opponentName || "Opponent"}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getRankColor(opponentRank)}`}>
                    {opponentRankDisplay}
                  </span>
                  {opponentBadges.length > 0 && <UserBadges badges={opponentBadges} size="sm" />}
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
            <GameTimer timeLeft={opponentTime} isActive={isOpponentTurnForTimer && !isGameOver} />
          </div>

          {/* Chess Board with sound callbacks - only show opponent's last move */}
          <ChessBoard
            game={chess}
            onMove={handleMove}
            isPlayerTurn={isMyTurn && !isGameOver}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{playerName}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getRankColor(playerRank)}`}>
                    {playerRankDisplay}
                  </span>
                  {playerBadges.length > 0 && <UserBadges badges={playerBadges} size="sm" />}
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
              <div className="flex flex-col items-center gap-1">
                <span className="text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Waiting for {opponentName}...
                </span>
                {/* Premove set indicator */}
                {premove && (
                  <span className="text-xs font-medium text-red-400 animate-pulse">
                    Premove set · click piece to cancel
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resign Confirmation Dialog */}
      <AlertDialog open={showResignDialog} onOpenChange={setShowResignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resign Game?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to resign? This will count as a loss and your opponent will win
              {wager > 0 && ` the ${wager} SC wager`}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowResignDialog(false);
                onExit();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Resign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
