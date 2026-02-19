/**
 * FriendsSlideover - Popup panel with Friends/Messages tabs, inline profile,
 * DM chat, and game invite picker with wager selection.
 *
 * Click friend row → profile. Message icon → DM. Gamepad icon → game picker.
 * Messages tab shows DM inbox. Friends who sent you a game invite glow green.
 * Arrow collapses/expands panel (doesn't close it).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Users,
  Shield,
  Crown,
  UserPlus,
  Swords,
  ChevronRight,
  SmilePlus,
  ChevronDown,
  ChevronUp,
  X,
  ArrowLeft,
  Send,
  BarChart3,
  Eye,
  UserMinus,
  Trophy,
  Flame,
  Calendar,
  Gamepad2,
  Check,
  Lock,
  Coins,
  Loader2,
} from "lucide-react";
import { useFriendStore, type Friend } from "@/stores/friendStore";
import { usePresenceStore, type UserStatus } from "@/stores/presenceStore";
import { useChatStore, getDmChannelId } from "@/stores/chatStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBalance } from "@/hooks/useBalance";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface FriendsSlideoverProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ── Shared helpers ── */

function FriendAvatar({
  name,
  status,
  size = "md",
}: {
  name: string;
  status: UserStatus;
  size?: "sm" | "md" | "lg";
}) {
  const initial = name.charAt(0).toUpperCase();
  const dim =
    size === "sm" ? "w-8 h-8" : size === "lg" ? "w-16 h-16" : "w-10 h-10";
  const text =
    size === "sm" ? "text-xs" : size === "lg" ? "text-2xl" : "text-sm";
  const dotSize =
    size === "lg" ? "w-3.5 h-3.5 border-[3px]" : "w-2.5 h-2.5 border-2";
  return (
    <div className="relative flex-shrink-0">
      <div
        className={cn(
          dim,
          "rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center",
        )}
      >
        <span className={cn("text-white font-bold", text)}>{initial}</span>
      </div>
      <span
        className={cn(
          "absolute bottom-0 right-0 rounded-full border-[#0f1923]",
          dotSize,
          status === "online" && "bg-emerald-400",
          status === "in_game" && "bg-amber-400",
          status === "offline" && "bg-slate-600",
        )}
      />
    </div>
  );
}

const INVITE_GAMES = [
  { id: "chess", label: "Chess", emoji: "♟️", gradientFrom: "#1e3a5f", gradientTo: "#0d1b2a", available: true },
  { id: "game2", label: "", emoji: "🪿", gradientFrom: "#6b5c5c", gradientTo: "#4a3f3f", available: false },
  { id: "game3", label: "", emoji: "🦖", gradientFrom: "#4a6b5c", gradientTo: "#3a5248", available: false },
  { id: "game4", label: "", emoji: "🏓", gradientFrom: "#6b5a4a", gradientTo: "#524638", available: false },
] as const;

const WAGER_OPTIONS = [100, 500, 1000] as const;

/* ── Friend Row ── */

function FriendRow({
  friend,
  status,
  onMessage,
  onClickRow,
  onInvite,
  hasInvite,
}: {
  friend: Friend;
  status: UserStatus;
  onMessage: () => void;
  onClickRow: () => void;
  onInvite: () => void;
  hasInvite: boolean;
}) {
  return (
    <div
      onClick={onClickRow}
      className={cn(
        "flex items-center gap-3 px-5 py-3 transition-colors group cursor-pointer",
        hasInvite
          ? "bg-emerald-500/[0.07] hover:bg-emerald-500/[0.12]"
          : "hover:bg-white/[0.04]",
      )}
    >
      <div className="relative">
        <FriendAvatar name={friend.display_name} status={status} />
        {hasInvite && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0f1923] animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {friend.display_name}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {hasInvite ? (
            <span className="text-emerald-400 font-medium">
              Invited you to play!
            </span>
          ) : status === "in_game" ? (
            "In Game"
          ) : status === "online" ? (
            "Online"
          ) : (
            "Offline"
          )}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInvite();
          }}
          className="p-2 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-emerald-400 transition-all"
          title="Invite to game"
        >
          <Gamepad2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMessage();
          }}
          className="p-2 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-all"
          title="Message"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Game Invite Picker (game selection + wager) ── */

function GameInvitePicker({
  friend,
  onBack,
}: {
  friend: Friend;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const closePanel = useFriendStore((s) => s.closePanel);
  const inviteToGame = useFriendStore((s) => s.inviteToGame);
  const { balance } = useBalance();

  const [step, setStep] = useState<"game" | "wager" | "waiting">("game");
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [selectedWager, setSelectedWager] = useState<number>(100);
  const [customWager, setCustomWager] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [sending, setSending] = useState(false);

  // Waiting state
  const [lobbyRoomId, setLobbyRoomId] = useState<string | null>(null);
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);
  const [friendJoined, setFriendJoined] = useState(false);
  const [gameStarting, setGameStarting] = useState(false);

  const effectiveWager = useCustom
    ? parseInt(customWager, 10) || 0
    : selectedWager;

  const handleSelectGame = (gameId: string) => {
    setSelectedGame(gameId);
    setStep("wager");
  };

  // Subscribe to room updates when waiting
  useEffect(() => {
    if (step !== "waiting" || !lobbyRoomId) return;

    const channel = supabase
      .channel(`invite-room-${lobbyRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "private_rooms",
          filter: `id=eq.${lobbyRoomId}`,
        },
        (payload) => {
          const room = payload.new as any;
          if (room.joiner_id && !friendJoined) {
            setFriendJoined(true);
            setGameStarting(true);
            setTimeout(() => {
              closePanel();
              navigate(`/game/lobby/${lobbyRoomId}`);
            }, 1500);
          }
          if (room.status === "started" && room.game_id) {
            closePanel();
            navigate(`/game/live/${room.game_id}`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [step, lobbyRoomId, friendJoined, navigate, closePanel]);

  const handleSendInvite = async () => {
    if (effectiveWager <= 0) {
      toast.error("Please enter a valid wager amount");
      return;
    }
    if (effectiveWager > balance) {
      toast.error("Insufficient balance for this wager");
      return;
    }

    setSending(true);
    try {
      const response = await supabase.functions.invoke("create-lobby", {
        body: { wager: effectiveWager, gameType: "chess" },
      });

      if (response.error || response.data?.success === false) {
        toast.error(
          response.data?.error ||
            response.data?.details ||
            "Failed to create lobby",
        );
        setSending(false);
        return;
      }

      const { lobbyCode: code, roomId } = response.data;
      if (!code || !roomId) {
        toast.error("Invalid response from server");
        setSending(false);
        return;
      }

      // Encode both roomId and lobbyCode so the receiver can join
      await inviteToGame(friend.friend_user_id, `${roomId}::${code}`);

      setLobbyRoomId(roomId);
      setLobbyCode(code);
      setStep("waiting");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  // Step: game selection
  if (step === "game") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 py-2.5 border-b border-slate-700/25 flex-shrink-0">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="ml-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            Invite to Game
          </span>
        </div>

        <div className="px-4 pt-3 pb-2">
          <p className="text-sm text-slate-300">
            Play with{" "}
            <span className="font-bold text-white">{friend.display_name}</span>
          </p>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-2.5 px-4 pb-4">
            {INVITE_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => game.available && handleSelectGame(game.id)}
                disabled={!game.available}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-2xl aspect-square overflow-hidden transition-all",
                  game.available
                    ? "hover:scale-[1.03] cursor-pointer ring-1 ring-white/10 hover:ring-white/25"
                    : "opacity-50 cursor-not-allowed",
                )}
                style={{
                  background: `linear-gradient(135deg, ${game.gradientFrom}, ${game.gradientTo})`,
                }}
              >
                <span className="text-4xl mb-1.5 drop-shadow-lg">{game.emoji}</span>
                {game.available ? (
                  <p className="text-xs font-bold text-white drop-shadow">{game.label}</p>
                ) : (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="bg-black/50 backdrop-blur-sm rounded-full p-2">
                        <Lock className="w-4 h-4 text-white/60" />
                      </div>
                    </div>
                    <p className="relative text-[10px] font-semibold text-white/50 mt-0.5">
                      Coming Soon
                    </p>
                  </>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Step: waiting for friend
  if (step === "waiting") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 py-2.5 border-b border-slate-700/25 flex-shrink-0">
          <button
            onClick={() => {
              closePanel();
              if (lobbyRoomId) navigate(`/game/lobby/${lobbyRoomId}`);
            }}
            className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="ml-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            Waiting
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {gameStarting ? (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-base font-bold text-white mb-1">
                {friend.display_name} joined!
              </p>
              <p className="text-sm text-slate-400">
                Setting up the game...
              </p>
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin mt-4" />
            </>
          ) : friendJoined ? (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-base font-bold text-white mb-1">
                {friend.display_name} joined!
              </p>
              <p className="text-sm text-slate-400">
                Preparing the match...
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 animate-pulse">
                <Users className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-base font-bold text-white mb-1">
                Invite sent!
              </p>
              <p className="text-sm text-slate-400 mb-4">
                Waiting for {friend.display_name} to join...
              </p>
              <div className="px-4 py-3 rounded-xl bg-white/[0.04] border border-slate-700/25">
                <p className="text-[11px] text-slate-500 mb-1">Wager</p>
                <p className="text-lg font-bold text-white">
                  {effectiveWager} SC
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Step: wager
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-3 py-2.5 border-b border-slate-700/25 flex-shrink-0">
        <button
          onClick={() => setStep("game")}
          className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="ml-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          Set Wager
        </span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 pt-4 pb-4 flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-3xl">♟️</span>
            <p className="text-sm font-bold text-white">Chess</p>
          </div>

          <div className="flex flex-col gap-2">
            {WAGER_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  setSelectedWager(amount);
                  setUseCustom(false);
                }}
                disabled={amount > balance}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
                  !useCustom && selectedWager === amount
                    ? "bg-purple-500/15 border-purple-500/30 ring-1 ring-purple-500/20"
                    : "bg-white/[0.03] border-slate-700/25 hover:bg-white/[0.06]",
                  amount > balance && "opacity-40 cursor-not-allowed",
                )}
              >
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-bold text-white">
                    {amount} SC
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-medium">
                  Win {Math.floor(amount * 1.9)} SC
                </span>
              </button>
            ))}

            {/* Custom wager */}
            <button
              onClick={() => setUseCustom(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all",
                useCustom
                  ? "bg-purple-500/15 border-purple-500/30 ring-1 ring-purple-500/20"
                  : "bg-white/[0.03] border-slate-700/25 hover:bg-white/[0.06]",
              )}
            >
              <Coins className="w-4 h-4 text-yellow-500" />
              {useCustom ? (
                <input
                  autoFocus
                  type="number"
                  value={customWager}
                  onChange={(e) => setCustomWager(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Amount"
                  min={50}
                  max={100000}
                  className="flex-1 bg-transparent text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none w-20"
                />
              ) : (
                <span className="text-sm font-bold text-slate-400">
                  Custom Amount
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs mt-1 px-1">
            <span className="text-slate-500">Your balance</span>
            <span className="text-white font-semibold">
              {balance.toLocaleString()} SC
            </span>
          </div>
        </div>
      </ScrollArea>

      <div className="flex-shrink-0 p-3 border-t border-slate-700/25">
        <button
          onClick={handleSendInvite}
          disabled={sending || effectiveWager <= 0 || effectiveWager > balance}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all",
            sending || effectiveWager <= 0 || effectiveWager > balance
              ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
              : "bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:from-purple-400 hover:to-violet-400",
          )}
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating lobby...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Invite — {effectiveWager > 0 ? `${effectiveWager} SC` : "..."}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Friend Profile View ── */

interface FriendProfile {
  chess_elo: number;
  daily_play_streak: number;
  skilled_coins: number;
  total_wagered_sc: number;
  created_at: string;
  clan_id: string | null;
}

function FriendProfileView({
  friend,
  onBack,
  onChat,
}: {
  friend: Friend;
  onBack: () => void;
  onChat: () => void;
}) {
  const navigate = useNavigate();
  const status: UserStatus = usePresenceStore(
    (s) => s.statusMap[friend.friend_user_id] || "offline",
  );
  const removeFriend = useFriendStore((s) => s.removeFriend);
  const closePanel = useFriendStore((s) => s.closePanel);
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select(
        "chess_elo, daily_play_streak, skilled_coins, total_wagered_sc, created_at, clan_id",
      )
      .eq("user_id", friend.friend_user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data as FriendProfile);
      });
  }, [friend.friend_user_id]);

  const statusLabel =
    status === "in_game"
      ? "In Game"
      : status === "online"
        ? "Online"
        : "Offline";

  const statusColor =
    status === "online"
      ? "text-emerald-400"
      : status === "in_game"
        ? "text-amber-400"
        : "text-slate-500";

  const memberSince = profile
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "...";

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeFriend(friend.friend_user_id);
      onBack();
    } catch {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-3 py-2.5 border-b border-slate-700/25 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="ml-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          Profile
        </span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col items-center pt-5 pb-4 px-4">
          <FriendAvatar
            name={friend.display_name}
            status={status}
            size="lg"
          />
          <p className="mt-3 text-base font-bold text-white">
            {friend.display_name}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                status === "online" && "bg-emerald-400",
                status === "in_game" && "bg-amber-400",
                status === "offline" && "bg-slate-600",
              )}
            />
            <span className={cn("text-xs font-medium", statusColor)}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span className="text-[11px] text-slate-500">
              Member since {memberSince}
            </span>
          </div>
          {friend.clan_name && (
            <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-slate-700/25">
              <Shield className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] font-medium text-slate-300">
                {friend.clan_name}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mx-4 mb-4">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-slate-700/20">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-xs font-bold text-white">
                {profile?.chess_elo ?? friend.chess_elo}
              </p>
              <p className="text-[10px] text-slate-500">ELO</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-slate-700/20">
            <Flame className="w-4 h-4 text-orange-400" />
            <div>
              <p className="text-xs font-bold text-white">
                {profile?.daily_play_streak ?? 0}
              </p>
              <p className="text-[10px] text-slate-500">Day Streak</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mx-4 mb-4">
          <button
            onClick={onChat}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-slate-700/20 transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-slate-200">Chat</span>
          </button>
          <button
            onClick={() => navigate("/stats")}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-slate-700/20 transition-colors"
          >
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-slate-200">Stats</span>
          </button>
          {status === "in_game" && (
            <button
              onClick={() => {
                closePanel();
                navigate(`/game/spectate/${friend.friend_user_id}`);
              }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 transition-colors"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-200">
                Spectate
              </span>
            </button>
          )}
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.02] hover:bg-red-500/10 border border-slate-700/20 hover:border-red-500/20 transition-colors group"
          >
            <UserMinus className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
            <span className="text-sm font-medium text-slate-400 group-hover:text-red-400 transition-colors">
              {removing ? "Removing..." : "Remove Friend"}
            </span>
          </button>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── DM Chat View ── */

function DmChatView({
  friend,
  onBack,
}: {
  friend: Friend;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const status: UserStatus = usePresenceStore(
    (s) => s.statusMap[friend.friend_user_id] || "offline",
  );
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const setActiveChannel = useChatStore((s) => s.setActiveChannel);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.id) {
      const channelId = getDmChannelId(user.id, friend.friend_user_id);
      setActiveChannel("dm", channelId);
    }
  }, [user?.id, friend.friend_user_id, setActiveChannel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  const statusLabel =
    status === "in_game"
      ? "In Game"
      : status === "online"
        ? "Online"
        : "Offline";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-700/25 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <FriendAvatar name={friend.display_name} status={status} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">
            {friend.display_name}
          </p>
          <p
            className={cn(
              "text-[11px] leading-tight",
              status === "online"
                ? "text-emerald-400"
                : status === "in_game"
                  ? "text-amber-400"
                  : "text-slate-500",
            )}
          >
            {statusLabel}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1.5 p-3">
          {loading && messages.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-8">
              Loading messages...
            </p>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-8">
              No messages yet. Say hi!
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={cn("flex", isMe ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words",
                    isMe
                      ? "bg-purple-600 text-white rounded-br-md"
                      : "bg-white/[0.07] text-slate-200 rounded-bl-md",
                  )}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-700/25 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 bg-white/[0.05] border border-slate-700/30 rounded-full px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/40"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className={cn(
            "p-2 rounded-full transition-colors",
            input.trim()
              ? "bg-purple-600 text-white hover:bg-purple-500"
              : "bg-white/[0.04] text-slate-600",
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Messages Inbox Tab ── */

interface ConversationPreview {
  friendUserId: string;
  friendName: string;
  lastMessage: string;
  lastMessageAt: string;
  isMe: boolean;
}

function MessagesTabContent({
  onOpenDm,
}: {
  onOpenDm: (friend: Friend) => void;
}) {
  const { user } = useAuth();
  const friends = useFriendStore((s) => s.friends);
  const getStatus = usePresenceStore((s) => s.getStatus);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || friends.length === 0) {
      setLoading(false);
      return;
    }

    const channelIds = friends.map((f) =>
      getDmChannelId(user.id, f.friend_user_id),
    );

    supabase
      .from("messages")
      .select("*")
      .eq("channel_type", "dm")
      .in("channel_id", channelIds)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const seen = new Set<string>();
        const convos: ConversationPreview[] = [];
        for (const msg of data || []) {
          if (seen.has(msg.channel_id)) continue;
          seen.add(msg.channel_id);
          const friend = friends.find(
            (f) =>
              getDmChannelId(user.id, f.friend_user_id) === msg.channel_id,
          );
          if (!friend) continue;
          convos.push({
            friendUserId: friend.friend_user_id,
            friendName: friend.display_name,
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            isMe: msg.sender_id === user.id,
          });
        }
        setConversations(convos);
        setLoading(false);
      });
  }, [user?.id, friends]);

  if (loading) {
    return (
      <p className="text-xs text-slate-500 text-center py-8">
        Loading messages...
      </p>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center mb-4">
          <MessageCircle className="w-7 h-7 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-300 mb-1">
          No messages yet
        </p>
        <p className="text-xs text-slate-500 max-w-[200px]">
          Tap the message icon on a friend to start a conversation
        </p>
      </div>
    );
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div className="flex flex-col">
      {conversations.map((convo) => {
        const friend = friends.find(
          (f) => f.friend_user_id === convo.friendUserId,
        );
        if (!friend) return null;
        const status = getStatus(convo.friendUserId);
        return (
          <div
            key={convo.friendUserId}
            onClick={() => onOpenDm(friend)}
            className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <FriendAvatar name={convo.friendName} status={status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white truncate">
                  {convo.friendName}
                </p>
                <span className="text-[10px] text-slate-500 ml-2 flex-shrink-0">
                  {timeAgo(convo.lastMessageAt)}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {convo.isMe ? "You: " : ""}
                {convo.lastMessage}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Friends Tab Content ── */

function FriendsTabContent({
  onOpenDm,
  onOpenProfile,
  onOpenInvite,
  invitedByIds,
}: {
  onOpenDm: (friend: Friend) => void;
  onOpenProfile: (friend: Friend) => void;
  onOpenInvite: (friend: Friend) => void;
  invitedByIds: Set<string>;
}) {
  const navigate = useNavigate();
  const friends = useFriendStore((state) => state.friends);
  const pendingRequests = useFriendStore((state) => state.pendingRequests);
  const getStatus = usePresenceStore((state) => state.getStatus);
  const { user } = useAuth();

  const onlineFriends = friends.filter(
    (f) => getStatus(f.friend_user_id) !== "offline",
  );
  const offlineFriends = friends.filter(
    (f) => getStatus(f.friend_user_id) === "offline",
  );
  const incomingCount = pendingRequests.filter(
    (r) => r.receiver_id === user?.id,
  ).length;

  return (
    <div className="flex flex-col">
      {incomingCount > 0 && (
        <button
          onClick={() => navigate("/friends")}
          className="mx-4 mt-4 flex items-center gap-3 px-4 py-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-purple-200">
              Friend Requests
            </p>
            <p className="text-xs text-purple-400/70">
              {incomingCount} pending
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </button>
      )}

      {onlineFriends.length > 0 && (
        <div className="mt-4">
          <p className="px-5 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Online — {onlineFriends.length}
          </p>
          {onlineFriends.map((friend) => (
            <FriendRow
              key={friend.friend_user_id}
              friend={friend}
              status={getStatus(friend.friend_user_id)}
              onMessage={() => onOpenDm(friend)}
              onClickRow={() => onOpenProfile(friend)}
              onInvite={() => onOpenInvite(friend)}
              hasInvite={invitedByIds.has(friend.friend_user_id)}
            />
          ))}
        </div>
      )}

      {offlineFriends.length > 0 && (
        <div className="mt-4">
          <p className="px-5 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Offline — {offlineFriends.length}
          </p>
          {offlineFriends.map((friend) => (
            <FriendRow
              key={friend.friend_user_id}
              friend={friend}
              status="offline"
              onMessage={() => onOpenDm(friend)}
              onClickRow={() => onOpenProfile(friend)}
              onInvite={() => onOpenInvite(friend)}
              hasInvite={invitedByIds.has(friend.friend_user_id)}
            />
          ))}
        </div>
      )}

      {friends.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mb-5">
            <Users className="w-8 h-8 text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-slate-300 mb-1">
            No friends yet
          </p>
          <p className="text-xs text-slate-500 mb-5 max-w-[200px]">
            Search for players and send friend requests to get started
          </p>
          <button
            onClick={() => navigate("/friends")}
            className="px-5 py-2.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold hover:bg-purple-500/30 transition-colors"
          >
            Find Friends
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Slideover ── */

type View =
  | { screen: "list" }
  | { screen: "profile"; friend: Friend }
  | { screen: "dm"; friend: Friend; returnTo: "list" | "profile" | "messages" }
  | { screen: "invite"; friend: Friend };

export function FriendsSlideover({ isOpen, onClose }: FriendsSlideoverProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "messages">(
    "friends",
  );
  const [view, setView] = useState<View>({ screen: "list" });
  const [invitedByIds, setInvitedByIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const navigate = useNavigate();

  const collapsed = useFriendStore((s) => s.panelCollapsed);
  const toggleCollapse = useFriendStore((s) => s.toggleCollapse);

  useEffect(() => {
    if (!user?.id) return;

    const fetchInvites = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("metadata")
        .eq("user_id", user.id)
        .eq("type", "game_invite")
        .eq("action_taken", false);

      const ids = new Set<string>();
      (data || []).forEach((n: any) => {
        const id = n.metadata?.inviter_id || n.metadata?.sender_id;
        if (id) ids.add(id);
      });
      setInvitedByIds(ids);
    };

    fetchInvites();

    const channel = supabase
      .channel(`game-invites-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as any;
          const inviterId = notif.metadata?.inviter_id || notif.metadata?.sender_id;
          if (notif.type === "game_invite" && inviterId) {
            setInvitedByIds((prev) => {
              const next = new Set(prev);
              next.add(inviterId);
              return next;
            });
            const senderName =
              notif.metadata?.inviter_name || notif.metadata?.sender_name || "A friend";
            toast.info(`${senderName} invited you to play!`, {
              icon: <Gamepad2 className="w-4 h-4" />,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const goToList = useCallback(() => {
    setView({ screen: "list" });
    useChatStore.getState().reset();
  }, []);

  const goToProfile = useCallback((friend: Friend) => {
    setView({ screen: "profile", friend });
  }, []);

  const goToDm = useCallback(
    (friend: Friend, returnTo: "list" | "profile" | "messages" = "list") => {
      setView({ screen: "dm", friend, returnTo });
    },
    [],
  );

  const goToInvite = useCallback((friend: Friend) => {
    setView({ screen: "invite", friend });
  }, []);

  const goBackFromDm = useCallback(() => {
    useChatStore.getState().reset();
    if (view.screen === "dm") {
      if (view.returnTo === "profile") {
        setView({ screen: "profile", friend: view.friend });
      } else {
        setView({ screen: "list" });
        if (view.returnTo === "messages") {
          setActiveTab("messages");
        }
      }
    } else {
      setView({ screen: "list" });
    }
  }, [view]);

  const COLLAPSED_HEIGHT = "h-[44px]";
  const EXPANDED_HEIGHT = "h-[400px]";

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 w-[310px] z-[61]",
        "bg-[#0f1923]",
        "border border-slate-500/25",
        "rounded-2xl",
        "shadow-[0_8px_40px_rgba(0,0,0,0.45)]",
        "flex flex-col overflow-hidden",
        "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isOpen
          ? "translate-y-0 opacity-100"
          : "translate-y-8 opacity-0 pointer-events-none",
        collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
      )}
    >
      {view.screen === "dm" ? (
        <DmChatView friend={view.friend} onBack={goBackFromDm} />
      ) : view.screen === "profile" ? (
        <FriendProfileView
          friend={view.friend}
          onBack={goToList}
          onChat={() => goToDm(view.friend, "profile")}
        />
      ) : view.screen === "invite" ? (
        <GameInvitePicker friend={view.friend} onBack={goToList} />
      ) : (
        <>
          {/* Header bar — always visible, even when collapsed */}
          <div className="flex items-center justify-between px-4 h-[44px] flex-shrink-0">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {activeTab === "friends" ? "Friends" : "Messages"}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content below header — hidden when collapsed */}
          {!collapsed && (
            <>
              {/* Tabs */}
              <div className="flex flex-shrink-0 mx-3 rounded-lg bg-white/[0.04] p-0.5">
                <button
                  onClick={() => setActiveTab("friends")}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold tracking-wide uppercase rounded-md transition-all duration-200",
                    activeTab === "friends"
                      ? "bg-white/[0.08] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300",
                  )}
                >
                  Friends
                </button>
                <button
                  onClick={() => setActiveTab("messages")}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold tracking-wide uppercase rounded-md transition-all duration-200",
                    activeTab === "messages"
                      ? "bg-white/[0.08] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300",
                  )}
                >
                  Messages
                </button>
              </div>

              <div className="mx-3 mt-2.5 border-t border-slate-700/25" />

              <ScrollArea className="flex-1 min-h-0">
                {activeTab === "friends" ? (
                  <FriendsTabContent
                    onOpenDm={(f) => goToDm(f, "list")}
                    onOpenProfile={goToProfile}
                    onOpenInvite={goToInvite}
                    invitedByIds={invitedByIds}
                  />
                ) : (
                  <MessagesTabContent onOpenDm={(f) => goToDm(f, "messages")} />
                )}
              </ScrollArea>

              <div className="flex-shrink-0 p-3 border-t border-slate-700/25">
                <button
                  onClick={() => navigate("/friends")}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-full",
                    "border border-slate-500/25 hover:border-slate-400/35",
                    "bg-white/[0.04] hover:bg-white/[0.07]",
                    "text-white text-sm font-bold tracking-wide",
                    "transition-all duration-200",
                  )}
                >
                  <SmilePlus className="w-4 h-4" />
                  SEE ALL FRIENDS
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
