import { useState, useCallback, useEffect } from 'react';
import { ChessBoard } from './ChessBoard';
import { GameTimer } from './GameTimer';
import { TokenBalance } from './TokenBalance';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Loader2 } from 'lucide-react';
import { Chess } from 'chess.js';

interface MultiplayerGameViewProps {
  player: { id: string; name: string; credits: number };
  opponent: { id: string; name: string };
  game: {
    id: string;
    white_player_id: string;
    black_player_id: string;
    wager: number;
    fen: string;
    white_time: number;
    black_time: number;
    current_turn: string;
    status: string;
    winner_id: string | null;
  };
  onMove: (fen: string, turn: string) => void;
  onTimeUpdate: (whiteTime: number, blackTime: number) => void;
  onGameEnd: (winnerId: string, reason: string) => void;
  onBack: () => void;
}

export const MultiplayerGameView = ({
  player,
  opponent,
  game,
  onMove,
  onTimeUpdate,
  onGameEnd,
  onBack,
}: MultiplayerGameViewProps) => {
  const [chess] = useState(() => new Chess(game.fen));
  const [localFen, setLocalFen] = useState(game.fen);
  const [whiteTime, setWhiteTime] = useState(game.white_time);
  const [blackTime, setBlackTime] = useState(game.black_time);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const isWhite = game.white_player_id === player.id;
  const isMyTurn = (isWhite && game.current_turn === 'w') || (!isWhite && game.current_turn === 'b');
  const isGameActive = game.status === 'active';

  // Sync with remote game state
  useEffect(() => {
    if (game.fen !== localFen) {
      chess.load(game.fen);
      setLocalFen(game.fen);
    }
    setWhiteTime(game.white_time);
    setBlackTime(game.black_time);
  }, [game.fen, game.white_time, game.black_time]);

  // Timer
  useEffect(() => {
    if (!isGameActive) return;

    const interval = setInterval(() => {
      if (game.current_turn === 'w') {
        const newTime = Math.max(0, whiteTime - 1);
        setWhiteTime(newTime);
        if (newTime === 0) {
          onGameEnd(game.black_player_id, 'timeout');
        }
      } else {
        const newTime = Math.max(0, blackTime - 1);
        setBlackTime(newTime);
        if (newTime === 0) {
          onGameEnd(game.white_player_id, 'timeout');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isGameActive, game.current_turn, whiteTime, blackTime, onGameEnd, game.white_player_id, game.black_player_id]);

  const handleMove = useCallback((from: string, to: string) => {
    if (!isMyTurn || !isGameActive) return false;

    try {
      const move = chess.move({ from, to, promotion: 'q' });
      if (!move) return false;

      setLastMove({ from, to });
      const newFen = chess.fen();
      setLocalFen(newFen);
      
      // Add time increment
      const newWhiteTime = isWhite ? whiteTime + 3 : whiteTime;
      const newBlackTime = !isWhite ? blackTime + 3 : blackTime;
      
      onMove(newFen, chess.turn());
      onTimeUpdate(newWhiteTime, newBlackTime);

      // Check for game end
      if (chess.isCheckmate()) {
        onGameEnd(player.id, 'checkmate');
      } else if (chess.isDraw()) {
        onGameEnd('', 'draw');
      }

      return true;
    } catch {
      return false;
    }
  }, [chess, isMyTurn, isGameActive, isWhite, whiteTime, blackTime, onMove, onTimeUpdate, onGameEnd, player.id]);

  const myTime = isWhite ? whiteTime : blackTime;
  const opponentTime = isWhite ? blackTime : whiteTime;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Button>
          <TokenBalance balance={player.credits} />
        </div>

        {/* Game Area */}
        <div className="flex flex-col items-center gap-4">
          {/* Opponent Info */}
          <div className="flex items-center justify-between w-full max-w-md">
            <div className="flex items-center gap-3 px-4 py-2 bg-secondary rounded-lg">
              <User className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">{opponent.name}</span>
            </div>
            <GameTimer timeLeft={opponentTime} isActive={!isMyTurn && isGameActive} />
          </div>

          {/* Chess Board */}
          <ChessBoard
            game={chess}
            onMove={handleMove}
            isPlayerTurn={isMyTurn}
            lastMove={lastMove}
            isCheck={chess.isCheck()}
            flipped={!isWhite}
          />

          {/* Player Info */}
          <div className="flex items-center justify-between w-full max-w-md">
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <User className="w-5 h-5 text-primary" />
              <span className="font-semibold">{player.name}</span>
            </div>
            <GameTimer timeLeft={myTime} isActive={isMyTurn && isGameActive} />
          </div>

          {/* Wager Display */}
          <div className="text-center mt-4 p-4 bg-secondary/50 rounded-xl">
            <p className="text-sm text-muted-foreground">Wager</p>
            <p className="text-2xl font-bold text-gold">{game.wager} tokens</p>
          </div>

          {/* Turn Indicator */}
          {isGameActive && (
            <div className="text-center animate-fade-in">
              {isMyTurn ? (
                <span className="text-primary font-semibold">Your Move</span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Waiting for {opponent.name}...
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};