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
import { ArrowLeft, WifiOff } from 'lucide-react';
import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePrivateGame } from '@/hooks/usePrivateGame';
import { useProfile } from '@/hooks/useProfile';
import { getRankFromTotalWagered, type RankInfo } from '@/lib/rankSystem';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { usePresenceStore } from '@/stores/presenceStore';


export default function LiveGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [loadingGame, setLoadingGame] = useState(false);
  const [isPrivateGame, setIsPrivateGame] = useState(false);
  const [privateGamePlayerId, setPrivateGamePlayerId] = useState<string | null>(null);
  const [playerRank, setPlayerRank] = useState<RankInfo | undefined>(undefined);
  // Initialize opponent rank from versus screen data if the WS handler already fetched it
  const [opponentRank, setOpponentRank] = useState<RankInfo | undefined>(
    () => useUILoadingStore.getState().versusData?.opponentRank
  );
  const [playerBadges, setPlayerBadges] = useState<string[]>([]);
  const [opponentBadges, setOpponentBadges] = useState<string[]>([]);
  const [opponentElo, setOpponentElo] = useState<number>(800);
  const [opponentStreak, setOpponentStreak] = useState<number>(0);
  
  // Global state from Zustand store
  const { phase, gameState, gameEndResult, setPhase, setGameState, setPlayerName, handleGameEnd, matchmaking } = useChessStore();
  const { balance } = useBalance();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { totalWageredSc, displayName: playerDisplayName, chessElo, dailyPlayStreak } = useProfile();
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
    // If in game, resign first — DO NOT navigate immediately.
    // The resign sends WS, shows overlay, and game_ended will trigger the result modal.
    // Navigating here would cause route flicker.
    if (phase === "in_game") {
      resignGame();
      return; // Don't navigate — overlay is shown, game_ended will handle it
    }
    navigate('/');
  };

  const handleExit = () => {
    // Resign — DO NOT navigate immediately.
    // The overlay is shown by resignGame(). game_ended → result modal.
    if (phase === "in_game") {
      resignGame();
      return; // Don't navigate — overlay is shown, game_ended will handle it
    }
    navigate('/chess');
  };

  const handleSendMove = async (from: string, to: string, promotion?: string) => {
    // All games now use WebSocket (both matchmade and private)
    wsSendMove(from, to, promotion);
  };

  const handleTimeLoss = async (loserColor: 'w' | 'b') => {
    // Server-authoritative: the server's 1 Hz clock tick detects time loss
    // and calls endGame(), which broadcasts game_ended to both players.
    // The client does NOT need to send resign — just log and wait.
    // Sending resignGame() here would show a loading overlay for the opponent
    // when their own clock expires, which is wrong.
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
  
  // Global loading overlay
  const hideLoading = useUILoadingStore((s) => s.hideLoading);
  const showLoading = useUILoadingStore((s) => s.showLoading);
  
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
      setIsPrivateGame(false);
      setPrivateGamePlayerId(null);
      
      // If URL gameId doesn't match store gameId, clear store (including stale gameEndResult)
      if (gameState && gameState.gameId !== gameId) {
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
      joinGameSentRef.current = gameId;
      setIsPrivateGame(false); // Will use WS, not private game hook
      setPrivateGamePlayerId(null);
      joinGame(gameId);
    }
  }, [gameId, gameState, loadingGame, navigate, setPhase, setGameState, setPlayerName, connect, status, joinGame]);

  // Update player name and rank immediately when they become available (for WebSocket games)
  // Uses a ref to only fetch badges ONCE per session (not per game or re-render)
  const playerBadgesFetchedRef = useRef(false);
  
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
      if (!playerRank || playerRank.displayName !== playerRankInfo.displayName) {
        setPlayerRank(playerRankInfo);
        // Also re-patch the versus screen in case it was set with stale data
        useUILoadingStore.getState().patchVersusData({ playerRank: playerRankInfo });
      }
    }

    // Fetch player badges ONCE per session (not per game)
    if (user?.id && !playerBadgesFetchedRef.current) {
      playerBadgesFetchedRef.current = true;
      supabase
        .from('user_badges')
        .select('badge')
        .eq('user_id', user.id)
        .then(({ data }) => {
          if (data) setPlayerBadges(data.map((b) => b.badge));
        });
    }
  }, [playerDisplayName, totalWageredSc, gameState, isPrivateGame, setGameState, setPlayerRank, user?.id]);

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
    
    // Patch the versus screen (if still showing) with player rank + name
    useUILoadingStore.getState().patchVersusData({
      playerRank: playerRankInfo,
      ...(playerDisplayName ? { playerName: playerDisplayName } : {}),
    });
    
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

    // Fetch opponent info only ONCE — consolidated into minimal Supabase calls
    const fetchOpponentInfo = async () => {
      try {
        // Get opponent user ID from matchmaking state (set by WS handler)
        let opponentUserId: string | null = null;
        if (!isPrivateGame) {
          opponentUserId = matchmaking.opponentUserId || null;
        }

        // Strategy: Try multiple approaches to find opponent's profile
        // 1) Direct profile lookup using opponentUserId (works if it's an auth user_id)
        // 2) resolve_player_user_id RPC (handles players.id → auth user_id, bypasses RLS)
        // 3) get_opponent_profile RPC (full game→player→profile join, bypasses all RLS)

        let opponentProfile: { display_name?: string | null; total_wagered_sc: number | null; chess_elo?: number | null; daily_play_streak?: number | null } | null = null;
        let resolvedAuthUserId: string | null = null;

        // Strategy 1: Direct profile lookup
        if (opponentUserId) {
          const { data: directProfile } = await supabase
            .from('profiles')
            .select('total_wagered_sc, display_name, chess_elo, daily_play_streak')
            .eq('user_id', opponentUserId)
            .maybeSingle();
          if (directProfile) {
            opponentProfile = directProfile;
            resolvedAuthUserId = opponentUserId;
          }
        }

        // Strategy 2: resolve_player_user_id RPC (players.id → auth user_id)
        if (!opponentProfile && opponentUserId) {
          const { data: resolvedId } = await supabase.rpc('resolve_player_user_id', {
            p_player_id: opponentUserId,
          });
          if (resolvedId) {
            resolvedAuthUserId = resolvedId;
            const { data: retryProfile } = await supabase
              .from('profiles')
              .select('total_wagered_sc, display_name, chess_elo, daily_play_streak')
              .eq('user_id', resolvedId)
              .maybeSingle();
            if (retryProfile) opponentProfile = retryProfile;
          }
        }

        // Strategy 3: get_opponent_profile RPC (full server-side join, no RLS issues)
        // Works even without opponentUserId — only needs dbGameId
        if (!opponentProfile && gameState?.dbGameId) {
          const { data: rpcData } = await supabase.rpc('get_opponent_profile', {
            p_game_id: gameState.dbGameId,
          });
          if (rpcData && rpcData.length > 0) {
            const row = rpcData[0];
            opponentProfile = { display_name: row.display_name, total_wagered_sc: row.total_wagered_sc, chess_elo: row.chess_elo, daily_play_streak: row.daily_play_streak };
            resolvedAuthUserId = row.opponent_user_id;
          }
        }

        if (opponentProfile) {
          const opponentRankInfo = getRankFromTotalWagered(opponentProfile.total_wagered_sc || 0);
          setOpponentRank(opponentRankInfo);
          setOpponentElo(opponentProfile.chess_elo ?? 800);
          setOpponentStreak(opponentProfile.daily_play_streak ?? 0);
          
          // Mark as successfully fetched — prevents re-runs for this game
          opponentFetchedRef.current = gameKey;
          
          // Patch the versus screen (if still showing) with rank + name
          const patchData: Record<string, any> = { opponentRank: opponentRankInfo };
          const displayName = opponentProfile.display_name;
          if (displayName) {
            patchData.opponentName = displayName;
          }
          useUILoadingStore.getState().patchVersusData(patchData);
          
          // Update game state with display name if we fetched it
          if (displayName) {
            const storeState = useChessStore.getState();
            const currentGameState = storeState.gameState;
            if (currentGameState && displayName !== currentGameState.opponentName) {
              setGameState({
                ...currentGameState,
                opponentName: displayName,
              });
            }
          }

          // Fetch badges using the resolved auth user_id
          if (resolvedAuthUserId) {
            const { data: badgeData } = await supabase
              .from('user_badges')
              .select('badge')
              .eq('user_id', resolvedAuthUserId);
            if (badgeData && badgeData.length > 0) {
              setOpponentBadges(badgeData.map((b) => b.badge));
            }
          }

        } else if (!opponentUserId && !gameState?.dbGameId) {
          // No opponent user ID AND no dbGameId — DON'T mark as fetched so
          // the effect can retry when matchmaking.opponentUserId or dbGameId
          // becomes available.
        } else {
          // We tried all strategies and couldn't find the profile
          opponentFetchedRef.current = gameKey;
          setOpponentRank(getRankFromTotalWagered(0));
        }
      } catch (error) {
        setOpponentRank(getRankFromTotalWagered(0));
      }
    };

    fetchOpponentInfo();
  // IMPORTANT: Remove gameState from dependencies to prevent re-running on every move
  // Only re-run when game ID changes (new game) or opponent info becomes available
  }, [gameState?.gameId, gameState?.dbGameId, isPrivateGame, matchmaking.opponentUserId, totalWageredSc, playerDisplayName, user?.id, setGameState]);

  // Update presence to "in_game" while on this page
  useEffect(() => {
    usePresenceStore.getState().setStatus('in_game');
    return () => {
      usePresenceStore.getState().setStatus('online');
    };
  }, []);

  // Sync game on visibility change, focus, and reconnect (only for WebSocket games)
  useEffect(() => {
    // Only sync for WebSocket games, not private games
    const isWebSocketGameIdLocal = gameId?.startsWith('g_') ?? false;
    if (isPrivateGame || !isWebSocketGameIdLocal || !gameState || phase !== 'in_game') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncGame();
      }
    };

    const handleFocus = () => {
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

  // Hide the global loading overlay once the game is ready to render
  // This covers: matchmaking flow, reconnect flow, private game join
  // NOTE: If the overlay is in "versus" mode, do NOT auto-hide — VersusScreen's
  // onComplete callback will call hideLoading() when its animation finishes.
  const gameReadyRef = useRef(false);
  useEffect(() => {
    if (gameState && phase === 'in_game' && !gameReadyRef.current) {
      gameReadyRef.current = true;
      const uiState = useUILoadingStore.getState();
      if (uiState.mode !== "versus") {
        // Spinner mode: hide immediately once board is ready
        hideLoading();
      }
      // Versus mode: VersusScreen.onComplete() will handle hideLoading
    }
    // Reset if game ends or state clears, so next game can show/hide properly
    if (!gameState || phase !== 'in_game') {
      gameReadyRef.current = false;
    }
  }, [gameState, phase, hideLoading]);

  // Loading state (connecting or loading game) — show global overlay
  const isLoadingConnection = loadingGame || status === "connecting" || status === "reconnecting";
  
  useEffect(() => {
    if (isLoadingConnection) {
      showLoading();
      // Reset gameReadyRef so the "game ready" effect can re-fire hideLoading()
      // after the connection is restored. Without this, a reconnect after alt-tab
      // leaves the overlay stuck because gameReadyRef.current is still true
      // from the initial game setup.
      gameReadyRef.current = false;
    }
  }, [isLoadingConnection, showLoading]);

  // No game state yet — show global overlay while waiting for game data
  useEffect(() => {
    if (!isLoadingConnection && !gameState) {
      showLoading();
    }
  }, [isLoadingConnection, gameState, showLoading]);
  
  if (isLoadingConnection) {
    // Global overlay is shown — render nothing else
    return showNetworkDebug ? (
      <NetworkDebugPanel
        status={status}
        logs={logs}
        reconnectAttempts={reconnectAttempts}
        onConnect={connect}
        onDisconnect={disconnect}
        onSendRaw={sendRaw}
        onClearLogs={clearLogs}
      />
    ) : null;
  }

  // Disconnected state — show overlay + minimal reconnect action
  if (!isPrivateGame && status === "disconnected") {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0a0f1a] gap-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        </div>
        <WifiOff className="relative z-10 w-10 h-10 text-red-400/70" />
        <div className="relative z-10 flex gap-3">
          <Button size="sm" onClick={connect}>Reconnect</Button>
          <Button size="sm" variant="ghost" onClick={handleBack} className="text-blue-400">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Home
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
    } else {
      // Guard: Ensure all required fields exist with defaults
      const tokensChange = gameEndResult.creditsChange ?? 0;
      const isWin = gameEndResult.isWin ?? false;
      const reason = gameEndResult.message || gameEndResult.reason || "Game ended";
      
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

  // No game state yet — global overlay is shown via useEffect above
  if (!gameState) {
    // If phase is not in_game and not searching, offer escape
    if (phase !== "in_game" && phase !== "searching" && phase !== "idle") {
      return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0a0f1a] gap-4">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
          </div>
          <div className="relative z-10 flex gap-3">
            <Button size="sm" onClick={() => navigate('/chess')}>Find a Match</Button>
            <Button size="sm" variant="ghost" onClick={handleBack} className="text-blue-400">
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
          </div>
        </div>
      );
    }

    // Overlay is already shown globally — render nothing else
    return showNetworkDebug ? (
      <NetworkDebugPanel
        status={status}
        logs={logs}
        reconnectAttempts={reconnectAttempts}
        onConnect={connect}
        onDisconnect={disconnect}
        onSendRaw={sendRaw}
        onClearLogs={clearLogs}
      />
    ) : null;
  }

  // Verify this is the correct game (for UUID private games, dbGameId matches the URL)
  if (gameId && gameState.gameId !== gameId && gameState.dbGameId !== gameId) {
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
        playerBadges={playerBadges}
        opponentBadges={opponentBadges}
        playerElo={chessElo}
        opponentElo={opponentElo}
        playerStreak={dailyPlayStreak}
        opponentStreak={opponentStreak}
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
