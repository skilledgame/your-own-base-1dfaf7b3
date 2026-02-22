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
import { useAuthModal } from '@/contexts/AuthModalContext';
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
import { LogOut, Crown, Shield, Search, Flame, Eye, Volume2, VolumeX, Settings, Maximize, Minimize, HelpCircle, Users, Loader2, X, Clock, Gamepad2, Info } from 'lucide-react';
import { getAppSettings } from '@/components/settings/AppSettingsTab';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useProfile } from '@/hooks/useProfile';
import { RankBadge } from '@/components/RankBadge';
import { Chess } from 'chess.js';
import { CHESS_TIME_CONTROL } from '@/lib/chessConstants';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';
import { useChessSound } from '@/hooks/useChessSound';
import { type RankInfo, getRankFromTotalWagered } from '@/lib/rankSystem';
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
import { useChessWebSocket } from '@/hooks/useChessWebSocket';
import { useBalance } from '@/hooks/useBalance';
import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { GameResultModal } from '@/components/GameResultModal';
import { VersusScreen } from '@/components/VersusScreen';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LiveWins } from '@/components/LiveWins';
import { SiteFooterLinks } from '@/components/SiteFooterLinks';
import skilledMascot from '@/assets/skilled-mascot.png';

// ---------------------------------------------------------------------------
// Idle board overlay (shown when no game is active)
// ---------------------------------------------------------------------------
function IdleBoardOverlay() {
  return (
    <div className="relative w-full max-w-[480px] mx-auto">
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
        <div className="text-center space-y-3 bg-black/70 backdrop-blur-sm rounded-xl px-8 py-6">
          <Gamepad2 className="w-8 h-8 text-white/40 mx-auto" />
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
    <div className="relative w-full max-w-[480px] mx-auto">
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
  playerStreak,
  opponentStreak,
  opponentSkinColor,
  opponentSkinIcon,
  onSendMove,
  onExit,
  onBack,
  onTimeLoss,
  gameResultProps,
}: {
  gameState: NonNullable<ReturnType<typeof useChessStore.getState>['gameState']>;
  playerRank?: RankInfo;
  opponentRank?: RankInfo;
  playerBadges: string[];
  opponentBadges: string[];
  playerStreak: number;
  opponentStreak: number;
  opponentSkinColor?: string | null;
  opponentSkinIcon?: string | null;
  onSendMove: (from: string, to: string, promotion?: string) => void;
  onExit: () => void;
  onBack: () => void;
  onTimeLoss?: (loserColor: 'w' | 'b') => void;
  gameResultProps?: {
    isWin: boolean;
    coinsChange: number;
    newBalance: number;
    reason: string;
    onPlayAgain: () => void;
    onGoHome: () => void;
  } | null;
}) {
  const { skinColor, skinIcon } = useProfile();
  const timerSnapshot = useChessStore((s) => s.timerSnapshot);
  const spectatorCount = useChessStore((s) => s.spectatorCount);
  const { playMove, playCapture, playCheck, playGameEnd } = useChessSound();

  // Versus overlay state — rendered over the board
  const versusMode = useUILoadingStore((s) => s.mode);
  const versusData = useUILoadingStore((s) => s.versusData);
  const versusIsLoading = useUILoadingStore((s) => s.isLoading);
  const hideVersus = useUILoadingStore((s) => s.hideLoading);
  const showVersus = versusIsLoading && versusMode === 'versus' && !!versusData;

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

  const opponentColor = isWhite ? 'black' : 'white';
  const myPieceColor = isWhite ? 'white' : 'black';

  return (
    <div className="flex items-start justify-center w-full">
      {/* Board column: top bar + board + bottom bar, all same width, no gaps */}
      <div className="relative flex flex-col w-[384px] sm:w-[448px] md:w-[512px] max-w-full shrink-0">
        {/* Versus overlay — covers exactly the board column */}
        {showVersus && versusData && (
          <VersusScreen
            playerName={versusData.playerName}
            opponentName={versusData.opponentName}
            playerColor={versusData.playerColor}
            wager={versusData.wager}
            playerRank={versusData.playerRank}
            opponentRank={versusData.opponentRank}
            playerSkinColor={skinColor}
            playerSkinIcon={skinIcon}
            opponentSkinColor={opponentSkinColor}
            opponentSkinIcon={opponentSkinIcon}
            onComplete={hideVersus}
          />
        )}

        {/* Game result overlay — covers exactly the board column */}
        {gameResultProps && (
          <GameResultModal
            isWin={gameResultProps.isWin}
            coinsChange={gameResultProps.coinsChange}
            newBalance={gameResultProps.newBalance}
            reason={gameResultProps.reason}
            onPlayAgain={gameResultProps.onPlayAgain}
            onGoHome={gameResultProps.onGoHome}
          />
        )}

        {/* Opponent bar — rounded top, flat bottom to connect to board */}
        <div className="flex items-stretch bg-[#0a0f1a] rounded-t-lg overflow-hidden">
          <PlayerAvatar skinColor={opponentSkinColor} skinIcon={opponentSkinIcon} fallbackInitial={opponentName || 'O'} fill className="w-11" />
          <div className="flex-1 flex items-center justify-between px-3 py-2 min-w-0">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-sm text-white truncate max-w-[130px]">{opponentName || 'Opponent'}</span>
                <RankBadge rank={opponentRank} size="xs" />
                {opponentStreak > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-400">
                    <Flame className="w-3 h-3" />{opponentStreak}
                  </span>
                )}
              </div>
              <CapturedPieces pieces={opponentCaptured} color={opponentColor} materialAdvantage={opponentMaterialAdvantage > 0 ? opponentMaterialAdvantage : undefined} />
            </div>
            <GameTimer timeLeft={opponentTime} isActive={isOpponentTurnForTimer && !isGameOver} pieceColor={opponentColor} />
          </div>
        </div>

        {/* Board — no rounding, flush with bars */}
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

        {/* Player bar — flat top, rounded bottom to connect to board */}
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
              <CapturedPieces pieces={myCaptured} color={myPieceColor} materialAdvantage={myMaterialAdvantage > 0 ? myMaterialAdvantage : undefined} />
            </div>
            <GameTimer timeLeft={myTime} isActive={isMyTurnForTimer && !isGameOver} pieceColor={myPieceColor} />
          </div>
        </div>
      </div>

      {/* Right column: resign + spectators, aligned to the right of the board */}
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

// ---------------------------------------------------------------------------
// Settings overlay
// ---------------------------------------------------------------------------
function SettingsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-sm rounded-xl flex items-center justify-center">
      <div className="w-full max-w-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5" /> Game Settings
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white/70">Time Control</h3>
            <p className="text-white/50 text-xs">1 minute per player + 3 second increment per move</p>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white/70">Board Theme</h3>
            <p className="text-white/50 text-xs">Navy blue — matching the game UI</p>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white/70">Sound</h3>
            <p className="text-white/50 text-xs">Toggle sound using the speaker icon in the footer bar, or visit the full settings page for volume controls.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Help overlay
// ---------------------------------------------------------------------------
function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-sm rounded-xl flex items-center justify-center">
      <div className="w-full max-w-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5" /> How to Play
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2"><Info className="w-4 h-4" /> Select a Tier</h3>
            <p className="text-white/50 text-xs">Choose your entry fee from Tier I, II, or III on the left panel. Higher tiers have bigger prizes.</p>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2"><Users className="w-4 h-4" /> Find a Match</h3>
            <p className="text-white/50 text-xs">Click "Find Match" to enter the queue. You'll be paired with another player at the same tier.</p>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2"><Clock className="w-4 h-4" /> Play & Win</h3>
            <p className="text-white/50 text-xs">Each player has 1 minute with a 3-second increment per move. Checkmate your opponent or win on time to claim the prize.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Game info section (below game area)
// ===========================================================================
const INFO_TABS = ['Description', 'How to Play', 'Rules'] as const;
type InfoTab = typeof INFO_TABS[number];

function GameInfoSection() {
  const [activeTab, setActiveTab] = useState<InfoTab>('Description');

  return (
    <div
      className="bg-[#0a0f1a] rounded-2xl p-5 sm:p-6 mt-4"
      style={{ boxShadow: '0 0 40px rgba(0,0,0,0.3)' }}
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left column: game thumbnail + metadata */}
        <div className="w-full md:w-[180px] shrink-0 flex flex-col items-center md:items-start gap-3">
          <div
            className="w-[160px] h-[200px] rounded-xl overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #0d1b2a)' }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-7xl drop-shadow-2xl">♟️</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
              <h4 className="text-white font-bold text-sm uppercase tracking-wide">Chess</h4>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">Live Now</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-white/40 text-xs">
            <img src={skilledMascot} alt="Skilled" className="w-4 h-4 object-contain" />
            <span>Skilled Originals</span>
          </div>
          <h3 className="text-white font-bold text-lg leading-none">Chess</h3>
          <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-1.5 text-xs text-white/50">
            <Users className="w-3.5 h-3.5" />
            <span>Online Players</span>
          </div>
        </div>

        {/* Right column: tabs + content */}
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-base sm:text-lg mb-4">Play Chess Online at Skilled</h2>

          {/* Tab bar */}
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-1 mb-5 w-fit">
            {INFO_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-[#0ea5e9] text-white shadow-md'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="space-y-4 text-white/50 text-sm leading-relaxed">
            {activeTab === 'Description' && (
              <>
                <h3 className="text-white/80 font-semibold text-base">What is Online Chess?</h3>
                <p>
                  Online Chess on Skilled is a competitive skill-based game where you wager Skilled Coins
                  against real opponents. Each match is a test of strategy, calculation, and nerves.
                </p>
                <p>
                  Players choose from three wager tiers — 100, 500, or 1,000 Skilled Coins — and are
                  matched against opponents at the same stake. The winner takes the pot.
                </p>
                <p>
                  Unlike luck-based games, chess rewards preparation and deep thinking. Every move matters,
                  and a single blunder can turn the tide of the entire match.
                </p>
                <p>
                  Games are played with a 1-minute clock plus 3-second increment per move, creating
                  fast-paced, high-intensity battles that demand quick decisions under pressure.
                </p>

                <h3 className="text-white/80 font-semibold text-base pt-2">Why Play on Skilled?</h3>
                <p>
                  Skilled is purpose-built for competitive gaming. Our matchmaking system pairs you with
                  opponents of similar skill, ensuring every game is a fair and meaningful challenge.
                </p>
                <p>
                  Every player has an Elo rating that updates in real time. Climb the ranks, track your
                  progress on the leaderboard, and earn recognition as one of the top players on the platform.
                </p>
                <p>
                  With Skilled Coins on the line, every move carries real weight. The combination of skill-based
                  competition and tangible rewards makes each game more engaging than casual play.
                </p>

                <h3 className="text-white/80 font-semibold text-base pt-2">Built for Competitive Players</h3>
                <p>
                  Whether you're a seasoned chess player or just getting started, Skilled offers a premium
                  competitive environment. The clean interface, responsive board, and reliable connection
                  let you focus entirely on the game.
                </p>
                <p>
                  Our anti-cheat system ensures a level playing field. Engine assistance, external analysis,
                  and any form of unfair advantage are detected and penalized, so you can trust that every
                  win is earned.
                </p>
                <p>
                  Join thousands of players competing daily. With 24/7 matchmaking across all wager tiers,
                  there's always an opponent ready to play.
                </p>
              </>
            )}
            {activeTab === 'How to Play' && (
              <>
                <h3 className="text-white/80 font-semibold text-base">Getting Started</h3>
                <p>
                  Select a wager tier from the panel on the left, then click "Find Match" to enter the
                  matchmaking queue. You'll be paired with an opponent wagering the same amount.
                </p>
                <p>
                  Once matched, the game begins immediately. You and your opponent each start with
                  1 minute on the clock, gaining 3 seconds after every move.
                </p>
                <p>
                  Play standard chess rules — checkmate your opponent, or win on time if their clock
                  runs out. Draws are possible through stalemate, insufficient material, or threefold repetition.
                </p>
                <p>
                  The winner receives the combined wager pool. Your Elo rating updates after every game,
                  tracking your skill progression over time.
                </p>

                <h3 className="text-white/80 font-semibold text-base pt-2">Wager Tiers</h3>
                <p>
                  <strong className="text-white/70">Tier I — 100 SC:</strong> Perfect for warming up or
                  practicing new openings without heavy risk. Ideal for newer players building confidence.
                </p>
                <p>
                  <strong className="text-white/70">Tier II — 500 SC:</strong> The mid-stakes tier where
                  competition gets serious. Most active players prefer this tier for balanced risk and reward.
                </p>
                <p>
                  <strong className="text-white/70">Tier III — 1,000 SC:</strong> High-stakes matches for
                  experienced players. The biggest rewards come with the toughest opponents.
                </p>

                <h3 className="text-white/80 font-semibold text-base pt-2">Tips for New Players</h3>
                <p>
                  Start with Tier I to learn the platform without risking too many coins. Focus on
                  controlling the center of the board and developing your pieces early.
                </p>
                <p>
                  Pay attention to the clock — in bullet chess, time management is just as important as
                  positional play. Pre-move when you can to save precious seconds.
                </p>
              </>
            )}
            {activeTab === 'Rules' && (
              <>
                <h3 className="text-white/80 font-semibold text-base">Game Rules</h3>
                <p>
                  All matches follow standard FIDE chess rules with a bullet time control of
                  1 minute + 3 seconds increment.
                </p>
                <p>
                  Players must have sufficient Skilled Coins balance to enter a match at their chosen
                  wager tier. Coins are deducted when the match begins and awarded to the winner upon completion.
                </p>
                <p>
                  Disconnecting from an active game will keep your clock running. If your time expires,
                  the game is forfeited. Intentional abandonment may affect your account standing.
                </p>
                <p>
                  Fair play is enforced. The use of chess engines, external analysis tools, or any form
                  of assistance during a match is strictly prohibited and will result in account action.
                </p>

                <h3 className="text-white/80 font-semibold text-base pt-2">Win Conditions</h3>
                <p>
                  A game is won by checkmate (trapping the opponent's king), by the opponent's clock running
                  out, or by the opponent resigning. Stalemate results in a draw, and the wager is returned
                  to both players.
                </p>
                <p>
                  Draws can also occur by threefold repetition, the fifty-move rule, or insufficient material
                  (e.g., king vs. king). In all draw scenarios, both players receive their wager back.
                </p>

                <h3 className="text-white/80 font-semibold text-base pt-2">Fair Play Policy</h3>
                <p>
                  Skilled employs automated detection systems to identify the use of chess engines or
                  other forms of cheating. Accounts found violating fair play policies will be suspended
                  and any ill-gotten winnings will be reversed.
                </p>
                <p>
                  Players are expected to conduct themselves respectfully. Intentional stalling, repeated
                  abandonment, or abusive behavior may result in temporary or permanent restrictions.
                </p>
                <p>
                  If you suspect an opponent of cheating, you can report the game after it concludes. Our
                  team reviews all reports and takes appropriate action.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
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
  const { openAuthModal } = useAuthModal();
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

  // Footer controls state
  const [isMuted, setIsMuted] = useState(() => !getAppSettings().gameSounds);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const gameShellRef = useRef<HTMLDivElement>(null);

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

  // Sound toggle
  const handleToggleMute = useCallback(() => {
    const current = getAppSettings();
    const next = { ...current, gameSounds: isMuted };
    localStorage.setItem('app_settings', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('app-settings-change', { detail: next }));
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Fullscreen toggle
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && gameShellRef.current) {
      gameShellRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Listen for fullscreen exit (e.g. Escape key)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Game result data (rendered as overlay on the board, not a full-page replacement)
  const showGameResult = phase === 'game_over' && gameEndResult;
  const gameResultProps = showGameResult ? {
    isWin: gameEndResult.isWin ?? false,
    coinsChange: gameEndResult.creditsChange ?? 0,
    newBalance: balance,
    reason: gameEndResult.message || gameEndResult.reason || 'Game ended',
    onPlayAgain: handlePlayAgain,
    onGoHome: handleGoHome,
  } : null;

  // Determine right panel content
  const isPlaying = (phase === 'in_game' || phase === 'game_over') && gameState;
  const isSearching = phase === 'searching';

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-16 md:pb-0">
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
        <header className={`fixed top-0 z-40 bg-[#0a0f1a]/80 backdrop-blur-xl transition-all duration-300 ease-out ${sideMenuOpen ? (sidebarCollapsed ? 'md:left-16 left-0 right-0' : 'md:left-72 left-0 right-0') : 'left-0 right-0'}`}>
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

        {/* Game layout */}
        <div className="pt-16 sm:pt-[60px]">
          <div className="w-full min-h-[calc(100vh-64px)] flex items-start justify-center px-2 sm:px-3 md:px-4 py-5 sm:py-8 md:py-10">
            <div className="w-full max-w-[1280px]">
              <div
                className="bg-[#0a0f1a] rounded-2xl p-3 sm:p-5 md:p-6"
                style={{ boxShadow: '0 0 60px rgba(0,0,0,0.4)' }}
              >
                <div ref={gameShellRef} className="relative w-full bg-background rounded-xl p-4 sm:p-6 md:p-8">
                  {/* Settings / Help overlays */}
                  {showSettings && <SettingsOverlay onClose={() => setShowSettings(false)} />}
                  {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

                  {/* Two-panel layout */}
                  <div className="flex flex-col-reverse md:flex-row gap-4 md:gap-6">
                    {/* Left panel: Wager selection */}
                    <div className="w-full md:w-[280px] lg:w-[320px] shrink-0 flex">
                      <div className="w-full bg-[#0a0f1a] rounded-b-xl p-4 flex flex-col overflow-hidden">
                        <WagerPanel />
                      </div>
                    </div>

                    {/* Right panel: Game area */}
                    <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
                      {isPlaying ? (
                        <ActiveGamePanel
                          gameState={gameState}
                          playerRank={effectivePlayerRank}
                          opponentRank={opponentRank}
                          playerBadges={playerBadges}
                          opponentBadges={opponentBadges}
                          playerStreak={dailyPlayStreak ?? 0}
                          opponentStreak={opponentStreak}
                          opponentSkinColor={opponentSkinColor}
                          opponentSkinIcon={opponentSkinIcon}
                          onSendMove={handleSendMove}
                          onExit={handleExit}
                          onBack={handleBack}
                          onTimeLoss={handleTimeLoss}
                          gameResultProps={gameResultProps}
                        />
                      ) : isSearching ? (
                        <SearchingOverlay />
                      ) : (
                        <IdleBoardOverlay />
                      )}
                    </div>
                  </div>

                  {/* Footer — spans both panels */}
                  <div className="w-full mt-6 pt-4">
                    <div className="flex items-center justify-between px-2">
                      <div className="w-28" />
                      <LogoLink className="h-6 sm:h-7 opacity-40" />
                      <div className="flex items-center gap-3 w-28 justify-end">
                        <button
                          onClick={handleToggleMute}
                          className={`transition-colors ${isMuted ? 'text-red-400/60 hover:text-red-400' : 'text-white/30 hover:text-white/60'}`}
                          title={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={handleToggleFullscreen}
                          className="text-white/30 hover:text-white/60 transition-colors"
                          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => { setShowHelp(false); setShowSettings(!showSettings); }}
                          className={`transition-colors ${showSettings ? 'text-white/70' : 'text-white/30 hover:text-white/60'}`}
                          title="Settings"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setShowSettings(false); setShowHelp(!showHelp); }}
                          className={`transition-colors ${showHelp ? 'text-white/70' : 'text-white/30 hover:text-white/60'}`}
                          title="Help"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <GameInfoSection />

              {/* Recent Wins */}
              <div className="mt-6">
                <LiveWins />
              </div>

              {/* Unified Footer */}
              <SiteFooterLinks />
            </div>
          </div>
        </div>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
