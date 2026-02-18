/**
 * FriendsSlideover - Popup panel with Friends/Clan tabs, inline profile, and DM chat.
 *
 * Click a friend row → profile screen (Duolingo-style).
 * From profile, tap Chat → DM view. Tap message icon directly → DM.
 */

import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { useFriendStore, type Friend } from "@/stores/friendStore";
import { useClanStore } from "@/stores/clanStore";
import { usePresenceStore, type UserStatus } from "@/stores/presenceStore";
import { useChatStore, getDmChannelId } from "@/stores/chatStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FriendsSlideoverProps {
  isOpen: boolean;
  onClose: () => void;
}

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
    size === "lg"
      ? "w-3.5 h-3.5 border-[3px]"
      : "w-2.5 h-2.5 border-2";
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

function FriendRow({
  friend,
  status,
  onMessage,
  onClickRow,
}: {
  friend: Friend;
  status: UserStatus;
  onMessage: () => void;
  onClickRow: () => void;
}) {
  return (
    <div
      onClick={onClickRow}
      className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors group cursor-pointer"
    >
      <FriendAvatar name={friend.display_name} status={status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {friend.display_name}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {status === "in_game"
            ? "In Game"
            : status === "online"
              ? "Online"
              : "Offline"}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMessage();
        }}
        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-all"
        title="Message"
      >
        <MessageCircle className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── Friend Profile View (Duolingo-inspired) ── */

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
      .select("chess_elo, daily_play_streak, skilled_coins, total_wagered_sc, created_at, clan_id")
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
      {/* Header */}
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
          {/* Avatar */}
          <FriendAvatar
            name={friend.display_name}
            status={status}
            size="lg"
          />

          {/* Name */}
          <p className="mt-3 text-base font-bold text-white">
            {friend.display_name}
          </p>

          {/* Status pill */}
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

          {/* Member since */}
          <div className="flex items-center gap-1 mt-2">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span className="text-[11px] text-slate-500">
              Member since {memberSince}
            </span>
          </div>

          {/* Clan badge */}
          {friend.clan_name && (
            <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-slate-700/25">
              <Shield className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] font-medium text-slate-300">
                {friend.clan_name}
              </span>
            </div>
          )}
        </div>

        {/* Stats grid */}
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

        {/* Action buttons */}
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

/* ── DM Chat View (phone-style) ── */

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

/* ── Tab Content ── */

function FriendsTabContent({
  onOpenDm,
  onOpenProfile,
}: {
  onOpenDm: (friend: Friend) => void;
  onOpenProfile: (friend: Friend) => void;
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

function ClanTabContent() {
  const navigate = useNavigate();
  const clan = useClanStore((state) => state.clan);
  const members = useClanStore((state) => state.members);
  const getStatus = usePresenceStore((state) => state.getStatus);

  if (!clan) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mb-5">
          <Shield className="w-8 h-8 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-300 mb-1">
          No clan yet
        </p>
        <p className="text-xs text-slate-500 mb-5 max-w-[200px]">
          Create or join a clan to compete together
        </p>
        <button
          onClick={() => navigate("/clan")}
          className="px-5 py-2.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold hover:bg-purple-500/30 transition-colors"
        >
          Browse Clans
        </button>
      </div>
    );
  }

  const onlineMembers = members.filter(
    (m) => getStatus(m.user_id) !== "offline",
  );

  return (
    <div className="flex flex-col">
      <div className="mx-4 mt-4 px-4 py-4 rounded-xl bg-white/[0.03] border border-slate-700/30">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {clan.name}
            </p>
            <p className="text-xs text-slate-400">
              {clan.member_count} members · {clan.total_trophies} trophies
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="px-5 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Members — {onlineMembers.length} online
        </p>
        {members.slice(0, 10).map((member) => {
          const status = getStatus(member.user_id);
          const name = member.display_name || "Unknown";
          return (
            <div
              key={member.id}
              className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors"
            >
              <FriendAvatar name={name} status={status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-white truncate">
                    {name}
                  </p>
                  {member.role === "leader" && (
                    <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  )}
                  {member.role === "elder" && (
                    <Swords className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {member.chess_elo} ELO
                </p>
              </div>
            </div>
          );
        })}
        {members.length > 10 && (
          <p className="px-5 py-2.5 text-xs text-slate-500">
            +{members.length - 10} more members
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Main Slideover ── */

type View =
  | { screen: "list" }
  | { screen: "profile"; friend: Friend }
  | { screen: "dm"; friend: Friend };

export function FriendsSlideover({ isOpen, onClose }: FriendsSlideoverProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "clan">("friends");
  const [view, setView] = useState<View>({ screen: "list" });
  const navigate = useNavigate();

  const goToList = () => {
    setView({ screen: "list" });
    useChatStore.getState().reset();
  };

  const goToProfile = (friend: Friend) => {
    setView({ screen: "profile", friend });
  };

  const goToDm = (friend: Friend) => {
    setView({ screen: "dm", friend });
  };

  const goBackFromDm = () => {
    useChatStore.getState().reset();
    if (view.screen === "dm") {
      setView({ screen: "profile", friend: view.friend });
    } else {
      setView({ screen: "list" });
    }
  };

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
      ) : (
        <>
          {/* Close arrow bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {activeTab === "friends" ? "Friends" : "Clan"}
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
              onClick={() => setActiveTab("clan")}
              className={cn(
                "flex-1 py-2 text-xs font-bold tracking-wide uppercase rounded-md transition-all duration-200",
                activeTab === "clan"
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              Clan
            </button>
          </div>

          <div className="mx-3 mt-2.5 border-t border-slate-700/25" />

          <ScrollArea className="flex-1 min-h-0">
            {activeTab === "friends" ? (
              <FriendsTabContent
                onOpenDm={goToDm}
                onOpenProfile={goToProfile}
              />
            ) : (
              <ClanTabContent />
            )}
          </ScrollArea>

          <div className="flex-shrink-0 p-3 border-t border-slate-700/25">
            <button
              onClick={() =>
                navigate(activeTab === "friends" ? "/friends" : "/clan")
              }
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-full",
                "border border-slate-500/25 hover:border-slate-400/35",
                "bg-white/[0.04] hover:bg-white/[0.07]",
                "text-white text-sm font-bold tracking-wide",
                "transition-all duration-200",
              )}
            >
              <SmilePlus className="w-4 h-4" />
              {activeTab === "friends" ? "SEE ALL FRIENDS" : "VIEW CLAN"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
