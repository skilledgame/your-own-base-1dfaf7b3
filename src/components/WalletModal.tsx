/**
 * WalletModal - Unified wallet modal for deposits, withdrawals, gifts, and redemptions
 * 
 * Appears as an overlay on top of the current page with 4 tabs.
 */

import { memo } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Gift, Ticket } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle 
} from '@/components/ui/dialog';
import { useWalletModal, WalletTab } from '@/contexts/WalletModalContext';
import { DepositTab } from '@/components/wallet/DepositTab';
import { WithdrawalTab } from '@/components/wallet/WithdrawalTab';
import { GiftTab } from '@/components/wallet/GiftTab';
import { RedeemTab } from '@/components/wallet/RedeemTab';
import { cn } from '@/lib/utils';

interface TabButtonProps {
  tab: WalletTab;
  activeTab: WalletTab;
  onClick: (tab: WalletTab) => void;
  icon: React.ReactNode;
  label: string;
}

const TabButton = memo(({ tab, activeTab, onClick, icon, label }: TabButtonProps) => {
  const isActive = tab === activeTab;
  
  return (
    <button
      onClick={() => onClick(tab)}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-2 rounded-lg font-medium text-xs transition-all whitespace-nowrap",
        isActive
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
          : "text-slate-400 hover:text-white hover:bg-slate-700/50"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
});

TabButton.displayName = 'TabButton';

export const WalletModal = memo(() => {
  const { isOpen, activeTab, closeWallet, setActiveTab } = useWalletModal();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeWallet()}>
      <DialogContent 
        className={cn(
          "max-w-md w-[95vw] sm:w-full",
          "bg-slate-900 border-slate-700/50",
          "rounded-2xl shadow-2xl shadow-black/50",
          "p-0 gap-0",
          "flex flex-col"
        )}
      >
        {/* Accessible title for screen readers */}
        <DialogTitle className="sr-only">Wallet</DialogTitle>
        
        {/* Header with Tabs */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            <TabButton
              tab="deposit"
              activeTab={activeTab}
              onClick={setActiveTab}
              icon={<ArrowUpRight className="w-4 h-4" />}
              label="Deposit"
            />
            <TabButton
              tab="withdrawal"
              activeTab={activeTab}
              onClick={setActiveTab}
              icon={<ArrowDownRight className="w-4 h-4" />}
              label="Withdraw"
            />
            <TabButton
              tab="gift"
              activeTab={activeTab}
              onClick={setActiveTab}
              icon={<Gift className="w-4 h-4" />}
              label="Gift"
            />
            <TabButton
              tab="redeem"
              activeTab={activeTab}
              onClick={setActiveTab}
              icon={<Ticket className="w-4 h-4" />}
              label="Redeem"
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0">
          {activeTab === 'deposit' && <DepositTab />}
          {activeTab === 'withdrawal' && <WithdrawalTab />}
          {activeTab === 'gift' && <GiftTab />}
          {activeTab === 'redeem' && <RedeemTab />}
        </div>
      </DialogContent>
    </Dialog>
  );
});

WalletModal.displayName = 'WalletModal';
