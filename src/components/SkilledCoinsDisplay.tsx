/**
 * SkilledCoinsDisplay Component
 * 
 * Displays Skilled Coins balance with proper loading states.
 * NEVER shows 0 while loading - uses skeleton or last known value.
 */

import { memo } from 'react';
import { Coins, Infinity, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useBalance } from '@/hooks/useBalance';

interface SkilledCoinsDisplayProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  isPrivileged?: boolean;
  animate?: boolean;
}

export const SkilledCoinsDisplay = memo(({
  className,
  size = 'md',
  showLabel = false,
  isPrivileged = false,
  animate = false,
}: SkilledCoinsDisplayProps) => {
  const { balance, isLoading, isReady } = useBalance();
  
  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-3 py-2',
    lg: 'text-lg px-4 py-2',
  };
  
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };
  
  // Privileged users show infinity
  if (isPrivileged) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30",
          sizeClasses[size],
          animate && "animate-bounce-in",
          className
        )}
      >
        <Infinity className={cn(iconSizes[size], "text-primary")} />
        <span className="font-semibold text-primary">∞</span>
        {showLabel && <span className="text-primary/70">Skilled Coins</span>}
      </div>
    );
  }
  
  // Loading state - show skeleton or last known value
  if (isLoading && !isReady) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full bg-secondary border border-border",
          sizeClasses[size],
          className
        )}
      >
        <Coins className={cn(iconSizes[size], "text-yellow-500/50")} />
        <Skeleton className="h-5 w-12" />
      </div>
    );
  }
  
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full bg-secondary border border-border",
        sizeClasses[size],
        animate && "animate-bounce-in",
        className
      )}
    >
      <Coins className={cn(iconSizes[size], "text-yellow-500")} />
      <span className="font-semibold text-foreground">
        {balance.toLocaleString()}
      </span>
      {showLabel && <span className="text-muted-foreground">Skilled Coins</span>}
    </div>
  );
});

SkilledCoinsDisplay.displayName = 'SkilledCoinsDisplay';
