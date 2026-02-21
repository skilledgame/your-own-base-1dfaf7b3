import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { useChessWebSocket } from '@/hooks/useChessWebSocket';
import { useChessStore } from '@/stores/chessStore';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Coins, Trophy, Loader2, X, Clock, Globe, Lock,
  Swords, Link2, Copy, Share2, Check, UserPlus, Users,
} from 'lucide-react';
import coins100 from '@/assets/coins-100.png';
import coins500 from '@/assets/coins-500.png';
import coins1000 from '@/assets/coins-1000.png';

const WAGER_OPTIONS = [
  {
    amount: 100,
    label: 'Tier I',
    prize: 190,
    image: coins100,
    color: 'from-blue-500 to-blue-600',
    glowColor: 'rgba(59, 130, 246, 0.4)',
  },
  {
    amount: 500,
    label: 'Tier II',
    prize: 950,
    image: coins500,
    color: 'from-purple-500 to-purple-600',
    glowColor: 'rgba(147, 51, 234, 0.4)',
    popular: true,
  },
  {
    amount: 1000,
    label: 'Tier III',
    prize: 1900,
    image: coins1000,
    color: 'from-yellow-500 to-orange-500',
    glowColor: 'rgba(245, 158, 11, 0.4)',
  },
];

type PanelMode = 'online' | 'private';
type PrivateSubMode = 'select' | 'create' | 'join';

export function WagerPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const { isAuthenticated, user } = useAuth();
  const { balance } = useBalance();
  const { phase, setSelectedWager, queueEstimate } = useChessStore();
  const { displayName } = useProfile();
  const { status, findMatch, cancelSearch } = useChessWebSocket();

  // Panel mode
  const [panelMode, setPanelMode] = useState<PanelMode>('online');

  // Online state
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Private state
  const [privateSubMode, setPrivateSubMode] = useState<PrivateSubMode>('select');
  const [lobbyCode, setLobbyCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lobbyCreated, setLobbyCreated] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [privateWager, setPrivateWager] = useState<number>(100);

  const isSearching = phase === 'searching';
  const isInGame = phase === 'in_game';
  const isConnected = status === 'connected';

  // Pre-fill join code from URL
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setPanelMode('private');
      setJoinCode(code.toUpperCase());
      setPrivateSubMode('join');
    }
  }, [searchParams]);

  // --- Online handlers ---

  const handleSelectWager = (amount: number) => {
    if (balance < amount || isSearching || isInGame) return;
    setSelectedOption(amount);
    setSelectedWager(amount);
  };

  const handlePlay = useCallback(async () => {
    if (!isAuthenticated) { openAuthModal('sign-up'); return; }
    if (!selectedOption) return;
    if (balance < selectedOption) return;
    setIsStarting(true);
    findMatch(selectedOption, displayName || 'Player');
  }, [isAuthenticated, selectedOption, balance, findMatch, displayName, navigate]);

  const handleCancelSearch = useCallback(() => {
    cancelSearch();
    setIsStarting(false);
  }, [cancelSearch]);

  // --- Private handlers ---

  const handleCreateLobby = async () => {
    if (!user) { openAuthModal('sign-up'); return; }
    if (privateWager > balance) {
      toast({ variant: 'destructive', title: 'Insufficient balance', description: "You don't have enough coins for this wager" });
      return;
    }
    setIsCreating(true);
    try {
      const response = await supabase.functions.invoke('create-lobby', {
        body: { wager: privateWager, gameType: 'chess' },
      });
      if (response.error) {
        const msg = response.data?.error || response.data?.details || response.error.message || 'Please try again';
        toast({ variant: 'destructive', title: 'Failed to create lobby', description: msg });
        setIsCreating(false);
        return;
      }
      const data = response.data;
      if (data?.success === false || data?.error) {
        toast({ variant: 'destructive', title: 'Failed to create lobby', description: data.details || data.error || 'Please try again' });
        setIsCreating(false);
        return;
      }
      if (data?.lobbyCode && data?.success !== false) {
        setLobbyCode(data.lobbyCode);
        setLobbyCreated(true);
        setWaitingForOpponent(true);
        if (data.roomId) sessionStorage.setItem('lobbyRoomId', data.roomId);
        toast({ title: 'Lobby created!', description: `Wager: ${privateWager} SC. Winner takes 95% of pot.` });

        const channel = supabase
          .channel(`room-${data.roomId}`)
          .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'private_rooms',
            filter: `id=eq.${data.roomId}`,
          }, (payload) => {
            const room = payload.new as any;
            if (room.status === 'matched' && room.game_id) {
              toast({ title: 'Opponent joined!', description: 'Head to the lobby to ready up.' });
              navigate(`/game/lobby/${data.roomId}`);
            }
          })
          .subscribe();
        sessionStorage.setItem('lobbyChannel', channel.topic);
      } else {
        toast({ variant: 'destructive', title: 'Failed to create lobby', description: 'Invalid response from server.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Failed to create lobby', description: 'Please try again' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!user) { openAuthModal('sign-up'); return; }
    if (!joinCode || joinCode.length < 4) {
      toast({ variant: 'destructive', title: 'Invalid code', description: 'Please enter a valid lobby code.' });
      return;
    }
    setIsJoining(true);
    try {
      const response = await supabase.functions.invoke('join-lobby', { body: { lobbyCode: joinCode } });
      if (response.error) {
        const msg = response.data?.error || response.data?.details || response.error.message || 'Please try again';
        toast({ variant: 'destructive', title: 'Failed to join lobby', description: msg });
        setIsJoining(false);
        return;
      }
      const data = response.data;
      if (data?.success === false || data?.error) {
        toast({ variant: 'destructive', title: 'Failed to join lobby', description: data.details || data.error || 'Please try again' });
        setIsJoining(false);
        return;
      }
      if ((data?.game || data?.gameId) && data?.success !== false) {
        toast({ title: 'Joined lobby!', description: `Playing against ${data.opponent?.name || 'opponent'}. Ready up!` });
        navigate(`/game/lobby/${data.roomId}`);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Failed to join lobby', description: 'Please try again' });
    }
    setIsJoining(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(lobbyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Code copied!', description: 'Share it with your friend.' });
  };

  const shareCode = () => {
    const shareUrl = `${window.location.origin}/chess?code=${lobbyCode}`;
    if (navigator.share) {
      navigator.share({ title: 'Join my Chess match on Skilled!', text: `Use code ${lobbyCode} to join my lobby`, url: shareUrl });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied!', description: 'Share this link with your friend.' });
    }
  };

  const handleBackFromLobby = () => {
    setLobbyCreated(false);
    setWaitingForOpponent(false);
    setLobbyCode('');
    setPrivateSubMode('select');
  };

  // --- Tier card renderer (shared between online and private create) ---

  const renderTierCards = (
    selected: number | null,
    onSelect: (amount: number) => void,
    disabled: boolean,
  ) => (
    <div className="flex flex-col gap-3">
      {WAGER_OPTIONS.map((option) => {
        const isHovered = hoveredOption === option.amount;
        const isSelected = selected === option.amount;
        const canAfford = balance >= option.amount;
        const isDisabled = !canAfford || disabled;

        return (
          <button
            key={option.amount}
            className={`
              relative w-full rounded-xl transition-all duration-200
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              ${isSelected
                ? 'bg-white/[0.06]'
                : isHovered
                  ? 'bg-white/[0.03]'
                  : 'bg-white/[0.02]'
              }
            `}
            onMouseEnter={() => !isDisabled && setHoveredOption(option.amount)}
            onMouseLeave={() => setHoveredOption(null)}
            onClick={() => !isDisabled && onSelect(option.amount)}
          >
            {option.popular && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider bg-purple-500 text-white px-2 py-0.5 rounded-full">
                Popular
              </span>
            )}
            <div className="flex items-center gap-3 p-3">
              <img src={option.image} alt={option.label} className="w-10 h-10 object-contain" />
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-white">{option.label}</div>
                <div className="flex items-center gap-1 text-white/60 text-xs">
                  <Coins className="w-3 h-3" />
                  <span>{option.amount} SC</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
                <Trophy className="w-3 h-3" />
                <span>{option.prize}</span>
              </div>
            </div>
            {isSelected && (
              <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Mode toggle — underline style, blends with game board bg */}
      <div className="bg-background -mx-4 -mt-4 px-4 pt-4">
        <div className="flex">
          <button
            onClick={() => setPanelMode('online')}
            className={`flex-1 flex items-center justify-center gap-1.5 pb-2.5 text-sm font-semibold transition-all relative ${
              panelMode === 'online' ? 'text-white' : 'text-white/35 hover:text-white/55'
            }`}
          >
            Online
            {panelMode === 'online' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0ea5e9] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setPanelMode('private')}
            className={`flex-1 flex items-center justify-center gap-1.5 pb-2.5 text-sm font-semibold transition-all relative ${
              panelMode === 'private' ? 'text-white' : 'text-white/35 hover:text-white/55'
            }`}
          >
            Private
            {panelMode === 'private' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0ea5e9] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* ====================== ONLINE MODE ====================== */}
      {panelMode === 'online' && (
        <>
          <div className="flex items-center gap-2 text-white/50 text-xs px-1">
            <Clock className="w-3.5 h-3.5" />
            <span>1 min + 3s increment</span>
          </div>

          {renderTierCards(selectedOption, handleSelectWager, isSearching || isInGame)}

          {isSearching ? (
            <div className="flex flex-col gap-3 mt-2">
              {queueEstimate && (
                <div className="text-center space-y-1">
                  <p className="text-white/50 text-xs">Est. wait: {queueEstimate.estimatedLabel}</p>
                  <p className="text-white/40 text-[10px]">
                    {queueEstimate.onlinePlayers} online &middot; {queueEstimate.inGamePlayers} in game
                  </p>
                  {queueEstimate.queuePosition > 0 && (
                    <p className="text-white/40 text-[10px]">Queue position: {queueEstimate.queuePosition}</p>
                  )}
                </div>
              )}
              <Button
                variant="outline" size="sm"
                onClick={handleCancelSearch}
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <X className="w-4 h-4 mr-1.5" />
                Cancel Search
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full mt-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold border-0"
              disabled={!selectedOption || !isConnected || isStarting || isInGame}
              onClick={handlePlay}
            >
              {!isConnected ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Connecting...</>
              ) : isStarting && !isSearching ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Starting...</>
              ) : (
                <>Find Match{selectedOption ? ` - ${selectedOption} SC` : ''}</>
              )}
            </Button>
          )}
        </>
      )}

      {/* ====================== PRIVATE MODE ====================== */}
      {panelMode === 'private' && (
        <>
          {/* Sub-mode selection */}
          {privateSubMode === 'select' && (
            <div className="flex flex-col gap-3">
              <p className="text-white/40 text-xs px-1">Play with friends using room codes</p>
              <button
                onClick={() => setPrivateSubMode('create')}
                className="w-full p-4 rounded-xl bg-purple-950/20 hover:bg-purple-950/30 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Swords className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Create Room</div>
                    <div className="text-[11px] text-purple-200/50">Generate a code and invite a friend</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setPrivateSubMode('join')}
                className="w-full p-4 rounded-xl bg-violet-950/20 hover:bg-violet-950/30 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shrink-0">
                    <Link2 className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Join Room</div>
                    <div className="text-[11px] text-violet-200/50">Enter a friend's code to join</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Create Room — wager selection */}
          {privateSubMode === 'create' && !lobbyCreated && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-white/60 text-xs font-medium">Set your wager</p>
                <button onClick={() => setPrivateSubMode('select')} className="text-white/30 hover:text-white/50 text-xs transition-colors">Back</button>
              </div>

              {renderTierCards(privateWager, (amt) => setPrivateWager(amt), false)}

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-white/40">Winner takes (95%)</span>
                <span className="text-green-400 font-semibold flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  {Math.floor(privateWager * 1.9).toLocaleString()} SC
                </span>
              </div>

              <Button
                size="sm"
                className="w-full bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400 text-white font-semibold border-0"
                disabled={isCreating || privateWager > balance}
                onClick={handleCreateLobby}
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Room'}
              </Button>
            </div>
          )}

          {/* Create Room — lobby created, waiting */}
          {privateSubMode === 'create' && lobbyCreated && (
            <div className="flex flex-col gap-4 items-center text-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center animate-pulse">
                <Users className="w-7 h-7 text-white" />
              </div>

              <div>
                <p className="text-purple-200/50 text-[11px] mb-1">Your lobby code</p>
                <div className="text-3xl font-bold font-mono tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-400">
                  {lobbyCode}
                </div>
              </div>

              <div className="w-full bg-purple-950/30 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-purple-200/50">Entry Wager</span>
                  <span className="font-bold text-white flex items-center gap-1">
                    <Coins className="w-3 h-3 text-yellow-500" />
                    {privateWager.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-200/50">Winner Takes</span>
                  <span className="font-bold text-green-400 flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    {Math.floor(privateWager * 1.9).toLocaleString()} SC
                  </span>
                </div>
              </div>

              <div className="flex gap-2 w-full">
                <Button
                  variant="outline" size="sm"
                  className="flex-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs"
                  onClick={copyCode}
                >
                  {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400 text-xs"
                  onClick={shareCode}
                >
                  <Share2 className="w-3.5 h-3.5 mr-1" />
                  Share
                </Button>
              </div>

              {waitingForOpponent && (
                <div className="flex items-center justify-center gap-2 text-purple-200/50 text-xs pt-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Waiting for opponent...</span>
                </div>
              )}

              <button
                onClick={handleBackFromLobby}
                className="text-purple-400 hover:text-purple-300 text-xs transition-colors"
              >
                Cancel &amp; Go Back
              </button>
            </div>
          )}

          {/* Join Room */}
          {privateSubMode === 'join' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-white/60 text-xs font-medium">Enter room code</p>
                <button onClick={() => setPrivateSubMode('select')} className="text-white/30 hover:text-white/50 text-xs transition-colors">Back</button>
              </div>

              <Input
                placeholder="e.g. ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="bg-black/30 border-transparent text-white placeholder:text-violet-200/30 text-center text-lg tracking-[0.15em] font-mono h-12"
                maxLength={6}
              />

              <Button
                size="sm"
                className="w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-semibold border-0"
                disabled={isJoining || !joinCode}
                onClick={handleJoinLobby}
              >
                {isJoining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><UserPlus className="w-4 h-4 mr-1.5" />Join Match</>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Not authenticated hint */}
      {!isAuthenticated && (
        <p className="text-center text-white/30 text-[10px]">
          Sign in to play
        </p>
      )}
    </div>
  );
}
