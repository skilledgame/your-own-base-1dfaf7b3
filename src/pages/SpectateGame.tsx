/**
 * Spectate Game Page
 * 
 * Route: /game/spectate/:targetUserId
 * 
 * Connects as a spectator to watch a friend's live game.
 * Displays a read-only chessboard with a red border and "SPECTATING" banner.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { GameTimer } from '@/components/GameTimer';
import { CapturedPieces } from '@/components/CapturedPieces';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Loader2 } from 'lucide-react';
import { useSpectate } from '@/hooks/useSpectate';
import { supabase } from '@/integrations/supabase/client';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';
import { CHESS_TIME_CONTROL } from '@/lib/chessConstants';

export default function SpectateGame() {
  const { targetUserId } = useParams<{ targetUserId: string }>();
  const navigate = useNavigate();
  const { gameState, timerSnapshot, loading, error, lastMove } = useSpectate(targetUserId);

  // Player names
  const [whiteName, setWhiteName] = useState('White');
  const [blackName, setBlackName] = useState('Black');

  // Display clocks
  const [displayWhiteSec, setDisplayWhiteSec] = useState(CHESS_TIME_CONTROL.BASE_TIME);
  const [displayBlackSec, setDisplayBlackSec] = useState(CHESS_TIME_CONTROL.BASE_TIME);

  // Chess instance for board rendering
  const chess = useMemo(() => {
    if (!gameState) return new Chess();
    try {
      return new Chess(gameState.fen);
    } catch {
      return new Chess();
    }
  }, [gameState?.fen]);

  // Fetch player names when game state arrives
  useEffect(() => {
    if (!gameState) return;
    const fetchNames = async () => {
      try {
        const [whiteRes, blackRes] = await Promise.all([
          supabase.from('profiles').select('display_name').eq('user_id', gameState.whiteId).maybeSingle(),
          supabase.from('profiles').select('display_name').eq('user_id', gameState.blackId).maybeSingle(),
        ]);
        if (whiteRes.data?.display_name) setWhiteName(whiteRes.data.display_name);
        if (blackRes.data?.display_name) setBlackName(blackRes.data.display_name);
      } catch {
        // Non-fatal
      }
    };
    fetchNames();
  }, [gameState?.whiteId, gameState?.blackId]);

  // Display clock tick
  useEffect(() => {
    if (!timerSnapshot) return;

    const tick = () => {
      const snap = timerSnapshot;
      if (!snap) return;

      let wMs = snap.wMs;
      let bMs = snap.bMs;

      if (snap.clockRunning) {
        const serverNowEstimate = Date.now() + snap.serverTimeOffsetMs;
        const elapsed = Math.max(0, serverNowEstimate - snap.serverNow);
        if (snap.turn === 'w') {
          wMs = Math.max(0, wMs - elapsed);
        } else {
          bMs = Math.max(0, bMs - elapsed);
        }
      }

      setDisplayWhiteSec(Math.ceil(wMs / 1000));
      setDisplayBlackSec(Math.ceil(bMs / 1000));
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [timerSnapshot]);

  // Captured pieces + material advantage
  const currentFen = chess.fen();
  const capturedPieces = useMemo(() => calculateCapturedPieces(chess), [currentFen]);
  const materialAdvantage = useMemo(() => calculateMaterialAdvantage(chess), [currentFen]);
  const whiteAdvantage = materialAdvantage.difference > 0 ? materialAdvantage.difference : undefined;
  const blackAdvantage = materialAdvantage.difference < 0 ? -materialAdvantage.difference : undefined;

  // No-op move handler (read-only board)
  const noopMove = () => false;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <p className="text-slate-400 text-sm">Connecting to game...</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Go Back
        </Button>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center gap-4">
        <Eye className="w-10 h-10 text-red-400/60" />
        <p className="text-slate-300 text-sm font-medium">{error}</p>
        <p className="text-slate-500 text-xs">This player may not be in a game right now.</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-blue-400">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Go Back
        </Button>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400 text-sm">No game data available</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-blue-400">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Go Back
        </Button>
      </div>
    );
  }

  const isGameOver = gameState.isGameOver;

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center relative overflow-hidden">
      {/* Full-screen red vignette — edges of viewport */}
      <div className="fixed inset-0 pointer-events-none z-10"
        style={{
          boxShadow: 'inset 0 0 120px 40px rgba(220, 38, 38, 0.25), inset 0 0 300px 80px rgba(220, 38, 38, 0.10)',
        }}
      />

      {/* Top Bar */}
      <div className="w-full max-w-lg flex items-center justify-between px-4 py-3 relative z-20">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        {/* SPECTATING banner */}
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/20 border border-red-500/40 rounded-full">
          <Eye className="w-4 h-4 text-red-400" />
          <span className="text-red-300 text-xs font-bold uppercase tracking-wider">Spectating</span>
        </div>

        <div className="w-16" /> {/* Spacer for balance */}
      </div>

      {/* Game area — pushed down with top margin for breathing room */}
      <div className="flex flex-col items-center gap-2.5 px-4 w-full max-w-lg mt-6 sm:mt-10 relative z-20">
        {/* Black player info (top) — compact row matching timer height */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary border-2 border-border rounded-xl">
            <span className="font-semibold text-sm text-muted-foreground truncate max-w-[160px]">{blackName}</span>
            <CapturedPieces pieces={capturedPieces.black} color="black" materialAdvantage={blackAdvantage} />
          </div>
          <GameTimer timeLeft={displayBlackSec} isActive={gameState.turn === 'b' && !isGameOver} />
        </div>

        {/* Chess Board with blue glow */}
        <div className="relative w-fit max-w-full rounded-lg"
          style={{ boxShadow: '0 0 30px 6px rgba(59, 130, 246, 0.25), 0 0 60px 15px rgba(59, 130, 246, 0.10)' }}
        >
          <ChessBoard
            game={chess}
            onMove={noopMove}
            isPlayerTurn={false}
            lastMove={null}
            isCheck={chess.isCheck()}
            flipped={false}
            isGameOver={isGameOver}
            enablePremove={false}
          />
        </div>

        {/* White player info (bottom) — compact row matching timer height */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary border-2 border-border rounded-xl">
            <span className="font-semibold text-sm text-muted-foreground truncate max-w-[160px]">{whiteName}</span>
            <CapturedPieces pieces={capturedPieces.white} color="white" materialAdvantage={whiteAdvantage} />
          </div>
          <GameTimer timeLeft={displayWhiteSec} isActive={gameState.turn === 'w' && !isGameOver} />
        </div>

        {/* Wager display */}
        {gameState.wager > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full text-slate-400 text-xs mt-1">
            <span>Wager: {gameState.wager} SC</span>
          </div>
        )}

        {/* Game over summary */}
        {isGameOver && (
          <div className="flex flex-col items-center gap-3 mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-white font-bold text-lg">Game Over</p>
            {gameState.gameEndReason && (
              <p className="text-slate-400 text-sm">
                {gameState.winnerColor === 'w' ? whiteName : gameState.winnerColor === 'b' ? blackName : 'Draw'} 
                {gameState.winnerColor ? ' wins' : ''} — {gameState.gameEndReason}
              </p>
            )}
            <Button onClick={() => navigate(-1)} className="mt-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Go Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
