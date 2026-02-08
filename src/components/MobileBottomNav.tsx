import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Home, Wallet, BarChart3, User } from 'lucide-react';
import { MobileFullScreenMenu } from './MobileFullScreenMenu';
import { MobileProfileSheet } from './MobileProfileSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletModal } from '@/contexts/WalletModalContext';

interface MobileBottomNavProps {
  onMenuClick?: () => void;
}

const navItems = [
  { icon: Menu, label: 'Menu', path: null, isMenu: true, isProfile: false, isHome: false, isWallet: false },
  { icon: Wallet, label: 'Wallet', path: null, isMenu: false, isProfile: false, isHome: false, isWallet: true },
  { icon: Home, label: 'Home', path: null, isMenu: false, isProfile: false, isHome: true, isWallet: false },
  { icon: BarChart3, label: 'Stats', path: '/stats', isMenu: false, isProfile: false, isHome: false, isWallet: false },
  { icon: User, label: 'Profile', path: null, isMenu: false, isProfile: true, isHome: false, isWallet: false },
];

export const MobileBottomNav = ({ onMenuClick }: MobileBottomNavProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { openWallet } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleMenuClick = () => {
    setMenuOpen(true);
  };

  const handleProfileClick = () => {
    if (isAuthenticated) {
      setProfileOpen(true);
    } else {
      window.location.href = '/auth';
    }
  };

  const handleHomeClick = () => {
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  const handleWalletClick = () => {
    openWallet('deposit');
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item, index) => {
            const isActive = item.path ? location.pathname === item.path : false;
            
            if (item.isMenu) {
              return (
                <button
                  key={index}
                  onClick={handleMenuClick}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 text-muted-foreground active:text-primary"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            }

            if (item.isProfile) {
              return (
                <button
                  key={index}
                  onClick={handleProfileClick}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 text-muted-foreground active:text-primary"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            }

            if (item.isHome) {
              return (
                <button
                  key={index}
                  onClick={handleHomeClick}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 ${location.pathname === '/' ? 'text-primary' : 'text-muted-foreground'} active:text-primary`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            }

            if (item.isWallet) {
              return (
                <button
                  key={index}
                  onClick={handleWalletClick}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 text-muted-foreground active:text-primary"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            }
            
            return (
              <Link
                key={item.path}
                to={item.path!}
                className={`
                  flex flex-col items-center justify-center gap-0.5 flex-1 h-full
                  transition-colors duration-200
                  ${isActive ? 'text-primary' : 'text-muted-foreground'}
                `}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Full screen menu */}
      <MobileFullScreenMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Profile sheet */}
      <MobileProfileSheet isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
};
