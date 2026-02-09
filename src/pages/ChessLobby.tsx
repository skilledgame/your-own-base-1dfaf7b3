import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { LogoLink } from '@/components/LogoLink';
import { 
  ArrowLeft, 
  Copy, 
  Users, 
  Loader2,
  Swords,
  Share2,
  Check,
  Coins,
  Trophy,
  ChevronLeft
} from 'lucide-react';
import { User } from '@supabase/supabase-js';

const WAGER_OPTIONS = [100, 500, 1000, 5000];
const MIN_WAGER = 50;
const MAX_WAGER = 100000;

export default function ChessLobby() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lobbyCode, setLobbyCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lobbyCreated, setLobbyCreated] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [selectedWager, setSelectedWager] = useState<number>(100);
  const [customWager, setCustomWager] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const [showWagerSelection, setShowWagerSelection] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Pre-fill join code from URL params
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setJoinCode(code.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Fetch balance if user is logged in
      if (session?.user) {
        supabase
          .from('profiles')
          .select('skilled_coins')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setBalance(data.skilled_coins);
          });
      }
    });
  }, []);

  const generateLobbyCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateLobby = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Show wager selection first
    setShowWagerSelection(true);
  };

  const handleConfirmWager = async () => {
    const effectiveWager = customWager ? parseInt(customWager) || 0 : selectedWager;
    
    if (effectiveWager < MIN_WAGER) {
      toast({
        variant: 'destructive',
        title: 'Invalid wager',
        description: `Minimum wager is ${MIN_WAGER} coins`,
      });
      return;
    }
    
    if (effectiveWager > MAX_WAGER) {
      toast({
        variant: 'destructive',
        title: 'Invalid wager',
        description: `Maximum wager is ${MAX_WAGER.toLocaleString()} coins`,
      });
      return;
    }
    
    if (effectiveWager > balance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient balance',
        description: 'You don\'t have enough coins for this wager',
      });
      return;
    }

    setIsCreating(true);
    
    try {
      // Create lobby in the backend
      const response = await supabase.functions.invoke('create-lobby', {
        body: { wager: effectiveWager, gameType: 'chess' }
      });

      if (response.error) {
        console.error('Create lobby error:', response.error);
        toast({
          variant: 'destructive',
          title: 'Failed to create lobby',
          description: response.error.message || 'Please try again',
        });
        setIsCreating(false);
        return;
      }

      const data = response.data;
      if (data?.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to create lobby',
          description: data.error,
        });
        setIsCreating(false);
        return;
      }

      if (data?.lobbyCode) {
        setLobbyCode(data.lobbyCode);
        setLobbyCreated(true);
        setWaitingForOpponent(true);
        setShowWagerSelection(false);
        
        // Store room ID for later
        if (data.roomId) {
          sessionStorage.setItem('lobbyRoomId', data.roomId);
        }

        toast({
          title: 'Lobby created!',
          description: `Wager: ${effectiveWager} coins. Winner takes 95% of pot.`,
        });

        // Subscribe to private_rooms updates to detect when opponent joins
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
              console.log('[ChessLobby] Room updated:', room.status, 'game_id:', room.game_id);
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

        // Store channel for cleanup
        sessionStorage.setItem('lobbyChannel', channel.topic);
      }
    } catch (error) {
      console.error('Create lobby error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create lobby',
        description: 'Please try again',
      });
    }
    
    setIsCreating(false);
  };

  const { showLoading: globalShowLoading, hideLoading: globalHideLoading } = useUILoadingStore();

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
    globalShowLoading(); // overlay during network call
    
    try {
      const response = await supabase.functions.invoke('join-lobby', {
        body: { lobbyCode: joinCode }
      });

      if (response.error) {
        console.error('Join lobby error:', response.error);
        toast({
          variant: 'destructive',
          title: 'Failed to join lobby',
          description: response.error.message || 'Please try again',
        });
        setIsJoining(false);
        globalHideLoading();
        return;
      }

      const data = response.data;
      if (data?.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to join lobby',
          description: data.error,
        });
        setIsJoining(false);
        globalHideLoading();
        return;
      }

      if (data?.game || data?.gameId) {
        // Navigate to lobby for ready-up — overlay stays until lobby page renders
        const targetRoomId = data.roomId;
        navigate(`/game/lobby/${targetRoomId}`);
        // hideLoading will be called by PrivateGameLobby once it loads
      }
    } catch (error) {
      console.error('Join lobby error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to join lobby',
        description: 'Please try again',
      });
      globalHideLoading();
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

  // Show global overlay while loading auth
  useEffect(() => {
    if (loading) {
      globalShowLoading();
    } else {
      globalHideLoading();
    }
  }, [loading, globalShowLoading, globalHideLoading]);

  if (loading) {
    return null; // Global overlay handles it
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-blue-500/20 p-4 backdrop-blur-sm bg-[#0a0f1a]/80">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link to="/chess" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Chess
            </Link>
            <LogoLink className="h-8" />
            <div className="w-20" />
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-6 space-y-8">
          {/* Title */}
          <div className="text-center space-y-4 pt-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Private Match</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Play with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Friends</span>
            </h1>
            <p className="text-blue-200/60 text-lg">
              Create a private lobby or join with a code
            </p>
          </div>

          {!lobbyCreated ? (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Create Lobby */}
              <div className="bg-gradient-to-br from-blue-900/40 to-blue-950/40 border border-blue-500/30 rounded-2xl p-6 backdrop-blur-sm hover:border-blue-400/50 transition-all group">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Swords className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Create Lobby</h2>
                <p className="text-blue-200/60 text-sm mb-6">
                  Generate a unique code and share it with your friend to start a match
                </p>
                <Button
                  onClick={handleCreateLobby}
                  disabled={isCreating || !user}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white border-0 h-12"
                >
                  {isCreating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : !user ? (
                    'Sign in to Create'
                  ) : (
                    'Create Lobby'
                  )}
                </Button>
              </div>

              {/* Join Lobby */}
              <div className="bg-gradient-to-br from-cyan-900/40 to-cyan-950/40 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur-sm hover:border-cyan-400/50 transition-all group">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Join Lobby</h2>
                <p className="text-cyan-200/60 text-sm mb-4">
                  Enter the code shared by your friend
                </p>
                <div className="space-y-3">
                  <Input
                    placeholder="Enter code (e.g., ABC123)"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="bg-[#0a0f1a]/50 border-cyan-500/30 text-white placeholder:text-cyan-200/40 text-center text-xl tracking-widest font-mono h-12"
                    maxLength={6}
                  />
                  <Button
                    onClick={handleJoinLobby}
                    disabled={isJoining || !joinCode || !user}
                    variant="outline"
                    className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 h-12"
                  >
                    {isJoining ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : !user ? (
                      'Sign in to Join'
                    ) : (
                      'Join Match'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {lobbyCreated && (
            /* Lobby Created - Waiting for opponent */
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-950/40 border border-blue-500/30 rounded-2xl p-8 backdrop-blur-sm text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto animate-pulse">
                <Users className="w-10 h-10 text-white" />
              </div>

              <div>
                <p className="text-blue-200/60 text-sm mb-2">Your lobby code</p>
                <div className="text-5xl font-bold font-mono tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  {lobbyCode}
                </div>
              </div>

              {/* Wager Info */}
              <div className="bg-blue-950/50 border border-blue-500/20 rounded-xl p-4 space-y-3 max-w-xs mx-auto">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-200/60">Entry Wager</span>
                  <span className="font-bold text-white flex items-center gap-1">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    {(customWager ? parseInt(customWager) || selectedWager : selectedWager).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-200/60">Winner Takes (95%)</span>
                  <span className="font-bold text-green-400 flex items-center gap-1">
                    <Trophy className="w-4 h-4" />
                    {Math.floor((customWager ? parseInt(customWager) || selectedWager : selectedWager) * 1.9).toLocaleString()} SC
                  </span>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={copyCode}
                  variant="outline"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </Button>
                <Button
                  onClick={shareCode}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Link
                </Button>
              </div>

              {/* Subtle waiting indicator — no text-heavy waiting state */}
              {waitingForOpponent && (
                <div className="pt-4 border-t border-blue-500/20 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500/40" />
                </div>
              )}

              <Button
                variant="ghost"
                onClick={() => {
                  setLobbyCreated(false);
                  setWaitingForOpponent(false);
                  setLobbyCode('');
                  setShowWagerSelection(false);
                }}
                className="text-blue-400 hover:text-blue-300"
              >
                Cancel & Go Back
              </Button>
            </div>
          )}

          {!user && (
            <div className="text-center">
              <Button asChild variant="link" className="text-blue-400 hover:text-blue-300">
                <Link to="/auth">Sign in to play with friends</Link>
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
