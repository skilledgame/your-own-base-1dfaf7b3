/**
 * FriendsButton - Compact friend icon with online friend count
 * Styled inspired by Fortnite's friend list button.
 * Links to /friends page.
 */

import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useFriendStore } from '@/stores/friendStore';
import { cn } from '@/lib/utils';

interface FriendsButtonProps {
  className?: string;
}

export function FriendsButton({ className }: FriendsButtonProps) {
  const navigate = useNavigate();
  const friends = useFriendStore(state => state.friends);
  const friendCount = friends.length;

  return (
    <button
      onClick={() => navigate('/friends')}
      className={cn(
        "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
        "bg-primary/10 border border-primary/20",
        "text-primary hover:bg-primary/20 hover:border-primary/30",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-primary/40",
        className
      )}
      title="Friends"
    >
      <Users className="w-4 h-4" />
      <span className="text-xs font-bold tabular-nums leading-none">
        {friendCount}
      </span>
    </button>
  );
}
