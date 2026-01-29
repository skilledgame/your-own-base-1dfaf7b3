/**
 * Deposit Page - Auto-opens the wallet modal
 * 
 * This page now simply opens the wallet modal with the deposit tab
 * and redirects to the home page so the modal appears over the homepage.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletModal } from '@/contexts/WalletModalContext';

export default function Deposit() {
  const navigate = useNavigate();
  const { openWallet } = useWalletModal();

  useEffect(() => {
    // Open the wallet modal with deposit tab
    openWallet('deposit');
    // Navigate to home so the modal appears over the homepage
    navigate('/', { replace: true });
  }, [openWallet, navigate]);

  return null;
}
