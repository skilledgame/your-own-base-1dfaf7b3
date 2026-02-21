import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface GameTimerProps {
  timeLeft: number;
  isActive: boolean;
  pieceColor?: 'white' | 'black';
}

export const GameTimer = ({ timeLeft, isActive, pieceColor = 'black' }: GameTimerProps) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLow = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  const isWhiteSide = pieceColor === 'white';

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-lg font-bold tabular-nums transition-all duration-300",
        isWhiteSide
          ? "bg-white/90 text-gray-900"
          : "bg-white/[0.08] text-white",
        isActive && !isLow && "ring-1 ring-white/20",
        isLow && isActive && "animate-pulse",
        isCritical && isActive && (isWhiteSide
          ? "bg-red-100 text-red-600 ring-1 ring-red-400"
          : "bg-red-500/20 text-red-400 ring-1 ring-red-500/50"),
        isLow && isActive && !isCritical && (isWhiteSide
          ? "bg-orange-50 text-orange-600 ring-1 ring-orange-400"
          : "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50"),
        !isActive && !isLow && "opacity-60"
      )}
    >
      <Clock className={cn(
        "w-4 h-4",
        isWhiteSide ? "text-gray-500" : "text-white/50",
        isActive && !isLow && (isWhiteSide ? "text-gray-700" : "text-white/70"),
        isLow && isActive && "text-current"
      )} />
      <span>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
};
