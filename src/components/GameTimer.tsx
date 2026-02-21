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
        isActive && !isLow && (isWhiteSide
          ? "bg-emerald-400 text-emerald-950"
          : "bg-emerald-500/20 text-emerald-400"),
        isLow && isActive && "animate-pulse",
        isLow && isActive && !isCritical && (isWhiteSide
          ? "bg-orange-400 text-orange-950"
          : "bg-orange-500/20 text-orange-400"),
        isCritical && isActive && (isWhiteSide
          ? "bg-red-500 text-white"
          : "bg-red-500/20 text-red-400"),
        !isActive && !isLow && "opacity-50"
      )}
    >
      <Clock className={cn(
        "w-4 h-4",
        isActive && !isLow && "text-current",
        !isActive && (isWhiteSide ? "text-gray-500" : "text-white/50"),
        isLow && isActive && "text-current"
      )} />
      <span>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
};
