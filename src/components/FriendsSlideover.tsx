/**
 * FriendsSlideover - Full-height slide-out panel on the right side.
 *
 * Portaled to document.body so it escapes the header's stacking context.
 * Starts below the header, stretches to the bottom of the viewport.
 * Heavy backdrop dims the page behind it.
 */

import { useState } from "react";
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
} from "lucide-react";
import { useFriendStore, type Friend } from "@/stores/friendStore";
import { useClanStore } from "@/stores/clanStore";
import { usePresenceStore, type UserStatus } from "@/stores/presenceStore";
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

function FriendAvatar({ name, status }: { name: string; status: UserStatus }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="relative flex-shrink-0">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        <span className="text-white text-sm font-bold">{initial}</span>
      </div>
      <StatusDot status={status} />
    </div>
  );
}

function FriendRow({
  friend,
  status,
  onMessage,
}: {
  friend: Friend;
  status: UserStatus;
  onMessage: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors group">
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

function FriendsTabContent() {
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
      {/* Pending requests banner */}
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

      {/* Online friends */}
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
              onMessage={() => navigate("/friends")}
            />
          ))}
        </div>
      )}

      {/* Offline friends */}
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
              onMessage={() => navigate("/friends")}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
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
      {/* Clan header card */}
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

      {/* Members */}
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

export function FriendsSlideover({ isOpen, onClose }: FriendsSlideoverProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "clan">("friends");
  const navigate = useNavigate();

  return (
    <>
      {/* Panel - slides up from bottom, right side, no backdrop */}
      <div
        className={cn(
          "fixed right-4 bottom-4 w-[310px] h-[520px] z-[61]",
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

        {/* Thin separator */}
        <div className="mx-3 mt-2.5 border-t border-slate-700/25" />

        {/* Scrollable content */}
        <ScrollArea className="flex-1 min-h-0">
          {activeTab === "friends" ? <FriendsTabContent /> : <ClanTabContent />}
        </ScrollArea>

        {/* Bottom button */}
        <div className="flex-shrink-0 p-3 border-t border-slate-700/25">
          <button
            onClick={() => {
              navigate(activeTab === "friends" ? "/friends" : "/clan");
              onClose();
            }}
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
      </div>
    </>
  );
}
