import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Home, Gamepad2, HelpCircle, 
  FileText, Shield, Mail, Crown, Trophy, Coins,
  LogOut, ChevronRight, Moon, Sun, User, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useAuth } from '@/contexts/AuthContext';

interface DesktopSideMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
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

export const DesktopSideMenu = ({ isOpen, onToggle, isCollapsed = false, onCollapseToggle }: DesktopSideMenuProps) => {
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

  // Load collapsed state from localStorage - default to collapsed (icon-only)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarCollapsed');
      // Default to collapsed if no preference stored
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  // Sync with prop if provided
  useEffect(() => {
    if (onCollapseToggle !== undefined) {
      // Controlled mode - use prop
      setCollapsed(isCollapsed);
    }
  }, [isCollapsed, onCollapseToggle]);

  const handleCollapseToggle = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem('sidebarCollapsed', String(newCollapsed));
    if (onCollapseToggle) {
      onCollapseToggle();
    }
  };

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

  const sidebarWidth = collapsed ? 'w-16' : 'w-72';

  return (
    <TooltipProvider>
      {/* Side Menu - Works on both mobile and desktop */}
      <div
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          bg-card border-r border-border
          transition-all duration-300 ease-out
          ${isOpen ? `${sidebarWidth} translate-x-0` : 'w-0 -translate-x-full md:w-0'}
        `}
      >
        {isOpen && (
          <div className={`flex flex-col h-full ${collapsed ? 'w-16 overflow-hidden' : 'w-72 overflow-hidden'}`}>
            {/* Header */}
            <div className="flex items-center justify-start p-4 border-b border-border">
              {/* Desktop: Hamburger menu to toggle collapsed state - stays fixed position */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleCollapseToggle}
                className="hidden md:flex h-10 w-10"
              >
                <Menu className="h-5 w-5" />
              </Button>
              {/* Mobile: X to close completely */}
              <Button variant="ghost" size="icon" onClick={onToggle} className="md:hidden">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Main Navigation */}
            <div className={`flex-1 py-4 ${collapsed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              {!collapsed && (
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
              )}

              {collapsed && (
                <div className="px-2 mb-6">
                  <nav className="space-y-1">
                    {menuItems.map((item) => {
                      const isActive = location.pathname === item.path || 
                        (item.path === '/' && location.pathname === '/');
                      return (
                        <Tooltip key={item.path}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleNavigation(item.path)}
                              className={`
                                w-full flex items-center justify-center p-3 rounded-lg
                                transition-colors duration-200
                                ${isActive 
                                  ? 'bg-primary/10 text-primary' 
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                              `}
                            >
                              <item.icon className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>{item.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </nav>
                </div>
              )}

              {!collapsed && (
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
              )}

              {collapsed && (
                <div className="px-2">
                  <nav className="space-y-1">
                    {legalItems.map((item) => (
                      <Tooltip key={item.path}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleNavigation(item.path)}
                            className="w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <item.icon className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </nav>
                </div>
              )}

              {/* Settings Section */}
              {!collapsed && (
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
              )}

              {collapsed && (
                <div className="px-2 mt-6">
                  <nav className="space-y-1">
                    {isAuthenticated && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleNavigation('/profile')}
                            className="w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <User className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>Account Settings</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center p-3 rounded-lg text-muted-foreground">
                          {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="flex items-center gap-2">
                          <span>Dark Mode</span>
                          <Switch
                            checked={isDarkMode}
                            onCheckedChange={setIsDarkMode}
                            className="ml-2"
                          />
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </nav>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              {isAuthenticated ? (
                collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleSignOut}
                      >
                        <LogOut className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Sign Out</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                  </Button>
                )
              ) : (
                collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="icon"
                        className="w-full bg-primary text-primary-foreground"
                        onClick={() => { navigate('/auth'); onToggle(); }}
                      >
                        <Crown className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Get Started</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button 
                    className="w-full bg-primary text-primary-foreground"
                    onClick={() => { navigate('/auth'); onToggle(); }}
                  >
                    Get Started
                  </Button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

