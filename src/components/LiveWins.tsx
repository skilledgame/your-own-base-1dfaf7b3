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

const MAX_WINS = 6;
const CARD_WIDTH = 140; // px
const CARD_GAP = 12; // px (gap-3)

export const LiveWins = () => {
  const [wins, setWins] = useState<Win[]>([]);
  const [displayedWins, setDisplayedWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const previousWinIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const animatingRef = useRef(false);

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

      // Get player records for all winner IDs
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

      // Get display names from profiles
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
      previousWinIdsRef.current = new Set(recentWins.map(w => w.id));
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

  // Staggered pop-in on initial load, then detect new wins
  useEffect(() => {
    if (wins.length === 0) return;

    if (!initialLoadDone.current) {
      // First load: pop in wins one by one from left to right
      initialLoadDone.current = true;
      setDisplayedWins([]);

      wins.forEach((win, i) => {
        setTimeout(() => {
          setDisplayedWins(prev => {
            if (prev.find(w => w.id === win.id)) return prev;
            return [...prev, win];
          });
        }, i * 200); // 200ms stagger between each card
      });
    } else {
      // Subsequent fetches: check for new wins and pop them in
      const currentIds = new Set(displayedWins.map(w => w.id));
      const newWins = wins.filter(w => !currentIds.has(w.id));

      if (newWins.length > 0 && !animatingRef.current) {
        animatingRef.current = true;
        // Insert new wins at the front, trim to MAX_WINS
        setDisplayedWins(wins.slice(0, MAX_WINS));
        setTimeout(() => {
          animatingRef.current = false;
        }, 600);
      } else if (newWins.length === 0) {
        // Same wins, just update data (e.g. name corrections)
        setDisplayedWins(wins.slice(0, MAX_WINS));
      }
    }
  }, [wins]);

  if (!loading && wins.length === 0) return null;

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
            {displayedWins.map((win, index) => (
              <div
                key={win.id}
                className="flex-shrink-0 w-[140px] group cursor-pointer win-card-pop"
                style={{
                  animationDelay: `${index * 50}ms`,
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
