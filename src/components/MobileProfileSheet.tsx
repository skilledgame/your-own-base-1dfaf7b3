/**
 * MobileProfileSheet - Profile options sheet for mobile bottom nav
 * 
 * FIXED: Now uses centralized userDataStore instead of direct Supabase calls
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletModal } from '@/contexts/WalletModalContext';
import { useUserDataStore } from '@/stores/userDataStore';
import { 
  Wallet, Settings, 
  Trophy, History, Users, LogOut, BarChart3, X
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface MobileProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileProfileSheet = ({ isOpen, onClose }: MobileProfileSheetProps) => {
  const { user, isAuthenticated, signOut } = useAuth();
  const { openWallet } = useWalletModal();
  const navigate = useNavigate();
  
  const displayName = useUserDataStore(state => state.profile?.display_name ?? null);
  const skinColor = useUserDataStore(state => state.profile?.skin_color ?? 'normal');
  const skinIcon = useUserDataStore(state => state.profile?.skin_icon ?? 'cat');
  const loading = useUserDataStore(state => state.loading);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  const handleSignOut = async () => {
    await signOut();
    onClose();
    navigate('/');
  };

  const handleOpenCashier = () => {
    onClose();
    openWallet('deposit');
  };

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };
  
  const name = displayName || user?.email?.split('@')[0] || 'User';
  // Note: 'loading' from store indicates initial load, not per-component fetch

  // Show nothing if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  const menuItems = [
    { icon: Wallet, label: 'Wallet', onClick: handleOpenCashier, color: 'text-emerald-400' },
    { icon: Trophy, label: 'Ranks', path: '/vip', color: 'text-yellow-400' },
    { icon: BarChart3, label: 'Stats', path: '/stats', color: 'text-blue-400' },
    { icon: History, label: 'Game History', path: '/game-history', color: 'text-orange-400' },
    { icon: Users, label: 'Refer & Earn', path: '/affiliate', color: 'text-red-400' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`
          md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />
      
      {/* Sheet sliding up from bottom */}
      <div
        className={`
          md:hidden fixed inset-x-0 bottom-0 z-[70]
          bg-card rounded-t-3xl
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <PlayerAvatar skinColor={skinColor} skinIcon={skinIcon} size="md" />
            
            {/* Username */}
            {loading ? (
              <Skeleton className="h-5 w-24 bg-slate-600" />
            ) : (
              <span className="font-semibold text-foreground text-lg">
                {name}
              </span>
            )}
          </div>
          
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Menu items */}
        <div className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 200px)' }}>
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => item.onClick ? item.onClick() : handleNavigate(item.path!)}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors duration-200 text-left hover:bg-muted"
            >
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-foreground font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Account Settings - separated */}
        <div className="px-4 py-2 border-t border-border">
          <button
            onClick={() => handleNavigate('/settings')}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors duration-200 text-left hover:bg-muted"
          >
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="text-foreground font-medium">Account Settings</span>
          </button>
        </div>

        {/* Logout */}
        <div className="px-4 pb-4 pt-2 border-t border-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors duration-200 text-left hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5 text-destructive" />
            <span className="text-destructive font-medium">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};
