import { useState, useEffect, useRef, useCallback } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import coins100 from '@/assets/coins-100.png';
import coins500 from '@/assets/coins-500.png';
import coins1000 from '@/assets/coins-1000.png';

interface Win {
  id: string;
  playerName: string;
  amount: number;
  wager: number;
  game: string;
  tierImage: string;
  timestamp: Date;
}

const MAX_WINS = 18;
const VISIBLE_CARDS = 10; // enough to fill any screen width
const CYCLE_INTERVAL = 3000;

export const LiveWins = () => {
  const [wins, setWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  const [displayQueue, setDisplayQueue] = useState<Win[]>([]);
  const [animKey, setAnimKey] = useState(0);
  const [isFirstRender, setIsFirstRender] = useState(true);
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
        .order('updated_at', { ascending: false })
        .limit(MAX_WINS);

      if (error) { console.error('Error fetching recent wins:', error); return; }
      if (!games || games.length === 0) { setWins([]); setLoading(false); return; }

      const winnerIds = [...new Set(games.map(g => g.winner_id).filter(Boolean))] as string[];
      const playerMap = new Map<string, { name: string | null; user_id: string | null }>();
      if (winnerIds.length > 0) {
        const { data: players } = await supabase.from('players').select('id, name, user_id').in('id', winnerIds);
        if (players) for (const p of players) playerMap.set(p.id, { name: p.name, user_id: p.user_id });
      }

      const userIds = [...new Set(Array.from(playerMap.values()).map(p => p.user_id).filter(Boolean))] as string[];
      const profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
        if (profiles) for (const p of profiles) { if (p.display_name) profileMap.set(p.user_id, p.display_name); }
      }

      const getTierImage = (wager: number) => {
        if (wager >= 1000) return coins1000;
        if (wager >= 500) return coins500;
        return coins100;
      };

      const recentWins: Win[] = games.map((game) => {
        const player = game.winner_id ? playerMap.get(game.winner_id) : null;
        const displayName = (player?.user_id && profileMap.get(player.user_id)) || player?.name || 'Player';
        const ts = game.settled_at || game.updated_at || game.created_at;
        return {
          id: game.id, playerName: displayName, amount: Math.floor(game.wager * 1.9),
          wager: game.wager, game: 'Chess', tierImage: getTierImage(game.wager),
          timestamp: new Date(ts),
        };
      });

      recentWins.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setWins(recentWins);
    } catch (err) { console.error('Failed to fetch recent wins:', err); }
    finally { setLoading(false); isFetchingRef.current = false; }
  }, []);

  useEffect(() => { fetchRecentWins(); }, [fetchRecentWins]);
  useEffect(() => {
    const interval = setInterval(() => { fetchRecentWins(); }, 120_000);
    return () => clearInterval(interval);
  }, [fetchRecentWins]);

  // Cycling logic
  useEffect(() => {
    if (wins.length === 0) return;

    if (cycleTimerRef.current) {
      clearInterval(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }

    // Start fully filled — show the first VISIBLE_CARDS wins immediately
    const initialSlice = wins.slice(0, VISIBLE_CARDS);
    setDisplayQueue(initialSlice);
    setIsFirstRender(true);
    cycleIndexRef.current = VISIBLE_CARDS - 1; // next cycle starts after these

    // After a brief moment, mark first render done so future updates animate
    const initTimer = setTimeout(() => setIsFirstRender(false), 100);

    // Cycle: every interval, take the next win and prepend it
    cycleTimerRef.current = setInterval(() => {
      cycleIndexRef.current = (cycleIndexRef.current + 1) % wins.length;
      const nextWin = wins[cycleIndexRef.current];

      setDisplayQueue(prev => [nextWin, ...prev.slice(0, VISIBLE_CARDS - 1)]);
      setAnimKey(k => k + 1);
    }, CYCLE_INTERVAL);

    return () => {
      clearTimeout(initTimer);
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
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

      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-16">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          /* Fade-out mask on the right edge instead of hard crop */
          <div
            className="overflow-hidden pb-2"
            style={{
              maskImage: 'linear-gradient(to right, black 0%, black 80%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, black 0%, black 80%, transparent 100%)',
            }}
          >
            <div
              key={isFirstRender ? 'initial' : animKey}
              className={`flex gap-3${!isFirstRender ? ' win-row-shift' : ''}`}
            >
              {displayQueue.map((win, index) => (
                <div
                  key={`${win.id}-${index}`}
                  className={`flex-shrink-0 w-[140px] group cursor-pointer${!isFirstRender && index === 0 ? ' win-card-pop' : ''}`}
                >
                  <div className="relative h-[140px] rounded-xl overflow-hidden transition-transform duration-300 group-hover:scale-105">
                    <img
                      src={win.tierImage}
                      alt={`${win.wager} SC Chess`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 text-[10px] text-white/90 font-bold uppercase tracking-wider drop-shadow-lg">
                      Chess
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-4 h-4 rounded-full bg-gradient-rainbow flex items-center justify-center overflow-hidden">
                      <Coins className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                      {win.playerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-accent font-bold text-sm">
                    {win.amount.toLocaleString()} SC
                    <Coins className="w-4 h-4 text-yellow-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
