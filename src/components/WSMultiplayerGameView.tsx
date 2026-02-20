/**
 * WebSocket-based Multiplayer Game View
 * 
 * Uses the chess WebSocket for move sending and state synchronization.
 * Server is authoritative for all game state.
 * Displays wager, balance, captured pieces, and material advantage.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChessBoard } from './ChessBoard';
import { GameTimer } from './GameTimer';
import { CapturedPieces } from './CapturedPieces';
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
import { LogOut, Crown, Shield, Search, Flame, UserPlus, Eye } from 'lucide-react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useProfile } from '@/hooks/useProfile';
import { UserBadges } from '@/components/UserBadge';
import { Chess } from 'chess.js';
import { CHESS_TIME_CONTROL } from '@/lib/chessConstants';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';
import { useChessSound } from '@/hooks/useChessSound';
import { type RankInfo } from '@/lib/rankSystem';
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
import { toast } from 'sonner';

interface WSMultiplayerGameViewProps {
  gameId: string;
  dbGameId?: string;
  playerColor: "white" | "black";
  playerName: string;
  playerSkilledCoins: number;
  opponentName: string;
  initialFen: string;
  wager: number;
  
  // From useChessWebSocket or usePrivateGame
  currentFen: string;
  isMyTurn: boolean;
  whiteTime?: number; // For private games
  blackTime?: number; // For private games
  isPrivateGame?: boolean; // Indicates if this is a private game using Realtime
  
  // Rank info
  playerRank?: RankInfo;
  opponentRank?: RankInfo;
  
  // Badges
  playerBadges?: string[];
  opponentBadges?: string[];
  
  // ELO + Streak
  playerElo?: number;
  opponentElo?: number;
  playerStreak?: number;
  opponentStreak?: number;
  
  // Opponent skin
  opponentSkinColor?: string | null;
  opponentSkinIcon?: string | null;
  
  // Actions
  onSendMove: (from: string, to: string, promotion?: string) => void;
  onExit: () => void;
  onBack: () => void;
  onTimeLoss?: (loserColor: 'w' | 'b') => void;
}

export const WSMultiplayerGameView = ({
  gameId,
  dbGameId,
  playerColor,
  playerName,
  playerSkilledCoins,
  opponentName,
  initialFen,
  wager,
  currentFen,
  isMyTurn,
  whiteTime: propWhiteTime,
  blackTime: propBlackTime,
  isPrivateGame = false,
  playerRank,
  opponentRank,
  playerBadges = [],
  opponentBadges = [],
  playerElo = 800,
  opponentElo = 800,
  playerStreak = 0,
  opponentStreak = 0,
  opponentSkinColor,
  opponentSkinIcon,
  onSendMove,
  onExit,
  onBack,
  onTimeLoss,
}: WSMultiplayerGameViewProps) => {
  // Layout state
  const [sideMenuOpen, setSideMenuOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });
  const { isAuthenticated, isPrivileged } = useAuth();
  const { openWallet } = useWalletModal();
  const { skinColor, skinIcon } = useProfile();

  // Local chess instance for move validation
  const [chess] = useState(() => new Chess(currentFen || initialFen));
  const [localFen, setLocalFen] = useState(currentFen || initialFen);
  // Track OPPONENT's last move only (not your own)
  const [opponentLastMove, setOpponentLastMove] = useState<{ from: string; to: string } | null>(null);
  // Resign confirmation dialog
  const [showResignDialog, setShowResignDialog] = useState(false);
  
  // Get timer snapshot from store (server-authoritative for WebSocket games)
  const timerSnapshot = useChessStore((state) => state.timerSnapshot);
  const spectatorCount = useChessStore((state) => state.spectatorCount);
  // Premove from store (used for execution logic in useChessWebSocket)
  // const premove = useChessStore((state) => state.premove);
  
  // Sound effects (must be declared before the display clock effect that uses playGameEnd)
  const { playMove, playCapture, playCheck, playGameEnd } = useChessSound();
  
  const isWhite = playerColor === "white";
  const myColor = isWhite ? 'w' : 'b';
  
  // Timers - use props for private games, calculate from snapshot for WebSocket games
  const [isGameOver, setIsGameOver] = useState(false);
  
  // Track whose turn it was when they moved (for increment)
  const lastMoveByRef = useRef<'w' | 'b' | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // --- Smooth display clock loop ---
  // Keep the authoritative server snapshot in a ref for the display loop.
  // The ref avoids re-creating the interval on every snapshot update.
  const clockRef = useRef(timerSnapshot);
  useEffect(() => { clockRef.current = timerSnapshot; }, [timerSnapshot]);
  
  // Display state (updated by the interval — only when the *seconds* value changes)
  const [displayWhiteSec, setDisplayWhiteSec] = useState(CHESS_TIME_CONTROL.BASE_TIME);
  const [displayBlackSec, setDisplayBlackSec] = useState(CHESS_TIME_CONTROL.BASE_TIME);
  
  // Display clock tick (runs every 200ms for responsive countdown + time-loss detection)
  // IMPORTANT: Elapsed is computed in SERVER time (Date.now() + serverTimeOffsetMs)
  // so the display stays correct even after alt-tab / background throttling.
  useEffect(() => {
    if (isPrivateGame || isGameOver) {
      // For private games, derive from props
      setDisplayWhiteSec(propWhiteTime ?? CHESS_TIME_CONTROL.BASE_TIME);
      setDisplayBlackSec(propBlackTime ?? CHESS_TIME_CONTROL.BASE_TIME);
      return;
    }
    
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
        // Compute elapsed in SERVER time since this snapshot was created
        // serverNowEstimate = Date.now() + serverTimeOffsetMs ≈ current server time
        const serverNowEstimate = Date.now() + snap.serverTimeOffsetMs;
        const elapsed = Math.max(0, serverNowEstimate - snap.serverNow);
        if (snap.turn === 'w') {
          wMs = Math.max(0, wMs - elapsed);
        } else {
          bMs = Math.max(0, bMs - elapsed);
        }
      }
      
      const wSec = Math.ceil(wMs / 1000);
      const bSec = Math.ceil(bMs / 1000);
      
      // Only set state when displayed seconds change (avoids unnecessary re-renders)
      setDisplayWhiteSec(prev => prev !== wSec ? wSec : prev);
      setDisplayBlackSec(prev => prev !== bSec ? bSec : prev);
      
      // Time-loss detection
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
    
    tick(); // Run immediately
    timerIntervalRef.current = setInterval(tick, 200);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isPrivateGame, isGameOver, propWhiteTime, propBlackTime, playGameEnd, onTimeLoss]);
  
  // Alt-tab / focus resync: request fresh clock snapshot from server
  // when the tab becomes visible or window regains focus.
  useEffect(() => {
    if (isPrivateGame || isGameOver) return;
    
    const requestSync = () => {
      const state = useChessStore.getState();
      const currentGameId = state.gameState?.gameId;
      if (currentGameId && wsClient.getStatus() === 'connected') {
        wsClient.send({ type: "clock_sync_request", gameId: currentGameId });
      }
    };
    
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestSync();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', requestSync);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', requestSync);
    };
  }, [isPrivateGame, isGameOver]);
  
  // Final displayed times (seconds)
  const whiteTime = displayWhiteSec;
  const blackTime = displayBlackSec;

  // Calculate captured pieces and material (memoized to prevent recalculation)
  const capturedPieces = useMemo(() => calculateCapturedPieces(chess), [chess.fen()]);
  const materialAdvantage = useMemo(() => calculateMaterialAdvantage(chess), [chess.fen()]);
  
  // My captured pieces (pieces I captured = opponent's missing pieces)
  const myCaptured = useMemo(() => 
    isWhite ? capturedPieces.white : capturedPieces.black,
    [isWhite, capturedPieces]
  );
  const opponentCaptured = useMemo(() => 
    isWhite ? capturedPieces.black : capturedPieces.white,
    [isWhite, capturedPieces]
  );
  
  // Material advantage from my perspective
  const myMaterialAdvantage = useMemo(() => 
    isWhite ? materialAdvantage.difference : -materialAdvantage.difference,
    [isWhite, materialAdvantage.difference]
  );
  const opponentMaterialAdvantage = useMemo(() => 
    -myMaterialAdvantage,
    [myMaterialAdvantage]
  );

  // Sync with server FEN (server is authoritative)
  useEffect(() => {
    if (currentFen && currentFen !== localFen) {
      try {
        const previousFen = localFen;
        
        // Try to detect what move the opponent made
        const prevChess = new Chess(previousFen);
        const prevTurn = prevChess.turn();
        
        chess.load(currentFen);
        setLocalFen(currentFen);
        
        const newTurn = chess.turn();
        
        // If turn changed AND it's now my turn, the opponent just moved
        // Try to figure out what move they made to highlight it
        if (prevTurn !== newTurn && newTurn === myColor) {
          // Opponent just moved - try to find their move
          const possibleMoves = prevChess.moves({ verbose: true });
          for (const move of possibleMoves) {
            const testChess = new Chess(previousFen);
            testChess.move(move);
            if (testChess.fen().split(' ')[0] === currentFen.split(' ')[0]) {
              // Found the opponent's move
              setOpponentLastMove({ from: move.from, to: move.to });
              break;
            }
          }
          
          // Track for increment (only apply once)
          // Note: Server handles increment, we just track for display
          if (lastMoveByRef.current !== prevTurn && !isPrivateGame) {
            lastMoveByRef.current = prevTurn;
            // Server will send updated timer snapshot in move_applied message
          }
        }
      } catch (e) {
        console.error("[Game] Invalid FEN from server:", currentFen);
      }
    }
  }, [currentFen, chess, localFen, myColor, isPrivateGame]);

  // (Timer display loop + time loss detection is handled by the display clock effect above)

  // Note: Premove execution is handled in useChessWebSocket when move_applied message is received
  // This ensures premove executes synchronously when the turn switches, not via React effects

  // Handle local move with sound and increment
  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    // Block moves if game is over
    if (isGameOver) {
      return false;
    }
    
    // Block moves if time is 0
    const myTime = myColor === 'w' ? whiteTime : blackTime;
    if (myTime <= 0) {
      return false;
    }
    
    if (!isMyTurn) {
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
        return false;
      }

      // Check if it's a capture before applying
      const isCapture = !!move.captured;
      
      // Optimistic update - show move immediately
      chess.move({ from, to, promotion: promoChar });
      setLocalFen(chess.fen());
      // Don't set opponent's last move for our own moves - we only highlight opponent's moves
      
      // Server handles increment - it will send updated timer snapshot in move_applied message
      lastMoveByRef.current = myColor;

      // Send to server
      onSendMove(from, to, promoChar);

      return true;
    } catch (e) {
      console.error("[Game] Move error:", e);
      return false;
    }
  }, [chess, isMyTurn, localFen, onSendMove, isGameOver, myColor, isPrivateGame]);

  const myTime = isWhite ? whiteTime : blackTime;
  const opponentTime = isWhite ? blackTime : whiteTime;
  const myColorLabel = isWhite ? "White" : "Black";
  const opponentColorLabel = isWhite ? "Black" : "White";
  // Active clock indicator: the running clock is ALWAYS the side whose turn it is.
  // BOTH are false when clockRunning=false (before first move), so neither clock appears active.
  const isMyTurnForTimer = !isPrivateGame && timerSnapshot
    ? (timerSnapshot.clockRunning && timerSnapshot.turn === myColor)
    : isMyTurn;
  const isOpponentTurnForTimer = !isPrivateGame && timerSnapshot
    ? (timerSnapshot.clockRunning && timerSnapshot.turn !== myColor)
    : !isMyTurn;

  // Rank display is handled by the RankBadge component

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

      {/* Overlay for mobile only */}
      {sideMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      {/* Main content wrapper */}
      <div 
        className={`
          transition-all duration-300 ease-out
          ${sideMenuOpen ? (sidebarCollapsed ? 'md:ml-16' : 'md:ml-72') : 'md:ml-0'}
        `}
      >
        {/* Header */}
        <header 
          className={`
            fixed top-0 z-40 bg-[#0a0f1a] border-b-[3px] border-black
            transition-all duration-300 ease-out
            ${sideMenuOpen ? (sidebarCollapsed ? 'md:left-16 left-0 right-0' : 'md:left-72 left-0 right-0') : 'left-0 right-0'}
          `}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
            {/* Left: Logo */}
            <div className="flex items-center">
              <LogoLink className="h-12 sm:h-14" />
            </div>

            {/* Center: Balance + Deposit (only when authenticated) */}
            {isAuthenticated && (
              <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2">
                <BalanceDepositPill isPrivileged={isPrivileged} />
              </div>
            )}

            {/* Right: Auth/User controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isAuthenticated ? (
                <>
                  {isPrivileged && (
                    <Button variant="ghost" size="sm" asChild className="hidden sm:flex text-purple-400 hover:text-purple-300 hover:bg-purple-500/10">
                      <Link to="/admin">
                        <Shield className="w-4 h-4 mr-1" />
                        Admin
                      </Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" asChild className="hidden sm:flex text-muted-foreground hover:text-foreground">
                    <Link to="/search">
                      <Search className="w-5 h-5" />
                    </Link>
                  </Button>
                  <div className="hidden sm:flex">
                    <NotificationDropdown />
                  </div>
                  <div className="hidden sm:flex items-center">
                    <UserDropdown />
                  </div>
                  {/* Friends button */}
                  <div className="hidden sm:flex">
                    <FriendsButton />
                  </div>
                  <div className="sm:hidden">
                    <button onClick={() => openWallet('deposit')}>
                      <SkilledCoinsDisplay size="sm" isPrivileged={isPrivileged} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/search">
                      <Search className="w-5 h-5" />
                    </Link>
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

        {/* Bordered game layout: black border → navy border → black game area */}
        <div className="pt-16 sm:pt-[60px]">
          {/* Outer black border */}
          <div className="bg-black p-2 sm:p-3 md:p-[14px] min-h-[calc(100vh-64px)]">
            {/* Inner navy border */}
            <div className="bg-[#0a0f1a] rounded-lg p-2 sm:p-3 md:p-[14px] min-h-[calc(100vh-64px-16px)] sm:min-h-[calc(100vh-60px-24px)] md:min-h-[calc(100vh-60px-28px)]">
              {/* Game screen area */}
              <div className="bg-black rounded-md min-h-[calc(100vh-64px-48px)] sm:min-h-[calc(100vh-60px-72px)] md:min-h-[calc(100vh-60px-84px)] p-4 sm:p-8">
                <div className="max-w-4xl mx-auto mt-2 sm:mt-6">
            {/* Game Area */}
            <div className="flex flex-col items-center gap-2.5">
              {/* Opponent Info Row — compact name box + badges outside + timer + resign */}
              <div className="flex items-center justify-between w-full max-w-md">
                <div className="flex items-center gap-2">
                  {/* Compact name box matching timer height */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary border-2 border-border rounded-xl">
                    <PlayerAvatar
                      skinColor={opponentSkinColor}
                      skinIcon={opponentSkinIcon}
                      size="sm"
                      fallbackInitial={opponentName || "O"}
                    />
                    <span className="font-semibold text-sm truncate max-w-[120px]">{opponentName || "Opponent"}</span>
                  </div>
                  {/* Badges outside the name box */}
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
                      <Flame className="w-3 h-3" />
                      {opponentStreak}
                    </span>
                  )}
                  <button
                    className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:text-primary/80 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded transition-colors"
                    title="Add Friend"
                    onClick={async () => {
                      try {
                        const matchmaking = useChessStore.getState().matchmaking;
                        const opponentUserId = matchmaking.opponentUserId;
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
                    onClick={() => {
                      if (isGameOver) {
                        onBack();
                      } else {
                        setShowResignDialog(true);
                      }
                    }} 
                    className={`h-9 w-9 shrink-0 ${isGameOver ? '' : 'text-destructive hover:text-destructive border-destructive/30'}`}
                    title={isGameOver ? 'Leave' : 'Resign'}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Opponent captured pieces */}
              <div className="w-full max-w-md">
                <CapturedPieces 
                  pieces={opponentCaptured} 
                  color={isWhite ? "black" : "white"}
                  materialAdvantage={opponentMaterialAdvantage > 0 ? opponentMaterialAdvantage : undefined}
                />
              </div>

              {/* Chess Board with sound callbacks - only show opponent's last move */}
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

              {/* Player captured pieces */}
              <div className="w-full max-w-md">
                <CapturedPieces 
                  pieces={myCaptured} 
                  color={isWhite ? "white" : "black"}
                  materialAdvantage={myMaterialAdvantage > 0 ? myMaterialAdvantage : undefined}
                />
              </div>

              {/* Player Info Row — compact name box + badges outside + timer + spectators */}
              <div className="flex items-center justify-between w-full max-w-md">
                <div className="flex items-center gap-2">
                  {/* Compact name box matching timer height */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border-2 border-primary/20 rounded-xl">
                    <PlayerAvatar
                      skinColor={skinColor}
                      skinIcon={skinIcon}
                      size="sm"
                    />
                    <span className="font-semibold text-sm truncate max-w-[120px]">{playerName}</span>
                  </div>
                  {/* Badges outside the name box */}
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
                      <Flame className="w-3 h-3" />
                      {playerStreak}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <GameTimer timeLeft={myTime} isActive={isMyTurnForTimer && !isGameOver} />
                  {spectatorCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/60 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
                      <Eye className="w-3.5 h-3.5" />
                      {spectatorCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resign Confirmation Dialog */}
      <AlertDialog open={showResignDialog} onOpenChange={setShowResignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{timerSnapshot?.clockRunning ? 'Resign Game?' : 'Leave Game?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {timerSnapshot?.clockRunning
                ? <>Are you sure you want to resign? This will count as a loss and your opponent will win{wager > 0 && ` the ${wager} SC wager`}.</>
                : 'No moves have been made yet. You can leave without losing any credits.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowResignDialog(false);
                onExit();
              }}
              className={timerSnapshot?.clockRunning ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {timerSnapshot?.clockRunning ? 'Yes, Resign' : 'Leave Game'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
};
