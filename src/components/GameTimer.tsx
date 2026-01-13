import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface GameTimerProps {
  timeLeft: number;
  isActive: boolean;
}

export const GameTimer = ({ timeLeft, isActive }: GameTimerProps) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLow = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-6 py-4 rounded-xl font-display text-3xl font-bold transition-all duration-300",
        "bg-secondary border-2",
        isActive && "border-gold glow-gold",
        !isActive && "border-border opacity-60",
        isLow && isActive && "border-destructive animate-pulse",
        isCritical && isActive && "bg-destructive/20 border-destructive"
      )}
    >
      <Clock className={cn(
        "w-6 h-6",
        isActive && "text-gold",
        isLow && isActive && "text-destructive"
      )} />
      <span className={cn(
        isActive && "text-foreground",
        !isActive && "text-muted-foreground",
        isLow && isActive && "text-destructive"
      )}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
};
