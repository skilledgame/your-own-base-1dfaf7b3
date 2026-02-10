/**
 * ChessOnlineMode - Wager Selection Screen
 * 
 * Shows entry fee options (100, 500, 1000 SC)
 * When selected, starts matchmaking via WebSocket
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { useChessWebSocket } from '@/hooks/useChessWebSocket';
import { useChessStore } from '@/stores/chessStore';
import { useProfile } from '@/hooks/useProfile';
import { LogoLink } from '@/components/LogoLink';
import {
  ArrowLeft,
  Coins,
  Trophy,
  Loader2,
  Users,
  X,
  Zap,
  Target,
  Crown,
  Wallet,
  LogIn
} from 'lucide-react';

interface ChessOnlineModeProps {
  onBack: () => void;
}

const WAGER_OPTIONS = [
  {
    amount: 100,
    label: 'Starter',
    description: 'Perfect for beginners',
    prize: 190,
    icon: Target,
    color: 'from-blue-500 to-blue-600',
    glowColor: 'rgba(59, 130, 246, 0.4)'
  },
  {
    amount: 500,
    label: 'Competitive',
    description: 'Most popular tier',
    prize: 950,
    icon: Zap,
    color: 'from-purple-500 to-purple-600',
    glowColor: 'rgba(147, 51, 234, 0.4)',
    popular: true
  },
  {
    amount: 1000,
    label: 'Pro',
    description: 'High stakes action',
    prize: 1900,
    icon: Crown,
    color: 'from-yellow-500 to-orange-500',
    glowColor: 'rgba(245, 158, 11, 0.4)'
  }
];

export function ChessOnlineMode({ onBack }: ChessOnlineModeProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const { balance } = useBalance();
  const { phase, setSelectedWager, selectedWager } = useChessStore();
  const { displayName } = useProfile();
  const { status, findMatch, cancelSearch, isAuthenticated: wsAuth } = useChessWebSocket();
  
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const isSearching = phase === 'searching';
  const isConnected = status === 'connected';

  // Handle match found - redirect to game
  useEffect(() => {
    if (phase === 'in_game') {
      const gameState = useChessStore.getState().gameState;
      if (gameState?.gameId) {
        navigate(`/game/live/${gameState.gameId}`);
      }
    }
  }, [phase, navigate]);

  const handleSelectWager = (amount: number) => {
    if (balance < amount) return;
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

  // Loading state
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, #0c4a6e 0%, #0a0f1a 70%)'
          }}
        />
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[120px] animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 p-4 backdrop-blur-sm bg-black/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            
            <LogoLink className="h-10" />
            
            {/* Balance */}
            {isAuthenticated && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-950/50 border border-yellow-500/30">
                <Wallet className="w-4 h-4 text-yellow-400" />
                <span className="font-bold text-yellow-200">{balance.toLocaleString()} SC</span>
              </div>
            )}
            
            {!isAuthenticated && <div className="w-20" />}
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          {/* Not authenticated */}
          {!isAuthenticated && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-blue-950/50 border border-blue-500/30 flex items-center justify-center">
                <LogIn className="w-10 h-10 text-blue-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Sign In Required</h2>
                <p className="text-white/60">Sign in to play for Skilled Coins</p>
              </div>
              <Button
                size="lg"
                className="px-8 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400"
                onClick={() => navigate('/auth')}
              >
                <LogIn className="w-5 h-5 mr-2" />
                Sign In
              </Button>
            </div>
          )}

          {/* Searching state */}
          {isAuthenticated && isSearching && (
            <div className="text-center space-y-6 py-12">
              <div className="relative w-28 h-28 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 animate-ping" />
                <div className="absolute inset-2 rounded-full border-4 border-cyan-500/50 animate-pulse" />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                  <Users className="w-12 h-12 text-white animate-pulse" />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-bold text-white">Finding Opponent</h2>
                <p className="text-white/60">Searching for a player...</p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Coins className="w-6 h-6 text-yellow-500" />
                  <span className="text-2xl font-bold text-yellow-400">{selectedOption} SC</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="lg"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={handleCancelSearch}
              >
                <X className="w-5 h-5 mr-2" />
                Cancel Search
              </Button>
            </div>
          )}

          {/* Wager selection */}
          {isAuthenticated && !isSearching && (
            <>
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  SELECT <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">ENTRY FEE</span>
                </h1>
                <p className="text-white/50 mt-2">Winner takes 95% of the pot</p>
              </div>

              {/* Wager Cards */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 max-w-4xl w-full mb-8">
                {WAGER_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isHovered = hoveredOption === option.amount;
                  const isSelected = selectedOption === option.amount;
                  const canAfford = balance >= option.amount;
                  
                  return (
                    <div
                      key={option.amount}
                      className={`
                        relative flex-1 cursor-pointer
                        transition-all duration-300 ease-out
                        ${isHovered || isSelected ? 'scale-105 z-20' : 'scale-100 z-10'}
                        ${!canAfford ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      onMouseEnter={() => canAfford && setHoveredOption(option.amount)}
                      onMouseLeave={() => setHoveredOption(null)}
                      onClick={() => canAfford && handleSelectWager(option.amount)}
                    >
                      {/* Popular badge */}
                      {option.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold uppercase tracking-wider">
                          Most Popular
                        </div>
                      )}

                      <div
                        className={`
                          relative p-6 rounded-2xl border-2 transition-all duration-300
                          ${isSelected 
                            ? 'border-white bg-white/10' 
                            : isHovered 
                              ? 'border-white/60 bg-white/5' 
                              : 'border-white/20 bg-black/20'}
                        `}
                        style={{
                          boxShadow: (isHovered || isSelected) ? `0 0 40px ${option.glowColor}` : undefined
                        }}
                      >
                        {/* Icon */}
                        <div className={`w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br ${option.color} flex items-center justify-center`}>
                          <Icon className="w-7 h-7 text-white" />
                        </div>

                        {/* Label */}
                        <h3 className="text-xl font-bold text-white text-center mb-1">
                          {option.label}
                        </h3>
                        <p className="text-white/50 text-sm text-center mb-4">
                          {option.description}
                        </p>

                        {/* Amount */}
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Coins className="w-6 h-6 text-yellow-500" />
                          <span className="text-3xl font-black text-white">{option.amount}</span>
                          <span className="text-lg text-yellow-400 font-semibold">SC</span>
                        </div>

                        {/* Prize */}
                        <div className="flex items-center justify-center gap-2 text-green-400">
                          <Trophy className="w-4 h-4" />
                          <span className="text-sm font-semibold">Win {option.prize} SC</span>
                        </div>

                        {/* Selected indicator */}
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}

                        {/* Can't afford */}
                        {!canAfford && (
                          <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                            <span className="text-red-400 font-semibold">Insufficient balance</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Play Button */}
              <Button
                size="lg"
                className={`
                  px-12 py-7 text-xl font-black uppercase tracking-wider
                  bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400
                  text-white border-0 shadow-[0_0_40px_rgba(34,197,94,0.4)]
                  transition-all duration-300
                  ${!selectedOption || !isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-[0_0_60px_rgba(34,197,94,0.6)]'}
                `}
                disabled={!selectedOption || !isConnected || isStarting}
                onClick={handlePlay}
              >
                {!isConnected ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : isStarting ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Find Match
                    {selectedOption && ` - ${selectedOption} SC`}
                  </>
                )}
              </Button>

              {!isConnected && (
                <p className="text-white/40 text-sm mt-4">
                  Connecting to game server...
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
