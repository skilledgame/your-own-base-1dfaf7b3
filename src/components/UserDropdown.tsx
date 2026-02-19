/**
 * UserDropdown - User menu dropdown in header
 *
 * Shows username with arrow, expands to show menu options
 */

import { memo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWalletModal } from "@/contexts/WalletModalContext";
import {
  ChevronDown,
  ChevronUp,
  Wallet,
  Settings,
  Trophy,
  History,
  Users,
  LogOut,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useProfile } from "@/hooks/useProfile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserDropdownProps {
  className?: string;
}

export const UserDropdown = memo(({ className }: UserDropdownProps) => {
  const { user, isAuthenticated, isAuthReady, signOut } = useAuth();
  const { openWallet } = useWalletModal();
  const navigate = useNavigate();
  const { displayName, skinColor, skinIcon, isLoading: loading } = useProfile();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleOpenWallet = () => {
    setIsOpen(false);
    openWallet("deposit");
  };

  // Not ready yet
  if (!isAuthReady) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  const name = displayName || user?.email?.split("@")[0] || "User";

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl",
            "bg-slate-800/60 hover:bg-slate-700/60",
            "border border-slate-600/40",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            className,
          )}
        >
          <PlayerAvatar skinColor={skinColor} skinIcon={skinIcon} size="xs" />

          {/* Username */}
          {loading ? (
            <Skeleton className="h-4 w-16 bg-slate-600" />
          ) : (
            <span className="font-medium text-white text-sm max-w-[100px] truncate">{name}</span>
          )}

          {/* Arrow */}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 bg-slate-800 border-slate-700 rounded-xl shadow-xl shadow-black/30 z-50"
      >
        {/* Main actions */}
        <DropdownMenuItem onClick={handleOpenWallet} className="focus:bg-slate-700 cursor-pointer">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-200">Wallet</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="focus:bg-slate-700 cursor-pointer">
          <Link to="/vip" className="flex items-center gap-3 px-3 py-2.5">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-slate-200">Ranks</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="focus:bg-slate-700 cursor-pointer">
          <Link to="/stats" className="flex items-center gap-3 px-3 py-2.5">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-slate-200">Stats</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="focus:bg-slate-700 cursor-pointer">
          <Link to="/game-history" className="flex items-center gap-3 px-3 py-2.5">
            <History className="w-4 h-4 text-orange-400" />
            <span className="text-slate-200">Game History</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="focus:bg-slate-700 cursor-pointer">
          <Link to="/affiliate" className="flex items-center gap-3 px-3 py-2.5">
            <Users className="w-4 h-4 text-red-400" />
            <span className="text-slate-200">Refer & Earn</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-700" />

        <DropdownMenuItem asChild className="focus:bg-slate-700 cursor-pointer">
          <Link to="/settings" className="flex items-center gap-3 px-3 py-2.5">
            <Settings className="w-4 h-4 text-slate-400" />
            <span className="text-slate-200">Account Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-700" />

        {/* Logout */}
        <DropdownMenuItem onClick={handleSignOut} className="focus:bg-red-500/10 cursor-pointer">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <LogOut className="w-4 h-4 text-red-400" />
            <span className="text-red-400">Logout</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

UserDropdown.displayName = "UserDropdown";
