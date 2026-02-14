/**
 * VersusScreen — dramatic "Player VS Opponent" splash overlay
 * shown when a game first starts. Auto-dismisses after the animation.
 *
 * Animation timeline (ms):
 *   0      → mount (dark overlay fades in)
 *   100    → player panels slide in from left / right
 *   700    → "VS" text + flash burst appear
 *   2200   → everything begins fading out
 *   2800   → onComplete() fires → overlay removed
 */

import { useEffect, useState, useRef } from 'react';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PIECE_SYMBOLS } from '@/lib/chessConstants';
import type { RankInfo } from '@/lib/rankSystem';

interface VersusScreenProps {
  playerName: string;
  opponentName: string;
  playerColor: 'white' | 'black';
  wager: number;
  playerRank?: RankInfo;
  opponentRank?: RankInfo;
  onComplete: () => void;
}

// Rank tier → tailwind color class
function rankColor(rank?: RankInfo): string {
  if (!rank) return 'text-slate-400';
  switch (rank.tierName) {
    case 'diamond':  return 'text-cyan-400';
    case 'platinum': return 'text-slate-300';
    case 'gold':     return 'text-yellow-400';
    case 'silver':   return 'text-gray-300';
    case 'bronze':   return 'text-orange-500';
    default:         return 'text-slate-400';
  }
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
  // This was the root cause of the freeze: inline () => setState(...) changed every render,
  // which reset all timers, so the animation never progressed and the overlay never dismissed.
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
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center overflow-hidden pointer-events-none',
        'transition-opacity duration-500',
        phase === 0 && 'opacity-0',
        phase >= 1 && phase < 3 && 'opacity-100',
        phase === 3 && 'opacity-0',
      )}
      style={{ background: 'radial-gradient(ellipse at center, #0d1424 0%, #060a14 100%)' }}
    >
      {/* ── Animated background bursts ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Left glow (player) */}
        <div
          className={cn(
            'absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full blur-[100px] transition-opacity duration-700',
            phase >= 1 ? 'opacity-60' : 'opacity-0',
          )}
          style={{ background: isWhite ? 'rgba(255,255,255,0.12)' : 'rgba(100,100,255,0.12)' }}
        />
        {/* Right glow (opponent) */}
        <div
          className={cn(
            'absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full blur-[100px] transition-opacity duration-700',
            phase >= 1 ? 'opacity-60' : 'opacity-0',
          )}
          style={{ background: isWhite ? 'rgba(100,100,255,0.12)' : 'rgba(255,255,255,0.12)' }}
        />
        {/* VS flash burst */}
        <div
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full blur-[80px] transition-all duration-500',
            phase >= 2 ? 'opacity-80 scale-150' : 'opacity-0 scale-50',
          )}
          style={{ background: 'rgba(255,180,50,0.25)' }}
        />
      </div>

      {/* ── PLAYER (left) ── */}
      <div
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 px-6 sm:px-12 transition-all duration-700 ease-out',
          phase >= 1 ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0',
        )}
        style={{ width: '40%' }}
      >
        {/* King piece */}
        <span
          className="text-6xl sm:text-7xl md:text-8xl drop-shadow-2xl"
          style={{
            color: isWhite ? '#FFFFFF' : '#1a1a1a',
            textShadow: isWhite
              ? '0 0 20px rgba(255,255,255,0.4), 2px 2px 4px rgba(0,0,0,0.8)'
              : '0 0 20px rgba(80,80,255,0.3), 2px 2px 4px rgba(0,0,0,0.8)',
            filter: !isWhite ? 'brightness(1.5)' : undefined,
          }}
        >
          {playerKing}
        </span>
        {/* Name */}
        <span className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate max-w-full text-center">
          {playerName}
        </span>
        {/* Color + rank */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-white/50 uppercase tracking-wider">
            {isWhite ? 'White' : 'Black'}
          </span>
          {playerRank && (
            <span className={cn('text-xs sm:text-sm font-semibold', rankColor(playerRank))}>
              {playerRank.displayName}
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/30 uppercase tracking-widest mt-1">You</span>
      </div>

      {/* ── VS badge (center) ── */}
      <div
        className={cn(
          'relative z-20 flex flex-col items-center gap-4 transition-all duration-500',
          phase >= 2 ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
        )}
      >
        {/* Decorative line left */}
        <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-screen h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent -z-10" />
        
        <span
          className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter select-none"
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
            'flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-500',
            'bg-yellow-950/60 border-yellow-500/40',
            phase >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          )}>
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-bold text-yellow-200">{wager} SC</span>
          </div>
        )}
      </div>

      {/* ── OPPONENT (right) ── */}
      <div
        className={cn(
          'absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 px-6 sm:px-12 transition-all duration-700 ease-out',
          phase >= 1 ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        )}
        style={{ width: '40%' }}
      >
        {/* King piece */}
        <span
          className="text-6xl sm:text-7xl md:text-8xl drop-shadow-2xl"
          style={{
            color: isWhite ? '#1a1a1a' : '#FFFFFF',
            textShadow: isWhite
              ? '0 0 20px rgba(80,80,255,0.3), 2px 2px 4px rgba(0,0,0,0.8)'
              : '0 0 20px rgba(255,255,255,0.4), 2px 2px 4px rgba(0,0,0,0.8)',
            filter: isWhite ? 'brightness(1.5)' : undefined,
          }}
        >
          {opponentKing}
        </span>
        {/* Name */}
        <span className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate max-w-full text-center">
          {opponentName}
        </span>
        {/* Color + rank */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-white/50 uppercase tracking-wider">
            {isWhite ? 'Black' : 'White'}
          </span>
          {opponentRank && (
            <span className={cn('text-xs sm:text-sm font-semibold', rankColor(opponentRank))}>
              {opponentRank.displayName}
            </span>
          )}
        </div>
      </div>

      {/* ── Top / bottom decorative bars ── */}
      <div className={cn(
        'absolute top-0 inset-x-0 h-1 transition-all duration-1000',
        phase >= 2 ? 'opacity-100' : 'opacity-0',
      )}
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,180,50,0.5), transparent)' }}
      />
      <div className={cn(
        'absolute bottom-0 inset-x-0 h-1 transition-all duration-1000',
        phase >= 2 ? 'opacity-100' : 'opacity-0',
      )}
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,180,50,0.5), transparent)' }}
      />
    </div>
  );
}
