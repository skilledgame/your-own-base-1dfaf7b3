/**
 * WalletModalContext - Global state for the wallet modal
 * 
 * Allows opening the wallet modal from anywhere in the app
 * with a specific tab pre-selected.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type WalletTab = 'deposit' | 'withdrawal' | 'gift' | 'redeem';

interface WalletModalContextType {
  isOpen: boolean;
  activeTab: WalletTab;
  openWallet: (tab?: WalletTab) => void;
  closeWallet: () => void;
  setActiveTab: (tab: WalletTab) => void;
}

const WalletModalContext = createContext<WalletModalContextType | undefined>(undefined);

interface WalletModalProviderProps {
  children: ReactNode;
}

export function WalletModalProvider({ children }: WalletModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WalletTab>('deposit');

  const openWallet = useCallback((tab: WalletTab = 'deposit') => {
    setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closeWallet = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <WalletModalContext.Provider
      value={{
        isOpen,
        activeTab,
        openWallet,
        closeWallet,
        setActiveTab,
      }}
    >
      {children}
    </WalletModalContext.Provider>
  );
}

export function useWalletModal() {
  const context = useContext(WalletModalContext);
  if (context === undefined) {
    throw new Error('useWalletModal must be used within a WalletModalProvider');
  }
  return context;
}
