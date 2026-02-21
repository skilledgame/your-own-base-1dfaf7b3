import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, ArrowLeft, Loader2, Trophy, XCircle, Minus, Coins, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoLink } from '@/components/LogoLink';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface GameHistoryEntry {
  id: string;
  gameId: string;
  wagerAmount: number;
  result: 'win' | 'loss' | 'draw' | 'pending';
  wagerLockedAt: string;
  hasPgn: boolean;
}

const GameHistory = () => {
  const { user } = useAuth();
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGameHistory = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Use the user_wager_history view
        const { data, error } = await supabase
          .from('user_wager_history')
          .select('*')
          .eq('user_id', user.id)
          .order('wager_locked_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching game history:', error);
          setGames([]);
          return;
        }

        // Get the game IDs to check PGN availability
        const gameIds = (data || []).map((row) => row.game_id).filter(Boolean);
        let pgnMap: Record<string, boolean> = {};
        if (gameIds.length > 0) {
          const { data: pgnData } = await supabase
            .from('games')
            .select('id, pgn')
            .in('id', gameIds);
          if (pgnData) {
            pgnMap = Object.fromEntries(
              pgnData.map((g) => [g.id, !!g.pgn])
            );
          }
        }

        const entries: GameHistoryEntry[] = (data || []).map((row) => ({
          id: row.id || '',
          gameId: row.game_id || '',
          wagerAmount: Number(row.wager_amount) || 0,
          result: row.result as 'win' | 'loss' | 'draw' | 'pending',
          wagerLockedAt: row.wager_locked_at || '',
          hasPgn: pgnMap[row.game_id] || false,
        }));

        setGames(entries);
      } catch (err) {
        console.error('Failed to fetch game history:', err);
        setGames([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGameHistory();
  }, [user?.id]);

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'win':
        return <Trophy className="w-5 h-5 text-emerald-400" />;
      case 'loss':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'draw':
        return <Minus className="w-5 h-5 text-slate-400" />;
      default:
        return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />;
    }
  };

  const getResultStyle = (result: string) => {
    switch (result) {
      case 'win':
        return 'bg-emerald-500/10 border-l-emerald-500';
      case 'loss':
        return 'bg-red-500/10 border-l-red-500';
      case 'draw':
        return 'bg-slate-500/10 border-l-slate-500';
      default:
        return 'bg-yellow-500/10 border-l-yellow-500';
    }
  };

  const getResultText = (result: string) => {
    switch (result) {
      case 'win':
        return <span className="text-emerald-400 font-semibold">Won</span>;
      case 'loss':
        return <span className="text-red-400 font-semibold">Lost</span>;
      case 'draw':
        return <span className="text-slate-400 font-semibold">Draw</span>;
      default:
        return <span className="text-yellow-400 font-semibold">Pending</span>;
    }
  };

  const getPayout = (result: string, wager: number) => {
    switch (result) {
      case 'win':
        return <span className="text-emerald-400">+{Math.floor(wager * 0.9)} SC</span>;
      case 'loss':
        return <span className="text-red-400">-{wager} SC</span>;
      case 'draw':
        return <span className="text-slate-400">0 SC</span>;
      default:
        return <span className="text-yellow-400">-{wager} SC</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <LogoLink className="h-10" />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <History className="w-8 h-8 text-orange-400" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Game History</h1>
              <p className="text-sm text-muted-foreground">Your recent matches and results</p>
            </div>
          </div>

          {/* Not logged in */}
          {!user && !loading && (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium text-foreground mb-2">Sign in to view your history</p>
              <p className="text-sm text-muted-foreground mb-6">Your game history will appear here once you're logged in.</p>
              <Button asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
            </div>
          )}

          {/* Game List */}
          {user && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-2">Result</div>
                <div className="col-span-3">Date</div>
                <div className="col-span-2 text-center">Wager</div>
                <div className="col-span-3 text-right">Payout</div>
                <div className="col-span-2 text-center">Replay</div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}

              {/* Empty State */}
              {!loading && games.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <History className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No games played yet</p>
                  <p className="text-sm mb-6">Start competing to see your history here!</p>
                  <Button asChild>
                    <Link to="/chess">Play Chess</Link>
                  </Button>
                </div>
              )}

              {/* Entries */}
              {!loading && games.length > 0 && (
                <div className="divide-y divide-border">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      className={`grid grid-cols-12 gap-4 px-4 py-4 items-center transition-colors hover:bg-secondary/30 border-l-2 ${getResultStyle(game.result)}`}
                    >
                      <div className="col-span-2 flex items-center gap-2">
                        {getResultIcon(game.result)}
                        <span className="hidden sm:inline">{getResultText(game.result)}</span>
                      </div>
                      <div className="col-span-3 text-sm text-muted-foreground">
                        {game.wagerLockedAt 
                          ? format(new Date(game.wagerLockedAt), 'MMM d, h:mm a')
                          : 'Unknown'
                        }
                      </div>
                      <div className="col-span-2 text-center flex items-center justify-center gap-1">
                        <Coins className="w-4 h-4 text-yellow-400" />
                        <span className="font-medium">{game.wagerAmount} SC</span>
                      </div>
                      <div className="col-span-3 text-right font-bold">
                        {getPayout(game.result, game.wagerAmount)}
                      </div>
                      <div className="col-span-2 flex justify-center">
                        {game.hasPgn && game.result !== 'pending' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="gap-1.5 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                          >
                            <Link to={`/game/replay/${game.gameId}`}>
                              <Film className="w-4 h-4" />
                              <span className="hidden sm:inline text-xs">Replay</span>
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GameHistory;
