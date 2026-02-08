/**
 * Live Chess Game Page
 * 
 * Uses WebSocket for real-time game state and moves.
 * Route: /game/live/:gameId
 * 
 * Uses Zustand store for GLOBAL state that persists across navigation.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useRef } from 'react';
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
import { useProfile } from '@/hooks/useProfile';
import { getRankFromTotalWagered, type RankInfo } from '@/lib/rankSystem';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

export default function LiveGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [loadingGame, setLoadingGame] = useState(false);
  const [isPrivateGame, setIsPrivateGame] = useState(false);
  const [privateGamePlayerId, setPrivateGamePlayerId] = useState<string | null>(null);
  const [playerRank, setPlayerRank] = useState<RankInfo | undefined>(undefined);
  const [opponentRank, setOpponentRank] = useState<RankInfo | undefined>(undefined);
  
  // Global state from Zustand store
  const { phase, gameState, gameEndResult, setPhase, setGameState, setPlayerName, handleGameEnd, matchmaking } = useChessStore();
  const { balance } = useBalance();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { totalWageredSc, displayName: playerDisplayName } = useProfile();
  const showNetworkDebug = isAdmin;
  
  // WebSocket connection and actions (for matchmade AND private games)
  const {
    status,
    connect,
    disconnect,
    joinGame,
    sendMove: wsSendMove,
    resignGame,
    syncGame,
    clearGameEnd,
    refreshBalance,
    logs,
    clearLogs,
    sendRaw,
    reconnectAttempts,
  } = useChessWebSocket();

  // Determine if this is a WebSocket game (gameId starts with 'g_') or a private game (UUID)
  // WebSocket games have local IDs like 'g_m7s1pgtn', private games have UUIDs
  const isWebSocketGameId = gameId?.startsWith('g_') ?? false;
  
  // Private game hook (only used for private games, NOT WebSocket games)
  // Pass empty gameId for WebSocket games to prevent database queries
  // React hooks must be called unconditionally, so we always call it but with empty gameId for WS games
  const privateGame = usePrivateGame({
    gameId: (isPrivateGame && !isWebSocketGameId && gameId) ? gameId : '',
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
    // All games now use WebSocket (both matchmade and private)
    wsSendMove(from, to, promotion);
  };

  const handleTimeLoss = async (loserColor: 'w' | 'b') => {
    // When time runs out, resign the game
    console.log(`[LiveGame] Time loss for ${loserColor === 'w' ? 'white' : 'black'}`);
    // All games now use WebSocket for time loss handling
    resignGame();
  };

  const handlePlayAgain = () => {
    clearGameEnd();
    refreshBalance();  // Refresh balance when going to play again
    navigate('/chess');
  };

  const handleGoHome = () => {
    clearGameEnd();
    refreshBalance();  // Refresh balance when going home
    navigate('/');
  };

  // Ref to track if we've already sent join_game for this UUID
  const joinGameSentRef = useRef<string | null>(null);
  
  // Load game from database if gameId is in URL but no gameState
  // Also reload if URL gameId doesn't match store gameId (game changed)
  useEffect(() => {
    // Dismiss any "waiting for opponent" notifications when game loads
    toast.dismiss();
    
    if (!gameId || loadingGame) return;
    
    // Check if this is a WebSocket game (starts with 'g_')
    // WebSocket games are handled by the WebSocket hook, not by loading from database
    const isWebSocketGameId = gameId.startsWith('g_');
    
    if (isWebSocketGameId) {
      // This is a WebSocket game - don't try to load from database
      console.log('[LiveGame] WebSocket game detected (gameId starts with g_), skipping database load');
      setIsPrivateGame(false);
      setPrivateGamePlayerId(null);
      
      // If URL gameId doesn't match store gameId, clear store (including stale gameEndResult)
      if (gameState && gameState.gameId !== gameId) {
        console.log('[LiveGame] WebSocket gameId mismatch - clearing old game state and gameEndResult');
        setGameState(null);
        setPhase('idle');
        clearGameEnd(); // Clear any stale game end result from previous game
      }
      
      // If we already have the correct gameState from WebSocket, we're good
      if (gameState && gameState.gameId === gameId) {
        return;
      }
      
      // If we don't have gameState yet, wait for WebSocket to provide it
      // The WebSocket hook will set gameState when match_found is received
      return;
    }
    
    // UUID game (from private rooms) — join via WebSocket instead of loading from DB
    // This gives us server-authoritative game state and no per-move DB writes
    
    // If URL gameId doesn't match store gameId and store has stale data, clear it
    if (gameState && gameState.gameId !== gameId && gameState.dbGameId !== gameId) {
      console.log('[LiveGame] GameId mismatch - clearing old game state and gameEndResult');
      setGameState(null);
      setPhase('idle');
      clearGameEnd();
      setIsPrivateGame(false);
      setPrivateGamePlayerId(null);
      joinGameSentRef.current = null;
    }
    
    // If we already have the correct gameState (dbGameId matches UUID), we're good
    if (gameState && (gameState.gameId === gameId || gameState.dbGameId === gameId)) {
      return;
    }
    
    // Send join_game to WebSocket server (only once per gameId)
    if (status === 'connected' && joinGameSentRef.current !== gameId) {
      console.log('[LiveGame] Sending join_game for private game:', gameId);
      joinGameSentRef.current = gameId;
      setIsPrivateGame(false); // Will use WS, not private game hook
      setPrivateGamePlayerId(null);
      joinGame(gameId);
    }
  }, [gameId, gameState, loadingGame, navigate, setPhase, setGameState, setPlayerName, connect, status, joinGame]);

  // Update player name and rank immediately when they become available (for WebSocket games)
  useEffect(() => {
    if (!gameState || isPrivateGame) return;
    
    // Update player name if displayName is available
    if (playerDisplayName) {
      const storeState = useChessStore.getState();
      const currentGameState = storeState.gameState;
      
      if (currentGameState && (currentGameState.playerName === "Player" || currentGameState.playerName !== playerDisplayName)) {
        setGameState({
          ...currentGameState,
          playerName: playerDisplayName,
        });
      }
    }
    
    // Update player rank if totalWageredSc is available (0 is valid, only skip if undefined/null)
    if (totalWageredSc !== undefined && totalWageredSc !== null) {
      const playerRankInfo = getRankFromTotalWagered(totalWageredSc);
      // Only update if we don't already have a rank, or if the rank would be different
      // This prevents unnecessary updates but ensures it's set initially
      if (!playerRank || playerRank.displayName !== playerRankInfo.displayName) {
        setPlayerRank(playerRankInfo);
      }
    }
  }, [playerDisplayName, totalWageredSc, gameState, isPrivateGame, setGameState, setPlayerRank]);

  // Fetch opponent info ONCE when game starts - NOT on every gameState change
  // This prevents Supabase calls during active games
  const opponentFetchedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!gameState) return;
    
    // CRITICAL: Only fetch opponent info ONCE per game
    // Skip if we already fetched for this game
    const gameKey = `${gameState.gameId}-${gameState.dbGameId || 'no-db'}`;
    if (opponentFetchedRef.current === gameKey) {
      return;
    }
    
    // Set player rank from profile hook (no Supabase call)
    const playerRankInfo = getRankFromTotalWagered(totalWageredSc);
    setPlayerRank(playerRankInfo);
    
    // Update player's own name from profile if available (no Supabase call)
    if (playerDisplayName && !isPrivateGame) {
      const storeState = useChessStore.getState();
      const currentGameState = storeState.gameState;
      if (currentGameState && (currentGameState.playerName === "Player" || currentGameState.playerName !== playerDisplayName)) {
        setGameState({
          ...currentGameState,
          playerName: playerDisplayName,
        });
      }
    }

    // Fetch opponent info only ONCE
    const fetchOpponentInfo = async () => {
      // Mark as fetched BEFORE the async call to prevent duplicate fetches
      opponentFetchedRef.current = gameKey;
      
      try {
        let opponentUserId: string | null = null;

        // For WebSocket games, try matchmaking state first (no Supabase call)
        if (!isPrivateGame) {
          opponentUserId = matchmaking.opponentUserId || null;
        }
        
        // Only query Supabase if we don't have opponent info and have dbGameId
        // This is a ONE-TIME query at game start
        if (!opponentUserId && gameState?.dbGameId) {
          const { data: game } = await supabase
            .from('games')
            .select(`
              white_player_id,
              black_player_id,
              white_player:players!games_white_player_id_fkey(user_id),
              black_player:players!games_black_player_id_fkey(user_id)
            `)
            .eq('id', gameState.dbGameId)
            .maybeSingle();

          if (game && user?.id) {
            const whitePlayerUserId = (game.white_player as any)?.user_id;
            const blackPlayerUserId = (game.black_player as any)?.user_id;
            
            opponentUserId = gameState.color === 'w' ? blackPlayerUserId : whitePlayerUserId;
          }
        }

        if (opponentUserId) {
          // ONE-TIME fetch of opponent profile
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_opponent_profile', { p_user_id: opponentUserId });
          
          let opponentProfile: { display_name: string | null; total_wagered_sc: number | null } | null = null;
          
          if (!rpcError && rpcData && rpcData.length > 0) {
            opponentProfile = rpcData[0];
          } else {
            // Fallback to direct query
            const { data: profileData } = await supabase
              .from('profiles')
              .select('total_wagered_sc, display_name')
              .eq('user_id', opponentUserId)
              .maybeSingle();
            
            if (profileData) {
              opponentProfile = profileData;
            }
          }

          if (opponentProfile) {
            const opponentRankInfo = getRankFromTotalWagered(opponentProfile.total_wagered_sc || 0);
            setOpponentRank(opponentRankInfo);
            
            const opponentDisplayName = opponentProfile.display_name || "Opponent";
            const storeState = useChessStore.getState();
            const currentGameState = storeState.gameState;
            if (currentGameState && opponentDisplayName !== currentGameState.opponentName) {
              setGameState({
                ...currentGameState,
                opponentName: opponentDisplayName,
              });
            }
          } else {
            setOpponentRank(getRankFromTotalWagered(0));
          }
        } else {
          setOpponentRank(getRankFromTotalWagered(0));
        }
      } catch (error) {
        console.error('[LiveGame] Error fetching opponent info:', error);
        setOpponentRank(getRankFromTotalWagered(0));
      }
    };

    fetchOpponentInfo();
  // IMPORTANT: Remove gameState from dependencies to prevent re-running on every move
  // Only re-run when game ID changes (new game) or opponent info becomes available
  }, [gameState?.gameId, gameState?.dbGameId, isPrivateGame, matchmaking.opponentUserId, totalWageredSc, playerDisplayName, user?.id, setGameState]);

  // Sync game on visibility change, focus, and reconnect (only for WebSocket games)
  useEffect(() => {
    // Only sync for WebSocket games, not private games
    const isWebSocketGameIdLocal = gameId?.startsWith('g_') ?? false;
    if (isPrivateGame || !isWebSocketGameIdLocal || !gameState || phase !== 'in_game') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[LiveGame] Tab became visible, syncing game...');
        syncGame();
      }
    };

    const handleFocus = () => {
      console.log('[LiveGame] Window focused, syncing game...');
      syncGame();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Sync on reconnect
    if (status === 'connected') {
      syncGame();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [gameId, isPrivateGame, gameState, phase, status, syncGame]);

  // Ensure playerRank is always calculated if totalWageredSc is available
  // IMPORTANT: useMemo must be called BEFORE any early returns to satisfy React hooks rules
  const effectivePlayerRank = useMemo(() => {
    if (playerRank) return playerRank;
    if (totalWageredSc !== undefined && totalWageredSc !== null) {
      return getRankFromTotalWagered(totalWageredSc);
    }
    return undefined;
  }, [playerRank, totalWageredSc]);

  // Loading state (connecting or loading game)
  // All games now use WebSocket, so check WS status
  const isLoading = loadingGame || status === "connecting" || status === "reconnecting";
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {status === "connecting" ? "Connecting to game server..." : "Reconnecting..."}
        </p>
        {showNetworkDebug && (
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
        {showNetworkDebug && (
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
      </div>
    );
  }

  // Game end modal - show before checking gameState
  // CRITICAL: Only show if phase is game_over AND gameEndResult exists AND we're in the correct game
  // This prevents showing stale game results from previous games
  if (phase === "game_over" && gameEndResult) {
    // Guard: Only show modal if we have a gameState that matches the current gameId
    // If gameState doesn't match gameId, this is a stale result from a previous game - don't show
    // For private games: URL has UUID, gameState has g_xxx, so also check dbGameId
    const shouldShowModal = gameState && (gameState.gameId === gameId || gameState.dbGameId === gameId);
    
    if (!shouldShowModal) {
      console.log("[LiveGame] NOT showing GameResultModal - gameId mismatch or no gameState", {
        currentGameId: gameId,
        gameStateGameId: gameState?.gameId,
        phase,
        hasGameEndResult: !!gameEndResult,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Guard: Ensure all required fields exist with defaults
      const tokensChange = gameEndResult.creditsChange ?? 0;
      const isWin = gameEndResult.isWin ?? false;
      const reason = gameEndResult.message || gameEndResult.reason || "Game ended";
      
      console.log("[LiveGame] Showing GameResultModal", {
        phase,
        hasGameEndResult: !!gameEndResult,
        isWin,
        tokensChange,
        reason,
        balance,
        gameId,
        gameStateGameId: gameState.gameId,
        timestamp: new Date().toISOString(),
      });
      
      return (
        <>
          <GameResultModal
            isWin={isWin}
            coinsChange={tokensChange}
            newBalance={balance}
            reason={reason}
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
  }

  // No game state - check phase to determine what to show
  if (!gameState) {
    // For UUID private games in searching/waiting phase, show connecting/waiting UI
    const isPrivateUuidGame = gameId && !gameId.startsWith('g_');
    if (isPrivateUuidGame && (phase === "searching" || phase === "idle")) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {status === 'connected' ? 'Waiting for opponent to connect...' : 'Connecting to game server...'}
          </p>
          <p className="text-sm text-muted-foreground/60">Game code: {gameId.slice(0, 8)}…</p>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          {showNetworkDebug && (
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
        </div>
      );
    }

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
        {showNetworkDebug && (
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
      </div>
    );
  }

  // Verify this is the correct game (for UUID private games, dbGameId matches the URL)
  if (gameId && gameState.gameId !== gameId && gameState.dbGameId !== gameId) {
    console.warn("[LiveGame] URL gameId mismatch:", gameId, "vs store:", gameState.gameId, "dbGameId:", gameState.dbGameId);
  }

  // Guard against null gameState (prevents React error #300)
  if (!gameState) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Game state not available</p>
        <Button onClick={handleBack}>Go Home</Button>
      </div>
    );
  }

  // Convert color from "w"/"b" to "white"/"black"
  const playerColor = gameState.color === "w" ? "white" : "black";

  // All games now use WebSocket and store state (no more private game Realtime distinction)
  const currentFen = gameState.fen;
  const isMyTurn = gameState.isMyTurn;
  const whiteTime = 60; // Timer managed by WS server, displayed via timer snapshot
  const blackTime = 60; // Timer managed by WS server, displayed via timer snapshot

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
        playerRank={effectivePlayerRank}
        opponentRank={opponentRank}
        onSendMove={handleSendMove}
        onExit={handleExit}
        onBack={handleBack}
        onTimeLoss={handleTimeLoss}
      />
      {showNetworkDebug && (!isPrivateGame || isWebSocketGameId) && (
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
