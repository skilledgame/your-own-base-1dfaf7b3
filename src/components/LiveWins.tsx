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

export const LiveWins = () => {
  const [wins, setWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const previousWinIdsRef = useRef<Set<string>>(new Set());
  const [newWinId, setNewWinId] = useState<string | null>(null);

  const fetchRecentWins = useCallback(async () => {
    if (isFetchingRef.current) return;

    const now = Date.now();
    if (lastFetchRef.current > 0 && now - lastFetchRef.current < 60000) return;

    isFetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      // Step 1: Get the 6 most recent finished games
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

      // Step 2: Get player records for all winner IDs (RLS policy now allows this)
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

      // Step 3: Get display names from profiles (publicly readable)
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

      const isInitialLoad = previousWinIdsRef.current.size === 0;

      // Step 4: Build the win objects
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

      // Sort newest first (leftmost)
      recentWins.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Detect brand-new win for pop-in animation
      if (!isInitialLoad) {
        const incoming = recentWins[0];
        if (incoming && !previousWinIdsRef.current.has(incoming.id)) {
          setNewWinId(incoming.id);
        }
      }

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

  // Clear pop-in animation flag after it finishes
  useEffect(() => {
    if (newWinId) {
      const timer = setTimeout(() => setNewWinId(null), 700);
      return () => clearTimeout(timer);
    }
  }, [newWinId]);

  // Continuous scroll loop
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || wins.length === 0) return;

    let animationId: number;
    let scrollPosition = 0;
    const scrollSpeed = 0.5;
    const singleSetWidth = scrollContainer.scrollWidth / 2;

    const animate = () => {
      scrollPosition += scrollSpeed;
      if (scrollPosition >= singleSetWidth) {
        scrollPosition -= singleSetWidth;
      }
      scrollContainer.scrollLeft = scrollPosition;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    const handleMouseEnter = () => cancelAnimationFrame(animationId);
    const handleMouseLeave = () => {
      animationId = requestAnimationFrame(animate);
    };

    scrollContainer.addEventListener('mouseenter', handleMouseEnter);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [wins]);

  if (!loading && wins.length === 0) return null;

  return (
    <section className="py-6 px-0 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-16 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-semibold text-foreground bg-accent/20 px-3 py-1 rounded-full">
            Recent Wins 🏆
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
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
            style={{ scrollBehavior: 'auto' }}
          >
            {[...wins, ...wins].map((win, index) => {
              const shouldPop = win.id === newWinId && index < MAX_WINS;

              return (
                <div
                  key={`${win.id}-${index}`}
                  className={`flex-shrink-0 w-[140px] group cursor-pointer${shouldPop ? ' win-pop-in' : ''}`}
                >
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
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
