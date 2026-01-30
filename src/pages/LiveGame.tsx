/**
 * Live Chess Game Page
 * 
 * Uses WebSocket for real-time game state and moves.
 * Route: /game/live/:gameId
 * 
 * Uses Zustand store for GLOBAL state that persists across navigation.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useChessWebSocket } from '@/hooks/useChessWebSocket';
import { useChessStore } from '@/stores/chessStore';
import { useBalance } from '@/hooks/useBalance';
import { WSMultiplayerGameView } from '@/components/WSMultiplayerGameView';
import { NetworkDebugPanel } from '@/components/NetworkDebugPanel';
import { GameResultModal } from '@/components/GameResultModal';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePrivateGame } from '@/hooks/usePrivateGame';

export default function LiveGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [loadingGame, setLoadingGame] = useState(false);
  const [isPrivateGame, setIsPrivateGame] = useState(false);
  const [privateGamePlayerId, setPrivateGamePlayerId] = useState<string | null>(null);
  
  // Global state from Zustand store
  const { phase, gameState, gameEndResult, setPhase, setGameState, setPlayerName, handleGameEnd } = useChessStore();
  const { balance } = useBalance();
  
  // WebSocket connection and actions (only for matchmade games)
  const {
    status,
    connect,
    disconnect,
    sendMove: wsSendMove,
    resignGame,
    clearGameEnd,
    refreshBalance,
    logs,
    clearLogs,
    sendRaw,
    reconnectAttempts,
  } = useChessWebSocket();

  // Private game hook (only used for private games)
  const privateGame = usePrivateGame({
    gameId: gameId || '',
    playerColor: gameState?.color === 'w' ? 'white' : 'black',
    playerId: privateGamePlayerId || '',
    onGameEnd: async (winnerId, reason, winnerColor, creditsChange) => {
      // Handle game end for private games
      // winnerColor is 'w' or 'b' or undefined
      // If winnerId is null, it's a draw
      // If winnerColor is provided, use it; otherwise determine from winnerId and game state
      let finalWinnerColor: 'w' | 'b' | null = null;
      
      if (winnerColor) {
        finalWinnerColor = winnerColor;
      } else if (winnerId && gameState) {
        // Need to determine winner color from winnerId
        // Load game to check which player won
        const { data: game } = await supabase
          .from('games')
          .select('white_player_id, black_player_id')
          .eq('id', gameId)
          .maybeSingle();
        
        if (game) {
          if (winnerId === game.white_player_id) {
            finalWinnerColor = 'w';
          } else if (winnerId === game.black_player_id) {
            finalWinnerColor = 'b';
          }
        }
      }
      
      handleGameEnd({
        reason: reason || 'Game ended',
        winnerColor: finalWinnerColor,
        isOpponentLeft: false,
        creditsChange: creditsChange,
      });
      
      refreshBalance();
    },
  });

  const handleBack = () => {
    // If in game, resign first
    if (phase === "in_game") {
      resignGame();
    }
    navigate('/');
  };

  const handleExit = () => {
    // Resign and go back to matchmaking
    resignGame();
    navigate('/quick-play');
  };

  const handleSendMove = async (from: string, to: string, promotion?: string) => {
    if (isPrivateGame && privateGame.sendMove) {
      // Use Realtime for private games
      await privateGame.sendMove(from, to, promotion);
    } else {
      // Use WebSocket for matchmade games
      wsSendMove(from, to, promotion);
    }
  };

  const handleTimeLoss = async (loserColor: 'w' | 'b') => {
    // When time runs out, resign the game
    console.log(`[LiveGame] Time loss for ${loserColor === 'w' ? 'white' : 'black'}`);
    if (isPrivateGame && privateGame.resign) {
      await privateGame.resign();
    } else {
      resignGame();
    }
  };

  const handlePlayAgain = () => {
    clearGameEnd();
    refreshBalance();  // Refresh balance when going to play again
    navigate('/quick-play');
  };

  const handleGoHome = () => {
    clearGameEnd();
    refreshBalance();  // Refresh balance when going home
    navigate('/');
  };

  // Load game from database if gameId is in URL but no gameState
  useEffect(() => {
    if (!gameId || gameState || loadingGame) return;

    const loadPrivateGame = async () => {
      setLoadingGame(true);
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('[LiveGame] No user found');
          navigate('/auth');
          return;
        }

        // Get user's player record
        const { data: player } = await supabase
          .from('players')
          .select('id, name, user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!player) {
          console.error('[LiveGame] Player not found');
          navigate('/');
          return;
        }

        // Load game from database
        const { data: game, error: gameError } = await supabase
          .from('games')
          .select('*, white_player:players!games_white_player_id_fkey(name, user_id), black_player:players!games_black_player_id_fkey(name, user_id)')
          .eq('id', gameId)
          .maybeSingle();

        if (gameError || !game) {
          console.error('[LiveGame] Error loading game:', gameError);
          toast.error('Game not found');
          navigate('/');
          return;
        }

        // Determine player color
        const isWhite = game.white_player_id === player.id;
        const color = isWhite ? 'w' : 'b';
        const opponent = isWhite 
          ? (game.black_player as any)?.name || 'Opponent'
          : (game.white_player as any)?.name || 'Opponent';

        // Set up game state
        setPlayerName(player.name);
        setGameState({
          gameId: game.id, // Use database ID as gameId for private games
          dbGameId: game.id,
          color,
          fen: game.fen,
          turn: game.current_turn as 'w' | 'b',
          isMyTurn: game.current_turn === color,
          playerName: player.name,
          opponentName: opponent,
          wager: game.wager,
        });
        setPhase('in_game');
        
        // Mark as private game and store player ID
        setIsPrivateGame(true);
        setPrivateGamePlayerId(player.id);
        
        // Don't connect to WebSocket for private games - use Realtime instead
      } catch (error) {
        console.error('[LiveGame] Error loading private game:', error);
        toast.error('Failed to load game');
        navigate('/');
      } finally {
        setLoadingGame(false);
      }
    };

    loadPrivateGame();
  }, [gameId, gameState, loadingGame, navigate, setPhase, setGameState, setPlayerName, connect]);

  // Loading state (connecting or loading game)
  // For private games, check privateGame.loading instead of WebSocket status
  const isLoading = isPrivateGame 
    ? (loadingGame || privateGame.loading)
    : (loadingGame || status === "connecting" || status === "reconnecting");
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {status === "connecting" ? "Connecting to game server..." : "Reconnecting..."}
        </p>
        <NetworkDebugPanel
          status={status}
          logs={logs}
          reconnectAttempts={reconnectAttempts}
          onConnect={connect}
          onDisconnect={disconnect}
          onSendRaw={sendRaw}
          onClearLogs={clearLogs}
        />
      </div>
    );
  }

  // Disconnected state (only for WebSocket games, not private games)
  if (!isPrivateGame && status === "disconnected") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <WifiOff className="w-12 h-12 text-destructive" />
        <p className="text-lg font-semibold">Disconnected from server</p>
        <p className="text-sm text-muted-foreground">The game may have ended due to connection loss.</p>
        <div className="flex gap-4">
          <Button onClick={connect}>Reconnect</Button>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
        <NetworkDebugPanel
          status={status}
          logs={logs}
          reconnectAttempts={reconnectAttempts}
          onConnect={connect}
          onDisconnect={disconnect}
          onSendRaw={sendRaw}
          onClearLogs={clearLogs}
        />
      </div>
    );
  }

  // Game end modal - show before checking gameState
  if (phase === "game_over" && gameEndResult) {
    const tokensChange = gameEndResult.creditsChange || 0;
    return (
      <>
        <GameResultModal
          isWin={gameEndResult.isWin}
          coinsChange={tokensChange}
          newBalance={balance}
          reason={gameEndResult.message}
          onPlayAgain={handlePlayAgain}
          onGoHome={handleGoHome}
        />
        <NetworkDebugPanel
          status={status}
          logs={logs}
          reconnectAttempts={reconnectAttempts}
          onConnect={connect}
          onDisconnect={disconnect}
          onSendRaw={sendRaw}
          onClearLogs={clearLogs}
        />
      </>
    );
  }

  // No game state - check phase to determine what to show
  if (!gameState) {
    // If phase is not in_game, show "no active game"
    if (phase !== "in_game") {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">No active game found</p>
          <p className="text-sm text-muted-foreground/60">Phase: {phase}</p>
          <Button onClick={() => navigate('/quick-play')}>
            Find a Match
          </Button>
          <NetworkDebugPanel
            status={status}
            logs={logs}
            reconnectAttempts={reconnectAttempts}
            onConnect={connect}
            onDisconnect={disconnect}
            onSendRaw={sendRaw}
            onClearLogs={clearLogs}
          />
        </div>
      );
    }
    
    // In game phase but waiting for game state (shouldn't happen normally)
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading game state...</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
        <NetworkDebugPanel
          status={status}
          logs={logs}
          reconnectAttempts={reconnectAttempts}
          onConnect={connect}
          onDisconnect={disconnect}
          onSendRaw={sendRaw}
          onClearLogs={clearLogs}
        />
      </div>
    );
  }

  // Verify this is the correct game
  if (gameId && gameState.gameId !== gameId) {
    console.warn("[LiveGame] URL gameId mismatch:", gameId, "vs store:", gameState.gameId);
    // Could redirect to correct game or show error
  }

  // Convert color from "w"/"b" to "white"/"black"
  const playerColor = gameState.color === "w" ? "white" : "black";

  // For private games, use Realtime state; for WebSocket games, use store state
  const currentFen = isPrivateGame && privateGame.gameState 
    ? privateGame.gameState.fen 
    : gameState.fen;
  const isMyTurn = isPrivateGame && privateGame.gameState
    ? privateGame.gameState.isMyTurn
    : gameState.isMyTurn;
  const whiteTime = isPrivateGame && privateGame.gameState
    ? privateGame.gameState.whiteTime
    : 60; // Default fallback
  const blackTime = isPrivateGame && privateGame.gameState
    ? privateGame.gameState.blackTime
    : 60; // Default fallback

  return (
    <>
      <WSMultiplayerGameView
        gameId={gameState.gameId}
        dbGameId={gameState.dbGameId}
        playerColor={playerColor}
        playerName={gameState.playerName}
        playerSkilledCoins={balance}
        opponentName={gameState.opponentName}
        initialFen={gameState.fen}
        wager={gameState.wager}
        currentFen={currentFen}
        isMyTurn={isMyTurn}
        whiteTime={whiteTime}
        blackTime={blackTime}
        isPrivateGame={isPrivateGame}
        onSendMove={handleSendMove}
        onExit={handleExit}
        onBack={handleBack}
        onTimeLoss={handleTimeLoss}
      />
      {!isPrivateGame && (
        <NetworkDebugPanel
          status={status}
          logs={logs}
          reconnectAttempts={reconnectAttempts}
          onConnect={connect}
          onDisconnect={disconnect}
          onSendRaw={sendRaw}
          onClearLogs={clearLogs}
        />
      )}
    </>
  );
}
