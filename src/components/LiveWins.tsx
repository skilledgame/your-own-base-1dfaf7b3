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

// Cache for player names to avoid repeated lookups
const playerNameCache = new Map<string, { name: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const LiveWins = () => {
  const [wins, setWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  // Fetch recent finished games - with deduplication and caching
  const fetchRecentWins = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }
    
    // Throttle: minimum 60 seconds between fetches (except initial)
    const now = Date.now();
    if (lastFetchRef.current > 0 && now - lastFetchRef.current < 60000) {
      return;
    }
    
    isFetchingRef.current = true;
    lastFetchRef.current = now;
    
    try {

      
      // Get the most recent finished games
      const { data: games, error } = await supabase
        .from('games')
        .select(`
          id,
          wager,
          settled_at,
          updated_at,
          created_at,
          winner_id
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

      // Get unique winner IDs - filter out cached ones
      const uniqueWinnerIds = [...new Set(games.map(g => g.winner_id).filter(Boolean))] as string[];
      const uncachedIds = uniqueWinnerIds.filter(id => {
        const cached = playerNameCache.get(id);
        return !cached || (now - cached.timestamp > CACHE_TTL);
      });

      // Batch fetch player -> user_id mappings for uncached IDs
      if (uncachedIds.length > 0) {

        
        const { data: players } = await supabase
          .from('players')
          .select('id, user_id')
          .in('id', uncachedIds);
        
        if (players && players.length > 0) {
          const userIds = players.map(p => p.user_id).filter(Boolean);
          
          if (userIds.length > 0) {

            
            // Batch fetch profiles
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, display_name')
              .in('user_id', userIds);
            
            // Build mapping
            const userToName = new Map<string, string | null>();
            if (profiles) {
              for (const p of profiles) {
                userToName.set(p.user_id, p.display_name);
              }
            }
            
            // Update cache
            for (const player of players) {
              const name = player.user_id ? userToName.get(player.user_id) : null;
              playerNameCache.set(player.id, { name, timestamp: now });
            }
          }
        }
        
        // Mark uncached IDs that weren't found
        for (const id of uncachedIds) {
          if (!playerNameCache.has(id)) {
            playerNameCache.set(id, { name: null, timestamp: now });
          }
        }
      }

      const recentWins: Win[] = games.map((game) => {
        const cached = playerNameCache.get(game.winner_id);
        const displayName = cached?.name || 'Skilled Player';
        const timestampSource = game.settled_at || game.updated_at || game.created_at || Date.now();

        return {
          id: game.id,
          playerName: displayName,
          amount: game.wager,
          game: 'Chess',
          gameIcon: '♟\uFE0E',
          timestamp: new Date(timestampSource),
          gradientFrom: '#5B3E99',
          gradientTo: '#3d2766',
        };
      });

      // Sort by timestamp
      const sortedWins = recentWins.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setWins(sortedWins);
    } catch (err) {
      console.error('Failed to fetch recent wins:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Initial fetch only
  useEffect(() => {
    fetchRecentWins();
  }, [fetchRecentWins]);

  // REPLACED Realtime subscription with a lightweight polling interval.
  // The old approach subscribed to ALL games table updates (status=eq.finished)
  // which fires for EVERY finished game by ANY user — creating massive Realtime
  // overhead on the server. A simple 2-minute refresh is far cheaper.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecentWins();
    }, 120_000); // Refresh every 2 minutes (the throttle inside fetchRecentWins is 60s)

    return () => clearInterval(interval);
  }, [fetchRecentWins]);

  // Auto-scroll animation with continuous loop
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || wins.length === 0) return;

    let animationId: number;
    let scrollPosition = 0;
    const scrollSpeed = 0.5;
    
    // Calculate the width of one set of wins for seamless looping
    const singleSetWidth = scrollContainer.scrollWidth / 2;

    const animate = () => {
      scrollPosition += scrollSpeed;
      
      // When we've scrolled past the first set, reset to start invisibly
      // This creates a seamless infinite loop
      if (scrollPosition >= singleSetWidth) {
        scrollPosition = scrollPosition - singleSetWidth;
      }

      scrollContainer.scrollLeft = scrollPosition;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    // Pause on hover
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

  // Don't render anything if no wins
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
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
            style={{ scrollBehavior: 'auto' }}
          >
            {/* Render wins twice for seamless infinite scrolling */}
            {[...wins, ...wins].map((win, index) => (
              <div
                key={`${win.id}-${index}`}
                className="flex-shrink-0 w-[140px] group cursor-pointer"
              >
                {/* Game Card */}
                <div 
                  className="relative h-[100px] rounded-xl overflow-hidden transition-transform duration-300 group-hover:scale-105"
                  style={{ 
                    background: `linear-gradient(135deg, ${win.gradientFrom}, ${win.gradientTo})` 
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
