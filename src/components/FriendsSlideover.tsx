/**
 * FriendsSlideover - Slide-out panel that appears on hover of FriendsButton
 *
 * Two tabs: Friends and Clan (inspired by Fortnite friend panel).
 * Slides in from the right with smooth animation.
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
} from "lucide-react";
import { useFriendStore, type Friend } from "@/stores/friendStore";
import { useClanStore } from "@/stores/clanStore";
import { usePresenceStore, type UserStatus } from "@/stores/presenceStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FriendsSlideoverProps {
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function StatusDot({ status }: { status: UserStatus }) {
  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900",
        status === "online" && "bg-emerald-400",
        status === "in_game" && "bg-amber-400",
        status === "offline" && "bg-slate-500",
      )}
    />
  );
}

function FriendAvatar({ name, status }: { name: string; status: UserStatus }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="relative flex-shrink-0">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
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
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/60 transition-colors group">
      <FriendAvatar name={friend.display_name} status={status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
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
        onClick={onMessage}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-all"
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
          className="mx-3 mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-purple-300">
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
        <div className="mt-3">
          <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
        <div className="mt-3">
          <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-400 mb-1">
            No friends yet
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Search for players and send friend requests
          </p>
          <button
            onClick={() => navigate("/friends")}
            className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-semibold hover:bg-purple-500/30 transition-colors"
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
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <Shield className="w-7 h-7 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-400 mb-1">
          No clan yet
        </p>
        <p className="text-xs text-slate-500 mb-4">
          Create or join a clan to compete together
        </p>
        <button
          onClick={() => navigate("/clan")}
          className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-semibold hover:bg-purple-500/30 transition-colors"
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
      <div className="mx-3 mt-3 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-100 truncate">
              {clan.name}
            </p>
            <p className="text-xs text-slate-400">
              {clan.member_count} members · {clan.total_trophies} trophies
            </p>
          </div>
        </div>
      </div>

      {/* Online members */}
      <div className="mt-3">
        <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Members Online — {onlineMembers.length}
        </p>
        {members.slice(0, 8).map((member) => {
          const status = getStatus(member.user_id);
          const name = member.display_name || "Unknown";
          return (
            <div
              key={member.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/60 transition-colors"
            >
              <FriendAvatar name={name} status={status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {name}
                  </p>
                  {member.role === "leader" && (
                    <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  )}
                  {member.role === "elder" && (
                    <Swords className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {member.chess_elo} ELO
                </p>
              </div>
            </div>
          );
        })}
        {members.length > 8 && (
          <p className="px-4 py-2 text-xs text-slate-500">
            +{members.length - 8} more members
          </p>
        )}
      </div>
    </div>
  );
}

export function FriendsSlideover({
  isOpen,
  onMouseEnter,
  onMouseLeave,
}: FriendsSlideoverProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "clan">("friends");
  const navigate = useNavigate();

  return (
    <>
      {/* Backdrop for mobile - not needed since desktop only, but adds polish */}
      <div
        className={cn(
          "fixed inset-0 z-[45] transition-opacity duration-300 pointer-events-none",
          isOpen ? "bg-black/20 opacity-100" : "opacity-0",
        )}
      />

      {/* Panel */}
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={cn(
          "fixed top-0 right-0 bottom-0 w-[340px] z-[46]",
          "bg-slate-900/[0.97] backdrop-blur-2xl",
          "border-l border-slate-700/50",
          "shadow-2xl shadow-black/50",
          "flex flex-col",
          "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isOpen
            ? "translate-x-0 opacity-100"
            : "translate-x-full opacity-0",
        )}
        style={{ paddingTop: "80px" }}
      >
        {/* Tabs */}
        <div className="flex border-b border-slate-700/50 flex-shrink-0">
          <button
            onClick={() => setActiveTab("friends")}
            className={cn(
              "flex-1 py-3.5 text-xs font-bold tracking-widest uppercase transition-all duration-200",
              activeTab === "friends"
                ? "text-white border-b-2 border-purple-500"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab("clan")}
            className={cn(
              "flex-1 py-3.5 text-xs font-bold tracking-widest uppercase transition-all duration-200",
              activeTab === "clan"
                ? "text-white border-b-2 border-purple-500"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            Clan
          </button>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 min-h-0">
          {activeTab === "friends" ? (
            <FriendsTabContent />
          ) : (
            <ClanTabContent />
          )}
        </ScrollArea>

        {/* Bottom action button */}
        <div className="flex-shrink-0 p-4 border-t border-slate-700/50">
          <button
            onClick={() =>
              navigate(activeTab === "friends" ? "/friends" : "/clan")
            }
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-full",
              "border border-slate-600/40 hover:border-slate-500/50",
              "bg-slate-800/40 hover:bg-slate-700/50",
              "text-slate-200 text-sm font-semibold",
              "transition-all duration-200",
            )}
          >
            {activeTab === "friends" ? (
              <>
                <Users className="w-4 h-4" />
                SEE ALL FRIENDS
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                VIEW CLAN
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
