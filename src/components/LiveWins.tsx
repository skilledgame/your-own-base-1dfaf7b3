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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:22',message:'fetchRecentWins entry',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,B,C'})}).catch(()=>{});
      // #endregion
      
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

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:40',message:'Query result',data:{error:error?.message||null,gameCount:games?.length||0,hasGames:!!games,firstGameId:games?.[0]?.id||null,firstGameWinnerId:games?.[0]?.winner_id||null,firstGameSettledAt:games?.[0]?.settled_at||null},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,B,C'})}).catch(()=>{});
      // #endregion

      if (error) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:42',message:'Query error',data:{error:error.message,code:error.code,details:error.details},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.error('Error fetching recent wins:', error);
        return;
      }

      if (!games || games.length === 0) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:46',message:'No games returned',data:{gamesIsNull:!games,length:games?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        setWins([]);
        setLoading(false);
        return;
      }

      // Get unique winner IDs (player_ids) and fetch their display_names from profiles
      const uniqueWinnerIds = [...new Set(games.map(g => g.winner_id).filter(Boolean))];
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:52',message:'Before fetching display names from profiles',data:{gameCount:games.length,uniqueWinnerIds,uniqueWinnerCount:uniqueWinnerIds.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Fetch display_name from profiles using security definer function (bypasses RLS)
      const displayNamePromises = uniqueWinnerIds.map(async (playerId) => {
        const { data, error } = await supabase.rpc('get_display_name_from_player_id', {
          p_player_id: playerId
        });
        return { playerId, displayName: error ? null : data, error: error?.message };
      });

      const displayNameResults = await Promise.all(displayNamePromises);
      const playerNameMap = new Map<string, string | null>();
      displayNameResults.forEach(({ playerId, displayName }) => {
        playerNameMap.set(playerId, displayName);
      });

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:68',message:'Display names fetched from profiles',data:{playerNameMapSize:playerNameMap.size,playerNames:Array.from(playerNameMap.entries()).map(([id,name])=>({playerId:id,displayName:name}))},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      const recentWins: Win[] = games.map((game) => {
        const playerName = playerNameMap.get(game.winner_id);
        const displayName = playerName || 'Skilled Player';
        const timestampSource = game.settled_at || game.updated_at || game.created_at || Date.now();

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:73',message:'Mapping game',data:{gameId:game.id,winnerId:game.winner_id,playerName,displayName,settledAt:game.settled_at,updatedAt:game.updated_at,createdAt:game.created_at,timestampSource},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,C'})}).catch(()=>{});
        // #endregion

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
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:90',message:'After sorting wins',data:{winCount:sortedWins.length,playerNames:sortedWins.map(w=>w.playerName),timestamps:sortedWins.map(w=>w.timestamp.toISOString())},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      setWins(sortedWins);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:94',message:'Exception in fetchRecentWins',data:{error:err instanceof Error?err.message:String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,B,C'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:92',message:'Setting up real-time subscription',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
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
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:103',message:'Real-time update received',data:{eventType:payload.eventType,table:payload.table,new:payload.new,old:payload.old,gameId:payload.new?.id||payload.old?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          // Refetch when a game finishes
          fetchRecentWins();
        }
      )
      .subscribe((status) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/887c5b56-2eca-4a7d-b630-4dd3ddfd58ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LiveWins.tsx:108',message:'Subscription status',data:{status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      });

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
            {wins.map((win) => (
              <div
                key={win.id}
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
