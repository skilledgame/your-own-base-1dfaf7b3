/**
 * FriendsButton - Header button matching UserDropdown style.
 *
 * Click toggles a full-height FriendsSlideover panel.
 * Open/close state lives in the friendStore so it persists across navigations.
 * The panel is portaled to document.body to escape the header's stacking context.
 */

import { createPortal } from "react-dom";
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
  const isOpen = useFriendStore((state) => state.panelOpen);
  const togglePanel = useFriendStore((state) => state.togglePanel);
  const closePanel = useFriendStore((state) => state.closePanel);

  return (
    <>
      <button
        onClick={togglePanel}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl",
          "bg-slate-800/60 hover:bg-slate-700/60",
          "border border-slate-600/40",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "text-slate-300 hover:text-white",
          isOpen && "bg-slate-700/60 text-white",
          className,
        )}
        title="Friends"
      >
        <Users className="w-4 h-4" />
        <span className="text-sm font-semibold tabular-nums">{friendCount}</span>
      </button>

      {createPortal(
        <FriendsSlideover isOpen={isOpen} onClose={closePanel} />,
        document.body,
      )}
    </>
  );
}
