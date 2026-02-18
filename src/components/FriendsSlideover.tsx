/**
 * FriendsSlideover - Popup panel with Friends/Messages tabs, inline profile,
 * DM chat, and game invite picker.
 *
 * Click friend row → profile. Message icon → DM. Gamepad icon → game picker.
 * Messages tab shows DM inbox. Friends who sent you a game invite glow green.
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
} from "lucide-react";
import { useFriendStore, type Friend } from "@/stores/friendStore";
import { usePresenceStore, type UserStatus } from "@/stores/presenceStore";
import { useChatStore, getDmChannelId } from "@/stores/chatStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface FriendsSlideoverProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ── Shared helpers ── */

function StatusDot({ status }: { status: UserStatus }) {
  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0f1923]",
        status === "online" && "bg-emerald-400",
        status === "in_game" && "bg-amber-400",
        status === "offline" && "bg-slate-600",
      )}
    />
  );
}

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

const GAMES = [
  { id: "chess", label: "Chess", icon: Crown },
] as const;

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

/* ── Game Invite Picker ── */

function GameInvitePicker({
  friend,
  onBack,
}: {
  friend: Friend;
  onBack: () => void;
}) {
  const inviteToGame = useFriendStore((s) => s.inviteToGame);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const handleInvite = async (gameId: string) => {
    setSending(gameId);
    try {
      await inviteToGame(friend.friend_user_id, gameId);
      setSent(gameId);
      toast.success(`Invited ${friend.display_name} to play!`);
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSending(null);
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
          Invite to Game
        </span>
      </div>

      <div className="p-4 text-center">
        <p className="text-sm text-slate-300">
          Choose a game to play with{" "}
          <span className="font-bold text-white">{friend.display_name}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2 px-4 pb-4">
        {GAMES.map((game) => {
          const Icon = game.icon;
          const isSent = sent === game.id;
          const isSending = sending === game.id;
          return (
            <button
              key={game.id}
              onClick={() => !isSent && handleInvite(game.id)}
              disabled={isSending || isSent}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors",
                isSent
                  ? "bg-emerald-500/10 border-emerald-500/25 cursor-default"
                  : "bg-white/[0.03] border-slate-700/25 hover:bg-white/[0.06] hover:border-slate-600/30",
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isSent
                    ? "bg-emerald-500/20"
                    : "bg-gradient-to-br from-amber-500 to-orange-600",
                )}
              >
                {isSent ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Icon className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-white">{game.label}</p>
                <p className="text-[11px] text-slate-500">
                  {isSent
                    ? "Invite sent!"
                    : isSending
                      ? "Sending..."
                      : "1v1 Private Match"}
                </p>
              </div>
            </button>
          );
        })}
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
  const status = usePresenceStore((s) => s.getStatus)(friend.friend_user_id);
  const removeFriend = useFriendStore((s) => s.removeFriend);
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
            <button className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 transition-colors">
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
  const status = usePresenceStore((s) => s.getStatus)(friend.friend_user_id);
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
  | { screen: "dm"; friend: Friend }
  | { screen: "invite"; friend: Friend };

export function FriendsSlideover({ isOpen, onClose }: FriendsSlideoverProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "messages">(
    "friends",
  );
  const [view, setView] = useState<View>({ screen: "list" });
  const [invitedByIds, setInvitedByIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch pending game invites to highlight friends who invited us
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
        if (n.metadata?.sender_id) ids.add(n.metadata.sender_id);
      });
      setInvitedByIds(ids);
    };

    fetchInvites();

    // Listen for new game invites
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
          if (notif.type === "game_invite" && notif.metadata?.sender_id) {
            setInvitedByIds((prev) => {
              const next = new Set(prev);
              next.add(notif.metadata.sender_id);
              return next;
            });
            const senderName =
              notif.metadata?.sender_name || "A friend";
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

  const goToDm = useCallback((friend: Friend) => {
    setView({ screen: "dm", friend });
  }, []);

  const goToInvite = useCallback((friend: Friend) => {
    setView({ screen: "invite", friend });
  }, []);

  const goBackFromDm = useCallback(() => {
    useChatStore.getState().reset();
    if (view.screen === "dm") {
      setView({ screen: "profile", friend: view.friend });
    } else {
      setView({ screen: "list" });
    }
  }, [view]);

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 w-[310px] h-[400px] z-[61]",
        "bg-[#0f1923]",
        "border border-slate-500/25",
        "rounded-2xl",
        "shadow-[0_8px_40px_rgba(0,0,0,0.45)]",
        "flex flex-col overflow-hidden",
        "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isOpen
          ? "translate-y-0 opacity-100"
          : "translate-y-8 opacity-0 pointer-events-none",
      )}
    >
      {view.screen === "dm" ? (
        <DmChatView friend={view.friend} onBack={goBackFromDm} />
      ) : view.screen === "profile" ? (
        <FriendProfileView
          friend={view.friend}
          onBack={goToList}
          onChat={() => goToDm(view.friend)}
        />
      ) : view.screen === "invite" ? (
        <GameInvitePicker friend={view.friend} onBack={goToList} />
      ) : (
        <>
          {/* Close bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {activeTab === "friends" ? "Friends" : "Messages"}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Close"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

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
                onOpenDm={goToDm}
                onOpenProfile={goToProfile}
                onOpenInvite={goToInvite}
                invitedByIds={invitedByIds}
              />
            ) : (
              <MessagesTabContent onOpenDm={goToDm} />
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
    </div>
  );
}
