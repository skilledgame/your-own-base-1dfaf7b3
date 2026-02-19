import { cn } from '@/lib/utils';
import { Coins } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TokenBalanceProps {
  /** The Skilled Coins balance to display. null = loading state */
  balance: number | null;
  wager?: number;
  showWager?: boolean;
  className?: string;
  animate?: boolean;
  isPrivileged?: boolean;
  /** Show loading skeleton when balance is null */
  isLoading?: boolean;
}

/**
 * TokenBalance - Displays Skilled Coins balance
 * 
 * IMPORTANT: Never shows 0 while loading. If balance is null or isLoading is true,
 * shows a skeleton placeholder.
 */
export const TokenBalance = ({ 
  balance, 
  wager, 
  showWager, 
  className, 
  animate, 
  isPrivileged,
  isLoading,
}: TokenBalanceProps) => {
  const showSkeleton = isLoading || balance === null;
  
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border",
          animate && "animate-bounce-in",
        )}
      >
        {showSkeleton ? (
          <>
            <Coins className="w-5 h-5 text-yellow-500/50" />
            <Skeleton className="h-6 w-16" />
          </>
        ) : (
          <>
            <Coins className="w-5 h-5 text-gold" />
            <span className="font-semibold text-lg text-foreground">
              {(balance ?? 0).toLocaleString()}
            </span>
          </>
        )}
      </div>
      
      {showWager && wager !== undefined && !isPrivileged && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Wagered:</span>
          <span className="font-bold text-gold">{wager}</span>
        </div>
      )}
    </div>
  );
};
