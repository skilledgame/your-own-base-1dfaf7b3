/**
 * VersusScreen — dramatic "Player VS Opponent" splash overlay
 * shown when a game first starts. Auto-dismisses after the animation.
 *
 * Animation timeline (ms):
 *   0      → mount (dark overlay fades in)
 *   100    → player panels slide in from top / bottom
 *   700    → "VS" text + flash burst appear
 *   2200   → everything begins fading out
 *   2800   → onComplete() fires → overlay removed
 *
 * The overlay is sized to cover just the chess board area (centered square),
 * not the entire screen.
 */

import { useEffect, useState, useRef } from 'react';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PIECE_SYMBOLS } from '@/lib/chessConstants';
import type { RankInfo } from '@/lib/rankSystem';
import { RankBadge } from '@/components/RankBadge';

interface VersusScreenProps {
  playerName: string;
  opponentName: string;
  playerColor: 'white' | 'black';
  wager: number;
  playerRank?: RankInfo;
  opponentRank?: RankInfo;
  onComplete: () => void;
}

export function VersusScreen({
  playerName,
  opponentName,
  playerColor,
  wager,
  playerRank,
  opponentRank,
  onComplete,
}: VersusScreenProps) {
  // Animation phase: 0→hidden  1→slide-in  2→VS flash  3→fade-out
  const [phase, setPhase] = useState(0);

  // Store onComplete in a ref so the effect never re-runs due to callback identity changes.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => setPhase(3), 2200);
    const t4 = setTimeout(() => onCompleteRef.current(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []); // no deps — runs exactly once on mount

  const isWhite = playerColor === 'white';

  // King piece symbols for each side
  const playerKing  = isWhite ? PIECE_SYMBOLS['wk'] : PIECE_SYMBOLS['bk'];
  const opponentKing = isWhite ? PIECE_SYMBOLS['bk'] : PIECE_SYMBOLS['wk'];

  return (
    /* Scrim — fills the whole viewport but is mostly transparent */
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* ── Board-sized container (centred square) ── */}
      <div
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-[min(480px,90vw)] h-[min(480px,90vw)]',
          'rounded-2xl overflow-hidden flex flex-col items-center justify-center',
          'transition-opacity duration-500',
          phase === 0 && 'opacity-0',
          phase >= 1 && phase < 3 && 'opacity-100',
          phase === 3 && 'opacity-0',
        )}
        style={{
          background: 'radial-gradient(ellipse at center, #0d1424 0%, #060a14 100%)',
          boxShadow: '0 0 80px 20px rgba(0,0,0,0.7)',
        }}
      >
        {/* ── Animated background bursts ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Top glow (player) */}
          <div
            className={cn(
              'absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full blur-[90px] transition-opacity duration-700',
              phase >= 1 ? 'opacity-60' : 'opacity-0',
            )}
            style={{ background: isWhite ? 'rgba(255,255,255,0.12)' : 'rgba(100,100,255,0.12)' }}
          />
          {/* Bottom glow (opponent) */}
          <div
            className={cn(
              'absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full blur-[90px] transition-opacity duration-700',
              phase >= 1 ? 'opacity-60' : 'opacity-0',
            )}
            style={{ background: isWhite ? 'rgba(100,100,255,0.12)' : 'rgba(255,255,255,0.12)' }}
          />
          {/* VS flash burst */}
          <div
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full blur-[70px] transition-all duration-500',
              phase >= 2 ? 'opacity-80 scale-150' : 'opacity-0 scale-50',
            )}
            style={{ background: 'rgba(255,180,50,0.25)' }}
          />
        </div>

        {/* ── PLAYER (top — slides down from above) ── */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 flex flex-col items-center gap-1.5 py-4 px-4 transition-all duration-700 ease-out',
            phase >= 1 ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0',
          )}
        >
          {/* King piece */}
          <span
            className="text-5xl sm:text-6xl md:text-7xl drop-shadow-2xl"
            style={{
              color: isWhite ? '#FFFFFF' : '#1a1a1a',
              textShadow: isWhite
                ? '0 0 20px rgba(255,255,255,0.4), 2px 2px 4px rgba(0,0,0,0.8)'
                : '0 0 20px rgba(80,80,255,0.3), 2px 2px 4px rgba(0,0,0,0.8)',
              filter: !isWhite ? 'brightness(1.5)' : undefined,
              fontFamily: '"Segoe UI Symbol", "Noto Sans Symbols 2", "Arial Unicode MS", sans-serif',
              fontVariantEmoji: 'text' as never,
            }}
          >
            {playerKing}
          </span>
          {/* Name */}
          <span className="text-base sm:text-lg md:text-xl font-bold text-white truncate max-w-full text-center">
            {playerName}
          </span>
          {/* Color + rank */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider">
              {isWhite ? 'White' : 'Black'}
            </span>
            {playerRank && (
              <RankBadge rank={playerRank} size="md" showLabel />
            )}
          </div>
          <span className="text-[9px] text-white/30 uppercase tracking-widest">You</span>
        </div>

        {/* ── VS badge (center) ── */}
        <div
          className={cn(
            'relative z-20 flex flex-col items-center gap-3 transition-all duration-500',
            phase >= 2 ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
          )}
        >
          {/* Decorative horizontal line */}
          <div className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-[120%] h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent -z-10" />
          
          <span
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter select-none"
            style={{
              background: 'linear-gradient(135deg, #FFD700, #FF8C00)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 30px rgba(255,180,50,0.5))',
            }}
          >
            VS
          </span>

          {/* Wager badge */}
          {wager > 0 && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500',
              'bg-yellow-950/60 border-yellow-500/40',
              phase >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
            )}>
              <Coins className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-bold text-yellow-200">{wager} SC</span>
            </div>
          )}
        </div>

        {/* ── OPPONENT (bottom — slides up from below) ── */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 flex flex-col items-center gap-1.5 py-4 px-4 transition-all duration-700 ease-out',
            phase >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
          )}
        >
          {/* King piece */}
          <span
            className="text-5xl sm:text-6xl md:text-7xl drop-shadow-2xl"
            style={{
              color: isWhite ? '#1a1a1a' : '#FFFFFF',
              textShadow: isWhite
                ? '0 0 20px rgba(80,80,255,0.3), 2px 2px 4px rgba(0,0,0,0.8)'
                : '0 0 20px rgba(255,255,255,0.4), 2px 2px 4px rgba(0,0,0,0.8)',
              filter: isWhite ? 'brightness(1.5)' : undefined,
              fontFamily: '"Segoe UI Symbol", "Noto Sans Symbols 2", "Arial Unicode MS", sans-serif',
              fontVariantEmoji: 'text' as never,
            }}
          >
            {opponentKing}
          </span>
          {/* Name */}
          <span className="text-base sm:text-lg md:text-xl font-bold text-white truncate max-w-full text-center">
            {opponentName}
          </span>
          {/* Color + rank */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider">
              {isWhite ? 'Black' : 'White'}
            </span>
            {opponentRank && (
              <RankBadge rank={opponentRank} size="md" showLabel />
            )}
          </div>
        </div>

        {/* ── Left / right decorative bars ── */}
        <div className={cn(
          'absolute left-0 inset-y-0 w-1 transition-all duration-1000',
          phase >= 2 ? 'opacity-100' : 'opacity-0',
        )}
          style={{ background: 'linear-gradient(180deg, transparent, rgba(255,180,50,0.5), transparent)' }}
        />
        <div className={cn(
          'absolute right-0 inset-y-0 w-1 transition-all duration-1000',
          phase >= 2 ? 'opacity-100' : 'opacity-0',
        )}
          style={{ background: 'linear-gradient(180deg, transparent, rgba(255,180,50,0.5), transparent)' }}
        />
      </div>
    </div>
  );
}
