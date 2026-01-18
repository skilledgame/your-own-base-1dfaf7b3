import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Home, Gamepad2, HelpCircle, 
  FileText, Shield, Mail, Crown, Trophy, Coins,
  LogOut, ChevronRight, Moon, Sun, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LogoLink } from './LogoLink';
import { useAuth } from '@/contexts/AuthContext';

interface DesktopSideMenuProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Gamepad2, label: 'Games', path: '/#games' },
  { icon: Crown, label: 'Play Chess', path: '/games/chess' },
  { icon: Trophy, label: 'How It Works', path: '/how-it-works' },
  { icon: Coins, label: 'Deposit', path: '/deposit' },
];

const legalItems = [
  { icon: FileText, label: 'Terms & Conditions', path: '/terms' },
  { icon: Shield, label: 'Privacy Policy', path: '/privacy' },
  { icon: HelpCircle, label: 'Help & FAQ', path: '/#faq' },
  { icon: Mail, label: 'Contact Us', path: '/contact' },
];

export const DesktopSideMenu = ({ isOpen, onToggle }: DesktopSideMenuProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Use centralized auth context (no duplicate listeners!)
  const { user, isAuthenticated, signOut } = useAuth();
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      // Default to dark if no preference stored
      return stored ? stored === 'dark' : true;
    }
    return true;
  });

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
    onToggle();
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
    onToggle();
  };

  return (
    <>
      {/* Side Menu - Works on both mobile and desktop */}
      <div
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          bg-card border-r border-border
          transition-all duration-300 ease-out
          ${isOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:w-0'}
        `}
      >
        {isOpen && (
          <div className="flex flex-col h-full w-72 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <LogoLink className="h-8" onClick={onToggle} />
              <Button variant="ghost" size="icon" onClick={onToggle}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Main Navigation */}
            <div className="flex-1 overflow-y-auto py-4">
              <div className="px-3 mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
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
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
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

              <div className="px-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
                  Legal & Support
                </p>
                <nav className="space-y-1">
                  {legalItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Settings Section */}
              <div className="px-3 mt-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
                  Settings
                </p>
                <nav className="space-y-1">
                  {isAuthenticated && (
                    <button
                      onClick={() => handleNavigation('/profile')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <User className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">Account Settings</span>
                    </button>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-muted-foreground">
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

            {/* Footer */}
            <div className="p-4 border-t border-border">
              {isAuthenticated ? (
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Sign Out
                </Button>
              ) : (
                <Button 
                  className="w-full bg-primary text-primary-foreground"
                  onClick={() => { navigate('/auth'); onToggle(); }}
                >
                  Get Started
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export const SideMenuTrigger = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={onClick}
      className="hidden md:flex h-10 w-10"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
};
