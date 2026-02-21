/**
 * MobileFullScreenMenu - Full screen menu that slides up from bottom (mobile only)
 */

import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  X, Home, Gamepad2, HelpCircle, 
  FileText, Shield, Mail, Crown, Trophy, Coins,
  LogOut, ChevronRight, Moon, Sun, BarChart3, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useState } from 'react';

interface MobileFullScreenMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Gamepad2, label: 'Games', path: '/#games' },
  { icon: Crown, label: 'Play Chess', path: '/chess' },
  { icon: Trophy, label: 'How It Works', path: '/how-it-works' },
  { icon: Coins, label: 'Deposit', path: '/deposit' },
];

const legalItems = [
  { icon: FileText, label: 'Terms & Conditions', path: '/terms' },
  { icon: Shield, label: 'Privacy Policy', path: '/privacy' },
  { icon: HelpCircle, label: 'Help & FAQ', path: '/#faq' },
  { icon: Mail, label: 'Contact Us', path: '/contact' },
];

export const MobileFullScreenMenu = ({ isOpen, onClose }: MobileFullScreenMenuProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuth();
  const { openAuthModal } = useAuthModal();
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      return stored ? stored === 'dark' : true;
    }
    return true;
  });

  // Prevent body scroll when menu is open
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

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const handleNavigation = (path: string) => {
    if (path.includes('#')) {
      const [basePath, hash] = path.split('#');
      if (location.pathname === basePath || basePath === '/') {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate(basePath);
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      navigate(path);
    }
    onClose();
  };

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
      
      {/* Full screen menu sliding up from bottom */}
      <div
        className={`
          md:hidden fixed inset-x-0 bottom-0 top-0 z-[70]
          bg-card
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="text-lg font-semibold text-foreground">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-20" style={{ height: 'calc(100vh - 140px)' }}>
          {/* Main Navigation */}
          <div className="px-4 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Menu
            </p>
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path === '/' && location.pathname === '/');
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-3 rounded-xl
                      transition-colors duration-200 text-left
                      ${isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                    `}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                    <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Legal & Support */}
          <div className="px-4 py-4 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Legal & Support
            </p>
            <nav className="space-y-1">
              {legalItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors duration-200 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Account section */}
          <div className="px-4 py-4 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Account
            </p>
            <nav className="space-y-1">
              {isAuthenticated && (
                <>
                  <button
                    onClick={() => handleNavigation('/stats')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors duration-200 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <BarChart3 className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Stats</span>
                  </button>
                  <button
                    onClick={() => handleNavigation('/settings')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors duration-200 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Settings className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Settings</span>
                  </button>
                </>
              )}
              <div className="flex items-center justify-between px-3 py-3 rounded-xl text-muted-foreground">
                <div className="flex items-center gap-3">
                  {isDarkMode ? <Moon className="w-5 h-5 flex-shrink-0" /> : <Sun className="w-5 h-5 flex-shrink-0" />}
                  <span className="font-medium">Dark Mode</span>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={setIsDarkMode}
                />
              </div>
            </nav>
          </div>
        </div>

        {/* Footer with auth action */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
          {isAuthenticated ? (
            <Button 
              variant="ghost" 
              className="w-full justify-center text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </Button>
          ) : (
            <Button 
              className="w-full bg-primary text-primary-foreground"
              onClick={() => { openAuthModal('sign-up'); onClose(); }}
            >
              Get Started
            </Button>
          )}
        </div>
      </div>
    </>
  );
};
