import { cn } from '@/lib/utils';
import { Coins, Infinity } from 'lucide-react';

interface TokenBalanceProps {
  balance: number;
  wager?: number;
  showWager?: boolean;
  className?: string;
  animate?: boolean;
  isPrivileged?: boolean;
}

export const TokenBalance = ({ balance, wager, showWager, className, animate, isPrivileged }: TokenBalanceProps) => {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border",
          animate && "animate-bounce-in",
          isPrivileged && "border-primary bg-primary/10"
        )}
      >
        {isPrivileged ? (
          <>
            <Infinity className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg text-primary">∞</span>
          </>
        ) : (
          <>
            <Coins className="w-5 h-5 text-gold" />
            <span className="font-semibold text-lg text-foreground">
              {balance.toLocaleString()}
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