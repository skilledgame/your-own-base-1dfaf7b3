/**
 * ChessPlay - Unified two-panel chess game page
 *
 * Left panel: wager selection (WagerPanel)
 * Right panel: game area with state overlays (idle / searching / playing)
 *
 * Route: /chess/play/:gameId?
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChessBoard } from '@/components/ChessBoard';
import { GameTimer } from '@/components/GameTimer';
import { CapturedPieces } from '@/components/CapturedPieces';
import { WagerPanel } from '@/components/chess/WagerPanel';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LogOut, Crown, Shield, Search, Flame, UserPlus, Eye, Volume2, Settings, Maximize, HelpCircle, Users, Loader2 } from 'lucide-react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useProfile } from '@/hooks/useProfile';
import { UserBadges } from '@/components/UserBadge';
import { Chess } from 'chess.js';
import { CHESS_TIME_CONTROL } from '@/lib/chessConstants';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';
import { useChessSound } from '@/hooks/useChessSound';
import { type RankInfo, getRankFromTotalWagered } from '@/lib/rankSystem';
import { RankBadge } from '@/components/RankBadge';
import { useChessStore } from '@/stores/chessStore';
import { wsClient } from '@/lib/wsClient';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { LogoLink } from '@/components/LogoLink';
import { UserDropdown } from '@/components/UserDropdown';
import { FriendsButton } from '@/components/FriendsButton';
import { BalanceDepositPill } from '@/components/BalanceDepositPill';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { SkilledCoinsDisplay } from '@/components/SkilledCoinsDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletModal } from '@/contexts/WalletModalContext';
import { getEloTitle } from '@/lib/eloSystem';
import { useFriendStore } from '@/stores/friendStore';
import { useChessWebSocket } from '@/hooks/useChessWebSocket';
import { useBalance } from '@/hooks/useBalance';
import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { GameResultModal } from '@/components/GameResultModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Idle board overlay (shown when no game is active)
// ---------------------------------------------------------------------------
function IdleBoardOverlay() {
  return (
    <div className="relative w-full">
      <div className="opacity-30 pointer-events-none">
        <ChessBoard
          game={new Chess()}
          onMove={() => false}
          isPlayerTurn={false}
          lastMove={null}
          isCheck={false}
          flipped={false}
          isGameOver={false}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-2 bg-black/60 backdrop-blur-sm rounded-xl px-6 py-4">
          <p className="text-white/70 text-sm font-medium">Select a tier and find a match</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Searching overlay (shown over the board area while matchmaking)
// ---------------------------------------------------------------------------
function SearchingOverlay() {
  const { queueEstimate } = useChessStore();

  return (
    <div className="relative w-full">
      <div className="opacity-20 pointer-events-none">
        <ChessBoard
          game={new Chess()}
          onMove={() => false}
          isPlayerTurn={false}
          lastMove={null}
          isCheck={false}
          flipped={false}
          isGameOver={false}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-cyan-400/40 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Users className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Finding Opponent</h2>
            {queueEstimate ? (
              <div className="space-y-1">
                <p className="text-white/50 text-xs">
                  Est. wait: {queueEstimate.estimatedLabel}
                </p>
                <p className="text-white/40 text-[10px]">
                  {queueEstimate.onlinePlayers} online &middot; {queueEstimate.inGamePlayers} in game
                </p>
              </div>
            ) : (
              <p className="text-white/50 text-xs">Searching for a player...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active game panel (board + player info + timers)
// ---------------------------------------------------------------------------
function ActiveGamePanel({
  gameState,
  playerRank,
  opponentRank,
  playerBadges,
  opponentBadges,
  playerElo,
  opponentElo,
  playerStreak,
  opponentStreak,
  opponentSkinColor,
  opponentSkinIcon,
  onSendMove,
  onExit,
  onBack,
  onTimeLoss,
}: {
  gameState: NonNullable<ReturnType<typeof useChessStore.getState>['gameState']>;
  playerRank?: RankInfo;
  opponentRank?: RankInfo;
  playerBadges: string[];
  opponentBadges: string[];
  playerElo: number;
  opponentElo: number;
  playerStreak: number;
  opponentStreak: number;
  opponentSkinColor?: string | null;
  opponentSkinIcon?: string | null;
  onSendMove: (from: string, to: string, promotion?: string) => void;
  onExit: () => void;
  onBack: () => void;
  onTimeLoss?: (loserColor: 'w' | 'b') => void;
}) {
  const { skinColor, skinIcon } = useProfile();
  const timerSnapshot = useChessStore((s) => s.timerSnapshot);
  const spectatorCount = useChessStore((s) => s.spectatorCount);
  const { playMove, playCapture, playCheck, playGameEnd } = useChessSound();

  const playerColor = gameState.color === 'w' ? 'white' as const : 'black' as const;
  const isWhite = playerColor === 'white';
  const myColor = isWhite ? 'w' : 'b';
  const playerName = gameState.playerName;
  const opponentName = gameState.opponentName;
  const currentFen = gameState.fen;
  const isMyTurn = gameState.isMyTurn;

  const [chess] = useState(() => new Chess(currentFen));
  const [localFen, setLocalFen] = useState(currentFen);
  const [opponentLastMove, setOpponentLastMove] = useState<{ from: string; to: string } | null>(null);
  const [showResignDialog, setShowResignDialog] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const lastMoveByRef = useRef<'w' | 'b' | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Display clock
  const clockRef = useRef(timerSnapshot);
  useEffect(() => { clockRef.current = timerSnapshot; }, [timerSnapshot]);
  const [displayWhiteSec, setDisplayWhiteSec] = useState(CHESS_TIME_CONTROL.BASE_TIME);
  const [displayBlackSec, setDisplayBlackSec] = useState(CHESS_TIME_CONTROL.BASE_TIME);

  useEffect(() => {
    if (isGameOver) return;
    const tick = () => {
      const snap = clockRef.current;
      if (!snap) {
        setDisplayWhiteSec(CHESS_TIME_CONTROL.BASE_TIME);
        setDisplayBlackSec(CHESS_TIME_CONTROL.BASE_TIME);
        return;
      }
      let wMs = snap.wMs;
      let bMs = snap.bMs;
      if (snap.clockRunning) {
        const serverNowEstimate = Date.now() + snap.serverTimeOffsetMs;
        const elapsed = Math.max(0, serverNowEstimate - snap.serverNow);
        if (snap.turn === 'w') wMs = Math.max(0, wMs - elapsed);
        else bMs = Math.max(0, bMs - elapsed);
      }
      const wSec = Math.ceil(wMs / 1000);
      const bSec = Math.ceil(bMs / 1000);
      setDisplayWhiteSec(prev => prev !== wSec ? wSec : prev);
      setDisplayBlackSec(prev => prev !== bSec ? bSec : prev);
      if (snap.clockRunning) {
        if (snap.turn === 'w' && wMs <= 0 && !isGameOver) {
          setIsGameOver(true);
          playGameEnd();
          onTimeLoss?.('w');
        } else if (snap.turn === 'b' && bMs <= 0 && !isGameOver) {
          setIsGameOver(true);
          playGameEnd();
          onTimeLoss?.('b');
        }
      }
    };
    tick();
    timerIntervalRef.current = setInterval(tick, 200);
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [isGameOver, playGameEnd, onTimeLoss]);

  // Clock sync on visibility change
  useEffect(() => {
    if (isGameOver) return;
    const requestSync = () => {
      const gId = useChessStore.getState().gameState?.gameId;
      if (gId && wsClient.getStatus() === 'connected') {
        wsClient.send({ type: 'clock_sync_request', gameId: gId });
      }
    };
    const handleVis = () => { if (document.visibilityState === 'visible') requestSync(); };
    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('focus', requestSync);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('focus', requestSync);
    };
  }, [isGameOver]);

  const whiteTime = displayWhiteSec;
  const blackTime = displayBlackSec;
  const myTime = isWhite ? whiteTime : blackTime;
  const opponentTime = isWhite ? blackTime : whiteTime;
  const isMyTurnForTimer = timerSnapshot ? (timerSnapshot.clockRunning && timerSnapshot.turn === myColor) : isMyTurn;
  const isOpponentTurnForTimer = timerSnapshot ? (timerSnapshot.clockRunning && timerSnapshot.turn !== myColor) : !isMyTurn;

  const capturedPieces = useMemo(() => calculateCapturedPieces(chess), [chess.fen()]);
  const materialAdvantage = useMemo(() => calculateMaterialAdvantage(chess), [chess.fen()]);
  const myCaptured = useMemo(() => isWhite ? capturedPieces.white : capturedPieces.black, [isWhite, capturedPieces]);
  const opponentCaptured = useMemo(() => isWhite ? capturedPieces.black : capturedPieces.white, [isWhite, capturedPieces]);
  const myMaterialAdvantage = useMemo(() => isWhite ? materialAdvantage.difference : -materialAdvantage.difference, [isWhite, materialAdvantage.difference]);
  const opponentMaterialAdvantage = useMemo(() => -myMaterialAdvantage, [myMaterialAdvantage]);

  // Sync with server FEN
  useEffect(() => {
    if (currentFen && currentFen !== localFen) {
      try {
        const previousFen = localFen;
        const prevChess = new Chess(previousFen);
        const prevTurn = prevChess.turn();
        chess.load(currentFen);
        setLocalFen(currentFen);
        const newTurn = chess.turn();
        if (prevTurn !== newTurn && newTurn === myColor) {
          const possibleMoves = prevChess.moves({ verbose: true });
          for (const move of possibleMoves) {
            const testChess = new Chess(previousFen);
            testChess.move(move);
            if (testChess.fen().split(' ')[0] === currentFen.split(' ')[0]) {
              setOpponentLastMove({ from: move.from, to: move.to });
              break;
            }
          }
          if (lastMoveByRef.current !== prevTurn) lastMoveByRef.current = prevTurn;
        }
      } catch { /* invalid FEN */ }
    }
  }, [currentFen, chess, localFen, myColor]);

  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (isGameOver) return false;
    const mt = myColor === 'w' ? whiteTime : blackTime;
    if (mt <= 0) return false;
    if (!isMyTurn) return false;
    const movingPiece = chess.get(from as any);
    let promoChar = promotion;
    if (movingPiece?.type === 'p') {
      const toRank = to[1];
      if ((movingPiece.color === 'w' && toRank === '8') || (movingPiece.color === 'b' && toRank === '1')) {
        promoChar = promoChar || 'q';
      }
    }
    try {
      const testChess = new Chess(localFen);
      const move = testChess.move({ from, to, promotion: promoChar });
      if (!move) return false;
      chess.move({ from, to, promotion: promoChar });
      setLocalFen(chess.fen());
      lastMoveByRef.current = myColor;
      onSendMove(from, to, promoChar);
      return true;
    } catch { return false; }
  }, [chess, isMyTurn, localFen, onSendMove, isGameOver, myColor, whiteTime, blackTime]);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Opponent row */}
      <div className="flex items-center justify-between w-full max-w-[480px]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary border-2 border-border rounded-xl">
            <PlayerAvatar skinColor={opponentSkinColor} skinIcon={opponentSkinIcon} size="sm" fallbackInitial={opponentName || 'O'} />
            <span className="font-semibold text-sm truncate max-w-[100px]">{opponentName || 'Opponent'}</span>
          </div>
          {(() => {
            const eloInfo = getEloTitle(opponentElo);
            return (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${eloInfo.bgClass} ${eloInfo.colorClass} ${eloInfo.borderClass}`}>
                {opponentElo}
              </span>
            );
          })()}
          <RankBadge rank={opponentRank} size="xs" />
          {opponentBadges.length > 0 && <UserBadges badges={opponentBadges} size="sm" />}
          {opponentStreak > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-400 bg-orange-500/15 border border-orange-500/25 px-1.5 py-0.5 rounded">
              <Flame className="w-3 h-3" />{opponentStreak}
            </span>
          )}
          <button
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:text-primary/80 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded transition-colors"
            title="Add Friend"
            onClick={async () => {
              try {
                const opponentUserId = useChessStore.getState().matchmaking.opponentUserId;
                if (opponentUserId) {
                  await useFriendStore.getState().sendRequest(opponentUserId);
                  toast.success('Friend request sent!');
                } else {
                  toast.error('Could not identify opponent');
                }
              } catch (error: any) {
                toast.error(error.message || 'Failed to send request');
              }
            }}
          >
            <UserPlus className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <GameTimer timeLeft={opponentTime} isActive={isOpponentTurnForTimer && !isGameOver} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => { isGameOver ? onBack() : setShowResignDialog(true); }}
            className={`h-9 w-9 shrink-0 ${isGameOver ? '' : 'text-destructive hover:text-destructive border-destructive/30'}`}
            title={isGameOver ? 'Leave' : 'Resign'}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Opponent captured */}
      <div className="w-full max-w-[480px]">
        <CapturedPieces pieces={opponentCaptured} color={isWhite ? 'black' : 'white'} materialAdvantage={opponentMaterialAdvantage > 0 ? opponentMaterialAdvantage : undefined} />
      </div>

      {/* Board */}
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

      {/* Player captured */}
      <div className="w-full max-w-[480px]">
        <CapturedPieces pieces={myCaptured} color={isWhite ? 'white' : 'black'} materialAdvantage={myMaterialAdvantage > 0 ? myMaterialAdvantage : undefined} />
      </div>

      {/* Player row */}
      <div className="flex items-center justify-between w-full max-w-[480px]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-2 border-primary/20 rounded-xl">
            <PlayerAvatar skinColor={skinColor} skinIcon={skinIcon} size="sm" />
            <span className="font-semibold text-sm truncate max-w-[100px]">{playerName}</span>
          </div>
          {(() => {
            const eloInfo = getEloTitle(playerElo);
            return (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${eloInfo.bgClass} ${eloInfo.colorClass} ${eloInfo.borderClass}`}>
                {playerElo}
              </span>
            );
          })()}
          <RankBadge rank={playerRank} size="xs" />
          {playerBadges.length > 0 && <UserBadges badges={playerBadges} size="sm" />}
          {playerStreak > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-400 bg-orange-500/15 border border-orange-500/25 px-1.5 py-0.5 rounded">
              <Flame className="w-3 h-3" />{playerStreak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <GameTimer timeLeft={myTime} isActive={isMyTurnForTimer && !isGameOver} />
          {spectatorCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/60 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
              <Eye className="w-3.5 h-3.5" />{spectatorCount}
            </span>
          )}
        </div>
      </div>

      {/* Resign dialog */}
      <AlertDialog open={showResignDialog} onOpenChange={setShowResignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{timerSnapshot?.clockRunning ? 'Resign Game?' : 'Leave Game?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {timerSnapshot?.clockRunning
                ? <>Are you sure you want to resign? This will count as a loss and your opponent will win{gameState.wager > 0 && ` the ${gameState.wager} SC wager`}.</>
                : 'No moves have been made yet. You can leave without losing any credits.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowResignDialog(false); onExit(); }}
              className={timerSnapshot?.clockRunning ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {timerSnapshot?.clockRunning ? 'Yes, Resign' : 'Leave Game'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===========================================================================
// Main ChessPlay page
// ===========================================================================
export default function ChessPlay() {
  const { gameId: urlGameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isPrivileged, user } = useAuth();
  const { openWallet } = useWalletModal();
  const { balance } = useBalance();
  const { totalWageredSc, displayName: playerDisplayName, chessElo, dailyPlayStreak } = useProfile();

  const {
    status,
    sendMove,
    resignGame,
    syncGame,
    clearGameEnd,
    refreshBalance,
    connect,
  } = useChessWebSocket();

  const { phase, gameState, gameEndResult, matchmaking } = useChessStore();
  const { hideLoading } = useUILoadingStore();

  // Layout state
  const [sideMenuOpen, setSideMenuOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  // Opponent info
  const [playerRank, setPlayerRank] = useState<RankInfo | undefined>(undefined);
  const [opponentRank, setOpponentRank] = useState<RankInfo | undefined>(
    () => useUILoadingStore.getState().versusData?.opponentRank
  );
  const [playerBadges, setPlayerBadges] = useState<string[]>([]);
  const [opponentBadges, setOpponentBadges] = useState<string[]>([]);
  const [opponentElo, setOpponentElo] = useState(800);
  const [opponentStreak, setOpponentStreak] = useState(0);
  const [opponentSkinColor, setOpponentSkinColor] = useState<string | null>(null);
  const [opponentSkinIcon, setOpponentSkinIcon] = useState<string | null>(null);

  const effectivePlayerRank = useMemo(() => {
    if (playerRank) return playerRank;
    if (totalWageredSc !== undefined && totalWageredSc !== null) return getRankFromTotalWagered(totalWageredSc);
    return undefined;
  }, [playerRank, totalWageredSc]);

  // Update URL when a match is found (no full navigation)
  useEffect(() => {
    if (phase === 'in_game' && gameState?.gameId) {
      const target = `/chess/play/${gameState.gameId}`;
      if (window.location.pathname !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [phase, gameState?.gameId, navigate]);

  // Hide global loading overlay once game is ready
  const gameReadyRef = useRef(false);
  useEffect(() => {
    if (gameState && phase === 'in_game' && !gameReadyRef.current) {
      gameReadyRef.current = true;
      const uiState = useUILoadingStore.getState();
      if (uiState.mode !== 'versus') hideLoading();
    }
    if (!gameState || phase !== 'in_game') gameReadyRef.current = false;
  }, [gameState, phase, hideLoading]);

  // Presence tracking
  useEffect(() => {
    if (phase === 'in_game') {
      usePresenceStore.getState().setStatus('in_game', {
        gameStartedAt: Date.now(),
        dbGameId: gameState?.dbGameId || undefined,
      });
    } else {
      usePresenceStore.getState().setStatus('online');
    }
    return () => { usePresenceStore.getState().setStatus('online'); };
  }, [phase, gameState?.dbGameId]);

  // Sync game on visibility/focus
  useEffect(() => {
    if (!gameState || phase !== 'in_game') return;
    const handleVis = () => { if (document.visibilityState === 'visible') syncGame(); };
    const handleFocus = () => syncGame();
    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('focus', handleFocus);
    if (status === 'connected') syncGame();
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('focus', handleFocus);
    };
  }, [gameState, phase, status, syncGame]);

  // Fetch opponent info when match found
  const opponentFetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameState?.gameId) return;
    const gameKey = gameState.gameId;
    if (opponentFetchedRef.current === gameKey) return;

    const fetchOpponentInfo = async () => {
      try {
        const opponentUserId = matchmaking.opponentUserId || null;
        let resolvedAuthUserId: string | null = null;

        if (opponentUserId) {
          const { data } = await supabase.from('profiles').select('display_name, total_wagered_sc, chess_elo, daily_play_streak, skin_color, skin_icon').eq('user_id', opponentUserId).maybeSingle();
          if (data) {
            resolvedAuthUserId = opponentUserId;
            opponentFetchedRef.current = gameKey;
            setOpponentRank(getRankFromTotalWagered(data.total_wagered_sc ?? 0));
            if (data.chess_elo) setOpponentElo(data.chess_elo);
            if (data.daily_play_streak) setOpponentStreak(data.daily_play_streak);
            setOpponentSkinColor(data.skin_color ?? null);
            setOpponentSkinIcon(data.skin_icon ?? null);
            if (data.display_name && gameState) {
              useChessStore.getState().setGameState({ ...useChessStore.getState().gameState!, opponentName: data.display_name });
            }
          }
        }

        if (!resolvedAuthUserId && gameState.dbGameId) {
          const { data: rpcData } = await supabase.rpc('get_opponent_profile', { p_game_id: gameState.dbGameId });
          if (rpcData?.[0]) {
            const row = rpcData[0];
            resolvedAuthUserId = row.opponent_user_id;
            opponentFetchedRef.current = gameKey;
            setOpponentRank(getRankFromTotalWagered(row.total_wagered_sc ?? 0));
          }
        }

        if (resolvedAuthUserId) {
          const { data: badgeData } = await supabase.from('user_badges').select('badge').eq('user_id', resolvedAuthUserId);
          if (badgeData?.length) setOpponentBadges(badgeData.map(b => b.badge));
        }

        if (!resolvedAuthUserId) {
          if (opponentUserId || gameState.dbGameId) {
            opponentFetchedRef.current = gameKey;
            setOpponentRank(getRankFromTotalWagered(0));
          }
        }
      } catch {
        setOpponentRank(getRankFromTotalWagered(0));
      }
    };
    fetchOpponentInfo();
  }, [gameState?.gameId, gameState?.dbGameId, matchmaking.opponentUserId]);

  // Player rank + badges
  useEffect(() => {
    if (totalWageredSc !== undefined) setPlayerRank(getRankFromTotalWagered(totalWageredSc));
  }, [totalWageredSc]);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_badges').select('badge').eq('user_id', user.id).then(({ data }) => {
      if (data?.length) setPlayerBadges(data.map(b => b.badge));
    });
  }, [user?.id]);

  // Handlers
  const handleSendMove = useCallback((from: string, to: string, promotion?: string) => {
    sendMove(from, to, promotion);
  }, [sendMove]);

  const handleExit = useCallback(() => {
    const timerSnapshot = useChessStore.getState().timerSnapshot;
    if (timerSnapshot?.clockRunning) resignGame();
    else {
      useChessStore.getState().setPhase('idle');
      useChessStore.getState().resetMatchmaking();
      navigate('/chess/play', { replace: true });
    }
  }, [resignGame, navigate]);

  const handleBack = useCallback(() => navigate('/chess'), [navigate]);
  const handleTimeLoss = useCallback((loserColor: 'w' | 'b') => {
    wsClient.send({ type: 'time_loss', gameId: gameState?.gameId, loserColor });
  }, [gameState?.gameId]);

  const handlePlayAgain = useCallback(() => {
    clearGameEnd();
    useChessStore.getState().setPhase('idle');
    useChessStore.getState().resetMatchmaking();
    navigate('/chess/play', { replace: true });
  }, [clearGameEnd, navigate]);

  const handleGoHome = useCallback(() => {
    clearGameEnd();
    navigate('/chess');
  }, [clearGameEnd, navigate]);

  // Game result modal
  if (phase === 'game_over' && gameEndResult) {
    const tokensChange = gameEndResult.creditsChange ?? 0;
    const isWin = gameEndResult.isWin ?? false;
    const reason = gameEndResult.message || gameEndResult.reason || 'Game ended';
    return (
      <GameResultModal
        isWin={isWin}
        coinsChange={tokensChange}
        newBalance={balance}
        reason={reason}
        onPlayAgain={handlePlayAgain}
        onGoHome={handleGoHome}
      />
    );
  }

  // Determine right panel content
  const isPlaying = phase === 'in_game' && gameState;
  const isSearching = phase === 'searching';

  return (
    <div className="min-h-screen bg-black overflow-x-hidden pb-16 md:pb-0">
      {/* Desktop Side Menu */}
      <DesktopSideMenu
        isOpen={sideMenuOpen}
        onToggle={() => setSideMenuOpen(!sideMenuOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        variant="dark"
      />

      {sideMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSideMenuOpen(false)} />
      )}

      {/* Main content wrapper */}
      <div className={`transition-all duration-300 ease-out ${sideMenuOpen ? (sidebarCollapsed ? 'md:ml-16' : 'md:ml-72') : 'md:ml-0'}`}>
        {/* Header */}
        <header className={`fixed top-0 z-40 bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/5 transition-all duration-300 ease-out ${sideMenuOpen ? (sidebarCollapsed ? 'md:left-16 left-0 right-0' : 'md:left-72 left-0 right-0') : 'left-0 right-0'}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center">
              <LogoLink className="h-12 sm:h-14" />
            </div>
            {isAuthenticated && (
              <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2">
                <BalanceDepositPill isPrivileged={isPrivileged} />
              </div>
            )}
            <div className="flex items-center gap-2 sm:gap-3">
              {isAuthenticated ? (
                <>
                  {isPrivileged && (
                    <Button variant="ghost" size="sm" asChild className="hidden sm:flex text-purple-400 hover:text-purple-300 hover:bg-purple-500/10">
                      <Link to="/admin"><Shield className="w-4 h-4 mr-1" />Admin</Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" asChild className="hidden sm:flex text-muted-foreground hover:text-foreground">
                    <Link to="/search"><Search className="w-5 h-5" /></Link>
                  </Button>
                  <div className="hidden sm:flex"><NotificationDropdown /></div>
                  <div className="hidden sm:flex items-center"><UserDropdown /></div>
                  <div className="hidden sm:flex"><FriendsButton /></div>
                  <div className="sm:hidden">
                    <button onClick={() => openWallet('deposit')}>
                      <SkilledCoinsDisplay size="sm" isPrivileged={isPrivileged} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/search"><Search className="w-5 h-5" /></Link>
                  </Button>
                  <Button variant="ghost" asChild className="hidden sm:flex text-muted-foreground hover:text-foreground">
                    <Link to="/auth">Sign In</Link>
                  </Button>
                  <Button asChild className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0 font-semibold">
                    <Link to="/auth">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Game layout */}
        <div className="pt-16 sm:pt-[60px]">
          <div className="w-full min-h-[calc(100vh-64px)] px-3 sm:px-5 md:px-6 py-5 sm:py-8 md:py-10">
            <div className="w-full max-w-[1400px] mx-auto">
              <div
                className="w-full bg-[#0a0f1a] rounded-2xl border border-white/[0.07] p-3 sm:p-5 md:p-6"
                style={{ boxShadow: '0 0 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}
              >
                <div className="w-full bg-black rounded-xl p-4 sm:p-6 md:p-8">
                  {/* Two-panel layout */}
                  <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                    {/* Left panel: Wager selection */}
                    <div className="w-full md:w-[280px] lg:w-[320px] shrink-0">
                      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                        <WagerPanel />
                      </div>
                    </div>

                    {/* Right panel: Game area */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex-1 flex flex-col items-center justify-center">
                        {isPlaying ? (
                          <ActiveGamePanel
                            gameState={gameState}
                            playerRank={effectivePlayerRank}
                            opponentRank={opponentRank}
                            playerBadges={playerBadges}
                            opponentBadges={opponentBadges}
                            playerElo={chessElo ?? 800}
                            opponentElo={opponentElo}
                            playerStreak={dailyPlayStreak ?? 0}
                            opponentStreak={opponentStreak}
                            opponentSkinColor={opponentSkinColor}
                            opponentSkinIcon={opponentSkinIcon}
                            onSendMove={handleSendMove}
                            onExit={handleExit}
                            onBack={handleBack}
                            onTimeLoss={handleTimeLoss}
                          />
                        ) : isSearching ? (
                          <SearchingOverlay />
                        ) : (
                          <IdleBoardOverlay />
                        )}
                      </div>

                      {/* Footer */}
                      <div className="w-full mt-4 pt-4">
                        <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 px-2">
                          <div className="w-24" />
                          <LogoLink className="h-6 sm:h-7 opacity-40" />
                          <div className="flex items-center gap-3 w-24 justify-end">
                            <button className="text-white/30 hover:text-white/60 transition-colors" title="Sound"><Volume2 className="w-4 h-4" /></button>
                            <button className="text-white/30 hover:text-white/60 transition-colors" title="Fullscreen"><Maximize className="w-4 h-4" /></button>
                            <button className="text-white/30 hover:text-white/60 transition-colors" title="Settings"><Settings className="w-4 h-4" /></button>
                            <button className="text-white/30 hover:text-white/60 transition-colors" title="Help"><HelpCircle className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
