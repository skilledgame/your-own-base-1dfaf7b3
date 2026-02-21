/**
 * ChessHome - Fortnite-inspired Game Mode Selection
 * 
 * Three modes:
 * - Private (left): Host/Join with codes
 * - Online (center): Wager-based matchmaking with eye-tracking rook character
 * - Battle Royale (right): Coming soon
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Button } from '@/components/ui/button';
import { LogoLink } from '@/components/LogoLink';
import { ChessPrivateMode } from '@/components/chess/ChessPrivateMode';
import { OnlineModeCard } from '@/components/chess/OnlineModeCard';
import { PrivateModeCard } from '@/components/chess/PrivateModeCard';
import { BattleRoyaleModeCard } from '@/components/chess/BattleRoyaleModeCard';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { UserDropdown } from '@/components/UserDropdown';
import { FriendsButton } from '@/components/FriendsButton';
import { BalanceDepositPill } from '@/components/BalanceDepositPill';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { SkilledCoinsDisplay } from '@/components/SkilledCoinsDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletModal } from '@/contexts/WalletModalContext';
import { 
  Users, 
  Swords, 
  Crown,
  Lock,
  Wifi,
  Globe,
  UserPlus,
  Shield,
  Search
} from 'lucide-react';

type GameMode = 'private' | 'online' | 'battle-royale';

type SelectedMode = 'private' | 'online' | null;

export default function ChessHome() {
  const navigate = useNavigate();
  const [hoveredMode, setHoveredMode] = useState<GameMode | null>(null);
  const [selectedMode, setSelectedMode] = useState<SelectedMode>(null);

  // Layout state
  const [sideMenuOpen, setSideMenuOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  const { isAuthenticated, isPrivileged } = useAuth();
  const { openWallet } = useWalletModal();
  const { openAuthModal } = useAuthModal();

  // Animated tab title with cycling chess pieces
  useEffect(() => {
    const pieces = ['♟', '♞', '♝', '♜', '♛', '♚'];
    let index = 0;
    const originalTitle = document.title;
    
    const interval = setInterval(() => {
      document.title = `${pieces[index]} Chess | Skilled`;
      index = (index + 1) % pieces.length;
    }, 500);
    
    return () => {
      clearInterval(interval);
      document.title = originalTitle;
    };
  }, []);

  const handleModeSelect = (mode: GameMode) => {
    if (mode === 'battle-royale') return; // Coming soon
    setSelectedMode(mode);
  };

  const handleBack = () => {
    if (selectedMode) {
      setSelectedMode(null);
    } else {
      navigate('/');
    }
  };

  // Online mode navigates to the unified chess play page
  useEffect(() => {
    if (selectedMode === 'online') {
      navigate('/chess/play');
    }
  }, [selectedMode, navigate]);

  if (selectedMode === 'private') {
    return <ChessPrivateMode onBack={handleBack} />;
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-16 md:pb-0">
      {/* Desktop Side Menu */}
      <DesktopSideMenu 
        isOpen={sideMenuOpen} 
        onToggle={() => setSideMenuOpen(!sideMenuOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        variant="dark"
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
            fixed top-0 z-40 bg-[#0a0f1a]/80 backdrop-blur-xl
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
                  {/* Friends button */}
                  <div className="hidden sm:flex">
                    <FriendsButton />
                  </div>
                  {/* Mobile: Show balance pill */}
                  <div className="sm:hidden">
                    <button onClick={() => openWallet('deposit')}>
                      <SkilledCoinsDisplay size="sm" isPrivileged={isPrivileged} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/search">
                      <Search className="w-5 h-5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" className="hidden sm:flex text-muted-foreground hover:text-foreground" onClick={() => openAuthModal('sign-in')}>
                    Sign In
                  </Button>
                  <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0 font-semibold" onClick={() => openAuthModal('sign-up')}>
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Game Content */}
        <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
          {/* Subtle Animated Background - Toned down to match home page */}
          <div className="absolute inset-0">
            {/* Soft radial gradient background - desaturated */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 30%, rgba(40, 55, 75, 0.25) 0%, transparent 70%)'
              }}
            />
            
            {/* Subtle glow orbs - reduced saturation and opacity */}
            <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-slate-500/8 rounded-full blur-[150px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-slate-400/6 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-slate-600/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
            
            {/* Subtle geometric lines - matching home page style */}
            <div className="absolute inset-0 opacity-[0.03]">
              <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-white to-transparent" />
              <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-white to-transparent" />
              <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-white to-transparent" />
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 min-h-screen flex flex-col pt-16">
            {/* Title Section */}
            <div className="text-center pt-8 pb-4 px-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                SELECT A <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">GAME MODE</span>
              </h1>
              <p className="text-white/50 mt-2 text-lg">Choose how you want to play</p>
            </div>

            {/* Game Mode Cards */}
            <div className="flex-1 flex items-center justify-center px-4 pb-8">
              <div className="flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8 items-center justify-center max-w-6xl w-full">
                {/* Private Mode - Knight piece (red themed) */}
                <PrivateModeCard
                  isHovered={hoveredMode === 'private'}
                  isSelected={selectedMode === 'private'}
                  onHover={(isHovering) => setHoveredMode(isHovering ? 'private' : null)}
                  onClick={() => handleModeSelect('private')}
                />

                {/* Online Mode (Center - Main) - Queen character */}
                <OnlineModeCard
                  isHovered={hoveredMode === 'online'}
                  isSelected={selectedMode === 'online'}
                  onHover={(isHovering) => setHoveredMode(isHovering ? 'online' : null)}
                  onClick={() => handleModeSelect('online')}
                />

                {/* Battle Royale Mode - Rook piece (yellow themed) */}
                <BattleRoyaleModeCard
                  isHovered={hoveredMode === 'battle-royale'}
                  isSelected={selectedMode === 'battle-royale'}
                  onHover={(isHovering) => setHoveredMode(isHovering ? 'battle-royale' : null)}
                  onClick={() => {}}
                />
              </div>
            </div>

            {/* Footer hint */}
            <div className="text-center pb-6">
              <p className="text-white/30 text-sm">
                Hover over a mode to learn more
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
