import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, X, Gamepad2, HelpCircle,
  FileText, Shield, Mail, Crown,
  LogOut, Moon, Sun, ChevronDown,
  Settings, Swords, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, SUPPORTED_LANGUAGES, stripLangPrefix } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface DesktopSideMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
  variant?: 'default' | 'dark' | 'black';
}

const gameSubItems = [
  { emoji: '♟️', translationKey: 'nav.chess', path: '/chess', isLive: true },
  { emoji: '🪿', translationKey: 'nav.coming_soon', path: '#', comingSoon: true },
  { emoji: '🦖', translationKey: 'nav.coming_soon', path: '#', comingSoon: true },
  { emoji: '🏓', translationKey: 'nav.coming_soon', path: '#', comingSoon: true },
];

export const DesktopSideMenu = ({ isOpen, onToggle, isCollapsed = false, onCollapseToggle, variant = 'default' }: DesktopSideMenuProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuth();
  const { t, lang, setLanguage, localePath } = useLanguage();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      return stored ? stored === 'dark' : true;
    }
    return true;
  });

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  const [gamesExpanded, setGamesExpanded] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [totalSCEarned, setTotalSCEarned] = useState(0);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onCollapseToggle !== undefined) {
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

  // Fetch total SC earned and subscribe to real-time updates
  useEffect(() => {
    const fetchTotal = async () => {
      const { data } = await supabase
        .from('games')
        .select('wager')
        .eq('status', 'finished')
        .not('winner_id', 'is', null);

      if (data) {
        const total = data.reduce((sum, g) => sum + (g.wager || 0) * 2, 0);
        setTotalSCEarned(total);
      }
    };

    fetchTotal();

    const channel = supabase
      .channel('total-sc-tracker')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
      }, (payload: any) => {
        if (payload.new?.status === 'finished' && payload.new?.winner_id && payload.old?.status !== 'finished') {
          setTotalSCEarned(prev => prev + (payload.new.wager || 0) * 2);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Close language dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    onToggle();
  };

  const currentPath = stripLangPrefix(location.pathname);

  const handleNavigation = (path: string) => {
    if (path === '#') return;
    if (path.includes('#')) {
      const [basePath, hash] = path.split('#');
      const target = basePath || '/';
      if (currentPath === target) {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate(localePath(target));
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      navigate(localePath(path));
    }
    onToggle();
  };

  const handleLanguageChange = (newLang: typeof lang) => {
    setLanguage(newLang);
    setLangDropdownOpen(false);
  };

  const currentLangName = SUPPORTED_LANGUAGES.find(l => l.code === lang)?.nativeName || 'English';

  const formattedTotal = new Intl.NumberFormat(
    lang === 'es' ? 'es-ES' : lang === 'hi' ? 'hi-IN' : 'en-US'
  ).format(totalSCEarned);

  const legalItems = [
    { icon: FileText, label: t('nav.terms'), path: '/terms' },
    { icon: Shield, label: t('nav.privacy'), path: '/privacy' },
    { icon: HelpCircle, label: t('nav.help'), path: '/#faq' },
    { icon: Mail, label: t('nav.contact'), path: '/contact' },
  ];

  const borderClass = variant === 'dark' || variant === 'black' ? 'border-white/5' : 'border-border';

  return (
    <TooltipProvider>
      <div
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          ${variant === 'dark'
            ? 'bg-[#0a0f1a]/80 backdrop-blur-xl border-r border-white/5'
            : variant === 'black'
              ? 'bg-background border-r border-white/5'
              : 'bg-card border-r border-border'}
          transition-all duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-16' : 'w-72'}
        `}
        style={{ transitionProperty: 'transform, width' }}
      >
        <div className={`flex flex-col h-full transition-all duration-300 ease-out ${collapsed ? 'w-16' : 'w-72'} overflow-hidden`}>
          {/* Header */}
          <div className={`flex items-center justify-start p-4 border-b ${borderClass}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCollapseToggle}
              className="hidden md:flex h-10 w-10"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onToggle} className="md:hidden">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Main Navigation */}
          <div className={`flex-1 py-4 relative ${collapsed ? 'overflow-hidden' : 'overflow-y-auto scrollbar-sidebar'}`}>

            {/* ===== EXPANDED VIEW ===== */}
            <div
              className={`absolute inset-0 py-4 transition-opacity duration-300 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              style={{ position: collapsed ? 'absolute' : 'relative' }}
            >
              {/* Menu Section */}
              <div className="px-3 mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3 whitespace-nowrap">
                  {t('nav.menu')}
                </p>
                <nav className="space-y-1">
                  {/* Games Dropdown */}
                  <div>
                    <button
                      onClick={() => setGamesExpanded(!gamesExpanded)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-colors duration-200 text-left whitespace-nowrap
                        ${gamesExpanded
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                      `}
                    >
                      <Gamepad2 className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{t('nav.games')}</span>
                      <ChevronDown
                        className={`w-4 h-4 ml-auto transition-transform duration-300 ${gamesExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Game Sub-items (expandable) */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-out ${gamesExpanded ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                      <div className="pl-4 pt-1 space-y-0.5">
                        {gameSubItems.map((game, idx) => {
                          const isActive = currentPath === game.path;
                          return (
                            <button
                              key={idx}
                              onClick={() => !game.comingSoon && handleNavigation(game.path)}
                              className={`
                                w-full flex items-center gap-3 px-3 py-2 rounded-lg
                                transition-colors duration-200 text-left whitespace-nowrap text-sm
                                ${game.comingSoon
                                  ? 'text-muted-foreground/50 cursor-default'
                                  : isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                              `}
                              disabled={game.comingSoon}
                            >
                              <span className="text-base flex-shrink-0">{game.emoji}</span>
                              <span className="font-medium">{t(game.translationKey)}</span>
                              {game.isLive && (
                                <span className="ml-auto flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  {t('games.live')}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Clan */}
                  <button
                    onClick={() => handleNavigation('/clan')}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-colors duration-200 text-left whitespace-nowrap
                      ${currentPath === '/clan'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                    `}
                  >
                    <Swords className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{t('nav.clan')}</span>
                  </button>
                </nav>
              </div>

              {/* Legal & Support */}
              <div className="px-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3 whitespace-nowrap">
                  {t('nav.legal')}
                </p>
                <nav className="space-y-1">
                  {legalItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-left text-muted-foreground hover:bg-muted hover:text-foreground whitespace-nowrap"
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Account */}
              <div className="px-3 mt-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3 whitespace-nowrap">
                  {t('nav.account')}
                </p>
                <nav className="space-y-1">
                  {isAuthenticated && (
                    <button
                      onClick={() => handleNavigation('/settings')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-left text-muted-foreground hover:bg-muted hover:text-foreground whitespace-nowrap"
                    >
                      <Settings className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{t('nav.settings')}</span>
                    </button>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {isDarkMode ? <Moon className="w-5 h-5 flex-shrink-0" /> : <Sun className="w-5 h-5 flex-shrink-0" />}
                      <span className="font-medium">{t('nav.dark_mode')}</span>
                    </div>
                    <Switch
                      checked={isDarkMode}
                      onCheckedChange={setIsDarkMode}
                    />
                  </div>
                </nav>
              </div>
            </div>

            {/* ===== COLLAPSED VIEW ===== */}
            <div
              className={`absolute inset-0 py-4 transition-opacity duration-300 ${collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              <div className="px-2 mb-6">
                <nav className="space-y-1">
                  {/* Games icon */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          handleCollapseToggle();
                          setGamesExpanded(true);
                        }}
                        className="w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Gamepad2 className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{t('nav.games')}</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Clan icon */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleNavigation('/clan')}
                        className={`
                          w-full flex items-center justify-center p-3 rounded-lg
                          transition-colors duration-200
                          ${currentPath === '/clan'
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                        `}
                      >
                        <Swords className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{t('nav.clan')}</p>
                    </TooltipContent>
                  </Tooltip>
                </nav>
              </div>

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

              <div className="px-2 mt-6">
                <nav className="space-y-1">
                  {isAuthenticated && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleNavigation('/settings')}
                          className="w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{t('nav.settings')}</p>
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
                        <span>{t('nav.dark_mode')}</span>
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
            </div>
          </div>

          {/* Footer: Language, Total SC, Sign Out */}
          <div className={`border-t ${borderClass}`}>
            {/* Language Selector & Total SC — only in expanded mode */}
            {!collapsed && (
              <div className="px-3 pt-3 pb-2 space-y-2">
                {/* Language Selector */}
                <div ref={langDropdownRef} className="relative">
                  <button
                    onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors duration-200 text-left"
                  >
                    <Globe className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="font-semibold text-foreground">{currentLangName}</span>
                    <ChevronDown
                      className={`w-4 h-4 ml-auto text-muted-foreground transition-transform duration-200 ${langDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Language Dropdown (opens downward) */}
                  {langDropdownOpen && (
                    <div className="mt-1 w-full rounded-xl bg-card border border-border shadow-lg overflow-hidden z-50">
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => handleLanguageChange(l.code)}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150
                            ${l.code === lang
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                          `}
                        >
                          <span className="font-medium">{l.nativeName}</span>
                          {l.code === lang && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total SC Earned */}
                <div className="rounded-xl bg-[#0d0f1a] border border-white/5 px-4 py-3">
                  <p className="text-xs font-semibold text-primary/70 uppercase tracking-wider mb-1">
                    {t('nav.total_sc_earned')}
                  </p>
                  <p className="text-lg font-bold text-foreground tracking-wide">
                    {formattedTotal}
                  </p>
                </div>
              </div>
            )}

            {/* Collapsed: language icon */}
            {collapsed && (
              <div className="px-2 pt-2 pb-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        handleCollapseToggle();
                        setLangDropdownOpen(true);
                      }}
                      className="w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Globe className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{currentLangName}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Sign Out / Get Started */}
            <div className="p-4">
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
                      <p>{t('nav.sign_out')}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    {t('nav.sign_out')}
                  </Button>
                )
              ) : (
                collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className="w-full bg-primary text-primary-foreground"
                        onClick={() => { navigate(localePath('/auth')); onToggle(); }}
                      >
                        <Crown className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{t('nav.get_started')}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    className="w-full bg-primary text-primary-foreground"
                    onClick={() => { navigate(localePath('/auth')); onToggle(); }}
                  >
                    {t('nav.get_started')}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
