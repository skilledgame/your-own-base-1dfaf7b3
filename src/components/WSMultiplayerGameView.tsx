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
import { supabase } from '@/integrations/supabase/client';
import { getRankFromTotalWagered, type RankInfo } from '@/lib/rankSystem';

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
  
  // Timers - use props for private games, local state for WebSocket games
  const [whiteTimeLocal, setWhiteTimeLocal] = useState<number>(CHESS_TIME_CONTROL.BASE_TIME);
  const [blackTimeLocal, setBlackTimeLocal] = useState<number>(CHESS_TIME_CONTROL.BASE_TIME);
  const whiteTime = isPrivateGame && propWhiteTime !== undefined ? propWhiteTime : whiteTimeLocal;
  const blackTime = isPrivateGame && propBlackTime !== undefined ? propBlackTime : blackTimeLocal;
  const [isGameOver, setIsGameOver] = useState(false);
  
  // Track whose turn it was when they moved (for increment)
  const lastMoveByRef = useRef<'w' | 'b' | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
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
          if (lastMoveByRef.current !== prevTurn && !isPrivateGame) {
            lastMoveByRef.current = prevTurn;
            // Opponent gets increment for their move
            if (prevTurn === 'w') {
              setWhiteTimeLocal(prev => prev + CHESS_TIME_CONTROL.INCREMENT);
            } else {
              setBlackTimeLocal(prev => prev + CHESS_TIME_CONTROL.INCREMENT);
            }
          }
        }
      } catch (e) {
        console.error("[Game] Invalid FEN from server:", currentFen);
      }
    }
  }, [currentFen, chess, localFen, myColor, isPrivateGame]);

  // Initialize timer from database and subscribe to realtime updates (only for WebSocket games)
  useEffect(() => {
    if (isPrivateGame || !dbGameId) {
      // Private games handle timers in usePrivateGame hook
      return;
    }

    // Initial load from database
    const loadInitialTimer = async () => {
      try {
        const { data: game, error } = await supabase
          .from('games')
          .select('white_time, black_time')
          .eq('id', dbGameId)
          .maybeSingle();

        if (!error && game) {
          if (game.white_time !== null && game.white_time !== undefined) {
            setWhiteTimeLocal(game.white_time);
          }
          if (game.black_time !== null && game.black_time !== undefined) {
            setBlackTimeLocal(game.black_time);
          }
          lastTickRef.current = Date.now();
          console.log('[Game] Timer initialized from database:', { white: game.white_time, black: game.black_time });
        }
      } catch (error) {
        console.error('[Game] Error loading initial timer:', error);
      }
    };

    loadInitialTimer();

    // Subscribe to realtime updates for timer sync
    gameChannelRef.current = supabase
      .channel(`game-timer-${dbGameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${dbGameId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.white_time !== null && updated.white_time !== undefined) {
          setWhiteTimeLocal(updated.white_time);
        }
        if (updated.black_time !== null && updated.black_time !== undefined) {
          setBlackTimeLocal(updated.black_time);
        }
        lastTickRef.current = Date.now();
        console.log('[Game] Timer synced from realtime:', { white: updated.white_time, black: updated.black_time });
      })
      .subscribe();

    // Sync timer to server every 3 seconds (less frequent to reduce load)
    syncTimerRef.current = setInterval(async () => {
      if (isGameOver || !dbGameId) {
        if (syncTimerRef.current) {
          clearInterval(syncTimerRef.current);
          syncTimerRef.current = null;
        }
        return;
      }

      try {
        const { error } = await supabase
          .from('games')
          .update({
            white_time: whiteTimeLocal,
            black_time: blackTimeLocal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', dbGameId)
          .eq('status', 'active'); // Only update if game is still active

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows updated (game might be over)
          console.error('[Game] Error syncing timer to server:', error);
        }
      } catch (error) {
        // Silently fail - don't spam console if game is already over
        if (!isGameOver) {
          console.error('[Game] Error syncing timer to server:', error);
        }
      }
    }, 3000);

    return () => {
      if (gameChannelRef.current) {
        supabase.removeChannel(gameChannelRef.current);
        gameChannelRef.current = null;
      }
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [dbGameId, isPrivateGame]);

  // Timer countdown with time loss handling (only for WebSocket games)
  // Uses elapsed time calculation to work correctly even when tab is hidden
  // Private games handle timers in usePrivateGame hook
  useEffect(() => {
    if (isPrivateGame) {
      // Don't run local timer for private games - usePrivateGame handles it
      return;
    }

    if (isGameOver) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (gameChannelRef.current) {
        supabase.removeChannel(gameChannelRef.current);
        gameChannelRef.current = null;
      }
      return;
    }

    // Reset last tick time when starting timer
    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastTickRef.current) / 1000);
      
      if (elapsedSeconds < 1) return;
      
      lastTickRef.current = now;
      const currentTurn = chess.turn();
      
      if (currentTurn === 'w') {
        setWhiteTimeLocal(prev => {
          const newTime = Math.max(0, prev - elapsedSeconds);
          if (newTime === 0 && !isGameOver) {
            // White loses on time
            setIsGameOver(true);
            playGameEnd();
            onTimeLoss?.('w');
          }
          return newTime;
        });
      } else {
        setBlackTimeLocal(prev => {
          const newTime = Math.max(0, prev - elapsedSeconds);
          if (newTime === 0 && !isGameOver) {
            // Black loses on time
            setIsGameOver(true);
            playGameEnd();
            onTimeLoss?.('b');
          }
          return newTime;
        });
      }
    }, 1000); // Update every second

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [chess, isGameOver, onTimeLoss, playGameEnd, isPrivateGame]);

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
      
      // Apply increment to the player who just moved (me) - only for WebSocket games
      // Private games handle increment in make-move Edge Function
      if (!isPrivateGame) {
        if (myColor === 'w') {
          setWhiteTimeLocal(prev => prev + CHESS_TIME_CONTROL.INCREMENT);
        } else {
          setBlackTimeLocal(prev => prev + CHESS_TIME_CONTROL.INCREMENT);
        }
        // The periodic sync will handle updating the server
      }
      lastMoveByRef.current = myColor;

      // Send to server
      onSendMove(from, to, promoChar);

      return true;
    } catch (e) {
      console.error("[Game] Move error:", e);
      return false;
    }
  }, [chess, isMyTurn, localFen, onSendMove, isGameOver, whiteTime, blackTime, myColor, isPrivateGame]);

  const myTime = isWhite ? whiteTime : blackTime;
  const opponentTime = isWhite ? blackTime : whiteTime;
  const myColorLabel = isWhite ? "White" : "Black";
  const opponentColorLabel = isWhite ? "Black" : "White";

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
                  <span className="font-semibold">{opponentName}</span>
                  {opponentRank && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getRankColor(opponentRank)}`}>
                      {opponentRankDisplay}
                    </span>
                  )}
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
            <GameTimer timeLeft={opponentTime} isActive={!isMyTurn && !isGameOver} />
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
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{playerName}</span>
                  {playerRank && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getRankColor(playerRank)}`}>
                      {playerRankDisplay}
                    </span>
                  )}
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
