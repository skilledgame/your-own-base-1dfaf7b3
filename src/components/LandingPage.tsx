import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Loader2, Shield, Lock, Zap, Crown, ArrowRight, ChevronDown, Gamepad2, Coins, Wallet, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { useWalletModal } from '@/contexts/WalletModalContext';
import skilledLogo from '@/assets/skilled-logo.png';
import { LogoLink } from './LogoLink';
import { GameCategory } from './GameCategory';
import { DesktopSideMenu } from './DesktopSideMenu';
import { MobileBottomNav } from './MobileBottomNav';
import { CryptoSection } from './CryptoSection';
import { FAQSection } from './FAQSection';
import { GuestLoginPrompt } from './GuestLoginPrompt';
import { InviteBanner } from './InviteBanner';
import { LiveWins } from './LiveWins';
import { WeeklyLeaderboard } from './WeeklyLeaderboard';
import { UserDropdown } from './UserDropdown';
import { SkilledCoinsDisplay } from './SkilledCoinsDisplay';
import { BalanceDepositPill } from './BalanceDepositPill';
import { NotificationDropdown } from './NotificationDropdown';

import { VIPProgressSection } from './VIPProgressSection';

interface LandingPageProps {
  onJoinGame: (playerName: string) => void;
  isSearching: boolean;
}

// Game data - Only Skilled Originals with Chess + 3 coming soon (muted colors)
const skilledOriginals = [{
  name: 'Chess',
  image: '♟️',
  gradientFrom: '#1e3a5f',
  gradientTo: '#0d1b2a',
  isLive: true,
  showName: true
}, {
  name: '',
  image: '🪿',
  gradientFrom: '#6b5c5c',
  gradientTo: '#4a3f3f',
  comingSoon: true,
  showName: false
}, {
  name: '',
  image: '🦖',
  gradientFrom: '#4a6b5c',
  gradientTo: '#3a5248',
  comingSoon: true,
  showName: false
}, {
  name: '',
  image: '🏓',
  gradientFrom: '#6b5a4a',
  gradientTo: '#524638',
  comingSoon: true,
  showName: false
}];

// Mobile balance pill that opens wallet modal
const MobileBalancePill = ({ isPrivileged }: { isPrivileged: boolean }) => {
  const { openWallet } = useWalletModal();
  
  return (
    <div className="sm:hidden">
      <button onClick={() => openWallet('deposit')}>
        <SkilledCoinsDisplay size="sm" isPrivileged={isPrivileged} />
      </button>
    </div>
  );
};

export const LandingPage = ({
  onJoinGame,
  isSearching
}: LandingPageProps) => {
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  // Desktop: always open, just toggle collapsed state. Mobile: can close completely.
  const [sideMenuOpen, setSideMenuOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      // Default open on desktop (md breakpoint = 768px)
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarCollapsed');
      // Default to collapsed (icon-only) on desktop
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });
  const navigate = useNavigate();
  
  // Use centralized auth context (no duplicate listeners!)
  const { user, isAuthenticated, isPrivileged } = useAuth();
  
  // Use centralized balance hook
  const { balance, isLoading: balanceLoading } = useBalance();
  
  // Initialize dark mode on mount - default to dark
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const shouldBeDark = stored ? stored === 'dark' : true;
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
      if (!stored) localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handlePlayClick = () => {
    if (showNameInput && playerName.trim()) {
      onJoinGame(playerName.trim());
    } else {
      setShowNameInput(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && playerName.trim()) {
      onJoinGame(playerName.trim());
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  const handleGameClick = (gameName: string) => {
    // Chess has its own dedicated game mode selection page
    if (gameName === 'Chess') {
      navigate('/chess');
      return;
    }
    
    const slugMap: Record<string, string> = {
      'Checkers': 'checkers',
      'Reversi': 'reversi',
      'Go': 'go',
      'Backgammon': 'backgammon',
      'Flappy Bird': 'flappy-bird',
      'Snake': 'snake',
      'Tetris': 'tetris',
      'Pong': 'pong',
      'Breakout': 'breakout',
      'Trivia': 'trivia',
      'Speed Math': 'speed-math',
      'Memory': 'memory',
      'Reaction': 'reaction',
      'Typing Race': 'typing-race'
    };
    const slug = slugMap[gameName] || gameName.toLowerCase().replace(/\s+/g, '-');
    navigate(`/games/${slug}`);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-16 md:pb-0">
      {/* Desktop Side Menu */}
      <DesktopSideMenu 
        isOpen={sideMenuOpen} 
        onToggle={() => setSideMenuOpen(!sideMenuOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Overlay for mobile only */}
      {sideMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      {/* Main content wrapper - pushes right on desktop when menu opens */}
      <div 
        className={`
          transition-all duration-300 ease-out
          ${sideMenuOpen ? (sidebarCollapsed ? 'md:ml-16' : 'md:ml-72') : 'md:ml-0'}
        `}
      >
        {/* Header */}
        <header 
          className={`
            fixed top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50
            transition-all duration-300 ease-out
            ${sideMenuOpen ? (sidebarCollapsed ? 'md:left-16 left-0 right-0' : 'md:left-72 left-0 right-0') : 'left-0 right-0'}
          `}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
            {/* Left: Logo */}
            <div className="flex items-center">
              <LogoLink className="h-12 sm:h-14" />
            </div>

            {/* Center: Balance + Deposit (only when authenticated) */}
            {isAuthenticated && (
              <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2">
                <BalanceDepositPill isPrivileged={isPrivileged} />
              </div>
            )}

            {/* Right: Auth/User controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isAuthenticated ? (
                <>
                  {isPrivileged && (
                    <Button variant="ghost" size="sm" asChild className="hidden sm:flex text-purple-400 hover:text-purple-300 hover:bg-purple-500/10">
                      <Link to="/admin">
                        <Shield className="w-4 h-4 mr-1" />
                        Admin
                      </Link>
                    </Button>
                  )}
                  {/* Search icon */}
                  <Button variant="ghost" size="icon" asChild className="hidden sm:flex text-muted-foreground hover:text-foreground">
                    <Link to="/search">
                      <Search className="w-5 h-5" />
                    </Link>
                  </Button>
                  {/* Notification bell */}
                  <div className="hidden sm:flex">
                    <NotificationDropdown />
                  </div>
                  {/* User dropdown with username and menu */}
                  <div className="hidden sm:flex items-center">
                    <UserDropdown />
                  </div>
                  {/* Mobile: Show balance pill */}
                  <MobileBalancePill isPrivileged={isPrivileged} />
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/search">
                      <Search className="w-5 h-5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" asChild className="hidden sm:flex text-muted-foreground hover:text-foreground">
                    <Link to="/auth">Sign In</Link>
                  </Button>
                  <Button asChild className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0 font-semibold">
                    <Link to="/auth">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Invite Banner - Moved to top */}
        <InviteBanner />

        {/* VIP Progress Section - Only for logged-in users */}
        {isAuthenticated && <VIPProgressSection />}

        {/* Hero Section - Only for non-logged-in users */}
        {!isAuthenticated && (
          <section className="relative pt-24 pb-16 overflow-hidden">
            {/* Subtle dark background with pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '32px 32px'
            }} />
            
            {/* Subtle glow accents */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
                {/* Left Content */}
                <div className="flex-1 text-center lg:text-left">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-white leading-tight">
                    Win Real Money
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                      With Your Skills
                    </span>
                  </h1>

                  <p className="text-lg text-slate-400 max-w-md mb-8">
                    Not gambling. Beat real opponents in skill-based games and cash out your winnings. Your skill = your earnings.
                  </p>

                  {/* CTA Buttons */}
                  <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4">
                    <Button 
                      size="lg" 
                      onClick={() => navigate('/auth')} 
                      className="h-14 px-8 text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      Register
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-sm">Or</span>
                      <div className="flex items-center gap-2 bg-slate-800/80 rounded-full p-1.5 border border-slate-700">
                        <button 
                          onClick={async () => {
                            const { error } = await supabase.auth.signInWithOAuth({
                              provider: 'google',
                              options: { redirectTo: `${window.location.origin}/` }
                            });
                            if (error) console.error('Google sign in error:', error);
                          }} 
                          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-700 transition-colors"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right - Chess Game Card with tilt effect */}
                <div className="flex-shrink-0 relative">
                  <div 
                    onClick={() => navigate('/chess')} 
                    className="relative cursor-pointer group"
                    style={{ transform: 'perspective(1000px) rotateY(-8deg) rotateX(4deg)' }}
                  >
                    {/* Card glow */}
                    <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
                    
                    {/* Main card */}
                    <div 
                      className="relative w-72 sm:w-80 h-96 sm:h-[420px] rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl group-hover:scale-[1.02] transition-transform duration-300"
                      style={{ background: 'linear-gradient(145deg, #1e3a5f, #0f2744)' }}
                    >
                      {/* Chess pattern overlay */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="grid grid-cols-4 h-full">
                          {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} className={`${i % 2 === (Math.floor(i / 4) % 2) ? 'bg-white' : 'bg-transparent'}`} />
                          ))}
                        </div>
                      </div>
                      
                      {/* Chess piece */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[140px] sm:text-[160px] drop-shadow-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2">
                          ♟️
                        </span>
                      </div>
                      
                      {/* Bottom gradient and label */}
                      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-cyan-900/90 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">♟️</span>
                          <span className="text-white font-bold text-xl">Chess</span>
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
                      </div>
                      
                      {/* Live badge */}
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-emerald-500/90 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Games Section */}
        <section id="games" className="py-12 px-0 sm:px-4">
          <div className="max-w-7xl mx-auto">
            <GameCategory title="Skilled Originals" icon="flame" games={skilledOriginals} onGameClick={handleGameClick} />
          </div>
        </section>

        {/* Live Wins Section */}
        <LiveWins />

        {/* Weekly Leaderboard */}
        <WeeklyLeaderboard compact />

        {/* FAQ Section */}
        <FAQSection />

        {/* Crypto Section */}
        <CryptoSection />

        {/* Footer */}
        <footer className="border-t border-border py-6">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <LogoLink className="h-7 opacity-70" />
            <div className="flex items-center gap-6">
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Skilled. Skill-based competition only.
            </p>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />

      {/* Guest Login Prompt */}
      {!isAuthenticated && <GuestLoginPrompt />}
    </div>
  );
};
