import { Crown, Shield, Star, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePresence } from '@/hooks/usePresence';
import type { ClanMember } from '@/stores/clanStore';

interface ClanMemberListProps {
  members: ClanMember[];
}

const roleIcons: Record<string, React.ReactNode> = {
  leader: <Crown className="w-3 h-3 text-yellow-500" />,
  co_leader: <Shield className="w-3 h-3 text-blue-500" />,
  elder: <Star className="w-3 h-3 text-purple-500" />,
  member: <User className="w-3 h-3 text-muted-foreground" />,
};

const roleLabels: Record<string, string> = {
  leader: 'Leader',
  co_leader: 'Co-Leader',
  elder: 'Elder',
  member: 'Member',
};

function MemberStatusDot({ userId }: { userId: string }) {
  const { getStatus } = usePresence();
  const status = getStatus(userId);
  const colorMap = {
    online: 'bg-green-500',
    in_game: 'bg-yellow-500',
    offline: 'bg-gray-500',
  };
  return <div className={`w-2 h-2 rounded-full ${colorMap[status]}`} />;
}

export function ClanMemberList({ members }: ClanMemberListProps) {
  const sortedMembers = [...members].sort((a, b) => {
    const order = ['leader', 'co_leader', 'elder', 'member'];
    return order.indexOf(a.role) - order.indexOf(b.role);
  });

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
        Members ({members.length})
      </h3>
      {sortedMembers.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              {member.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5">
              <MemberStatusDot userId={member.user_id} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground text-sm truncate block">
              {member.display_name || 'Unknown'}
            </span>
            <span className="text-[10px] text-muted-foreground">{member.chess_elo || 800} ELO</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {roleIcons[member.role]}
            <span className="text-[10px] text-muted-foreground">{roleLabels[member.role]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
