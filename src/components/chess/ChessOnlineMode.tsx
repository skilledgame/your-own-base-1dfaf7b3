/**
 * ChessOnlineMode - Wager Selection Screen
 * 
 * Shows entry fee options (100, 500, 1000 SC)
 * When selected, starts matchmaking via WebSocket
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { useChessWebSocket } from '@/hooks/useChessWebSocket';
import { useChessStore } from '@/stores/chessStore';
import { useProfile } from '@/hooks/useProfile';
import { LogoLink } from '@/components/LogoLink';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { UserDropdown } from '@/components/UserDropdown';
import { FriendsButton } from '@/components/FriendsButton';
import { BalanceDepositPill } from '@/components/BalanceDepositPill';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { SkilledCoinsDisplay } from '@/components/SkilledCoinsDisplay';
import { useWalletModal } from '@/contexts/WalletModalContext';
import {
  Coins,
  Trophy,
  Loader2,
  Users,
  X,
  Wallet,
  LogIn,
  Shield,
  Search
} from 'lucide-react';
import coins100 from '@/assets/coins-100.png';
import coins500 from '@/assets/coins-500.png';
import coins1000 from '@/assets/coins-1000.png';

interface ChessOnlineModeProps {
  onBack: () => void;
}

const WAGER_OPTIONS = [
  {
    amount: 100,
    label: 'Tier I',
    prize: 190,
    image: coins100,
    color: 'from-blue-500 to-blue-600',
    glowColor: 'rgba(59, 130, 246, 0.4)'
  },
  {
    amount: 500,
    label: 'Tier II',
    prize: 950,
    image: coins500,
    color: 'from-purple-500 to-purple-600',
    glowColor: 'rgba(147, 51, 234, 0.4)',
    popular: true
  },
  {
    amount: 1000,
    label: 'Tier III',
    prize: 1900,
    image: coins1000,
    color: 'from-yellow-500 to-orange-500',
    glowColor: 'rgba(245, 158, 11, 0.4)'
  }
];

export function ChessOnlineMode({ onBack }: ChessOnlineModeProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isAuthReady, isPrivileged, user } = useAuth();
  const { balance } = useBalance();
  const { phase, setSelectedWager, selectedWager, queueEstimate } = useChessStore();
  const { displayName } = useProfile();
  const { status, findMatch, cancelSearch, isAuthenticated: wsAuth } = useChessWebSocket();
  const { openWallet } = useWalletModal();
  
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

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

  const isSearching = phase === 'searching';
  const isConnected = status === 'connected';

  // Handle match found - redirect to game
  useEffect(() => {
    if (phase === 'in_game') {
      const gameState = useChessStore.getState().gameState;
      if (gameState?.gameId) {
        navigate(`/game/live/${gameState.gameId}`);
      }
    }
  }, [phase, navigate]);

  const handleSelectWager = (amount: number) => {
    if (balance < amount) return;
    setSelectedOption(amount);
    setSelectedWager(amount);
  };

  const handlePlay = useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    if (!selectedOption) return;
    if (balance < selectedOption) return;

    setIsStarting(true);
    findMatch(selectedOption, displayName || 'Player');
  }, [isAuthenticated, selectedOption, balance, findMatch, displayName, navigate]);

  const handleCancelSearch = useCallback(() => {
    cancelSearch();
    setIsStarting(false);
  }, [cancelSearch]);

  // Loading state
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
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

      {/* Main content wrapper */}
      <div 
        className={`
          transition-all duration-300 ease-out
          ${sideMenuOpen ? (sidebarCollapsed ? 'md:ml-16' : 'md:ml-72') : 'md:ml-0'}
        `}
      >
        {/* Header */}
        <header 
          className={`
            fixed top-0 z-40 bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/5
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
                  <Button variant="ghost" size="icon" asChild className="hidden sm:flex text-muted-foreground hover:text-foreground">
                    <Link to="/search">
                      <Search className="w-5 h-5" />
                    </Link>
                  </Button>
                  <div className="hidden sm:flex">
                    <NotificationDropdown />
                  </div>
                  <div className="hidden sm:flex items-center">
                    <UserDropdown />
                  </div>
                  {/* Friends button */}
                  <div className="hidden sm:flex">
                    <FriendsButton />
                  </div>
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

        {/* Game Content */}
        <div className="relative min-h-screen bg-[#0a0f1a] overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0">
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 30%, #0c4a6e 0%, #0a0f1a 70%)'
              }}
            />
            <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[150px] animate-pulse" />
            <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[120px] animate-pulse" />
          </div>

          {/* Content */}
          <div className="relative z-10 min-h-screen flex flex-col pt-16">
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
              {/* Not authenticated */}
              {!isAuthenticated && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 mx-auto rounded-full bg-blue-950/50 border border-blue-500/30 flex items-center justify-center">
                    <LogIn className="w-10 h-10 text-blue-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Sign In Required</h2>
                    <p className="text-white/60">Sign in to play for Skilled Coins</p>
                  </div>
                  <Button
                    size="lg"
                    className="px-8 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400"
                    onClick={() => navigate('/auth')}
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </Button>
                </div>
              )}

              {/* Searching state */}
              {isAuthenticated && isSearching && (
                <div className="text-center space-y-6 py-12">
                  <div className="relative w-28 h-28 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 animate-ping" />
                    <div className="absolute inset-2 rounded-full border-4 border-cyan-500/50 animate-pulse" />
                    <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                      <Users className="w-12 h-12 text-white animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-white">Finding Opponent</h2>
                    {queueEstimate ? (
                      <div className="space-y-2">
                        <p className="text-lg text-cyan-300 font-semibold">
                          Est. wait: {queueEstimate.estimatedLabel}
                        </p>
                        <div className="flex items-center justify-center gap-4 text-sm text-white/50">
                          <span>{queueEstimate.onlinePlayers} online</span>
                          <span className="w-1 h-1 rounded-full bg-white/30" />
                          <span>{queueEstimate.inGamePlayers} in game</span>
                        </div>
                        {queueEstimate.queuePosition > 0 && (
                          <p className="text-xs text-white/40">
                            Queue position: {queueEstimate.queuePosition}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-white/60">Searching for a player...</p>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Coins className="w-6 h-6 text-yellow-500" />
                      <span className="text-2xl font-bold text-yellow-400">{selectedOption} SC</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="lg"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    onClick={handleCancelSearch}
                  >
                    <X className="w-5 h-5 mr-2" />
                    Cancel Search
                  </Button>
                </div>
              )}

              {/* Wager selection */}
              {isAuthenticated && !isSearching && (
                <>
                  {/* Title */}
                  <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      SELECT <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">GAME</span>
                    </h1>
                    <p className="text-white/50 mt-2">Time Control: 1 minute games with a 3-second increment per move.</p>
                  </div>

                  {/* Wager Cards */}
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 max-w-4xl w-full mb-8">
                    {WAGER_OPTIONS.map((option) => {
                      const isHovered = hoveredOption === option.amount;
                      const isSelected = selectedOption === option.amount;
                      const canAfford = balance >= option.amount;
                      
                      return (
                        <div
                          key={option.amount}
                          className={`
                            relative flex-1 cursor-pointer
                            transition-all duration-300 ease-out
                            ${isHovered || isSelected ? 'scale-105 z-20' : 'scale-100 z-10'}
                            ${!canAfford ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                          onMouseEnter={() => canAfford && setHoveredOption(option.amount)}
                          onMouseLeave={() => setHoveredOption(null)}
                          onClick={() => canAfford && handleSelectWager(option.amount)}
                        >
                          {/* Popular badge */}
                          {option.popular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold uppercase tracking-wider">
                              Most Popular
                            </div>
                          )}

                          <div
                            className={`
                              relative p-6 rounded-2xl border-2 transition-all duration-300
                              ${isSelected 
                                ? 'border-white bg-white/10' 
                                : isHovered 
                                  ? 'border-white/60 bg-white/5' 
                                  : 'border-white/20 bg-black/20'}
                            `}
                            style={{
                              boxShadow: (isHovered || isSelected) ? `0 0 40px ${option.glowColor}` : undefined
                            }}
                          >
                            {/* Icon */}
                            <div className="w-20 h-20 mx-auto mb-4">
                              <img
                                src={option.image}
                                alt={option.label}
                                className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                                style={{
                                  mask: 'radial-gradient(circle, black 55%, transparent 80%)',
                                  WebkitMask: 'radial-gradient(circle, black 55%, transparent 80%)',
                                }}
                              />
                            </div>

                            {/* Label */}
                            <h3 className="text-xl font-bold text-white text-center mb-3">
                              {option.label}
                            </h3>

                            {/* Amount */}
                            <div className="flex items-center justify-center gap-2 mb-3">
                              <Coins className="w-7 h-7 text-yellow-500" />
                              <span className="text-4xl font-black text-white">{option.amount}</span>
                              <span className="text-xl text-yellow-400 font-semibold">SC</span>
                            </div>

                            {/* Prize */}
                            <div className="flex items-center justify-center gap-2 text-green-400">
                              <Trophy className="w-5 h-5" />
                              <span className="text-base font-semibold">Earn {option.prize} SC</span>
                            </div>

                            {/* Selected indicator */}
                            {isSelected && (
                              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}

                            {/* Can't afford */}
                            {!canAfford && (
                              <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                                <span className="text-red-400 font-semibold">Insufficient balance</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Play Button */}
                  <Button
                    size="lg"
                    className={`
                      px-12 py-7 text-xl font-black uppercase tracking-wider
                      bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400
                      text-white border-0 shadow-[0_0_40px_rgba(34,197,94,0.4)]
                      transition-all duration-300
                      ${!selectedOption || !isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-[0_0_60px_rgba(34,197,94,0.6)]'}
                    `}
                    disabled={!selectedOption || !isConnected || isStarting}
                    onClick={handlePlay}
                  >
                    {!isConnected ? (
                      <>
                        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : isStarting ? (
                      <>
                        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        Find Match
                        {selectedOption && ` - ${selectedOption} SC`}
                      </>
                    )}
                  </Button>

                  {!isConnected && (
                    <p className="text-white/40 text-sm mt-4">
                      Connecting to game server...
                    </p>
                  )}

                  {/* Platform fee disclaimer */}
                  <p className="text-white/30 text-xs mt-6 max-w-md text-center">
                    Keep in mind we take a 5% platform fee off each players entry that goes to hosting the service
                  </p>
                </>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
