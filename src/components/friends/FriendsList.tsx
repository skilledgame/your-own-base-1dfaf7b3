import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Gamepad2, MessageCircle, UserMinus, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePresence } from '@/hooks/usePresence';
import type { Friend } from '@/stores/friendStore';

interface FriendsListProps {
  friends: Friend[];
  loading: boolean;
  onRemoveFriend: (userId: string) => void;
  onInviteToGame: (userId: string) => void;
  onOpenChat: (userId: string) => void;
}

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}:${s.toString().padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span>{elapsed}</span>;
}

function StatusDot({ userId }: { userId: string }) {
  const { getStatus, getPresenceInfo } = usePresence();
  const status = getStatus(userId);
  const info = getPresenceInfo(userId);

  const colorMap = {
    online: 'bg-green-500',
    in_game: 'bg-yellow-500',
    offline: 'bg-gray-500',
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${colorMap[status]}`} />
      <span className="text-[10px] text-muted-foreground">
        {status === 'in_game' ? (
          <span className="text-yellow-500">
            In Game{' '}
            {info.game_started_at && <ElapsedTime startedAt={info.game_started_at} />}
          </span>
        ) : status === 'online' ? (
          'Online'
        ) : (
          'Offline'
        )}
      </span>
    </div>
  );
}

export function FriendsList({ friends, loading, onRemoveFriend, onInviteToGame, onOpenChat }: FriendsListProps) {
  const navigate = useNavigate();
  const { getStatus } = usePresence();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm font-medium">No friends yet</p>
        <p className="text-xs">Search for players and add them!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {friends.map((friend) => {
        const status = getStatus(friend.friend_user_id);
        return (
          <Card key={friend.friend_user_id} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {friend.display_name?.[0]?.toUpperCase() || '?'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm truncate">
                    {friend.display_name || 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {friend.chess_elo} ELO
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusDot userId={friend.friend_user_id} />
                  {friend.clan_name && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {friend.clan_name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {status === 'in_game' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => navigate(`/game/spectate/${friend.friend_user_id}`)}
                    title="Spectate game"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => onOpenChat(friend.friend_user_id)}
                  title="Message"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-green-500"
                  onClick={() => onInviteToGame(friend.friend_user_id)}
                  title="Invite to game"
                >
                  <Gamepad2 className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-red-500"
                  onClick={() => onRemoveFriend(friend.friend_user_id)}
                  title="Remove friend"
                >
                  <UserMinus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
