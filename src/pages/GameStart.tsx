import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useChessWebSocket } from '@/hooks/useChessWebSocket';
import { useChessStore } from '@/stores/chessStore';
import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { LogoLink } from '@/components/LogoLink';
import { MultiplayerGameView } from '@/components/MultiplayerGameView';
import { GameResultModal } from '@/components/GameResultModal';
import { 
  ArrowLeft, 
  Loader2, 
  Coins, 
  ExternalLink, 
  Shield,
  Play,
  Clock,
  Trophy,
  Bot,
  Sparkles,
  Check,
  Zap,
  Target,
  Crown,
  X,
  Users,
  Swords,
  Timer,
  Award
} from 'lucide-react';
import { User, Session } from '@supabase/supabase-js';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';

interface GameInfo {
  name: string;
  slug: string;
  description: string;
  image: string;
  gradientFrom: string;
  gradientTo: string;
  isLive: boolean;
  minWager: number;
}

const GAMES: Record<string, GameInfo> = {
  chess: {
    name: 'Chess',
    slug: 'chess',
    description: 'The ultimate game of strategy. Compete head-to-head in timed matches where every move counts.',
    image: '♟️',
    gradientFrom: '#1e3a5f',
    gradientTo: '#0d1b2a',
    isLive: true,
    minWager: 100,
  },
  checkers: {
    name: 'Checkers',
    slug: 'checkers',
    description: 'Classic board game strategy. Capture all opponent pieces to win.',
    image: '🔴',
    gradientFrom: '#dc2626',
    gradientTo: '#7f1d1d',
    isLive: false,
    minWager: 50,
  },
  'flappy-bird': {
    name: 'Flappy Bird',
    slug: 'flappy-bird',
    description: 'Test your reflexes. Navigate through obstacles and beat your opponent\'s score.',
    image: '🐦',
    gradientFrom: '#38bdf8',
    gradientTo: '#0284c7',
    isLive: false,
    minWager: 25,
  },
  tetris: {
    name: 'Tetris',
    slug: 'tetris',
    description: 'Stack blocks strategically. Clear lines faster than your opponent.',
    image: '🧱',
    gradientFrom: '#a855f7',
    gradientTo: '#7e22ce',
    isLive: false,
    minWager: 50,
  },
};

const STAKE_OPTIONS = [
  { 
    coins: 100, 
    label: 'Tier I',
    description: '',
    prize: 190,
    icon: Target,
  },
  { 
    coins: 500, 
    label: 'Tier II',
    description: '',
    prize: 950,
    icon: Zap,
    popular: true,
  },
  { 
    coins: 1000, 
    label: 'Tier III',
    description: '',
    prize: 1900,
    icon: Crown,
  },
];

const DEPOSIT_AMOUNTS = [
  { usd: 10, coins: 1000 },
  { usd: 25, coins: 2500, popular: true },
  { usd: 50, coins: 5000 },
  { usd: 100, coins: 10000 },
];

const CRYPTO_OPTIONS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', icon: '₿' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', icon: 'Ξ' },
  { id: 'usdttrc20', name: 'USDT (TRC20)', symbol: 'USDT', icon: '₮' },
  { id: 'usdcsol', name: 'USDC (Solana)', symbol: 'USDC', icon: '$' },
];

export default function GameStart() {
  const { gameSlug } = useParams<{ gameSlug: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [freePlaysRemaining, setFreePlaysRemaining] = useState<number | null>(null);
  const [selectedStake, setSelectedStake] = useState<number | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [selectedDepositAmount, setSelectedDepositAmount] = useState<number | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [startingFreePlay, setStartingFreePlay] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [gameResult, setGameResult] = useState<{
    isWin: boolean;
    tokensChange: number;
    newBalance: number;
    reason: string;
  } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPrivileged } = useUserRole();
  
  // Use Supabase for player data (not for chess matchmaking anymore)
  const {
    player,
    currentGame,
    opponent,
    error: multiplayerError,
    createPlayer,
    updateGame,
    endGame,
    resetGame,
    loadPlayer,
    loadGame,
    setOpponent,
  } = useMultiplayer();
  
  // Use NEW WebSocket for chess matchmaking
  const {
    status: wsStatus,
    findMatch,
    cancelSearch,
  } = useChessWebSocket();
  
  // Get global state from store
  const { phase, gameState, matchmaking } = useChessStore();
  
  // Global loading overlay
  const { showLoading: globalShowLoading } = useUILoadingStore();
  
  // STEP 4: Ensure matchmaking state has safe defaults (never undefined)
  const safeMatchmaking = matchmaking || {
    status: "idle" as const,
    wager: null,
    matchId: null,
    dbMatchId: null,
    opponentUserId: null,
    color: null,
  };
  
  // Derive isSearching from phase and normalized matchmaking state
  const isSearching = phase === "searching" || safeMatchmaking.status === "searching";
  
  // STEP C: Get IDs safely (normalized, never from raw objects)
  const userId = user?.id ?? session?.user?.id ?? null;
  const isConnected = wsStatus === "connected";

  const game = gameSlug ? GAMES[gameSlug] : null;
  const selectedOption = STAKE_OPTIONS.find(opt => opt.coins === selectedStake);
  const isChess = gameSlug === 'chess';

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && gameSlug) {
      fetchBalance();
      fetchFreePlays();
    }
  }, [user, gameSlug]);

  const fetchBalance = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('skilled_coins')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setBalance(data.skilled_coins);
    }
  };

  const fetchFreePlays = async () => {
    if (!user || !user.id || !gameSlug) return;
    
    const { data, error } = await supabase.rpc('get_or_create_free_plays', {
      p_user_id: user.id,
      p_game_slug: gameSlug,
    });

    if (!error && data !== null) {
      setFreePlaysRemaining(data);
    }
  };

  const handlePlayFree = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!gameSlug || freePlaysRemaining === null || freePlaysRemaining <= 0) {
      toast({
        variant: 'destructive',
        title: 'No free plays remaining',
        description: 'Please deposit coins to continue playing.',
      });
      return;
    }

    setStartingFreePlay(true);

    try {
      const { data, error } = await supabase.rpc('use_free_play', {
        p_user_id: user.id,
        p_game_slug: gameSlug,
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.success) {
        toast({
          variant: 'destructive',
          title: 'Cannot start free play',
          description: result?.message || 'No free plays remaining.',
        });
        setStartingFreePlay(false);
        return;
      }

      setFreePlaysRemaining(result.plays_remaining);

      toast({
        title: 'Free play started!',
        description: `${result.plays_remaining} free plays remaining.`,
      });

      navigate('/', { state: { startBotGame: true, gameSlug } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start free play';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      setStartingFreePlay(false);
    }
  };

  const handleDeposit = async () => {
    if (!selectedDepositAmount || !selectedCrypto || !session) return;

    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          amount_usd: selectedDepositAmount,
          crypto_currency: selectedCrypto,
          game_slug: gameSlug,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.invoice_url) {
        toast({
          title: 'Payment invoice created!',
          description: 'Complete the payment to add coins to your balance.',
        });
        window.open(data.invoice_url, '_blank');
        setShowDeposit(false);
        // REMOVED: setTimeout(fetchBalance, 3000) - balance updates via Realtime subscription
        // The balance will automatically update when the payment is confirmed
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create payment';
      toast({
        variant: 'destructive',
        title: 'Payment error',
        description: message,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handlePlay = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!selectedStake) {
      toast({
        variant: 'destructive',
        title: 'Select entry amount',
        description: 'Please select how many coins to enter with.',
      });
      return;
    }

    if (!isPrivileged && balance < selectedStake) {
      setShowDeposit(true);
      toast({
        variant: 'destructive',
        title: 'Insufficient balance',
        description: `You need at least ${selectedStake.toLocaleString()} coins to play.`,
      });
      return;
    }

    // Guard: ensure user exists
    if (!user || !user.id) {
      toast({
        variant: 'destructive',
        title: 'Not logged in',
        description: 'Please log in to play',
      });
      return;
    }

    // Create or get player, then join queue
    let currentPlayer = player;
    if (!currentPlayer || !currentPlayer.id) {
      // Get display name from profile or use a default
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      currentPlayer = await createPlayer(profile?.display_name || 'Player');
    }
    
    if (currentPlayer && currentPlayer.id) {
      // Use WebSocket matchmaking with wager
      const wager = selectedStake || 50;  // Default to 50 if not selected
      globalShowLoading();
      findMatch(wager, currentPlayer.name);
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to create player',
        description: 'Please try again',
      });
    }
  };

  // Game event handlers
  const handleMove = async (fen: string, turn: string) => {
    await updateGame({ fen, current_turn: turn });
  };

  const handleTimeUpdate = async (whiteTime: number, blackTime: number) => {
    await updateGame({ white_time: whiteTime, black_time: blackTime });
  };

  const handleGameEnd = async (winnerId: string, reason: string) => {
    if (!player || !currentGame || !player.id) return;
    
    await endGame(winnerId, reason);
    
    const isWin = winnerId === player.id;
    const isDraw = !winnerId;
    const coinsChange = isDraw ? 0 : (isWin ? currentGame.wager : -currentGame.wager);
    // Balance changes are handled server-side via settle_match RPC
    // Frontend will update via realtime subscription to profiles.skilled_coins
    const updatedBalance = balance + coinsChange;
    
    setGameResult({ isWin, tokensChange: coinsChange, newBalance: updatedBalance, reason });
    fetchBalance(); // Refresh balance
  };

  const handlePlayAgain = () => {
    setGameResult(null);
    resetGame();
    setSelectedStake(null);
  };

  const handleGoHome = () => {
    setGameResult(null);
    resetGame();
    cancelSearch();
    navigate('/');
  };

  const handleBackFromGame = () => {
    resetGame();
    cancelSearch();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Game not found</h1>
          <Button asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Show global loading overlay while searching — no fake "searching screen"
  useEffect(() => {
    if (isSearching && !currentGame) {
      globalShowLoading();
    }
  }, [isSearching, currentGame, globalShowLoading]);
  
  // If searching, the global overlay is active — render nothing extra
  if (isSearching && !currentGame) {
    return null;
  }

  // Show multiplayer game when matched
  if (currentGame && opponent && player && player.id) {
    return (
      <>
        <MultiplayerGameView
          player={{ ...player, skilledCoins: balance }}
          opponent={opponent}
          game={currentGame}
          onMove={handleMove}
          onTimeUpdate={handleTimeUpdate}
          onGameEnd={handleGameEnd}
          onBack={handleBackFromGame}
        />
        {gameResult && (
          <GameResultModal
            isWin={gameResult.isWin}
            coinsChange={gameResult.tokensChange}
            newBalance={gameResult.newBalance}
            reason={gameResult.reason}
            onPlayAgain={handlePlayAgain}
            onGoHome={handleGoHome}
          />
        )}
      </>
    );
  }

  // Chess-specific gaming design
  if (isChess && game.isLive) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] pb-20 md:pb-0 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[80px] animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]" />
        </div>

        {/* Chess pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)`,
          backgroundSize: '60px 60px',
        }} />

        <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />
        
        {sideMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSideMenuOpen(false)}
          />
        )}

        {/* Header */}
        <header className="border-b border-blue-500/20 p-4 sticky top-0 bg-[#0a0f1a]/90 backdrop-blur-xl z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <LogoLink className="h-8" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-950/50 border border-blue-500/30">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold text-white">{balance.toLocaleString()}</span>
            </div>
          </div>
        </header>

        <main className="relative z-10 max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4 pt-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-blue-300 text-sm font-medium">Live Now • 247 Players Online</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold">
              <span className="text-white">Chess</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400"> Duel</span>
            </h1>
            
            <p className="text-blue-200/60 text-lg max-w-md mx-auto">
              1 Minute • Winner Takes All • Pure Skill
            </p>

            {/* Large Chess Icon */}
            <div className="text-8xl mt-2 filter drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]">♟️</div>
          </div>

          {/* How It Works - Quick */}
          <div className="bg-gradient-to-br from-blue-950/50 to-blue-900/30 border border-blue-500/20 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-blue-400" />
              How It Works
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Users, title: '1v1 Match', desc: 'Random opponent' },
                { icon: Timer, title: '1 Min + 3s', desc: 'Per move bonus' },
                { icon: Coins, title: 'Equal Entry', desc: 'Both stake same' },
                { icon: Trophy, title: 'Winner Wins', desc: '95% of pot' },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 rounded-xl bg-blue-900/30 border border-blue-500/10">
                  <item.icon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="font-semibold text-white text-sm">{item.title}</p>
                  <p className="text-blue-200/50 text-xs">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Entry Selection */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-bold text-white text-xl flex items-center gap-2">
                <Swords className="w-5 h-5 text-blue-400" />
                Select Game
              </h2>
              
              <div className="grid sm:grid-cols-3 gap-4">
                {STAKE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedStake === option.coins;
                  const isDisabled = !isPrivileged && option.coins > balance;
                  
                  return (
                    <button
                      key={option.coins}
                      onClick={() => !isDisabled && setSelectedStake(option.coins)}
                      disabled={isDisabled}
                      className={`relative p-5 rounded-2xl border-2 text-left transition-all transform hover:scale-[1.02] ${
                        isSelected
                          ? 'border-blue-400 bg-gradient-to-br from-blue-600/30 to-blue-800/30 shadow-[0_0_30px_rgba(59,130,246,0.3)]'
                          : isDisabled
                          ? 'border-blue-900/50 bg-blue-950/30 opacity-50 cursor-not-allowed'
                          : 'border-blue-500/30 hover:border-blue-400/50 bg-blue-950/40'
                      }`}
                    >
                      {option.popular && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full shadow-lg">
                          POPULAR
                        </span>
                      )}
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          isSelected 
                            ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                            : 'bg-blue-900/50'
                        }`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <Coins className="w-5 h-5 text-yellow-500" />
                        <span className="text-2xl font-bold text-white">{option.coins.toLocaleString()}</span>
                      </div>
                      
                      <p className="font-medium text-blue-300 text-sm">{option.label}</p>
                      
                      <div className="pt-3 border-t border-blue-500/20">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-blue-200/50">Earn Prize</span>
                          <span className="font-bold text-green-400 flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {option.prize.toLocaleString()} SC
                          </span>
                        </div>
                      </div>

                      {isDisabled && (
                        <div className="absolute inset-0 rounded-2xl bg-[#0a0f1a]/70 flex items-center justify-center backdrop-blur-sm">
                          <span className="text-xs text-red-400 font-medium">Need more coins</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Play Button */}
              <Button
                size="lg"
                className="w-full h-16 text-xl font-bold bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 hover:from-blue-400 hover:via-blue-500 hover:to-cyan-400 border-0 shadow-[0_0_40px_rgba(59,130,246,0.4)] hover:shadow-[0_0_60px_rgba(59,130,246,0.6)] transition-all"
                disabled={!selectedStake || (!isPrivileged && selectedStake > balance) || isSearching || !user}
                onClick={handlePlay}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Finding Opponent...
                  </>
                ) : !user ? (
                  'Sign In to Play'
                ) : (
                  <>
                    <Play className="w-6 h-6 mr-2" />
                    Find Match
                    {isPrivileged && <span className="ml-2 text-xs opacity-70">(Mod)</span>}
                  </>
                )}
              </Button>

              {!user && (
                <div className="text-center">
                  <Button asChild variant="link" className="text-blue-400 hover:text-blue-300">
                    <Link to="/auth">Sign in or create an account</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Play with Friends */}
              <div className="bg-gradient-to-br from-cyan-950/50 to-blue-950/50 border border-cyan-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Play with Friends</h3>
                    <p className="text-cyan-200/50 text-xs">Create or join a private lobby</p>
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                >
                  <Link to="/chess-lobby">
                    <Swords className="w-4 h-4 mr-2" />
                    Create / Join Lobby
                  </Link>
                </Button>
              </div>

              {/* Free Practice */}
              <div className="bg-gradient-to-br from-blue-950/50 to-blue-900/30 border border-blue-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-900/50 border border-blue-500/30 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Practice Mode</h3>
                    <p className="text-blue-200/50 text-xs">Play vs AI • No rewards</p>
                  </div>
                </div>
                
                {user && freePlaysRemaining !== null && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/50 border border-blue-500/20 text-sm mb-3 w-fit">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    <span className="text-blue-200">{freePlaysRemaining}/3 free plays</span>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                  disabled={startingFreePlay || !user || (freePlaysRemaining !== null && freePlaysRemaining <= 0)}
                  onClick={handlePlayFree}
                >
                  {startingFreePlay ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Bot className="w-4 h-4 mr-2" />
                  )}
                  {!user ? 'Sign in to Practice' : 'Start Practice'}
                </Button>
              </div>

              {/* Stats Card */}
              <div className="bg-blue-950/30 border border-blue-500/10 rounded-2xl p-5">
                <h4 className="text-blue-200/50 text-xs uppercase tracking-wider mb-3">Game Stats</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-200/70 text-sm">Time Control</span>
                    <span className="text-white font-medium">1 min + 3s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-200/70 text-sm">Platform Fee</span>
                    <span className="text-white font-medium">5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-200/70 text-sm">Matchmaking</span>
                    <span className="text-green-400 font-medium">~10 sec</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deposit Modal */}
          {showDeposit && user && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#0a0f1a] border border-blue-500/30 rounded-2xl p-6 max-w-lg w-full space-y-6 max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Deposit Coins</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeposit(false)} className="text-blue-400">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div>
                  <p className="text-sm text-blue-200/60 mb-3">Select Amount</p>
                  <div className="grid grid-cols-2 gap-3">
                    {DEPOSIT_AMOUNTS.map((option) => (
                      <button
                        key={option.usd}
                        onClick={() => setSelectedDepositAmount(option.usd)}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          selectedDepositAmount === option.usd
                            ? 'border-blue-400 bg-blue-500/10'
                            : 'border-blue-500/30 hover:border-blue-400/50 bg-blue-950/50'
                        }`}
                      >
                        {option.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-semibold bg-blue-500 text-white rounded-full">
                            Popular
                          </span>
                        )}
                        <div className="text-xl font-bold text-white">${option.usd}</div>
                        <div className="flex items-center justify-center gap-1 text-xs text-blue-200/60">
                          <Coins className="w-3 h-3 text-yellow-500" />
                          {option.coins.toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-blue-200/60 mb-3">Select Payment Method</p>
                  <div className="grid grid-cols-2 gap-3">
                    {CRYPTO_OPTIONS.map((crypto) => (
                      <button
                        key={crypto.id}
                        onClick={() => setSelectedCrypto(crypto.id)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          selectedCrypto === crypto.id
                            ? 'border-blue-400 bg-blue-500/10'
                            : 'border-blue-500/30 hover:border-blue-400/50 bg-blue-950/50'
                        }`}
                      >
                        <div className="text-xl mb-1">{crypto.icon}</div>
                        <div className="font-semibold text-white text-sm">{crypto.symbol}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0"
                  disabled={!selectedDepositAmount || !selectedCrypto || processing}
                  onClick={handleDeposit}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating invoice...
                    </>
                  ) : (
                    <>
                      Deposit ${selectedDepositAmount || 0}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Trust Footer */}
          <div className="text-center py-8 space-y-2 border-t border-blue-500/20 mt-12">
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-white">Skilled</span>
            </div>
            <p className="text-sm text-blue-200/50 max-w-md mx-auto">
              100% skill-based competition. No luck. No gambling mechanics.
            </p>
          </div>
        </main>

        <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
      </div>
    );
  }

  // Default design for other games
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />
      
      {sideMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <LogoLink className="h-8" />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold">{balance.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {game.isLive ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">{game.image}</div>
            <h2 className="text-2xl font-bold mb-2">{game.name}</h2>
            <p className="text-muted-foreground mb-6">{game.description}</p>
            <Button asChild>
              <Link to="/">Play Now</Link>
            </Button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">🚧</div>
            <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground mb-6">
              {game.name} is currently in development. Join the waitlist to be notified when it launches!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <Link to="/">Browse Available Games</Link>
              </Button>
              <Button asChild variant="outline" className="border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2]/10">
                <a href="https://discord.gg/EPARc4mdJA" target="_blank" rel="noopener noreferrer">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Join Discord
                </a>
              </Button>
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
