/**
 * BalanceDepositPill Component
 * 
 * Combined balance display and deposit button in a single pill-shaped container.
 * Opens the wallet modal instead of navigating to a separate page.
 */

import { memo } from 'react';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useBalance } from '@/hooks/useBalance';
import { useWalletModal } from '@/contexts/WalletModalContext';

interface BalanceDepositPillProps {
  className?: string;
  isPrivileged?: boolean;
}

export const BalanceDepositPill = memo(({
  className,
  isPrivileged = false,
}: BalanceDepositPillProps) => {
  const { balance, isLoading, isReady } = useBalance();
  const { openWallet } = useWalletModal();
  
  return (
    <div
      className={cn(
        "flex items-center",
        "bg-slate-800/80 backdrop-blur-sm",
        "border border-slate-600/40",
        "rounded-xl overflow-hidden",
        "shadow-lg shadow-black/10",
        className
      )}
    >
      {/* Balance Section - Left side */}
      <button 
        onClick={() => openWallet('deposit')}
        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/5 transition-colors"
      >
        {/* Coin icon - simple colored icon */}
        <Coins className="w-5 h-5 text-yellow-400" />
        
        {/* Balance amount */}
        {isLoading && !isReady ? (
          <Skeleton className="h-4 w-14 bg-slate-600" />
        ) : (
          <span className="font-semibold text-white">
            {balance.toLocaleString()}
          </span>
        )}
      </button>
      
      {/* Deposit Button - Right side */}
      <button
        onClick={() => openWallet('deposit')}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 transition-all font-semibold text-white text-sm"
      >
        Deposit
      </button>
    </div>
  );
});

BalanceDepositPill.displayName = 'BalanceDepositPill';
