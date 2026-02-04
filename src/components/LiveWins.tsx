import { useState, useEffect, useRef } from 'react';
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

export const LiveWins = () => {
  const [wins, setWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch recent finished games
  const fetchRecentWins = async () => {
    try {
      // Get the most recent finished games (without join to avoid RLS blocking)
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

      // Get unique winner IDs (player_ids) and fetch their display_names from profiles
      const uniqueWinnerIds = [...new Set(games.map(g => g.winner_id).filter(Boolean))] as string[];

      // Fetch display_name by looking up player -> user_id -> profile
      const playerNameMap = new Map<string, string | null>();
      
      for (const playerId of uniqueWinnerIds) {
        // First get the user_id from the players table
        const { data: playerData } = await supabase
          .from('players')
          .select('user_id')
          .eq('id', playerId)
          .maybeSingle();
        
        if (playerData?.user_id) {
          // Then get the display_name from profiles
          const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', playerData.user_id)
            .maybeSingle();
          
          playerNameMap.set(playerId, profileData?.display_name || null);
        } else {
          playerNameMap.set(playerId, null);
        }
      }

      const recentWins: Win[] = games.map((game) => {
        const playerName = playerNameMap.get(game.winner_id);
        const displayName = playerName || 'Skilled Player';
        const timestampSource = game.settled_at || game.updated_at || game.created_at || Date.now();

        return {
          id: game.id,
          playerName: displayName,
          amount: game.wager,
          game: 'Chess',
          gameIcon: '♟️',
          timestamp: new Date(timestampSource),
          gradientFrom: '#5B3E99',
          gradientTo: '#3d2766',
        };
      });

      // Games are already sorted by settled_at from the query, but ensure proper sorting
      const sortedWins = recentWins.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setWins(sortedWins);
    } catch (err) {
      console.error('Failed to fetch recent wins:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRecentWins();
  }, []);

  // Poll for new games every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecentWins();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Subscribe to real-time updates for new finished games
  useEffect(() => {
    const channel = supabase
      .channel('live-wins')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: 'status=eq.finished',
        },
        (payload) => {
          // Refetch when a game finishes
          fetchRecentWins();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
