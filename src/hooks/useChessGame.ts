import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess, Move } from 'chess.js';

interface UseChessGameOptions {
  initialTime: number; // seconds
  timeIncrement: number; // seconds per move
  onGameEnd: (result: 'win' | 'lose', reason: string) => void;
}

export const useChessGame = ({ initialTime, timeIncrement, onGameEnd }: UseChessGameOptions) => {
  const [game, setGame] = useState<Chess>(() => new Chess());
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [isGameActive, setIsGameActive] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [isCheck, setIsCheck] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start the game
  const startGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setTimeLeft(initialTime);
    setIsPlayerTurn(true);
    setIsGameActive(true);
    setLastMove(null);
    setIsCheck(false);
  }, [initialTime]);

  // Timer countdown
  useEffect(() => {
    if (!isGameActive || !isPlayerTurn) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsGameActive(false);
          onGameEnd('lose', 'Time ran out!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isGameActive, isPlayerTurn, onGameEnd]);

  // Make a move
  const makeMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (!isGameActive || !isPlayerTurn) return false;

    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({ from, to, promotion });
      
      if (!move) return false;

      setGame(gameCopy);
      setLastMove({ from, to });
      setTimeLeft((prev) => prev + timeIncrement);
      setIsCheck(gameCopy.isCheck());

      // Check for game end
      if (gameCopy.isCheckmate()) {
        setIsGameActive(false);
        onGameEnd('win', 'Checkmate! You won!');
        return true;
      }

      if (gameCopy.isDraw() || gameCopy.isStalemate()) {
        setIsGameActive(false);
        onGameEnd('lose', 'Game ended in a draw');
        return true;
      }

      // Bot's turn
      setIsPlayerTurn(false);
      setTimeout(() => makeBotMove(gameCopy), 500);

      return true;
    } catch (e) {
      return false;
    }
  }, [game, isGameActive, isPlayerTurn, timeIncrement, onGameEnd]);

  // Bot makes a move (easy - random valid move)
  const makeBotMove = useCallback((currentGame: Chess) => {
    if (!isGameActive) return;

    const moves = currentGame.moves({ verbose: true });
    if (moves.length === 0) return;

    // Easy bot: just pick a random move
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    
    const gameCopy = new Chess(currentGame.fen());
    gameCopy.move(randomMove);

    setGame(gameCopy);
    setLastMove({ from: randomMove.from, to: randomMove.to });
    setIsCheck(gameCopy.isCheck());

    // Check for game end
    if (gameCopy.isCheckmate()) {
      setIsGameActive(false);
      onGameEnd('lose', 'Checkmate! You lost.');
      return;
    }

    if (gameCopy.isDraw() || gameCopy.isStalemate()) {
      setIsGameActive(false);
      onGameEnd('lose', 'Game ended in a draw');
      return;
    }

    setIsPlayerTurn(true);
  }, [isGameActive, onGameEnd]);

  const resetGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setGame(new Chess());
    setTimeLeft(initialTime);
    setIsPlayerTurn(true);
    setIsGameActive(false);
    setLastMove(null);
    setIsCheck(false);
  }, [initialTime]);

  return {
    game,
    timeLeft,
    isPlayerTurn,
    isGameActive,
    lastMove,
    isCheck,
    startGame,
    makeMove,
    resetGame,
  };
};
