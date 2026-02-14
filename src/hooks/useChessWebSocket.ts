/**
 * useChessWebSocket Hook
 * 
 * React hook for the chess WebSocket server with auth and wager support.
 * Uses Zustand store for GLOBAL state that persists across navigation.
 * 
 * PART D: Performance improvements:
 * - Memoized callbacks with useCallback
 * - Throttled balance refresh
 * - No unnecessary rerenders
 * - Uses AuthContext instead of redundant auth checks
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Chess } from 'chess.js';
import { wsClient } from '@/lib/wsClient';
import { useChessStore } from '@/stores/chessStore';
import { useUserDataStore } from '@/stores/userDataStore';
import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { perf } from '@/lib/perfLog';
import { getRankFromTotalWagered } from '@/lib/rankSystem';
import type { 
  WSConnectionStatus, 
  MatchFoundMessage,
  MoveAppliedMessage,
  GameEndedMessage,
  OpponentLeftMessage,
  ErrorMessage,
  WelcomeMessage,
  GameSyncMessage,
  WSLogEntry
} from '@/lib/wsTypes';

interface UseChessWebSocketReturn {
  // Connection
  status: WSConnectionStatus;
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Auth state
  isAuthenticated: boolean;
  refreshAuth: () => Promise<boolean>;
  
  // Matchmaking
  findMatch: (wager: number, playerName?: string) => void;
  cancelSearch: () => void;
  
  // Game actions
  joinGame: (gameId: string) => void;
  sendMove: (from: string, to: string, promotion?: string) => void;
  resignGame: () => void;
  syncGame: () => void;
  clearGameEnd: () => void;
  
  // Balance
  refreshBalance: () => Promise<void>;
  
  // Debug
  logs: WSLogEntry[];
  clearLogs: () => void;
  sendRaw: (json: string) => void;
  reconnectAttempts: number;
}

// Track if message handler has been registered globally
let messageHandlerRegistered = false;
let navigationCallback: ((path: string) => void) | null = null;
let balanceRefreshCallback: (() => void) | null = null;
let isAdminCallback: (() => boolean) | null = null;
// PART B: Guard against duplicate navigation to game route
let navigatedToGameId: string | null = null;

/**
 * Build a TimerSnapshot from a server payload.
 * Prefers new ms-precision fields (wMs/bMs/serverNow/lastMoveAt) and
 * falls back to legacy seconds fields (whiteTime/blackTime/serverTimeMs).
 */
function buildTimerSnapshot(payload: any, fallbackTurn: 'w' | 'b' = 'w'): import('@/stores/chessStore').TimerSnapshot {
  const wMs = payload.wMs ?? ((payload.whiteTime ?? 60) * 1000);
  const bMs = payload.bMs ?? ((payload.blackTime ?? 60) * 1000);
  const turn: 'w' | 'b' = payload.turn ?? payload.currentTurn ?? fallbackTurn;
  const clockRunning = payload.clockRunning === true;
  const serverNow = payload.serverNow ?? payload.serverTimeMs ?? Date.now();
  const lastTurnStartedAt = payload.lastMoveAt ?? null;
  const clientNow = Date.now();

  return {
    wMs,
    bMs,
    turn,
    clockRunning,
    serverNow,
    lastTurnStartedAt,
    serverTimeOffsetMs: serverNow - clientNow,
  };
}

/**
 * Initialize the global message handler ONCE
 * This is called from the hook but only registers once
 */
function initializeGlobalMessageHandler(): void {
  if (messageHandlerRegistered) {
    return;
  }
  
  messageHandlerRegistered = true;
  console.log("[Chess WS] Registering global message handler");
  
  wsClient.onMessage((data: unknown) => {
    if (typeof data !== 'object' || data === null || !('type' in data)) {
      console.warn("[Chess WS] Unknown message format:", data);
      return;
    }

    const msg = data as { type: string; [key: string]: unknown };
    const clientId = wsClient.getClientId();
    
    // ALWAYS read current state from store via getState() - never closures!
    const store = useChessStore.getState();
    
    switch (msg.type) {
      case "welcome": {
        const payload = msg as unknown as WelcomeMessage;
        console.log("[Chess WS]", clientId, "Welcome from server:", payload);
        // PART A: Perf milestone - WS handshake done
        perf.mark('ws_connected');
        // Only show connection alert for admin users
        if (isAdminCallback && isAdminCallback()) {
          toast.success("Connected to game server");
        }
        break;
      }
      
      case "searching": {
        console.log("[Chess WS]", clientId, "Searching for opponent...");
        store.setPhase("searching");
        store.setMatchmakingStatus("searching");
        break;
      }
      
      case "waiting_for_opponent": {
        console.log("[Chess WS]", clientId, "Waiting for opponent to connect to private game...", msg);
        store.setPhase("searching");
        store.setMatchmakingStatus("searching");
        break;
      }
      
      case "match_found": {
        const payload = msg as unknown as MatchFoundMessage;
        const store = useChessStore.getState();
        
        // PART A: Perf milestone
        perf.mark('match_found');
        
        // Structured logging
        console.log("[Chess WS] MATCH_FOUND", {
          gameId: payload.gameId,
          userId: store.playerName || 'unknown',
          phase: store.phase,
          hasTimer: !!(payload.whiteTime && payload.blackTime && payload.serverTimeMs),
          timestamp: new Date().toISOString(),
        });
        
        // STEP D: Normalize IDs immediately from various possible fields
        const matchId = payload?.gameId ?? (payload as any)?.game_id ?? (payload as any)?.matchId ?? (payload as any)?.match_id ?? null;
        const dbMatchId = payload?.dbGameId ?? (payload as any)?.dbGameId ?? (payload as any)?.db_game_id ?? null;
        const color = payload?.color ?? null;
        const fen = payload?.fen ?? null;
        
        // Normalize opponent userId (profiles uses user_id, not id)
        // IMPORTANT: Prefer whiteId/blackId (auth user IDs) over opponent.playerId
        // (which may be a players table ID, not an auth.users ID).
        // The profiles table is keyed on auth.users.id (user_id column).
        const opponentUserIdFromWhiteBlack = 
          (color === 'w' ? (payload as any)?.blackId ?? (payload as any)?.black_id : null)
          || (color === 'b' ? (payload as any)?.whiteId ?? (payload as any)?.white_id : null)
          || null;
        
        const opponentUserIdFromPayload = 
          (payload as any)?.opponentUserId ??
          (payload as any)?.opponent_user_id ??
          (payload?.opponent as any)?.user_id ??
          (payload?.opponent as any)?.userId ??
          null;
        
        // Use whiteId/blackId first (guaranteed auth user IDs), then direct fields,
        // then fall back to opponent object fields that might be players table IDs
        const opponentUserId = opponentUserIdFromWhiteBlack
          || opponentUserIdFromPayload
          || payload?.opponent?.playerId
          || (payload?.opponent as any)?.player_id
          || (payload?.opponent as any)?.id
          || null;
        
        console.log("[Chess WS] Opponent ID resolution:", {
          opponentUserIdFromWhiteBlack,
          opponentUserIdFromPayload,
          whiteId: (payload as any)?.whiteId,
          blackId: (payload as any)?.blackId,
          resolvedOpponentUserId: opponentUserId,
          opponentObj: payload?.opponent,
          color,
        });
        
        const wager = typeof payload?.wager === 'number' ? payload.wager : 0;
        
        // STEP D: Validate required fields before updating state
        if (!matchId || !color || !fen) {
          const errorMsg = `MATCH_FOUND missing required fields: matchId=${!!matchId}, color=${!!color}, fen=${!!fen}`;
          console.error("[Chess WS] Invalid match_found payload:", payload, errorMsg);
          store.setMatchmakingError(errorMsg);
          break;
        }
        
        console.log("[Chess WS] MATCH_FOUND received (normalized):", {
          clientId,
          matchId,
          dbMatchId,
          color,
          opponentUserId,
          wager,
          timestamp: new Date().toISOString()
        });
        
        // Update wsClient tracking
        wsClient.setSearching(false);
        wsClient.setInGame(true);

        // Remove search tracking from DB (match found)
        (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
              await supabase
                .from('active_searches')
                .delete()
                .eq('user_id', session.user.id);
            }
          } catch (err) {
            console.warn("[Chess WS] Failed to remove search tracking after match:", err);
          }
        })();
        
        // Get opponent name from payload (try new format first, then legacy)
        const opponentNameFromPayload = payload.opponent?.name || (payload as any).opponentName || "Opponent";
        
        // Get real display name from profile store (more reliable than chess store)
        const profileDisplayName = useUserDataStore.getState().profile?.display_name;
        const realPlayerName = profileDisplayName || store.playerName || "You";
        
        // Use payload opponent name — may be updated asynchronously below
        let opponentName = opponentNameFromPayload;
        
        // Build timer snapshot from server payload (uses ms fields with seconds fallback)
        const snapshot = buildTimerSnapshot(payload, 'w');
        store.updateTimerSnapshot(snapshot);
        console.log("[Chess WS] Timer snapshot (match_found)", {
          gameId: payload.gameId,
          wMs: snapshot.wMs,
          bMs: snapshot.bMs,
          turn: snapshot.turn,
          clockRunning: snapshot.clockRunning,
        });
        
        // STEP D: Update normalized matchmaking state
        store.setMatchmakingMatch({
          matchId,
          dbMatchId: dbMatchId || undefined,
          opponentUserId: opponentUserId || undefined,
          color,
          wager,
        });
        
        // Atomically update game store
        store.handleMatchFound({
          gameId: matchId,
          dbGameId: dbMatchId || undefined,
          color,
          fen,
          playerName: realPlayerName,
          opponentName,
          wager,
        });
        
        // Show "Versus" overlay — the VersusScreen animation plays inside
        // the global FullScreenLoaderOverlay until onComplete fires.
        useUILoadingStore.getState().showVersus({
          playerName: realPlayerName,
          opponentName,
          playerColor: color === "w" ? "white" : "black",
          wager,
          // Ranks will be patched in by LiveGame once fetched
        });
        
        // Patch player rank immediately from the already-loaded profile store
        // (no Supabase call — just reads from Zustand)
        const playerProfile = useUserDataStore.getState().profile;
        if (playerProfile) {
          const playerRankInfo = getRankFromTotalWagered(playerProfile.total_wagered_sc ?? 0);
          useUILoadingStore.getState().patchVersusData({ playerRank: playerRankInfo });
        }

        // Fetch opponent display_name + total_wagered_sc to patch both name AND rank
        // on the versus screen. This must happen here — LiveGame may not have mounted yet.
        //
        // Strategy:
        // 1) If opponentUserId is available, try direct profile lookup
        // 2) If that fails, use resolve_player_user_id RPC (handles players.id → auth user_id)
        // 3) If dbGameId is available, use get_opponent_profile RPC (bypasses RLS completely)
        (async () => {
          try {
            let profileData: { display_name: string | null; total_wagered_sc: number | null } | null = null;
            let resolvedOpponentAuthId: string | null = null;

            // Strategy 1: Direct profile lookup with the opponentUserId we have
            if (opponentUserId) {
              console.log("[Chess WS] Fetching opponent profile for userId:", opponentUserId);
              const { data } = await supabase
                .from('profiles')
                .select('display_name, total_wagered_sc')
                .eq('user_id', opponentUserId)
                .maybeSingle();
              if (data) {
                profileData = data;
                resolvedOpponentAuthId = opponentUserId;
              }
            }

            // Strategy 2: If profile not found and opponentUserId might be a players.id,
            // use the resolve_player_user_id RPC to get the auth user_id (bypasses RLS)
            if (!profileData && opponentUserId) {
              console.log("[Chess WS] Profile not found, trying resolve_player_user_id RPC:", opponentUserId);
              const { data: resolvedId } = await supabase.rpc('resolve_player_user_id', {
                p_player_id: opponentUserId,
              });
              if (resolvedId) {
                console.log("[Chess WS] Resolved players.id → auth user_id:", resolvedId);
                resolvedOpponentAuthId = resolvedId;
                // Update the matchmaking store with the correct auth user_id
                useChessStore.getState().setMatchmakingMatch({
                  matchId: matchId,
                  opponentUserId: resolvedId,
                });
                const { data: retryProfile } = await supabase
                  .from('profiles')
                  .select('display_name, total_wagered_sc')
                  .eq('user_id', resolvedId)
                  .maybeSingle();
                if (retryProfile) profileData = retryProfile;
              }
            }

            // Strategy 3: If still no profile and we have a dbGameId, use the
            // get_opponent_profile RPC which does the full games→players→profiles
            // join server-side (SECURITY DEFINER, bypasses all RLS)
            if (!profileData && dbMatchId) {
              console.log("[Chess WS] Using get_opponent_profile RPC for dbGameId:", dbMatchId);
              const { data: rpcData } = await supabase.rpc('get_opponent_profile', {
                p_game_id: dbMatchId,
              });
              if (rpcData && rpcData.length > 0) {
                const row = rpcData[0];
                profileData = { display_name: row.display_name, total_wagered_sc: row.total_wagered_sc };
                resolvedOpponentAuthId = row.opponent_user_id;
                // Update matchmaking store with the correct auth user_id
                useChessStore.getState().setMatchmakingMatch({
                  matchId: matchId,
                  opponentUserId: row.opponent_user_id,
                });
              }
            }

            if (profileData) {
              const patch: Record<string, any> = {};

              // Patch opponent name
              if (profileData.display_name) {
                patch.opponentName = profileData.display_name;
              }

              // Patch opponent rank
              const opponentRankInfo = getRankFromTotalWagered(profileData.total_wagered_sc ?? 0);
              patch.opponentRank = opponentRankInfo;

              useUILoadingStore.getState().patchVersusData(patch);

              // Also patch the game state so the board shows the real name
              const currentGameState = useChessStore.getState().gameState;
              if (currentGameState && currentGameState.gameId === matchId) {
                useChessStore.getState().setGameState({
                  ...currentGameState,
                  ...(profileData.display_name ? { opponentName: profileData.display_name } : {}),
                });
              }

              console.log("[Chess WS] Opponent profile resolved:", {
                resolvedOpponentAuthId,
                displayName: profileData.display_name,
                totalWagered: profileData.total_wagered_sc,
                rank: opponentRankInfo.displayName,
              });
            } else {
              console.warn("[Chess WS] Could not find opponent profile via any strategy");
            }
          } catch (err) {
            console.warn("[Chess WS] Error fetching opponent profile:", err);
          }
        })();
        
        // Only show match found toast for admin users
        if (isAdminCallback && isAdminCallback()) {
          toast.success(`Match found! You play as ${color === "w" ? "White" : "Black"}. Wager: ${wager} SC`);
        }
        
        // Navigate using the callback - CRITICAL: WS must stay open during navigation
        // For private games (dbMatchId present), the user is likely already on /game/live/{UUID}.
        // DON'T navigate to /game/live/g_xxx — it causes a URL change mid-render (React error #310).
        // The gameState is already set with dbGameId matching the URL, so the board will render.
        if (navigationCallback && matchId) {
          if (dbMatchId) {
            // Private game: user is already on /game/live/{UUID}, stay there
            console.log("[Chess WS] Private game match_found — NOT navigating (staying on UUID page). dbGameId:", dbMatchId);
          } else {
            // PART B: Guard against duplicate navigation (navigatedToGameRef pattern)
            if (navigatedToGameId === matchId) {
              console.log("[Chess WS] Already navigated to game, skipping duplicate nav:", matchId);
            } else {
              navigatedToGameId = matchId;
              // Public matchmaking: navigate from queue/lobby page to the game page
              console.log("[Chess WS] NAVIGATING to game:", `/game/live/${matchId}`);
              navigationCallback(`/game/live/${matchId}`);
            }
          }
        }
        break;
      }
      
      case "move_applied": {
        const payload = msg as unknown as MoveAppliedMessage;
        const currentState = useChessStore.getState();
        
        console.log("[Chess WS] MOVE_APPLIED", {
          gameId: payload.gameId || currentState.gameState?.gameId || 'unknown',
          userId: currentState.playerName || 'unknown',
          phase: currentState.phase,
          turn: payload.turn,
          hasTimer: !!(payload.whiteTime && payload.blackTime && payload.serverTimeMs),
          timestamp: new Date().toISOString(),
        });
        
        // Update FEN from server (server is authoritative)
        store.updateFromServer(payload.fen, payload.turn);
        
        // Always update timer snapshot on move_applied (turn always changes)
        const moveSnapshot = buildTimerSnapshot(payload, payload.turn);
        store.updateTimerSnapshot(moveSnapshot);
        console.log("[Chess WS] Timer snapshot (move_applied)", {
          gameId: payload.gameId || currentState.gameState?.gameId || 'unknown',
          wMs: moveSnapshot.wMs,
          bMs: moveSnapshot.bMs,
          turn: moveSnapshot.turn,
          clockRunning: moveSnapshot.clockRunning,
        });
        
        // PREMOVE EXECUTION: Check if it's now our turn and we have a premove queued
        const updatedState = useChessStore.getState();
        const myColor = updatedState.gameState?.color;
        const isNowMyTurn = myColor === payload.turn;
        const premove = updatedState.premove;
        
        if (isNowMyTurn && premove && updatedState.phase === "in_game") {
          console.log("[Chess WS] PREMOVE: Turn switched to us, attempting premove execution:", premove);
          
          // Validate premove against new position
          try {
            const testChess = new Chess(payload.fen);
            const moveResult = testChess.move({
              from: premove.from,
              to: premove.to,
              promotion: premove.promotion || 'q',
            });
            
            if (moveResult) {
              // Premove is valid - execute it immediately
              console.log("[Chess WS] PREMOVE: Valid! Sending to server:", premove);
              
              // Build UCI string
              const uci = `${premove.from.toLowerCase()}${premove.to.toLowerCase()}${premove.promotion ? premove.promotion.toLowerCase() : ""}`;
              
              wsClient.send({
                type: "move",
                move: uci,
              });
            } else {
              // Premove is illegal - discard silently
              console.log("[Chess WS] PREMOVE: Invalid in new position, discarding");
            }
          } catch (e) {
            // chess.js threw an error - premove is illegal
            console.log("[Chess WS] PREMOVE: chess.js error, discarding:", e);
          }
          
          // Always clear premove after attempting execution
          store.clearPremove();
        }
        break;
      }
      
      case "game_sync": {
        const payload = msg as unknown as GameSyncMessage;
        console.log("[Chess WS]", clientId, "Game sync received:", payload);
        
        // Update game state from server sync
        if (store.gameState && store.gameState.gameId === payload.gameId) {
          store.updateFromServer(payload.fen, payload.turn);
          
          // Update timer snapshot from server
          const syncSnapshot = buildTimerSnapshot(payload, payload.turn);
          store.updateTimerSnapshot(syncSnapshot);
          
          // If game ended, handle it
          if (payload.status === "ended") {
            console.log("[Chess WS] Sync shows game already ended");
            store.clearTimerSnapshot();
            store.clearPremove();
          }
          
          // PREMOVE: Also attempt premove execution on game_sync (safety net for reconnect)
          const syncState = useChessStore.getState();
          const syncMyColor = syncState.gameState?.color;
          const syncIsMyTurn = syncMyColor === payload.turn;
          const syncPremove = syncState.premove;
          
          if (syncIsMyTurn && syncPremove && syncState.phase === "in_game" && payload.status !== "ended") {
            console.log("[Chess WS] PREMOVE (game_sync): Turn is ours, attempting premove:", syncPremove);
            try {
              const syncTestChess = new Chess(payload.fen);
              const syncMoveResult = syncTestChess.move({
                from: syncPremove.from,
                to: syncPremove.to,
                promotion: syncPremove.promotion || 'q',
              });
              if (syncMoveResult) {
                const syncUci = `${syncPremove.from.toLowerCase()}${syncPremove.to.toLowerCase()}${syncPremove.promotion ? syncPremove.promotion.toLowerCase() : ""}`;
                wsClient.send({ type: "move", move: syncUci });
              } else {
                console.log("[Chess WS] PREMOVE (game_sync): Invalid, discarding");
              }
            } catch (e) {
              console.log("[Chess WS] PREMOVE (game_sync): Error, discarding:", e);
            }
            store.clearPremove();
          }
        }
        break;
      }
      
      case "game_ended": {
        const payload = msg as unknown as GameEndedMessage;
        const currentState = useChessStore.getState();
        
        console.log("[resign] game_end received", { reason: payload.reason, winnerColor: payload.winnerColor, timestamp: new Date().toISOString() });
        
        // Clear resign fallback timeout (if any)
        if ((window as any).__resignTimeoutId) {
          clearTimeout((window as any).__resignTimeoutId);
          (window as any).__resignTimeoutId = null;
          console.log("[resign] timeout cleared (game_end arrived in time)");
        }
        
        // ALWAYS hide global loading/transition overlay on game end
        useUILoadingStore.getState().hideLoading();
        console.log("[resign] overlay hidden");
        
        // PART B: Reset navigation guard so next game can navigate
        navigatedToGameId = null;
        
        // Validate payload and extract gameId
        const gameId = payload.gameId || currentState.gameState?.gameId || null;
        
        console.log("[Client] GAME_ENDED received", {
          gameId,
          dbGameId: payload.dbGameId || currentState.gameState?.dbGameId || 'unknown',
          userId: currentState.playerName || 'unknown',
          phase: currentState.phase,
          reason: payload.reason,
          winnerColor: payload.winnerColor,
          hasReason: !!payload.reason,
          hasWinnerColor: payload.winnerColor !== undefined,
          fullPayload: payload,
          timestamp: new Date().toISOString(),
        });
        
        // Validate required fields
        if (!payload.reason) {
          console.error("[Client] GAME_ENDED - Missing reason field", payload);
          // Use default reason but don't crash
          payload.reason = "game_over";
        }
        
        wsClient.setSearching(false);
        wsClient.setInGame(false);
        
        // Calculate credits change based on outcome FIRST (before determining isOpponentLeft)
        const myColor = currentState.gameState?.color || null;
        const wager = currentState.gameState?.wager || 0;
        let creditsChange = 0;
        
        if (payload.winnerColor === myColor) {
          creditsChange = wager;  // Won the wager
        } else if (payload.winnerColor !== null && payload.winnerColor !== undefined) {
          creditsChange = -wager;  // Lost the wager
        }
        // Draw = no change (winnerColor is null)
        
        // Determine if opponent left/resigned
        // When opponent resigns, reason is "resign" but winnerColor is NOT myColor
        // When I resign, reason is "resign" and winnerColor IS NOT myColor (I lost)
        // So: opponent resigned if reason is "resign" AND winnerColor === myColor (I won)
        const isOpponentLeft = payload.reason === "disconnect" || 
                               payload.reason === "opponent_disconnect" ||
                               payload.reason === "opponent_resigned" ||
                               (payload.reason === "resign" && payload.winnerColor === myColor);
        
        // Clear timer snapshot on game end
        store.clearTimerSnapshot();
        console.log("[Client] Timer snapshot cleared (game_ended)", {
          gameId,
          timestamp: new Date().toISOString(),
        });
        
        // Log state transition
        console.log("[Client] Calling handleGameEnd", {
          gameId,
          reason: payload.reason,
          winnerColor: payload.winnerColor,
          isOpponentLeft,
          creditsChange,
          myColor,
          wager,
          timestamp: new Date().toISOString(),
        });
        
        // Wrap handleGameEnd in try-catch to prevent crashes
        try {
          // Additional validation before calling handleGameEnd
          if (!currentState.gameState) {
            console.error("[Client] GAME_ENDED - No gameState, cannot process game end", {
              gameId,
              phase: currentState.phase,
            });
            return; // Don't crash, just log and return
          }
          
          // Ensure we have valid gameId match
          if (gameId && currentState.gameState.gameId !== gameId) {
            console.warn("[Client] GAME_ENDED - gameId mismatch, ignoring", {
              payloadGameId: gameId,
              storeGameId: currentState.gameState.gameId,
            });
            return; // Stale message, ignore
          }
          
          store.handleGameEnd({
            reason: payload.reason || "game_over",  // Ensure reason is never undefined
            winnerColor: payload.winnerColor ?? null,  // Ensure null if undefined
            isOpponentLeft,
            creditsChange,
          });
          
          console.log("[Client] handleGameEnd completed successfully", {
            gameId,
            newPhase: useChessStore.getState().phase,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("[Client] GAME_ENDED - Error in handleGameEnd:", error, {
            gameId,
            payload,
            currentState: {
              phase: currentState.phase,
              hasGameState: !!currentState.gameState,
            },
          });
          // Only show error for admin users
        if (isAdminCallback && isAdminCallback()) {
          toast.error("Error processing game end. Please refresh.");
        }
          // Still try to transition to game_over even if handleGameEnd failed
          try {
            store.setPhase("game_over");
          } catch (e) {
            console.error("[Client] Failed to set phase to game_over:", e);
          }
        }
        
        // Trigger event-driven balance sync via userDataStore (deduped by gameId)
        if (gameId) {
          useUserDataStore.getState().syncBalanceAfterGame({
            gameId,
            creditsChange,
            reason: payload.reason || "game_over",
          });
        } else {
          console.warn("[Client] GAME_ENDED - no gameId, falling back to legacy balance refresh");
          if (balanceRefreshCallback) {
            balanceRefreshCallback();
          }
        }
        
        if (isOpponentLeft) {
          // Only show for admin users
          if (isAdminCallback && isAdminCallback()) {
            toast.info("Opponent left the game");
          }
        } else if (payload.winnerColor === null || payload.winnerColor === undefined) {
          // Only show for admin users
          if (isAdminCallback && isAdminCallback()) {
            toast.info(`Game over: ${payload.reason}`);
          }
        }
        break;
      }
      
      case "credits_settled": {
        // Server finished DB settlement after game_ended was already sent.
        // game_ended already triggers syncBalanceAfterGame() which does:
        //   1. Optimistic balance update (instant UI)
        //   2. Authoritative DB fetch after 500ms
        // The Realtime subscription on profiles will also pick up the change.
        // So we DON'T need another balance refresh here — it would be a duplicate.
        console.log("[Client] credits_settled — no-op (syncBalanceAfterGame already handles this)");
        break;
      }
      
      case "opponent_left": {
        const payload = msg as unknown as OpponentLeftMessage;
        console.log("[Chess WS]", clientId, "Opponent left:", payload);
        
        // ALWAYS hide loading/transition overlay
        useUILoadingStore.getState().hideLoading();
        
        wsClient.setSearching(false);
        wsClient.setInGame(false);
        
        // Current player wins by default when opponent leaves
        const currentState = useChessStore.getState();
        const opponentLeftGameId = currentState.gameState?.gameId || null;
        const myColor = currentState.gameState?.color || null;
        const wager = currentState.gameState?.wager || 0;
        
        store.handleGameEnd({
          reason: payload.reason || "opponent_disconnect",
          winnerColor: myColor,
          isOpponentLeft: true,
          creditsChange: wager,  // Win the wager
        });
        
        // Trigger event-driven balance sync via userDataStore (deduped by gameId)
        if (opponentLeftGameId) {
          useUserDataStore.getState().syncBalanceAfterGame({
            gameId: opponentLeftGameId,
            creditsChange: wager,
            reason: payload.reason || "opponent_disconnect",
          });
        } else {
          if (balanceRefreshCallback) {
            balanceRefreshCallback();
          }
        }
        
        // Only show for admin users
        if (isAdminCallback && isAdminCallback()) {
          toast.info("Opponent left the game - you win!");
        }
        break;
      }
      
      case "error": {
        const payload = msg as unknown as ErrorMessage;
        console.log("[Chess WS]", clientId, "Error:", payload.code, payload.message);
        
        // Always hide global loading overlay on error
        useUILoadingStore.getState().hideLoading();
        
        // Handle "already in a game" desync
        if (payload.message?.toLowerCase().includes("already in") || 
            payload.code === "ALREADY_IN_GAME") {
          const currentPhase = useChessStore.getState().phase;
          
          if (currentPhase !== "in_game") {
            // Desync detected! Reset and reconnect
            console.log("[Chess WS] Desync detected - resetting");
            // Only show connection alerts for admin users
            if (isAdminCallback && isAdminCallback()) {
              toast.error("Desynced with server. Reconnecting...");
            }
            
            wsClient.disconnect();
            useChessStore.getState().resetAll();
            
            // Reconnect after short delay
            setTimeout(() => {
              wsClient.connect();
              // Only show connection alerts for admin users
              if (isAdminCallback && isAdminCallback()) {
                toast.info("Reconnected. Please find match again.");
              }
            }, 500);
            return;
          }
        }
        
        // Handle insufficient balance error
        if (payload.code === "INSUFFICIENT_BALANCE" || 
            payload.message?.toLowerCase().includes("insufficient")) {
          // Only show for admin users
          if (isAdminCallback && isAdminCallback()) {
            toast.error("Insufficient balance for this wager");
          }
          useChessStore.getState().setPhase("idle");
          wsClient.setSearching(false);
          return;
        }
        
        // Handle wager denied error (server-side validation failed)
        if (payload.code === "WAGER_DENIED") {
          // Only show for admin users
          if (isAdminCallback && isAdminCallback()) {
            toast.error("Unable to process wager. Please try again.");
          }
          useChessStore.getState().setPhase("idle");
          wsClient.setSearching(false);
          return;
        }
        
        const errorMessage = payload?.message ?? "Unknown error";
        // Only show generic errors for admin users
        if (isAdminCallback && isAdminCallback()) {
          toast.error(errorMessage);
        }
        break;
      }
      
      case "clock_snapshot":
      case "clock_update": {
        // Server sends clock snapshots: 1Hz periodic sync + explicit sync responses.
        // Always accept if no local snapshot, or if clockRunning/turn changed.
        // Otherwise, drift-check: only apply if local estimate drifted >500ms from server.
        const payload = msg as any;
        const incomingSnapshot = buildTimerSnapshot(payload);
        const currentSnapshot = store.timerSnapshot;

        if (!currentSnapshot) {
          store.updateTimerSnapshot(incomingSnapshot);
          break;
        }

        // If clockRunning state changed (e.g. first move), always accept
        if (currentSnapshot.clockRunning !== incomingSnapshot.clockRunning) {
          store.updateTimerSnapshot(incomingSnapshot);
          break;
        }

        // If turn changed (safety net — should already be handled by move_applied)
        if (currentSnapshot.turn !== incomingSnapshot.turn) {
          store.updateTimerSnapshot(incomingSnapshot);
          break;
        }

        // Drift check using server time offset
        if (currentSnapshot.clockRunning) {
          const serverNowEstimate = Date.now() + currentSnapshot.serverTimeOffsetMs;
          const elapsedSinceSnapshot = Math.max(0, serverNowEstimate - currentSnapshot.serverNow);
          const localActiveMs = currentSnapshot.turn === 'w'
            ? currentSnapshot.wMs - elapsedSinceSnapshot
            : currentSnapshot.bMs - elapsedSinceSnapshot;
          const serverActiveMs = incomingSnapshot.turn === 'w'
            ? incomingSnapshot.wMs
            : incomingSnapshot.bMs;
          const driftMs = Math.abs(localActiveMs - serverActiveMs);

          // Only correct if drifted more than 500ms
          if (driftMs > 500) {
            store.updateTimerSnapshot(incomingSnapshot);
          }
          // else: close enough — skip update to avoid visual jumps
        }
        break;
      }

      case "game_reconnected": {
        // Server sent full game state after reconnecting within grace period
        const payload = msg as any;
        console.log("[Chess WS]", clientId, "Game reconnected:", payload);

        const reconnColor: 'w' | 'b' = payload.color ?? null;
        const reconnFen: string = payload.fen ?? '';
        const reconnTurn: 'w' | 'b' = payload.turn ?? 'w';
        const reconnGameId: string = payload.gameId ?? '';
        const reconnDbGameId: string = payload.dbGameId ?? '';
        const reconnWager: number = payload.wager ?? 0;

        // Clear any stale premove from before the disconnect
        store.clearPremove();

        // Update or create game state
        if (store.gameState && store.gameState.gameId === reconnGameId) {
          store.updateFromServer(reconnFen, reconnTurn);
        } else if (reconnGameId && reconnColor && reconnFen) {
          const reconnDisplayName = useUserDataStore.getState().profile?.display_name || store.playerName;
          store.handleMatchFound({
            gameId: reconnGameId,
            dbGameId: reconnDbGameId || undefined,
            color: reconnColor,
            fen: reconnFen,
            playerName: reconnDisplayName,
            opponentName: store.gameState?.opponentName || "Opponent",
            wager: reconnWager,
          });
        }

        // Update timer snapshot
        const reconnSnapshot = buildTimerSnapshot(payload, reconnTurn);
        store.updateTimerSnapshot(reconnSnapshot);
        break;
      }

      default:
        console.log("[Chess WS]", clientId, "Unknown message type:", msg.type, msg);
    }
  });
}

export function useChessWebSocket(): UseChessWebSocketReturn {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  
  // Local state only for connection-related things
  const [status, setStatus] = useState<WSConnectionStatus>(wsClient.getStatus());
  const [logs, setLogs] = useState<WSLogEntry[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Refs for throttling
  const lastBalanceRefresh = useRef(0);
  const balanceRefreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Read global state from store
  const { 
    phase, 
    gameState, 
    playerName,
    setPhase,
    setPlayerName,
    // Removed setPlayerCredits - balance managed by balanceStore
    setAuthenticated,
    resetAll 
  } = useChessStore();
  
  // fetchBalance no longer used here — refreshBalance delegates to userDataStore
  
  // Throttled balance refresh - max once per 5 seconds
  // Uses userDataStore.refresh() instead of making a separate auth + balance call
  const refreshBalance = useCallback(async () => {
    const now = Date.now();
    const MIN_INTERVAL = 5000;
    
    // Clear any pending refresh
    if (balanceRefreshTimeout.current) {
      clearTimeout(balanceRefreshTimeout.current);
      balanceRefreshTimeout.current = null;
    }
    
    // If recently refreshed, schedule for later
    if (now - lastBalanceRefresh.current < MIN_INTERVAL) {
      balanceRefreshTimeout.current = setTimeout(() => {
        refreshBalance();
      }, MIN_INTERVAL - (now - lastBalanceRefresh.current));
      return;
    }
    
    lastBalanceRefresh.current = now;
    
    try {
      // Use userDataStore refresh — it already knows the userId and is throttled internally.
      // This avoids a redundant supabase.auth.getUser() call + duplicate balance fetch.
      const userDataRefresh = useUserDataStore.getState().refresh;
      await userDataRefresh();
    } catch (error) {
      console.error("[Chess WS] Failed to refresh balance:", error);
    }
  }, []);
  
  // Set up navigation, balance refresh, and admin check callbacks for the global message handler
  useEffect(() => {
    navigationCallback = navigate;
    balanceRefreshCallback = refreshBalance;
    isAdminCallback = () => isAdmin;
    return () => {
      // Only clear if this is the one that set it
      if (navigationCallback === navigate) {
        navigationCallback = null;
      }
      if (balanceRefreshCallback === refreshBalance) {
        balanceRefreshCallback = null;
      }
      // Clear admin callback on unmount (it will be set by the next instance if needed)
      isAdminCallback = null;
    };
  }, [navigate, refreshBalance, isAdmin]);

  // Refresh auth token and set on wsClient
  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        console.log("[Chess WS] No session - user not authenticated");
        wsClient.setAuthToken(null);
        setIsAuthenticated(false);
        setAuthenticated(false);
        return false;
      }
      
      // Use access_token
      const token = data.session.access_token;
      wsClient.setAuthToken(token);
      setIsAuthenticated(true);
      setAuthenticated(true);
      console.log("[Chess WS] Auth token refreshed");
      return true;
    } catch (error) {
      console.error("[Chess WS] Failed to refresh auth:", error);
      wsClient.setAuthToken(null);
      setIsAuthenticated(false);
      setAuthenticated(false);
      return false;
    }
  }, [setAuthenticated]);

  // Initialize global message handler and subscribe to wsClient events
  useEffect(() => {
    // Initialize the global message handler (only once globally)
    initializeGlobalMessageHandler();
    
    // Subscribe to status changes
    const unsubStatus = wsClient.onStatus((newStatus) => {
      setStatus(newStatus);
      
      if (newStatus === "reconnecting") {
        setReconnectAttempts(prev => prev + 1);
      } else if (newStatus === "connected") {
        setReconnectAttempts(0);
      }
    });
    
    // Subscribe to logs (limit updates for performance)
    const unsubLog = wsClient.onLog((entry) => {
      setLogs(prev => {
        const next = [entry, ...prev];
        return next.slice(0, 30); // Reduced from 40 to 30
      });
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Chess WS] Auth state changed:", event);
      
      if (session?.access_token) {
        // Update token on wsClient
        wsClient.setAuthToken(session.access_token);
        setIsAuthenticated(true);
        setAuthenticated(true);
        
        // Reconnect if disconnected - with new token
        if (wsClient.getStatus() === "disconnected") {
          wsClient.connect();
        } else if (wsClient.getStatus() === "connected") {
          // CRITICAL: Do NOT reconnect if we're in a game - that would end the game!
          const currentPhase = useChessStore.getState().phase;
          if (currentPhase === "in_game" || currentPhase === "searching") {
            console.log("[Chess WS] Token updated but in game/searching - NOT reconnecting");
          } else {
            // Only reconnect if idle/game_over
            console.log("[Chess WS] Token updated - reconnecting (phase:", currentPhase, ")");
            wsClient.disconnect();
            setTimeout(() => wsClient.connect(), 100);
          }
        }
        
        // Balance refresh handled by userDataStore (initialized in App.tsx on auth change)
      } else {
        console.log("[Chess WS] No session - clearing auth");
        wsClient.setAuthToken(null);
        setIsAuthenticated(false);
        setAuthenticated(false);
        wsClient.disconnect();
        resetAll();
      }
    });
    
    // Initial auth check and connect
    refreshAuth().then(hasAuth => {
      if (hasAuth) {
        wsClient.connect();
        // Balance initialization handled by userDataStore in App.tsx
      }
    });

    return () => {
      unsubStatus();
      unsubLog();
      subscription.unsubscribe();
      // DON'T disconnect on unmount - keep singleton alive
    };
  }, [refreshAuth, refreshBalance, setAuthenticated, resetAll]);

  // Memoized actions
  const connect = useCallback(async () => {
    const hasAuth = await refreshAuth();
    if (!hasAuth) {
      // Only show for admin users
      if (isAdminCallback && isAdminCallback()) {
        toast.error("Please sign in to play");
      }
      return;
    }
    wsClient.connect();
  }, [refreshAuth]);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
    resetAll();
    wsClient.setSearching(false);
    wsClient.setInGame(false);
  }, [resetAll]);

  const findMatch = useCallback((wager: number, name?: string) => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.access_token) {
        console.log("[Chess WS] findMatch blocked - no valid session");
        // Only show for admin users
        if (isAdminCallback && isAdminCallback()) {
          toast.error("Please sign in again");
        }
        wsClient.setAuthToken(null);
        setIsAuthenticated(false);
        setAuthenticated(false);
        return;
      }
      
      wsClient.setAuthToken(session.access_token);
      
      if (!isAuthenticated) {
        // Only show for admin users
        if (isAdminCallback && isAdminCallback()) {
          toast.error("Please sign in to play");
        }
        return;
      }

      const userId = session.user?.id;

      if (!userId) {
        // Only show for admin users
        if (isAdminCallback && isAdminCallback()) {
          toast.error("Please sign in again");
        }
        return;
      }

      const player_ids = [userId];
      const finalName = name || playerName || "Player";
      setPlayerName(finalName);

      const payload = {
        type: "find_match" as const,
        wager,
        player_ids,
        playerName: finalName,
      };

      console.log("[Chess WS] findMatch:", { wager, player_ids });

      setPhase("searching");
      wsClient.setSearching(true, finalName, wager, player_ids);
      wsClient.send(payload);

      // Track search in DB for admin visibility
      try {
        await supabase
          .from('active_searches')
          .upsert({
            user_id: userId,
            display_name: finalName,
            wager,
            game_type: 'chess',
            created_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      } catch (err) {
        console.warn("[Chess WS] Failed to track search in DB:", err);
      }
    })().catch((error) => {
      console.error("[Chess WS] findMatch failed:", error);
      // Only show for admin users
      if (isAdminCallback && isAdminCallback()) {
        toast.error("Please sign in again");
      }
    });
  }, [isAuthenticated, playerName, setPlayerName, setPhase, setAuthenticated]);

  const cancelSearch = useCallback(() => {
    const payload = { type: "cancel_search" };
    wsClient.send(payload);
    wsClient.setSearching(false);
    setPhase("idle");
    useChessStore.getState().resetMatchmaking();
    useUILoadingStore.getState().hideLoading();

    // Remove search tracking from DB
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await supabase
            .from('active_searches')
            .delete()
            .eq('user_id', session.user.id);
        }
      } catch (err) {
        console.warn("[Chess WS] Failed to remove search tracking:", err);
      }
    })();
  }, [setPhase]);

  const joinGame = useCallback((gameId: string) => {
    console.log("[Chess WS] Sending join_game for private game:", gameId);
    setPhase("searching"); // Show waiting state
    wsClient.send({ type: "join_game", gameId });
  }, [setPhase]);

  const sendMove = useCallback((from: string, to: string, promotion?: string) => {
    const currentGameState = useChessStore.getState().gameState;
    
    if (!currentGameState) {
      console.warn("[Chess WS] Cannot send move - no game state");
      return;
    }

    // Build UCI string: "e2e4" or "e7e8q" for promotion
    const uci = `${from.toLowerCase()}${to.toLowerCase()}${promotion ? promotion.toLowerCase() : ""}`;

    const payload = {
      type: "move" as const,
      move: uci,
    };

    console.log("[WS] sending move", { type: "move", move: uci });
    wsClient.send(payload);
  }, []);

  const resignGame = useCallback(() => {
    const currentState = useChessStore.getState();
    const currentGameState = currentState.gameState;
    const wsStatus = wsClient.getStatus();
    
    console.log("[resign] clicked", {
      gameId: currentGameState?.gameId || 'unknown',
      dbGameId: currentGameState?.dbGameId || 'unknown',
      userId: currentState.playerName || 'unknown',
      phase: currentState.phase,
      wsStatus,
      hasGameState: !!currentGameState,
      timestamp: new Date().toISOString(),
    });
    
    // Clear any queued premove on resign
    useChessStore.getState().clearPremove();
    
    // Idempotent: if game already ended, do nothing
    if (currentState.phase === "game_over") {
      console.log("[resign] Game already ended, resign is no-op");
      return;
    }
    
    if (!currentGameState) {
      console.warn("[resign] Cannot resign - no game state");
      if (isAdminCallback && isAdminCallback()) {
        toast.error("Cannot resign - no active game");
      }
      return;
    }
    
    // ── IMMEDIATELY show loading overlay BEFORE any WS call ──
    // This prevents any intermediate UI/route from rendering.
    useUILoadingStore.getState().showLoading();
    console.log("[resign] overlay shown (spinner)");
    
    // Check if WS is connected
    if (wsStatus !== "connected") {
      console.warn("[resign] WebSocket not connected, status:", wsStatus);
      useUILoadingStore.getState().hideLoading();
      if (isAdminCallback && isAdminCallback()) {
        toast.error("Not connected to server. Please reconnect.");
      }
      return;
    }

    const payload = {
      type: "resign",
      gameId: currentGameState.gameId,
      dbGameId: currentGameState.dbGameId,
    };

    console.log("[resign] ws sent", payload);
    try {
      wsClient.send(payload);
    } catch (error) {
      console.error("[resign] Error sending resign:", error);
      useUILoadingStore.getState().hideLoading();
      if (isAdminCallback && isAdminCallback()) {
        toast.error("Failed to send resign request");
      }
      return;
    }
    
    // ── Fallback timeout: if no game_ended arrives within 7s, bail out ──
    const resignTimeoutId = setTimeout(() => {
      const storeState = useChessStore.getState();
      // If still in_game (no game_ended arrived), clear overlay and show error
      if (storeState.phase === "in_game") {
        console.warn("[resign] timeout fallback fired — no game_end received within 7s");
        useUILoadingStore.getState().hideLoading();
        toast.error("Resign request timed out. Please try again.");
      }
    }, 7000);
    
    // Store the timeout ID so game_ended can clear it
    (window as any).__resignTimeoutId = resignTimeoutId;
  }, []);

  const syncGame = useCallback(() => {
    const currentGameState = useChessStore.getState().gameState;
    
    if (!currentGameState) {
      console.warn("[Chess WS] Cannot sync - no game state");
      return;
    }

    const payload = {
      type: "sync_game",
      gameId: currentGameState.gameId,
    };

    console.log("[Chess WS] Requesting game sync:", payload);
    wsClient.send(payload);
  }, []);

  const clearGameEnd = useCallback(() => {
    useChessStore.getState().clearGameEnd();
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const sendRaw = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      wsClient.send(parsed);
    } catch (e) {
      console.error("[Chess WS] Invalid JSON:", e);
      // Only show for admin users
      if (isAdminCallback && isAdminCallback()) {
        toast.error("Invalid JSON");
      }
    }
  }, []);

  // Memoize return object to prevent unnecessary rerenders
  return useMemo(() => ({
    status,
    connect,
    disconnect,
    isAuthenticated,
    refreshAuth,
    findMatch,
    cancelSearch,
    joinGame,
    sendMove,
    resignGame,
    syncGame,
    clearGameEnd,
    refreshBalance,
    logs,
    clearLogs,
    sendRaw,
    reconnectAttempts,
  }), [
    status,
    connect,
    disconnect,
    isAuthenticated,
    refreshAuth,
    findMatch,
    cancelSearch,
    joinGame,
    sendMove,
    resignGame,
    syncGame,
    clearGameEnd,
    refreshBalance,
    logs,
    clearLogs,
    sendRaw,
    reconnectAttempts,
  ]);
}
