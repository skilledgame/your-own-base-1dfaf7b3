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
      // Get the 15 most recent finished games with winner info
      const { data: games, error } = await supabase
        .from('games')
        .select(`
          id,
          wager,
          settled_at,
          winner_id
        `)
        .eq('status', 'finished')
        .not('winner_id', 'is', null)
        .order('settled_at', { ascending: false })
        .limit(15);

      if (error) {
        console.error('Error fetching recent wins:', error);
        return;
      }

      if (!games || games.length === 0) {
        setWins([]);
        setLoading(false);
        return;
      }

      // Get winner player names
      const winnerIds = games.map(g => g.winner_id).filter(Boolean);
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .in('id', winnerIds);

      if (playersError) {
        console.error('Error fetching player names:', playersError);
      }

      const playerMap = new Map(players?.map(p => [p.id, p.name]) || []);

      const recentWins: Win[] = games.map((game) => ({
        id: game.id,
        playerName: playerMap.get(game.winner_id!) || 'Anonymous',
        amount: game.wager,
        game: 'Chess',
        gameIcon: '♟️',
        timestamp: new Date(game.settled_at || Date.now()),
        gradientFrom: '#5B3E99',
        gradientTo: '#3d2766',
      }));

      setWins(recentWins);
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
        () => {
          // Refetch when a game finishes
          fetchRecentWins();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll animation
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || wins.length === 0) return;

    let animationId: number;
    let scrollPosition = 0;
    const scrollSpeed = 0.5;

    const animate = () => {
      scrollPosition += scrollSpeed;
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      
      if (scrollPosition >= maxScroll) {
        scrollPosition = 0;
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
            {/* Duplicate wins for seamless loop */}
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
