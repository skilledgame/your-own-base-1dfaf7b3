/**
 * FriendsButton - Header button that matches UserDropdown style.
 *
 * Shows friend icon + count. On hover, slides out a FriendsSlideover
 * panel from the right with Friends and Clan tabs.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Users } from "lucide-react";
import { useFriendStore } from "@/stores/friendStore";
import { cn } from "@/lib/utils";
import { FriendsSlideover } from "./FriendsSlideover";

interface FriendsButtonProps {
  className?: string;
}

export function FriendsButton({ className }: FriendsButtonProps) {
  const friends = useFriendStore((state) => state.friends);
  const friendCount = friends.length;
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl",
          "bg-slate-800/60 hover:bg-slate-700/60",
          "border border-slate-600/40",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "text-slate-300 hover:text-white",
          className,
        )}
        title="Friends"
      >
        <Users className="w-4 h-4" />
        <span className="text-sm font-semibold tabular-nums">{friendCount}</span>
      </button>

      <FriendsSlideover
        isOpen={isOpen}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </>
  );
}
