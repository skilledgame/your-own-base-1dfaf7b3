import { useState, useEffect, useRef, useCallback } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Win {
  id: string;
  playerName: string;
  amount: number;
  game: string;
  gameIcon: string;
  timestamp: Date;
  gradientFrom: string;
  gradientTo: string;
  isNew?: boolean;
}

export const LiveWins = () => {
  const [wins, setWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const previousWinIdsRef = useRef<Set<string>>(new Set());

  // Fetch recent finished games using FK joins for accurate player names
  const fetchRecentWins = useCallback(async () => {
    if (isFetchingRef.current) return;

    const now = Date.now();
    if (lastFetchRef.current > 0 && now - lastFetchRef.current < 60000) return;

    isFetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      // Use Supabase FK join: games.winner_id -> players.id -> players.user_id -> profiles.user_id
      const { data: games, error } = await supabase
        .from('games')
        .select(`
          id,
          wager,
          settled_at,
          updated_at,
          created_at,
          winner_id,
          winner:players!winner_id(
            id,
            name,
            user_id
          )
        `)
        .eq('status', 'finished')
        .not('winner_id', 'is', null)
        .order('settled_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching recent wins:', error);
        return;
      }

      if (!games || games.length === 0) {
        setWins([]);
        setLoading(false);
        return;
      }

      // Collect user_ids from winners to batch-fetch display names from profiles
      const userIds = games
        .map((g: any) => g.winner?.user_id)
        .filter(Boolean) as string[];
      const uniqueUserIds = [...new Set(userIds)];

      // Profiles table is publicly readable - fetch display names
      const profileMap = new Map<string, string>();
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', uniqueUserIds);

        if (profiles) {
          for (const p of profiles) {
            if (p.display_name) {
              profileMap.set(p.user_id, p.display_name);
            }
          }
        }
      }

      const isInitialLoad = previousWinIdsRef.current.size === 0;

      const recentWins: Win[] = games.map((game: any) => {
        const winner = game.winner;
        // Priority: profile display_name > player name > 'Player'
        const displayName =
          (winner?.user_id && profileMap.get(winner.user_id)) ||
          winner?.name ||
          'Player';

        const timestampSource = game.settled_at || game.updated_at || game.created_at || Date.now();

        return {
          id: game.id,
          playerName: displayName,
          amount: game.wager * 2, // Winner takes the full pot (both wagers)
          game: 'Chess',
          gameIcon: '♟️',
          timestamp: new Date(timestampSource),
          gradientFrom: '#5B3E99',
          gradientTo: '#3d2766',
          isNew: !isInitialLoad && !previousWinIdsRef.current.has(game.id),
        };
      });

      // Sort by timestamp (newest first = leftmost)
      const sortedWins = recentWins.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Update the previous IDs ref
      previousWinIdsRef.current = new Set(sortedWins.map(w => w.id));

      setWins(sortedWins);
    } catch (err) {
      console.error('Failed to fetch recent wins:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchRecentWins();
  }, [fetchRecentWins]);

  // Lightweight polling every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecentWins();
    }, 120_000);
    return () => clearInterval(interval);
  }, [fetchRecentWins]);

  // Clear "isNew" flag after the pop animation completes
  useEffect(() => {
    if (wins.some(w => w.isNew)) {
      const timer = setTimeout(() => {
        setWins(prev => prev.map(w => ({ ...w, isNew: false })));
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [wins]);

  if (!loading && wins.length === 0) {
    return null;
  }

  return (
    <section className="py-6 px-0 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-16 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-semibold text-foreground bg-accent/20 px-3 py-1 rounded-full">
            Recent Wins
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-16">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
          >
            {/* Newest win is first (leftmost). New wins pop in, pushing older ones right. */}
            {wins.map((win) => (
              <div
                key={win.id}
                className="flex-shrink-0 w-[140px] group cursor-pointer"
                style={{
                  animation: win.isNew ? 'pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : undefined,
                }}
              >
                {/* Game Card */}
                <div
                  className="relative h-[100px] rounded-xl overflow-hidden transition-transform duration-300 group-hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${win.gradientFrom}, ${win.gradientTo})`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl drop-shadow-lg">{win.gameIcon}</span>
                  </div>
                  <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                    <span className="text-white/90 text-xs font-bold uppercase tracking-wider drop-shadow">
                      {win.game}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>

                {/* Win Info */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-gradient-rainbow flex items-center justify-center overflow-hidden">
                      <Coins className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                      {win.playerName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-accent font-bold text-sm">
                  {win.amount.toLocaleString()} SC
                  <Coins className="w-4 h-4 text-yellow-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
