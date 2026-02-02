/**
 * Live Chess Game Page
 * 
 * Uses WebSocket for real-time game state and moves.
 * Route: /game/live/:gameId
 * 
 * Uses Zustand store for GLOBAL state that persists across navigation.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
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
  const { totalWageredSc, displayName: playerDisplayName } = useProfile();
  
  // WebSocket connection and actions (only for matchmade games)
  const {
    status,
    connect,
    disconnect,
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
    // Only use privateGame for actual private games (not WebSocket games)
    const isWebSocketGameId = gameId?.startsWith('g_') ?? false;
    if (isPrivateGame && !isWebSocketGameId && privateGame.sendMove) {
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
    // Only use privateGame for actual private games (not WebSocket games)
    const isWebSocketGameId = gameId?.startsWith('g_') ?? false;
    if (isPrivateGame && !isWebSocketGameId && privateGame.resign) {
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
    
    // If URL gameId doesn't match store gameId, clear store and load new game
    if (gameState && gameState.gameId !== gameId) {
      console.log('[LiveGame] GameId mismatch - clearing old game state and gameEndResult');
      setGameState(null);
      setPhase('idle');
      clearGameEnd(); // Clear any stale game end result from previous game
      setIsPrivateGame(false);
      setPrivateGamePlayerId(null);
      // Don't return - continue to load new game
    }
    
    // If we already have the correct gameState, don't reload
    if (gameState && gameState.gameId === gameId) return;

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

  // Fetch player and opponent ranks
  useEffect(() => {
    if (!gameState) return;

    const fetchRanks = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:316',message:'fetchRanks started',data:{hasGameState:!!gameState,phase:useChessStore.getState().phase,isPrivateGame,gameId:gameState?.gameId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      try {
        // Get player rank from profile hook
        const playerRankInfo = getRankFromTotalWagered(totalWageredSc);
        setPlayerRank(playerRankInfo);
        
        // Update player's own name from profile if available (for WebSocket games)
        if (playerDisplayName && gameState && !isPrivateGame) {
          // Get latest gameState from store to avoid stale closure
          const storeState = useChessStore.getState();
          const currentGameState = storeState.gameState;
          const currentPhase = storeState.phase;
          
          // CRITICAL: Don't update gameState if game has already ended
          // This prevents state conflicts that interfere with the GameResultModal display
          if (currentGameState && currentPhase !== "game_over" && (currentGameState.playerName === "Player" || currentGameState.playerName !== playerDisplayName)) {
            setGameState({
              ...currentGameState,
              playerName: playerDisplayName,
            });
            console.log('[LiveGame] Updated player name from profile:', {
              oldName: currentGameState.playerName,
              newName: playerDisplayName,
            });
          }
        }

        // Get opponent rank
        let opponentUserId: string | null = null;

        if (isPrivateGame && gameState.dbGameId) {
          // For private games, get opponent from game data
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
            // Find opponent user_id
            const whitePlayerUserId = (game.white_player as any)?.user_id;
            const blackPlayerUserId = (game.black_player as any)?.user_id;
            
            if (gameState.color === 'w') {
              opponentUserId = blackPlayerUserId;
            } else {
              opponentUserId = whitePlayerUserId;
            }
          }
        } else if (!isPrivateGame) {
          // For WebSocket games, get from matchmaking state
          opponentUserId = matchmaking.opponentUserId || null;
          
          // If opponentUserId is not in matchmaking state, try to get it from gameState.dbGameId
          // by querying the game to find the opponent
          if (!opponentUserId && gameState?.dbGameId) {
            try {
              const { data: game } = await supabase
                .from('games')
                .select('white_player_id, black_player_id')
                .eq('id', gameState.dbGameId)
                .maybeSingle();
              
              if (game && user?.id) {
                // Find opponent user_id by checking which player we are
                const { data: myPlayer } = await supabase
                  .from('players')
                  .select('id, user_id')
                  .or(`user_id.eq.${user.id},id.eq.${gameState.color === 'w' ? game.white_player_id : game.black_player_id}`)
                  .maybeSingle();
                
                if (gameState.color === 'w') {
                  // We're white, opponent is black
                  const { data: blackPlayer } = await supabase
                    .from('players')
                    .select('user_id')
                    .eq('id', game.black_player_id)
                    .maybeSingle();
                  opponentUserId = blackPlayer?.user_id || null;
                } else {
                  // We're black, opponent is white
                  const { data: whitePlayer } = await supabase
                    .from('players')
                    .select('user_id')
                    .eq('id', game.white_player_id)
                    .maybeSingle();
                  opponentUserId = whitePlayer?.user_id || null;
                }
              }
            } catch (err) {
              console.error('[LiveGame] Error fetching opponent from game:', err);
            }
          }
        }

        if (opponentUserId) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:412',message:'About to fetch opponent profile',data:{opponentUserId,phase:useChessStore.getState().phase,hasGameState:!!gameState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          // Fetch opponent's profile using RPC function (bypasses RLS)
          let opponentProfile: { display_name: string | null; total_wagered_sc: number | null } | null = null;
          
          try {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:417',message:'Calling get_opponent_profile RPC',data:{opponentUserId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            // Try RPC function first (bypasses RLS)
            const { data: rpcData, error: rpcError } = await supabase
              .rpc('get_opponent_profile', { p_user_id: opponentUserId });
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:421',message:'get_opponent_profile RPC result',data:{hasRpcError:!!rpcError,rpcError:rpcError?.message,hasRpcData:!!rpcData,rpcDataLength:rpcData?.length,phase:useChessStore.getState().phase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            
            if (!rpcError && rpcData && rpcData.length > 0) {
              opponentProfile = rpcData[0];
            } else {
              // Fallback to direct query if RPC fails
              const { data: profileData, error: queryError } = await supabase
                .from('profiles')
                .select('total_wagered_sc, display_name')
                .eq('user_id', opponentUserId)
                .maybeSingle();
              
              if (!queryError && profileData) {
                opponentProfile = profileData;
              } else {
                console.error('[LiveGame] Error fetching opponent profile:', rpcError || queryError);
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:434',message:'Error fetching opponent profile',data:{rpcError:rpcError?.message,queryError:queryError?.message,phase:useChessStore.getState().phase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
              }
            }
          } catch (err) {
            console.error('[LiveGame] Exception fetching opponent profile:', err);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:438',message:'Exception in fetchRanks get_opponent_profile',data:{error:err instanceof Error?err.message:String(err),phase:useChessStore.getState().phase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
          }

          if (opponentProfile) {
            const opponentRankInfo = getRankFromTotalWagered(opponentProfile.total_wagered_sc || 0);
            setOpponentRank(opponentRankInfo);
            
            // Always update opponent name from profile (more reliable than server payload)
            const opponentDisplayName = opponentProfile.display_name || "Opponent";
            // Get latest gameState from store to avoid stale closure
            // Access store directly to get the latest state (avoids stale closure)
            const storeState = useChessStore.getState();
            const currentGameState = storeState.gameState;
            const currentPhase = storeState.phase;
            
            // CRITICAL: Don't update gameState if game has already ended
            // This prevents state conflicts that interfere with the GameResultModal display
            if (currentGameState && currentPhase !== "game_over") {
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:451',message:'About to update gameState with opponent name',data:{phase:currentPhase,hasGameState:!!currentGameState,opponentDisplayName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
              // Always update if name is different or if it's still "Opponent"
              if (opponentDisplayName !== currentGameState.opponentName || currentGameState.opponentName === "Opponent") {
                // Update the gameState with the actual opponent name from profile
                try {
                  setGameState({
                    ...currentGameState,
                    opponentName: opponentDisplayName,
                  });
                  // #region agent log
                  fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:455',message:'Updated gameState with opponent name',data:{oldName:currentGameState.opponentName,newName:opponentDisplayName,phase:useChessStore.getState().phase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                  // #endregion
                  console.log('[LiveGame] Updated opponent name from profile:', {
                    oldName: currentGameState.opponentName,
                    newName: opponentDisplayName,
                    opponentUserId,
                  });
                } catch (err) {
                  // #region agent log
                  fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:464',message:'Error updating gameState with opponent name',data:{error:err instanceof Error?err.message:String(err),phase:useChessStore.getState().phase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                  // #endregion
                  console.error('[LiveGame] Error updating gameState:', err);
                }
              }
            } else if (currentPhase === "game_over") {
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:470',message:'Skipping gameState update - game already ended',data:{phase:currentPhase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
            }
          } else {
            // If no profile found, set to unranked
            setOpponentRank(getRankFromTotalWagered(0));
            console.warn('[LiveGame] No profile found for opponentUserId:', opponentUserId);
          }
        } else {
          // No opponent user_id available, set to unranked
          setOpponentRank(getRankFromTotalWagered(0));
          console.warn('[LiveGame] No opponentUserId available for WebSocket game', {
            hasMatchmaking: !!matchmaking,
            opponentUserIdFromMatchmaking: matchmaking.opponentUserId,
            hasDbGameId: !!gameState?.dbGameId,
          });
        }
      } catch (error) {
        console.error('[LiveGame] Error fetching ranks:', error);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:480',message:'Exception in fetchRanks',data:{error:error instanceof Error?error.message:String(error),phase:useChessStore.getState().phase,hasGameState:!!gameState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // On error, set to unranked
        setOpponentRank(getRankFromTotalWagered(0));
      }
    };

    fetchRanks();
  }, [gameState, isPrivateGame, totalWageredSc, user?.id, matchmaking.opponentUserId, playerDisplayName, setGameState, setPlayerRank]);

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

  // Loading state (connecting or loading game)
  // For private games, check privateGame.loading instead of WebSocket status
  // Only check privateGame.loading if it's actually a private game (not WebSocket)
  const isLoading = (isPrivateGame && !isWebSocketGameId)
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
  // CRITICAL: Only show if phase is game_over AND gameEndResult exists AND we're in the correct game
  // This prevents showing stale game results from previous games
  if (phase === "game_over" && gameEndResult) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:579',message:'Checking if should show GameResultModal',data:{phase,hasGameEndResult:!!gameEndResult,hasGameState:!!gameState,gameId,gameStateGameId:gameState?.gameId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    // Guard: Only show modal if we have a gameState that matches the current gameId
    // If gameState doesn't match gameId, this is a stale result from a previous game - don't show
    const shouldShowModal = gameState && gameState.gameId === gameId;
    
    if (!shouldShowModal) {
      console.log("[LiveGame] NOT showing GameResultModal - gameId mismatch or no gameState", {
        currentGameId: gameId,
        gameStateGameId: gameState?.gameId,
        phase,
        hasGameEndResult: !!gameEndResult,
        timestamp: new Date().toISOString(),
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:585',message:'NOT showing GameResultModal - gameId mismatch',data:{currentGameId:gameId,gameStateGameId:gameState?.gameId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    } else {
      // Guard: Ensure all required fields exist with defaults
      const tokensChange = gameEndResult.creditsChange ?? 0;
      const isWin = gameEndResult.isWin ?? false;
      const reason = gameEndResult.message || gameEndResult.reason || "Game ended";
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveGame.tsx:593',message:'About to render GameResultModal',data:{isWin,tokensChange,reason,hasGameEndResult:!!gameEndResult},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
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

  // For private games, use Realtime state; for WebSocket games, use store state
  // Only use privateGame state if it's actually a private game (not WebSocket)
  // Note: isWebSocketGameId is already defined at component level (line 60)
  const usePrivateGameState = isPrivateGame && !isWebSocketGameId && privateGame.gameState;
  
  const currentFen = usePrivateGameState
    ? privateGame.gameState.fen 
    : gameState.fen;
  const isMyTurn = usePrivateGameState
    ? privateGame.gameState.isMyTurn
    : gameState.isMyTurn;
  const whiteTime = usePrivateGameState
    ? privateGame.gameState.whiteTime
    : 60; // Default fallback
  const blackTime = usePrivateGameState
    ? privateGame.gameState.blackTime
    : 60; // Default fallback

  // Ensure playerRank is always calculated if totalWageredSc is available
  const effectivePlayerRank = useMemo(() => {
    if (playerRank) return playerRank;
    if (totalWageredSc !== undefined && totalWageredSc !== null) {
      return getRankFromTotalWagered(totalWageredSc);
    }
    return undefined;
  }, [playerRank, totalWageredSc]);


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
      {(!isPrivateGame || isWebSocketGameId) && (
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
