/**
 * Quick Play Page
 * 
 * Wager-based matchmaking flow: Select Wager -> Find Match -> Searching -> Game
 * Uses the chess WebSocket for matchmaking with auth token.
 * 
 * PART D: Performance improvements:
 * - Removed auth debug button (cleanup)
 * - Uses AuthContext and BalanceStore
 * - Memoized callbacks
 * - Reduced rerenders
 */

import { useEffect, useCallback, memo, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useChessWebSocket } from '@/hooks/useChessWebSocket';
import { useChessStore } from '@/stores/chessStore';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { perf } from '@/lib/perfLog';
import { MatchTransition } from '@/components/MatchTransition';
import { NetworkDebugPanel } from '@/components/NetworkDebugPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Loader2, 
  Play, 
  Coins, 
  Trophy,
  Wifi,
  WifiOff,
  ArrowLeft,
  LogIn,
  Wallet
} from 'lucide-react';

// Memoized quick wager button for performance
const WagerButton = memo(({ 
  amount, 
  selected, 
  disabled, 
  onClick 
}: { 
  amount: number; 
  selected: boolean; 
  disabled: boolean; 
  onClick: () => void;
}) => (
  <Button
    variant={selected ? "default" : "outline"}
    size="sm"
    onClick={onClick}
    disabled={disabled}
    className={`
      ${selected 
        ? "bg-blue-600 text-white" 
        : "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"}
      ${disabled ? "opacity-50" : ""}
    `}
  >
    {amount === 0 ? "Free" : `${amount} SC`}
  </Button>
));
WagerButton.displayName = 'WagerButton';

export default function QuickPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showDebug = searchParams.get('debug') === '1';
  
  // Auth from context
  const { isAuthenticated: authContextAuthenticated, isAuthReady, user } = useAuth();
  const authLoading = !isAuthReady;
  
  // STEP C: Get IDs safely (normalized, never from raw objects)
  const userId = user?.id ?? null;
  
  // Balance from centralized userDataStore (single source of truth)
  const { balance: storeBalance } = useBalance();
  
  // Global state from Zustand store
  const { 
    phase, 
    gameState, 
    playerName, 
    // Removed playerCredits - use balanceStore instead
    selectedWager,
    setSelectedWager,
    matchmaking  // Normalized matchmaking state
  } = useChessStore();
  
  // Use the higher balance (store or chess store)
  const displayBalance = storeBalance; // Use balanceStore only
  
  // WebSocket connection and actions
  const {
    status,
    connect,
    disconnect,
    isAuthenticated,
    findMatch,
    cancelSearch,
    refreshBalance,
    logs,
    clearLogs,
    sendRaw,
    reconnectAttempts,
  } = useChessWebSocket();

  // Fetch balance on mount
  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // If already in game, redirect to the game
  useEffect(() => {
    if (phase === "in_game" && gameState) {
      console.log("[QuickPlay] Already in game, redirecting to:", gameState.gameId);
      navigate(`/game/live/${gameState.gameId}`);
    }
  }, [phase, gameState, navigate]);

  const handleWagerChange = useCallback((value: string) => {
    const numValue = parseInt(value) || 0;
    if (numValue >= 0) {
      setSelectedWager(numValue);
    }
  }, [setSelectedWager]);

  const handleFindMatch = useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    
    // Validate wager against balance
    if (selectedWager > displayBalance) {
      return;
    }
    
    // PART A: Start perf measurement session
    perf.start('click_matchmake');
    
    findMatch(selectedWager, playerName);
  }, [isAuthenticated, selectedWager, displayBalance, findMatch, playerName, navigate]);

  const handleCancelSearch = useCallback(() => {
    cancelSearch();
  }, [cancelSearch]);

  const handleSignIn = useCallback(() => {
    navigate('/auth');
  }, [navigate]);

  const StatusIcon = status === "connected" ? Wifi : WifiOff;
  const isConnected = status === "connected";
  const isSearching = phase === "searching";
  const canAffordWager = selectedWager <= displayBalance;

  // Show loading during auth bootstrap
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[80px] animate-pulse" />
      </div>

      {/* Header */}
      <header className="border-b border-blue-500/20 p-4 sticky top-0 bg-[#0a0f1a]/90 backdrop-blur-xl z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          
          <h1 className="text-xl font-bold text-white">Quick Play</h1>
          
          <div className="flex items-center gap-3">
            {/* Balance Display */}
            {isAuthenticated && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-950/50 border border-yellow-500/30">
                <Wallet className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-bold text-yellow-200">{displayBalance} SC</span>
              </div>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/50 border border-blue-500/30">
              <StatusIcon className={`w-4 h-4 ${isConnected ? "text-green-400" : "text-red-400"}`} />
              <span className="text-sm text-blue-200">
                {status === "connected" ? "Connected" : status}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto p-6 space-y-8">
        {/* Not Authenticated - Show Sign In Prompt */}
        {!isAuthenticated && (
          <div className="text-center space-y-6 py-12">
            <div className="w-20 h-20 mx-auto rounded-full bg-blue-950/50 border border-blue-500/30 flex items-center justify-center">
              <LogIn className="w-10 h-10 text-blue-400" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Sign In Required</h2>
              <p className="text-blue-200/60">Please sign in to play wager-based matches</p>
            </div>

            <Button
              size="lg"
              className="px-8 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400"
              onClick={handleSignIn}
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign In
            </Button>
          </div>
        )}

        {/* PART B: Searching State — unified MatchTransition overlay */}
        {isAuthenticated && isSearching && (
          <MatchTransition
            variant="matchmaking"
            wager={selectedWager}
            onCancel={handleCancelSearch}
          />
        )}

        {/* Idle State */}
        {isAuthenticated && phase === "idle" && (
          <>
            {/* Player Info */}
            <div className="text-center p-4 rounded-xl bg-blue-950/40 border border-blue-500/20">
              <p className="text-sm text-blue-200/60 mb-1">Playing as</p>
              <p className="text-xl font-bold text-white">{playerName}</p>
            </div>

            {/* Wager Input */}
            <div className="p-6 rounded-xl bg-blue-950/40 border border-blue-500/20 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="text-lg font-semibold text-white">Set Your Wager</span>
              </div>
              
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min="0"
                  max={displayBalance}
                  value={selectedWager.toString()}
                  onChange={(e) => handleWagerChange(e.target.value)}
                  className="text-2xl font-bold text-center bg-blue-950/50 border-blue-500/30 text-white h-14"
                  placeholder="0"
                />
                <span className="text-lg text-yellow-400 font-semibold">SC</span>
              </div>
              
              {/* Quick Wager Buttons */}
              <div className="flex gap-2 flex-wrap">
                {[0, 10, 25, 50, 100].map((amount) => (
                  <WagerButton
                    key={amount}
                    amount={amount}
                    selected={selectedWager === amount}
                    disabled={amount > displayBalance}
                    onClick={() => handleWagerChange(amount.toString())}
                  />
                ))}
              </div>
              
              {!canAffordWager && selectedWager > 0 && (
                <p className="text-sm text-red-400">
                  Insufficient balance. You have {displayBalance} SC.
                </p>
              )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm text-blue-200/60">Your Balance</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">{displayBalance} SC</p>
              </div>
              
              <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-blue-200/60">Potential Win</span>
                </div>
                <p className="text-2xl font-bold text-green-400">+{selectedWager} SC</p>
              </div>
            </div>

            {/* Find Match Button */}
            <Button
              size="lg"
              className="w-full h-16 text-xl font-bold bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 hover:from-blue-400 hover:via-blue-500 hover:to-cyan-400 border-0 shadow-[0_0_40px_rgba(59,130,246,0.4)] hover:shadow-[0_0_60px_rgba(59,130,246,0.6)] transition-all disabled:opacity-50"
              disabled={!isConnected || !canAffordWager}
              onClick={handleFindMatch}
            >
              {!isConnected ? (
                <>
                  <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 mr-2" />
                  Find Match {selectedWager > 0 ? `(${selectedWager} SC)` : "(Free)"}
                </>
              )}
            </Button>

            {!isConnected && (
              <p className="text-center text-sm text-blue-200/50">
                Waiting for connection to game server...
              </p>
            )}
          </>
        )}

        {/* Game Over state - user navigated back here */}
        {isAuthenticated && phase === "game_over" && (
          <div className="text-center space-y-4 py-8">
            <p className="text-lg text-white">Your last game has ended.</p>
            <Button
              onClick={() => {
                useChessStore.getState().resetAll();
                refreshBalance();
              }}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Start New Match
            </Button>
          </div>
        )}
      </main>

      {/* Debug Panel */}
      <NetworkDebugPanel
        status={status}
        logs={logs}
        reconnectAttempts={reconnectAttempts}
        onConnect={connect}
        onDisconnect={disconnect}
        onSendRaw={sendRaw}
        onClearLogs={clearLogs}
      />
    </div>
  );
}
