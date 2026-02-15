/**
 * Private Game Lobby - Ready-Up Screen
 * 
 * Both players see each other, can ready up, and start the game when both ready.
 * Route: /game/lobby/:roomId
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { useUILoadingStore } from '@/stores/uiLoadingStore';
import { getRankFromTotalWagered, type RankInfo } from '@/lib/rankSystem';
import { LogoLink } from '@/components/LogoLink';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  Coins,
  Trophy,
  Wallet,
  Crown,
  CheckCircle2,
  Circle,
  Swords,
  Copy,
  Share2,
  Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';

interface PlayerInfo {
  id: string;
  name: string;
  total_wagered_sc: number;
  rank: RankInfo;
}

interface RoomData {
  id: string;
  code: string;
  status: string;
  wager: number;
  game_id: string | null;
  creator_id: string;
  joiner_id: string | null;
  creator_ready: boolean;
  joiner_ready: boolean;
  created_at: string;
}

export default function PrivateGameLobby() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { balance } = useBalance();
  const { showLoading: globalShowLoading, hideLoading: globalHideLoading } = useUILoadingStore();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [creator, setCreator] = useState<PlayerInfo | null>(null);
  const [joiner, setJoiner] = useState<PlayerInfo | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  // Derived state
  const myReady = isCreator ? room?.creator_ready : room?.joiner_ready;
  const opponentReady = isCreator ? room?.joiner_ready : room?.creator_ready;
  const bothReady = room?.creator_ready && room?.joiner_ready;
  const hasOpponent = !!room?.joiner_id;

  // Fetch room details
  const fetchRoom = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase.rpc('get_room_details', { p_room_id: roomId });

    if (error || !data?.success) {
      console.error('[Lobby] Error fetching room:', error || data?.error);
      toast({
        variant: 'destructive',
        title: 'Room not found',
        description: data?.error || 'This room does not exist or you do not have access.',
      });
      navigate('/chess');
      return;
    }

    const roomData = data.room;
    setRoom(roomData);
    setIsCreator(data.is_creator);

    // Set creator info
    const creatorRank = getRankFromTotalWagered(data.creator.total_wagered_sc);
    setCreator({
      id: data.creator.id,
      name: data.creator.name,
      total_wagered_sc: data.creator.total_wagered_sc,
      rank: creatorRank,
    });

    // Set joiner info (may be null)
    if (data.joiner) {
      const joinerRank = getRankFromTotalWagered(data.joiner.total_wagered_sc);
      setJoiner({
        id: data.joiner.id,
        name: data.joiner.name,
        total_wagered_sc: data.joiner.total_wagered_sc,
        rank: joinerRank,
      });
    }

    setLoading(false);
  }, [roomId, navigate, toast]);

  // Initial fetch
  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // Subscribe to Realtime updates on this room
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`lobby-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as any;

          setRoom((prev) => prev ? {
            ...prev,
            status: updated.status,
            creator_ready: updated.creator_ready,
            joiner_ready: updated.joiner_ready,
            joiner_id: updated.joiner_id,
            game_id: updated.game_id,
          } : prev);

          // If joiner just joined, refetch to get their profile
          if (updated.joiner_id && !joiner) {
            fetchRoom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, joiner, fetchRoom]);

  // When room status becomes 'started', show overlay and navigate immediately
  useEffect(() => {
    if (room?.status === 'started' && room?.game_id && !starting) {
      setStarting(true);
      globalShowLoading(); // Overlay until LiveGame renders the board
      navigate(`/game/live/${room.game_id}`);
    }
  }, [room?.status, room?.game_id, starting, navigate, globalShowLoading]);

  // Toggle ready state
  const handleToggleReady = async () => {
    if (!roomId || toggling) return;
    setToggling(true);

    try {
      const { data, error } = await supabase.rpc('toggle_ready', { p_room_id: roomId });

      if (error || !data?.success) {
        console.error('[Lobby] Toggle ready error:', error || data?.error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data?.error || 'Failed to update ready state',
        });
        return;
      }

      // Optimistic update
      setRoom((prev) => prev ? {
        ...prev,
        creator_ready: data.creator_ready,
        joiner_ready: data.joiner_ready,
      } : prev);
    } catch (err) {
      console.error('[Lobby] Toggle ready exception:', err);
    } finally {
      setToggling(false);
    }
  };

  // Start game — call RPC to set status='started', which triggers Realtime for BOTH players
  const handleStartGame = async () => {
    if (!room?.game_id || !bothReady || starting) return;
    setStarting(true);
    globalShowLoading(); // Overlay during start

    try {
      const { data, error } = await supabase.rpc('start_private_game', { p_room_id: roomId });

      if (error) {
        console.error('[Lobby] Failed to start game:', error);
        setStarting(false);
        globalHideLoading();
        return;
      }

      if (!data?.success) {
        console.error('[Lobby] Start game RPC failed:', data?.error);
        setStarting(false);
        globalHideLoading();
        return;
      }

      // Navigate immediately — overlay stays until LiveGame renders the board
      navigate(`/game/live/${room.game_id}`);
    } catch (err) {
      console.error('[Lobby] Start game exception:', err);
      setStarting(false);
      globalHideLoading();
    }
  };

  // Copy code
  const handleCopyCode = () => {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share link
  const handleShareLink = () => {
    if (!room?.code) return;
    const shareUrl = `${window.location.origin}/chess-lobby?code=${room.code}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join my Chess match on Skilled!',
        text: `Use code ${room.code} to join my lobby`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied!' });
    }
  };

  // Leave lobby
  const handleLeave = () => {
    navigate('/chess');
  };

  // Show global overlay while loading, hide once loaded
  useEffect(() => {
    if (loading) {
      globalShowLoading();
    } else {
      globalHideLoading();
    }
  }, [loading, globalShowLoading, globalHideLoading]);

  // Loading state — global overlay handles it
  if (loading) {
    return null;
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white/60 text-lg">Room not found</p>
          <Button onClick={() => navigate('/chess')}>Go Back</Button>
        </div>
      </div>
    );
  }

  const me = isCreator ? creator : joiner;
  const opponent = isCreator ? joiner : creator;

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, #2e1065 0%, #0a0f1a 70%)',
          }}
        />
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-violet-500/15 rounded-full blur-[120px] animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 p-4 backdrop-blur-sm bg-black/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={handleLeave}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Leave</span>
            </button>
            <LogoLink className="h-10" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-950/50 border border-yellow-500/30">
              <Wallet className="w-4 h-4 text-yellow-400" />
              <span className="font-bold text-yellow-200">{balance.toLocaleString()} SC</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-8">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              GAME <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-400">LOBBY</span>
            </h1>
            <p className="text-white/40 mt-1 text-sm">Room Code: <span className="font-mono text-purple-300">{room.code}</span></p>
          </div>

          {/* Wager Badge */}
          <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-purple-950/40 border border-purple-500/20">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-white/60 text-sm">Wager</span>
              <span className="text-white font-bold text-lg">{room.wager.toLocaleString()} SC</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-green-400" />
              <span className="text-white/60 text-sm">Winner</span>
              <span className="text-green-400 font-bold text-lg">{Math.floor(room.wager * 1.9).toLocaleString()} SC</span>
            </div>
          </div>

          {/* Players */}
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-12 w-full max-w-2xl">
            {/* Player 1 (Me) */}
            <PlayerCard
              player={me}
              label="You"
              isReady={!!myReady}
              isMe={true}
            />

            {/* VS Divider */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Swords className="w-8 h-8 text-white" />
              </div>
              <span className="text-white/30 font-bold text-sm">VS</span>
            </div>

            {/* Player 2 (Opponent) */}
            {hasOpponent ? (
              <PlayerCard
                player={opponent}
                label="Opponent"
                isReady={!!opponentReady}
                isMe={false}
              />
            ) : (
              <WaitingForOpponent code={room.code} onCopy={handleCopyCode} onShare={handleShareLink} copied={copied} />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {hasOpponent && !bothReady && (
              <Button
                size="lg"
                onClick={handleToggleReady}
                disabled={toggling}
                className={`w-full h-14 text-lg font-bold transition-all ${
                  myReady
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400 text-white'
                }`}
              >
                {toggling ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : myReady ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Ready! (click to unready)
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Ready Up
                  </>
                )}
              </Button>
            )}

            {bothReady && (
              <Button
                size="lg"
                onClick={handleStartGame}
                disabled={starting}
                className="w-full h-16 text-xl font-black bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/30"
              >
                {starting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Swords className="w-6 h-6 mr-3" />
                    START GAME
                  </>
                )}
              </Button>
            )}

            {!hasOpponent && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                  onClick={handleCopyCode}
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </Button>
                <Button
                  className="bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400"
                  onClick={handleShareLink}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Link
                </Button>
              </div>
            )}

            {hasOpponent && !myReady && (
              <p className="text-white/40 text-sm text-center">
                Press "Ready Up" when you're ready to play
              </p>
            )}

            {myReady && !opponentReady && (
              <div className="flex justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-white/30" />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* PART B: Countdown removed — navigate immediately to reduce time-to-board */}
    </div>
  );
}

// Player Card Component
function PlayerCard({
  player,
  label,
  isReady,
  isMe,
}: {
  player: PlayerInfo | null;
  label: string;
  isReady: boolean;
  isMe: boolean;
}) {
  const rankColor = player?.rank?.tierName === 'diamond'
    ? 'from-cyan-400 to-blue-500'
    : player?.rank?.tierName === 'gold'
    ? 'from-yellow-400 to-amber-500'
    : player?.rank?.tierName === 'silver'
    ? 'from-gray-300 to-gray-400'
    : 'from-amber-600 to-amber-700';

  return (
    <div className={`flex-1 w-full sm:max-w-[280px] rounded-2xl border-2 transition-all ${
      isReady
        ? 'border-green-500/60 bg-green-950/20 shadow-lg shadow-green-500/10'
        : 'border-white/10 bg-white/5'
    }`}>
      <div className="p-6 flex flex-col items-center gap-4">
        {/* Label */}
        <span className={`text-xs font-semibold uppercase tracking-wider ${isMe ? 'text-purple-400' : 'text-white/40'}`}>
          {label}
        </span>

        {/* Avatar */}
        <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${rankColor} flex items-center justify-center shadow-lg`}>
          <Crown className="w-10 h-10 text-white/90" />
        </div>

        {/* Name */}
        <h3 className="text-xl font-bold text-white truncate max-w-full">
          {player?.name || 'Unknown'}
        </h3>

        {/* Rank */}
        <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${rankColor} text-white text-xs font-bold uppercase`}>
          {player?.rank?.displayName || 'Unranked'}
        </div>

        {/* Ready status */}
        <div className={`flex items-center gap-2 text-sm font-semibold ${isReady ? 'text-green-400' : 'text-white/30'}`}>
          {isReady ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Ready
            </>
          ) : (
            <>
              <Circle className="w-5 h-5" />
              Not Ready
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Waiting for Opponent Card
function WaitingForOpponent({
  code,
  onCopy,
  onShare,
  copied,
}: {
  code: string;
  onCopy: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex-1 w-full sm:max-w-[280px] rounded-2xl border-2 border-dashed border-white/20 bg-white/5">
      <div className="p-6 flex flex-col items-center gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Opponent
        </span>

        {/* Pulsing placeholder */}
        <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
          <Loader2 className="w-10 h-10 text-white/20 animate-spin" />
        </div>

        <h3 className="text-lg font-bold text-white/30">
          Waiting...
        </h3>

        <p className="text-white/20 text-sm text-center">
          Share the code below
        </p>

        {/* Inline code + actions */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold text-purple-300 tracking-wider">{code}</span>
          <button
            onClick={onCopy}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onShare}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
