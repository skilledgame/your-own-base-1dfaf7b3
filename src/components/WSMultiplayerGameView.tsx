/**
 * WebSocket-based Multiplayer Game View
 * 
 * Uses the chess WebSocket for move sending and state synchronization.
 * Server is authoritative for all game state.
 * Displays wager, balance, captured pieces, and material advantage.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthModal } from '@/contexts/AuthModalContext';
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
import { LogOut, Crown, Shield, Search, Flame, UserPlus, Eye, Volume2, Settings, Maximize, HelpCircle } from 'lucide-react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useProfile } from '@/hooks/useProfile';
import { RankBadge } from '@/components/RankBadge';
import { Chess } from 'chess.js';
import { CHESS_TIME_CONTROL } from '@/lib/chessConstants';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';
import { useChessSound } from '@/hooks/useChessSound';
import { type RankInfo } from '@/lib/rankSystem';
import { useChessStore } from '@/stores/chessStore';
import { wsClient } from '@/lib/wsClient';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { LogoLink } from '@/components/LogoLink';
import { UserDropdown } from '@/components/UserDropdown';
import { FriendsButton } from '@/components/FriendsButton';
import { BalanceDepositPill } from '@/components/BalanceDepositPill';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { useAuth } from '@/contexts/AuthContext';
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
  const { openAuthModal } = useAuthModal();
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
            fixed top-0 z-40 bg-[#0a0f1a]/80 backdrop-blur-xl
            transition-all duration-300 ease-out
            ${sideMenuOpen ? (sidebarCollapsed ? 'md:left-16 left-0 right-0' : 'md:left-72 left-0 right-0') : 'left-0 right-0'}
          `}
        >
          <div className="max-w-7xl mx-auto relative flex items-center justify-center md:justify-between px-4 sm:px-6 py-4 sm:py-3">
            {/* Left: Logo */}
            <div className="flex items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:static md:top-auto md:translate-x-0 md:translate-y-0">
              <LogoLink className="h-16 md:h-14" />
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
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/search">
                      <Search className="w-5 h-5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" className="hidden sm:flex text-muted-foreground hover:text-foreground" onClick={() => openAuthModal('sign-in')}>
                    Sign In
                  </Button>
                  <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0 font-semibold" onClick={() => openAuthModal('sign-up')}>
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Game layout: page bg → centering wrapper → bordered game shell */}
        <div className="pt-16 sm:pt-[60px]">
          {/* 1: Page wrapper — dark navy breathing room */}
          <div className="w-full min-h-[calc(100vh-64px)] px-3 sm:px-5 md:px-6 py-5 sm:py-8 md:py-10">
            {/* 2: Centering wrapper — constrains max width */}
            <div className="w-full max-w-[1400px] mx-auto">
              {/* 3: Game shell — the visible bordered container */}
              <div
                className="w-full bg-[#0a0f1a] rounded-2xl border border-white/[0.07] p-3 sm:p-5 md:p-6"
                style={{ boxShadow: '0 0 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}
              >
                {/* 4: Inner game area */}
                <div className="w-full bg-black rounded-xl p-5 sm:p-8 md:p-10">
                  {/* 5: Game content */}
                  <div className="flex items-start justify-center">
                    {/* Board column */}
                    <div className="flex flex-col w-[384px] sm:w-[448px] md:w-[512px] max-w-full shrink-0">
                      {/* Opponent bar */}
                      <div className="flex items-stretch bg-[#0a0f1a] rounded-t-lg overflow-hidden">
                        <PlayerAvatar skinColor={opponentSkinColor} skinIcon={opponentSkinIcon} fallbackInitial={opponentName || "O"} fill className="w-11" />
                        <div className="flex-1 flex items-center justify-between px-3 py-2 min-w-0">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-sm text-white truncate max-w-[130px]">{opponentName || "Opponent"}</span>
                              <RankBadge rank={opponentRank} size="xs" />
                              {opponentStreak > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-400">
                                  <Flame className="w-3 h-3" />{opponentStreak}
                                </span>
                              )}
                            </div>
                            <CapturedPieces pieces={opponentCaptured} color={isWhite ? "black" : "white"} materialAdvantage={opponentMaterialAdvantage > 0 ? opponentMaterialAdvantage : undefined} />
                          </div>
                          <GameTimer timeLeft={opponentTime} isActive={isOpponentTurnForTimer && !isGameOver} pieceColor={isWhite ? 'black' : 'white'} />
                        </div>
                      </div>

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

                      {/* Player bar */}
                      <div className="flex items-stretch bg-[#0a0f1a] rounded-b-lg overflow-hidden">
                        <PlayerAvatar skinColor={skinColor} skinIcon={skinIcon} fill className="w-11" />
                        <div className="flex-1 flex items-center justify-between px-3 py-2 min-w-0">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-sm text-white truncate max-w-[130px]">{playerName}</span>
                              <RankBadge rank={playerRank} size="xs" />
                              {playerStreak > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-400">
                                  <Flame className="w-3 h-3" />{playerStreak}
                                </span>
                              )}
                            </div>
                            <CapturedPieces pieces={myCaptured} color={isWhite ? "white" : "black"} materialAdvantage={myMaterialAdvantage > 0 ? myMaterialAdvantage : undefined} />
                          </div>
                          <GameTimer timeLeft={myTime} isActive={isMyTurnForTimer && !isGameOver} pieceColor={isWhite ? 'white' : 'black'} />
                        </div>
                      </div>
                    </div>

                    {/* Right column: resign + spectators */}
                    <div className="flex flex-col items-center gap-2 ml-2 pt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { isGameOver ? onBack() : setShowResignDialog(true); }}
                        className={`h-9 w-9 shrink-0 rounded-lg ${isGameOver ? 'text-white/50 hover:text-white/70' : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'}`}
                        title={isGameOver ? 'Leave' : 'Resign'}
                      >
                        <LogOut className="w-4 h-4" />
                      </Button>
                      {spectatorCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/60 bg-white/[0.05] px-2 py-1.5 rounded-lg">
                          <Eye className="w-3.5 h-3.5" />{spectatorCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer bar */}
                  <div className="w-full mt-auto pt-6">
                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 px-2">
                      <div className="w-24" />
                      <LogoLink className="h-6 sm:h-7 opacity-40" />
                      <div className="flex items-center gap-3 w-24 justify-end">
                        <button className="text-white/30 hover:text-white/60 transition-colors" title="Sound">
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button className="text-white/30 hover:text-white/60 transition-colors" title="Fullscreen">
                          <Maximize className="w-4 h-4" />
                        </button>
                        <button className="text-white/30 hover:text-white/60 transition-colors" title="Settings">
                          <Settings className="w-4 h-4" />
                        </button>
                        <button className="text-white/30 hover:text-white/60 transition-colors" title="Help">
                          <HelpCircle className="w-4 h-4" />
                        </button>
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
