/**
 * ChessPrivateMode - Host or Join Private Games
 * 
 * - Create a room and get a code
 * - Join with a friend's code
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { LogoLink } from '@/components/LogoLink';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { UserDropdown } from '@/components/UserDropdown';
import { BalanceDepositPill } from '@/components/BalanceDepositPill';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { SkilledCoinsDisplay } from '@/components/SkilledCoinsDisplay';
import { useWalletModal } from '@/contexts/WalletModalContext';
import {
  Copy,
  Users,
  Loader2,
  Swords,
  Share2,
  Check,
  Coins,
  Trophy,
  Wallet,
  LogIn,
  UserPlus,
  Link2,
  Shield,
  Search
} from 'lucide-react';

interface ChessPrivateModeProps {
  onBack: () => void;
}

const WAGER_OPTIONS = [100, 500, 1000];
const MIN_WAGER = 50;
const MAX_WAGER = 100000;

export function ChessPrivateMode({ onBack }: ChessPrivateModeProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isAuthenticated, isAuthReady, isPrivileged, user } = useAuth();
  const { balance } = useBalance();
  const { openWallet } = useWalletModal();

  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [lobbyCode, setLobbyCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lobbyCreated, setLobbyCreated] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [selectedWager, setSelectedWager] = useState<number>(100);

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

  // Pre-fill join code from URL
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setJoinCode(code.toUpperCase());
      setMode('join');
    }
  }, [searchParams]);

  const handleCreateLobby = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (selectedWager > balance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient balance',
        description: "You don't have enough coins for this wager",
      });
      return;
    }

    setIsCreating(true);

    try {
      const response = await supabase.functions.invoke('create-lobby', {
        body: { wager: selectedWager, gameType: 'chess' }
      });

      console.log('[ChessPrivateMode] Full response:', JSON.stringify(response, null, 2));
      console.log('[ChessPrivateMode] Response data:', response.data);
      console.log('[ChessPrivateMode] Response error:', response.error);

      if (response.error) {
        console.error('[ChessPrivateMode] Create lobby error - full error:', JSON.stringify(response.error, null, 2));
        console.error('[ChessPrivateMode] Create lobby error - response.data:', response.data);
        const errorMessage = response.data?.error || response.data?.details || response.error.message || 
                           (typeof response.error === 'string' ? response.error : 'Please try again');
        toast({
          variant: 'destructive',
          title: 'Failed to create lobby',
          description: errorMessage,
        });
        setIsCreating(false);
        return;
      }

      const data = response.data;
      console.log('[ChessPrivateMode] Parsed data:', data);
      console.log('[ChessPrivateMode] Has lobbyCode?', !!data?.lobbyCode);
      console.log('[ChessPrivateMode] Has game?', !!data?.game);
      
      // Check for error in response (now returns 200 with success: false)
      if (data?.success === false || data?.error) {
        console.error('[ChessPrivateMode] Create lobby error:', data.error, 'details:', data.details);
        toast({
          variant: 'destructive',
          title: 'Failed to create lobby',
          description: data.details || data.error || 'Please try again',
        });
        setIsCreating(false);
        return;
      }

      if (data?.lobbyCode && data?.success !== false) {
        console.log('[ChessPrivateMode] Room created successfully! Code:', data.lobbyCode, 'Room ID:', data.roomId);
        setLobbyCode(data.lobbyCode);
        setLobbyCreated(true);
        setWaitingForOpponent(true);

        if (data.roomId) {
          sessionStorage.setItem('lobbyRoomId', data.roomId);
        }

        toast({
          title: 'Lobby created!',
          description: `Wager: ${selectedWager} SC. Winner takes 95% of pot.`,
        });

        // Subscribe to private_rooms updates (not games - game doesn't exist yet)
        const channel = supabase
          .channel(`room-${data.roomId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'private_rooms',
              filter: `id=eq.${data.roomId}`,
            },
            (payload) => {
              const room = payload.new as any;
              console.log('[ChessPrivateMode] Room updated:', room.status, 'game_id:', room.game_id);
              if (room.status === 'matched' && room.game_id) {
                // Opponent joined! Navigate to lobby for ready-up.
                const { dismiss } = toast({
                  title: 'Opponent joined!',
                  description: 'Head to the lobby to ready up.',
                });
                setTimeout(() => dismiss(), 2000);
                navigate(`/game/lobby/${data.roomId}`);
              }
            }
          )
          .subscribe();

        sessionStorage.setItem('lobbyChannel', channel.topic);
      } else {
        console.error('[ChessPrivateMode] No lobbyCode in response! Data:', data);
        toast({
          variant: 'destructive',
          title: 'Failed to create lobby',
          description: 'Invalid response from server. Please try again.',
        });
      }
    } catch (error) {
      console.error('[ChessPrivateMode] Exception creating lobby:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create lobby',
        description: 'Please try again',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!joinCode || joinCode.length < 4) {
      toast({
        variant: 'destructive',
        title: 'Invalid code',
        description: 'Please enter a valid lobby code.',
      });
      return;
    }

    setIsJoining(true);

    try {
      console.log('[ChessPrivateMode] Attempting to join lobby with code:', joinCode);
      const response = await supabase.functions.invoke('join-lobby', {
        body: { lobbyCode: joinCode }
      });
      console.log('[ChessPrivateMode] Join lobby response:', JSON.stringify(response, null, 2));

      if (response.error) {
        console.error('[ChessPrivateMode] Join lobby error - full error:', JSON.stringify(response.error, null, 2));
        console.error('[ChessPrivateMode] Join lobby error - response.data:', response.data);
        const errorMessage = response.data?.error || response.data?.details || response.error.message || 
                           (typeof response.error === 'string' ? response.error : 'Please try again');
        toast({
          variant: 'destructive',
          title: 'Failed to join lobby',
          description: errorMessage,
        });
        setIsJoining(false);
        return;
      }

      const data = response.data;
      console.log('[ChessPrivateMode] Join lobby data:', data);
      
      // Check for error in response (now returns 200 with success: false)
      if (data?.success === false || data?.error) {
        console.error('[ChessPrivateMode] Join lobby error:', data.error, 'details:', data.details);
        toast({
          variant: 'destructive',
          title: 'Failed to join lobby',
          description: data.details || data.error || 'Please try again',
        });
        setIsJoining(false);
        return;
      }

      if ((data?.game || data?.gameId) && data?.success !== false) {
        toast({
          title: 'Joined lobby!',
          description: `Playing against ${data.opponent?.name || 'opponent'}. Ready up!`,
        });
        // Navigate to lobby for ready-up (not directly to game)
        const targetRoomId = data.roomId;
        navigate(`/game/lobby/${targetRoomId}`);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to join lobby',
        description: 'Please try again',
      });
    }

    setIsJoining(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(lobbyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Code copied!',
      description: 'Share it with your friend.',
    });
  };

  const shareCode = () => {
    const shareUrl = `${window.location.origin}/chess-lobby?code=${lobbyCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join my Chess match on Skilled!',
        text: `Use code ${lobbyCode} to join my lobby`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied!',
        description: 'Share this link with your friend.',
      });
    }
  };

  const handleBackFromMode = () => {
    if (lobbyCreated) {
      setLobbyCreated(false);
      setWaitingForOpponent(false);
      setLobbyCode('');
    }
    setMode('select');
  };

  // Loading state
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
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
                background: 'radial-gradient(ellipse at 50% 30%, #2e1065 0%, #0a0f1a 70%)'
              }}
            />
            <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px] animate-pulse" />
            <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-violet-500/15 rounded-full blur-[120px] animate-pulse" />
          </div>

          {/* Content */}
          <div className="relative z-10 min-h-screen flex flex-col pt-16">
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
              {/* Not authenticated */}
              {!isAuthenticated && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 mx-auto rounded-full bg-purple-950/50 border border-purple-500/30 flex items-center justify-center">
                    <LogIn className="w-10 h-10 text-purple-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Sign In Required</h2>
                    <p className="text-white/60">Sign in to play private matches</p>
                  </div>
                  <Button
                    size="lg"
                    className="px-8 bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400"
                    onClick={() => navigate('/auth')}
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </Button>
                </div>
              )}

              {/* Mode Selection */}
              {isAuthenticated && mode === 'select' && (
                <>
                  <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      PRIVATE <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-400">MATCH</span>
                    </h1>
                    <p className="text-white/50 mt-2">Play with friends using room codes</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6 max-w-2xl w-full">
                    {/* Create Room */}
                    <div
                      className="cursor-pointer group"
                      onClick={() => setMode('create')}
                    >
                      <div className="p-8 rounded-2xl border-2 border-purple-500/30 bg-purple-950/20 hover:border-purple-400/60 hover:bg-purple-950/30 transition-all">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Swords className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white text-center mb-2">Create Room</h3>
                        <p className="text-purple-200/60 text-center">
                          Generate a code and invite your friend
                        </p>
                      </div>
                    </div>

                    {/* Join Room */}
                    <div
                      className="cursor-pointer group"
                      onClick={() => setMode('join')}
                    >
                      <div className="p-8 rounded-2xl border-2 border-violet-500/30 bg-violet-950/20 hover:border-violet-400/60 hover:bg-violet-950/30 transition-all">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Link2 className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white text-center mb-2">Join Room</h3>
                        <p className="text-violet-200/60 text-center">
                          Enter a friend's code to join their game
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Create Room Flow */}
              {isAuthenticated && mode === 'create' && !lobbyCreated && (
                <div className="max-w-md w-full space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Create Private Room</h2>
                    <p className="text-white/50">Set your wager and generate a code</p>
                  </div>

                  {/* Wager Selection */}
                  <div className="p-6 rounded-xl bg-purple-950/30 border border-purple-500/20 space-y-4">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-500" />
                      <span className="font-semibold text-white">Entry Wager</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {WAGER_OPTIONS.map((amount) => (
                        <Button
                          key={amount}
                          variant={selectedWager === amount ? "default" : "outline"}
                          onClick={() => setSelectedWager(amount)}
                          disabled={amount > balance}
                          className={`
                            h-14 text-lg font-bold
                            ${selectedWager === amount 
                              ? "bg-purple-600 text-white" 
                              : "border-purple-500/30 text-purple-300 hover:bg-purple-500/10"}
                            ${amount > balance ? "opacity-50" : ""}
                          `}
                        >
                          {amount} SC
                        </Button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-sm pt-2">
                      <span className="text-white/50">Winner takes (95%)</span>
                      <span className="text-green-400 font-semibold flex items-center gap-1">
                        <Trophy className="w-4 h-4" />
                        {Math.floor(selectedWager * 1.9).toLocaleString()} SC
                      </span>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400"
                    disabled={isCreating || selectedWager > balance}
                    onClick={handleCreateLobby}
                  >
                    {isCreating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Create Room'
                    )}
                  </Button>
                </div>
              )}

              {/* Lobby Created - Waiting */}
              {isAuthenticated && mode === 'create' && lobbyCreated && (
                <div className="max-w-md w-full p-8 rounded-2xl bg-purple-950/30 border border-purple-500/20 text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center mx-auto animate-pulse">
                    <Users className="w-10 h-10 text-white" />
                  </div>

                  <div>
                    <p className="text-purple-200/60 text-sm mb-2">Your lobby code</p>
                    <div className="text-5xl font-bold font-mono tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-400">
                      {lobbyCode}
                    </div>
                  </div>

                  <div className="bg-purple-950/50 border border-purple-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-200/60">Entry Wager</span>
                      <span className="font-bold text-white flex items-center gap-1">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        {selectedWager.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-200/60">Winner Takes (95%)</span>
                      <span className="font-bold text-green-400 flex items-center gap-1">
                        <Trophy className="w-4 h-4" />
                        {Math.floor(selectedWager * 1.9).toLocaleString()} SC
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                      onClick={copyCode}
                    >
                      {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      {copied ? 'Copied!' : 'Copy Code'}
                    </Button>
                    <Button
                      className="bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400"
                      onClick={shareCode}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share Link
                    </Button>
                  </div>

                  {waitingForOpponent && (
                    <div className="pt-4 border-t border-purple-500/20">
                      <div className="flex items-center justify-center gap-3 text-purple-200/60">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Waiting for opponent to join...</span>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    onClick={handleBackFromMode}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    Cancel & Go Back
                  </Button>
                </div>
              )}

              {/* Join Room Flow */}
              {isAuthenticated && mode === 'join' && (
                <div className="max-w-md w-full space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Join Private Room</h2>
                    <p className="text-white/50">Enter the code shared by your friend</p>
                  </div>

                  <div className="p-6 rounded-xl bg-violet-950/30 border border-violet-500/20 space-y-4">
                    <Input
                      placeholder="Enter code (e.g., ABC123)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="bg-black/30 border-violet-500/30 text-white placeholder:text-violet-200/40 text-center text-2xl tracking-[0.2em] font-mono h-16"
                      maxLength={6}
                    />

                    <Button
                      size="lg"
                      className="w-full h-14 text-lg font-bold bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500"
                      disabled={isJoining || !joinCode}
                      onClick={handleJoinLobby}
                    >
                      {isJoining ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="w-5 h-5 mr-2" />
                          Join Match
                        </>
                      )}
                    </Button>
                  </div>
                </div>
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
