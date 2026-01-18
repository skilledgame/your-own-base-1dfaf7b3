import { useState, useCallback, useEffect } from 'react';
import { ChessBoard } from './ChessBoard';
import { GameTimer } from './GameTimer';
import { CapturedPieces } from './CapturedPieces';
import { TokenBalance } from './TokenBalance';
import { WagerModal } from './WagerModal';
import { GameResultModal } from './GameResultModal';
import { useChessGame } from '@/hooks/useChessGame';
import { useChessSound } from '@/hooks/useChessSound';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot, User, Sparkles } from 'lucide-react';
import { CHESS_TIME_CONTROL } from '@/lib/chessConstants';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';

interface GameViewProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
  isFreePlay?: boolean;
}

export const GameView = ({ balance, onBalanceChange, onBack, isFreePlay = false }: GameViewProps) => {
  const [currentWager, setCurrentWager] = useState<number>(0);
  const [showWagerModal, setShowWagerModal] = useState(!isFreePlay);
  const [gameResult, setGameResult] = useState<{
    isWin: boolean;
    tokensChange: number;
    newBalance: number;
    reason: string;
  } | null>(null);

  // Sound effects
  const { playMove, playCapture, playCheck, playGameEnd } = useChessSound();

  const handleGameEnd = useCallback((result: 'win' | 'lose', reason: string) => {
    const isWin = result === 'win';
    // No tokens change for free play
    const tokensChange = isFreePlay ? 0 : (isWin ? currentWager : -currentWager);
    const newBalance = isFreePlay ? balance : balance + tokensChange;
    
    if (!isFreePlay) {
      onBalanceChange(newBalance);
    }
    playGameEnd();
    setGameResult({ isWin, tokensChange, newBalance, reason });
  }, [currentWager, balance, onBalanceChange, isFreePlay, playGameEnd]);

  const { game, timeLeft, isPlayerTurn, isGameActive, lastMove, isCheck, startGame, makeMove, resetGame } = useChessGame({
    initialTime: CHESS_TIME_CONTROL.BASE_TIME,
    timeIncrement: CHESS_TIME_CONTROL.INCREMENT,
    onGameEnd: handleGameEnd,
  });

  // Calculate captured pieces and material advantage
  const capturedPieces = calculateCapturedPieces(game);
  const materialAdvantage = calculateMaterialAdvantage(game);
  
  // Player is white, bot is black
  const playerCaptured = capturedPieces.white;  // Pieces player captured
  const botCaptured = capturedPieces.black;      // Pieces bot captured
  const playerMaterialAdvantage = materialAdvantage.difference;

  // Auto-start game for free play
  useEffect(() => {
    if (isFreePlay && !isGameActive && !gameResult) {
      startGame();
    }
  }, [isFreePlay, isGameActive, gameResult, startGame]);

  const handleStartGame = (wager: number) => {
    setCurrentWager(wager);
    setShowWagerModal(false);
    startGame();
  };

  const handlePlayAgain = () => {
    setGameResult(null);
    if (isFreePlay) {
      startGame();
    } else {
      setShowWagerModal(true);
      resetGame();
    }
  };

  const handleGoHome = () => {
    resetGame();
    onBack();
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-8">
      {showWagerModal && !isFreePlay && (
        <WagerModal balance={balance} onStartGame={handleStartGame} />
      )}

      {gameResult && (
        <GameResultModal
          isWin={gameResult.isWin}
          coinsChange={gameResult.tokensChange}
          newBalance={gameResult.newBalance}
          reason={gameResult.reason}
          onPlayAgain={handlePlayAgain}
          onGoHome={handleGoHome}
        />
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={handleGoHome} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Button>
          {isFreePlay ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg border border-primary/30">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold text-sm">Free Play</span>
            </div>
          ) : (
            <TokenBalance balance={balance} wager={currentWager} showWager={isGameActive} />
          )}
        </div>

        {/* Game Area */}
        <div className="flex flex-col items-center gap-6">
          {/* Bot Info with captured pieces */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-start gap-1 px-4 py-2 bg-secondary rounded-lg">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-muted-foreground" />
                <span className="font-display font-semibold text-muted-foreground">
                  {isFreePlay ? 'Practice Bot (600 Elo)' : 'Easy Bot'}
                </span>
              </div>
              {/* Bot's captured pieces (pieces bot captured = player's missing pieces) */}
              <CapturedPieces 
                pieces={botCaptured} 
                color="black"
                materialAdvantage={-playerMaterialAdvantage > 0 ? -playerMaterialAdvantage : undefined}
              />
            </div>
          </div>

          {/* Chess Board with sound callbacks */}
          <ChessBoard
            game={game}
            onMove={makeMove}
            isPlayerTurn={isPlayerTurn}
            lastMove={lastMove}
            isCheck={isCheck}
            isGameOver={!isGameActive && gameResult !== null}
            onMoveSound={playMove}
            onCaptureSound={playCapture}
            onCheckSound={playCheck}
          />

          {/* Player Info with captured pieces */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-start gap-1 px-4 py-2 bg-secondary rounded-lg">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gold" />
                <span className="font-display font-semibold text-foreground">You</span>
              </div>
              {/* Player's captured pieces (pieces player captured = bot's missing pieces) */}
              <CapturedPieces 
                pieces={playerCaptured} 
                color="white"
                materialAdvantage={playerMaterialAdvantage > 0 ? playerMaterialAdvantage : undefined}
              />
            </div>
            <GameTimer timeLeft={timeLeft} isActive={isPlayerTurn && isGameActive} />
          </div>

          {/* Turn Indicator */}
          {isGameActive && (
            <div className="text-center animate-fade-in">
              {isPlayerTurn ? (
                <span className="text-gold font-display font-semibold">Your Move</span>
              ) : (
                <span className="text-muted-foreground font-display">Bot is thinking...</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
