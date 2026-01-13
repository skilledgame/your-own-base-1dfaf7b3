/**
 * WebSocket-based Multiplayer Game View
 * 
 * Uses the chess WebSocket for move sending and state synchronization.
 * Server is authoritative for all game state.
 * Displays wager and balance information.
 */

import { useState, useCallback, useEffect } from 'react';
import { ChessBoard } from './ChessBoard';
import { GameTimer } from './GameTimer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Loader2, LogOut, Crown, Coins, Wallet } from 'lucide-react';
import { Chess } from 'chess.js';

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
}: WSMultiplayerGameViewProps) => {
  // Local chess instance for move validation
  const [chess] = useState(() => new Chess(currentFen || initialFen));
  const [localFen, setLocalFen] = useState(currentFen || initialFen);
  
  // Timers (these would come from server in a production app)
  const [whiteTime, setWhiteTime] = useState(300);  // 5 minutes
  const [blackTime, setBlackTime] = useState(300);
  
  const isWhite = playerColor === "white";

  // Sync with server FEN (server is authoritative)
  useEffect(() => {
    if (currentFen && currentFen !== localFen) {
      try {
        chess.load(currentFen);
        setLocalFen(currentFen);
      } catch (e) {
        console.error("[Game] Invalid FEN from server:", currentFen);
      }
    }
  }, [currentFen, chess, localFen]);

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTurn = chess.turn();
      if (currentTurn === 'w') {
        setWhiteTime(prev => Math.max(0, prev - 1));
      } else {
        setBlackTime(prev => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [chess]);

  // Handle local move
  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
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

      // Optimistic update - show move immediately
      chess.move({ from, to, promotion: promoChar });
      setLocalFen(chess.fen());

      // Send to server
      onSendMove(from, to, promoChar);

      return true;
    } catch (e) {
      console.error("[Game] Move error:", e);
      return false;
    }
  }, [chess, isMyTurn, localFen, onSendMove]);

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
          
          <Button variant="outline" onClick={onExit} className="gap-2 text-destructive hover:text-destructive">
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
          {/* Opponent Info */}
          <div className="flex items-center justify-between w-full max-w-md">
            <div className="flex items-center gap-3 px-4 py-2 bg-secondary rounded-lg">
              <User className="w-5 h-5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-semibold">{opponentName}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {opponentColorLabel}
                </span>
              </div>
            </div>
            <GameTimer timeLeft={opponentTime} isActive={!isMyTurn} />
          </div>

          {/* Chess Board */}
          <ChessBoard
            game={chess}
            onMove={handleMove}
            isPlayerTurn={isMyTurn}
            lastMove={null}
            isCheck={chess.isCheck()}
            flipped={!isWhite}
          />

          {/* Player Info */}
          <div className="flex items-center justify-between w-full max-w-md">
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <User className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold">{playerName}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {myColorLabel} (You)
                </span>
              </div>
            </div>
            <GameTimer timeLeft={myTime} isActive={isMyTurn} />
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

          {/* Turn Indicator */}
          <div className="text-center mt-4 p-4 rounded-xl bg-secondary/30 w-full max-w-md">
            {isMyTurn ? (
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
