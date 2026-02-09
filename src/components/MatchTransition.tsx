/**
 * MatchTransition — unified loading overlay for:
 *  • matchmaking (finding opponent)
 *  • private game create / join (waiting for opponent)
 *  • reconnecting to an active game
 *
 * This replaces the multi-screen flicker with ONE stable UI
 * that stays until the game is ready.
 */

import { Loader2, Swords, WifiOff, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type TransitionVariant = 'matchmaking' | 'private_waiting' | 'reconnecting' | 'connecting';

interface MatchTransitionProps {
  variant: TransitionVariant;
  /** Short game code snippet (first 8 chars of UUID) */
  gameCode?: string;
  /** Wager amount displayed during search */
  wager?: number;
  onCancel?: () => void;
  onBack?: () => void;
}

const COPY: Record<TransitionVariant, { title: string; subtitle: string }> = {
  matchmaking: {
    title: 'Finding Opponent',
    subtitle: 'Searching for a player with similar wager…',
  },
  private_waiting: {
    title: 'Waiting for Opponent',
    subtitle: 'Your opponent is connecting…',
  },
  reconnecting: {
    title: 'Reconnecting',
    subtitle: 'Restoring your game session…',
  },
  connecting: {
    title: 'Connecting',
    subtitle: 'Establishing connection to game server…',
  },
};

export function MatchTransition({
  variant,
  gameCode,
  wager,
  onCancel,
  onBack,
}: MatchTransitionProps) {
  const { title, subtitle } = COPY[variant];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0f1a] gap-6">
      {/* Animated background pulse */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/15 rounded-full blur-[120px] animate-pulse" />
      </div>

      {/* Icon */}
      <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
        {variant === 'reconnecting' || variant === 'connecting' ? (
          <WifiOff className="w-10 h-10 text-white animate-pulse" />
        ) : (
          <Swords className="w-10 h-10 text-white" />
        )}
      </div>

      {/* Spinner + text */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="text-blue-200/60 text-sm">{subtitle}</p>
      </div>

      {/* Optional game code */}
      {gameCode && (
        <p className="relative z-10 text-sm text-blue-300/50">
          Game: <span className="font-mono">{gameCode}</span>
        </p>
      )}

      {/* Optional wager badge */}
      {wager !== undefined && wager > 0 && (
        <div className="relative z-10 px-4 py-1.5 rounded-full bg-yellow-950/50 border border-yellow-500/30 text-yellow-200 text-sm font-bold">
          {wager} SC
        </div>
      )}

      {/* Actions */}
      <div className="relative z-10 flex gap-3 mt-2">
        {onCancel && (
          <Button
            variant="outline"
            size="sm"
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-400 hover:text-blue-300"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
