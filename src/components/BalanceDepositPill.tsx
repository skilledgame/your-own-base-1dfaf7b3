/**
 * BalanceDepositPill Component
 * 
 * Combined balance display and deposit button in a single pill-shaped container.
 * Inspired by crypto wallet UI patterns - shows balance on left, deposit CTA on right.
 */

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Infinity, ChevronDown, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useBalance } from '@/hooks/useBalance';

interface BalanceDepositPillProps {
  className?: string;
  isPrivileged?: boolean;
}

export const BalanceDepositPill = memo(({
  className,
  isPrivileged = false,
}: BalanceDepositPillProps) => {
  const { balance, isLoading, isReady } = useBalance();
  
  return (
    <div
      className={cn(
        "flex items-center rounded-full overflow-hidden",
        "bg-gradient-to-r from-slate-800/90 to-slate-700/90",
        "border border-slate-600/50 shadow-lg shadow-black/20",
        "backdrop-blur-sm",
        className
      )}
    >
      {/* Balance Section - Left side */}
      <Link 
        to="/deposit"
        className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        {/* Coin icon with glow effect */}
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-500/30 rounded-full blur-sm" />
          <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-inner">
            <Coins className="w-4 h-4 text-yellow-900" />
          </div>
        </div>
        
        {/* Balance amount */}
        {isPrivileged ? (
          <span className="font-bold text-white text-sm">∞</span>
        ) : isLoading && !isReady ? (
          <Skeleton className="h-4 w-12 bg-slate-600" />
        ) : (
          <span className="font-bold text-white text-sm">
            {balance.toLocaleString()}
          </span>
        )}
        
        {/* Dropdown indicator */}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </Link>
      
      {/* Divider */}
      <div className="w-px h-6 bg-slate-600/50" />
      
      {/* Deposit Button - Right side */}
      <Link
        to="/deposit"
        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 transition-all font-semibold text-white text-sm"
      >
        <Wallet className="w-4 h-4" />
        Deposit
      </Link>
    </div>
  );
});

BalanceDepositPill.displayName = 'BalanceDepositPill';
