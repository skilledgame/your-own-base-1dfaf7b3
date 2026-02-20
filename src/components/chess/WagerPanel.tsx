import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { useChessWebSocket } from '@/hooks/useChessWebSocket';
import { useChessStore } from '@/stores/chessStore';
import { useProfile } from '@/hooks/useProfile';
import { Coins, Trophy, Loader2, X, Clock } from 'lucide-react';
import coins100 from '@/assets/coins-100.png';
import coins500 from '@/assets/coins-500.png';
import coins1000 from '@/assets/coins-1000.png';

const WAGER_OPTIONS = [
  {
    amount: 100,
    label: 'Tier I',
    prize: 190,
    image: coins100,
    color: 'from-blue-500 to-blue-600',
    glowColor: 'rgba(59, 130, 246, 0.4)',
  },
  {
    amount: 500,
    label: 'Tier II',
    prize: 950,
    image: coins500,
    color: 'from-purple-500 to-purple-600',
    glowColor: 'rgba(147, 51, 234, 0.4)',
    popular: true,
  },
  {
    amount: 1000,
    label: 'Tier III',
    prize: 1900,
    image: coins1000,
    color: 'from-yellow-500 to-orange-500',
    glowColor: 'rgba(245, 158, 11, 0.4)',
  },
];

export function WagerPanel() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { balance } = useBalance();
  const { phase, setSelectedWager, queueEstimate } = useChessStore();
  const { displayName } = useProfile();
  const { status, findMatch, cancelSearch } = useChessWebSocket();

  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const isSearching = phase === 'searching';
  const isInGame = phase === 'in_game';
  const isConnected = status === 'connected';

  const handleSelectWager = (amount: number) => {
    if (balance < amount || isSearching || isInGame) return;
    setSelectedOption(amount);
    setSelectedWager(amount);
  };

  const handlePlay = useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (!selectedOption) return;
    if (balance < selectedOption) return;

    setIsStarting(true);
    findMatch(selectedOption, displayName || 'Player');
  }, [isAuthenticated, selectedOption, balance, findMatch, displayName, navigate]);

  const handleCancelSearch = useCallback(() => {
    cancelSearch();
    setIsStarting(false);
  }, [cancelSearch]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Time control */}
      <div className="flex items-center gap-2 text-white/50 text-xs px-1">
        <Clock className="w-3.5 h-3.5" />
        <span>1 min + 3s increment</span>
      </div>

      {/* Tier cards */}
      <div className="flex flex-col gap-3">
        {WAGER_OPTIONS.map((option) => {
          const isHovered = hoveredOption === option.amount;
          const isSelected = selectedOption === option.amount;
          const canAfford = balance >= option.amount;
          const disabled = !canAfford || isSearching || isInGame;

          return (
            <button
              key={option.amount}
              className={`
                relative w-full rounded-xl border transition-all duration-200
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected
                  ? 'border-white/20 bg-white/[0.06]'
                  : isHovered
                    ? 'border-white/10 bg-white/[0.03]'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }
              `}
              onMouseEnter={() => !disabled && setHoveredOption(option.amount)}
              onMouseLeave={() => setHoveredOption(null)}
              onClick={() => !disabled && handleSelectWager(option.amount)}
            >
              {option.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider bg-purple-500 text-white px-2 py-0.5 rounded-full">
                  Popular
                </span>
              )}
              <div className="flex items-center gap-3 p-3">
                <img src={option.image} alt={option.label} className="w-10 h-10 object-contain" />
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-white">{option.label}</div>
                  <div className="flex items-center gap-1 text-white/60 text-xs">
                    <Coins className="w-3 h-3" />
                    <span>{option.amount} SC</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
                  <Trophy className="w-3 h-3" />
                  <span>{option.prize}</span>
                </div>
              </div>
              {isSelected && (
                <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>

      {/* Action button */}
      {isSearching ? (
        <div className="flex flex-col gap-3 mt-2">
          {/* Queue info */}
          {queueEstimate && (
            <div className="text-center space-y-1">
              <p className="text-white/50 text-xs">
                Est. wait: {queueEstimate.estimatedLabel}
              </p>
              <p className="text-white/40 text-[10px]">
                {queueEstimate.onlinePlayers} online &middot; {queueEstimate.inGamePlayers} in game
              </p>
              {queueEstimate.queuePosition > 0 && (
                <p className="text-white/40 text-[10px]">
                  Queue position: {queueEstimate.queuePosition}
                </p>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelSearch}
            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <X className="w-4 h-4 mr-1.5" />
            Cancel Search
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          className="w-full mt-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold border-0"
          disabled={!selectedOption || !isConnected || isStarting || isInGame}
          onClick={handlePlay}
        >
          {!isConnected ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              Connecting...
            </>
          ) : isStarting && !isSearching ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              Starting...
            </>
          ) : (
            <>Find Match{selectedOption ? ` - ${selectedOption} SC` : ''}</>
          )}
        </Button>
      )}

      {/* Not authenticated hint */}
      {!isAuthenticated && (
        <p className="text-center text-white/30 text-[10px]">
          Sign in to play
        </p>
      )}
    </div>
  );
}
