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
}

const MAX_WINS = 18;
const CYCLE_INTERVAL = 3000; // 3 seconds between each new card

export const LiveWins = () => {
  const [wins, setWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  // Display state: queue of currently visible cards + animation trigger
  const [displayQueue, setDisplayQueue] = useState<Win[]>([]);
  const [animKey, setAnimKey] = useState(0);
  const cycleIndexRef = useRef(0);
  const cycleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRecentWins = useCallback(async () => {
    if (isFetchingRef.current) return;

    const now = Date.now();
    if (lastFetchRef.current > 0 && now - lastFetchRef.current < 60000) return;

    isFetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      const { data: games, error } = await supabase
        .from('games')
        .select('id, wager, settled_at, updated_at, created_at, winner_id')
        .eq('status', 'finished')
        .not('winner_id', 'is', null)
        .order('settled_at', { ascending: false })
        .limit(MAX_WINS);

      if (error) {
        console.error('Error fetching recent wins:', error);
        return;
      }

      if (!games || games.length === 0) {
        setWins([]);
        setLoading(false);
        return;
      }

      const winnerIds = [...new Set(games.map(g => g.winner_id).filter(Boolean))] as string[];
      const playerMap = new Map<string, { name: string | null; user_id: string | null }>();

      if (winnerIds.length > 0) {
        const { data: players } = await supabase
          .from('players')
          .select('id, name, user_id')
          .in('id', winnerIds);
        if (players) {
          for (const p of players) {
            playerMap.set(p.id, { name: p.name, user_id: p.user_id });
          }
        }
      }

      const userIds = [...new Set(
        Array.from(playerMap.values()).map(p => p.user_id).filter(Boolean)
      )] as string[];
      const profileMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        if (profiles) {
          for (const p of profiles) {
            if (p.display_name) profileMap.set(p.user_id, p.display_name);
          }
        }
      }

      const recentWins: Win[] = games.map((game) => {
        const player = game.winner_id ? playerMap.get(game.winner_id) : null;
        const displayName =
          (player?.user_id && profileMap.get(player.user_id)) ||
          player?.name ||
          'Player';
        const timestampSource = game.settled_at || game.updated_at || game.created_at;

        return {
          id: game.id,
          playerName: displayName,
          amount: Math.floor(game.wager * 1.9),
          game: 'Chess',
          gameIcon: '♟️',
          timestamp: new Date(timestampSource),
          gradientFrom: '#5B3E99',
          gradientTo: '#3d2766',
        };
      });

      recentWins.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setWins(recentWins);
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

  // Poll every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecentWins();
    }, 120_000);
    return () => clearInterval(interval);
  }, [fetchRecentWins]);

  // Cycling loop: pop in one card at a time from the wins array
  useEffect(() => {
    if (wins.length === 0) return;

    // Clear any previous cycle
    if (cycleTimerRef.current) {
      clearInterval(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }

    // Reset: start fresh cycle from the most recent win
    cycleIndexRef.current = 0;
    setDisplayQueue([wins[0]]);
    setAnimKey(0);

    // Every CYCLE_INTERVAL, pop the next win onto the left
    cycleTimerRef.current = setInterval(() => {
      cycleIndexRef.current += 1;
      const idx = cycleIndexRef.current % wins.length;

      // If we've looped back to 0, restart the queue fresh
      if (idx === 0) {
        setDisplayQueue([wins[0]]);
        setAnimKey(k => k + 1);
        return;
      }

      setDisplayQueue(prev => {
        // Prepend the next win; keep max ~10 visible to avoid DOM bloat
        return [wins[idx], ...prev].slice(0, 10);
      });
      setAnimKey(k => k + 1);
    }, CYCLE_INTERVAL);

    return () => {
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current);
      }
    };
  }, [wins]);

  if (!loading && wins.length === 0) return null;

  return (
    <section className="py-6 px-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-16 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-semibold text-foreground bg-accent/20 px-3 py-1 rounded-full">
            Recent Wins
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-16 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div
            key={animKey}
            className="flex gap-3 pb-2 win-row-shift"
          >
            {displayQueue.map((win, index) => (
              <div
                key={win.id}
                className={`flex-shrink-0 w-[140px] group cursor-pointer${index === 0 ? ' win-card-pop' : ''}`}
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
