import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Medal, Crown, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoLink } from '@/components/LogoLink';
import { supabase } from '@/integrations/supabase/client';
import { UserBadges } from '@/components/UserBadge';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  totalWon: number;
  gamesWon: number;
  userId: string;
  badges: string[];
  skinColor: string;
  skinIcon: string;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-6 h-6 text-yellow-400" />;
    case 2:
      return <Medal className="w-6 h-6 text-gray-400" />;
    case 3:
      return <Medal className="w-6 h-6 text-amber-600" />;
    default:
      return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  }
};

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/30';
    case 2:
      return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/30';
    case 3:
      return 'bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/30';
    default:
      return 'bg-card border-border';
  }
};

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysUntilReset, setDaysUntilReset] = useState(0);
  const [hoursUntilReset, setHoursUntilReset] = useState(0);

  useEffect(() => {
    // Calculate time until next Monday 00:00 UTC
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    
    // Calculate hours remaining in today (UTC)
    const hoursLeft = 23 - now.getUTCHours();
    
    setDaysUntilReset(daysUntilMonday);
    setHoursUntilReset(hoursLeft);
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_weekly_leaderboard');
        
        if (error) {
          setLeaderboard([]);
          return;
        }

        const rows = data || [];
        const userIds = rows.map((r: { user_id: string }) => r.user_id).filter(Boolean);

        // Fetch badges for all leaderboard users
        let badgesByUser: Record<string, string[]> = {};
        if (userIds.length > 0) {
          const { data: badgeData } = await supabase
            .from('user_badges')
            .select('user_id, badge')
            .in('user_id', userIds);

          if (badgeData) {
            for (const b of badgeData) {
              if (!badgesByUser[b.user_id]) badgesByUser[b.user_id] = [];
              badgesByUser[b.user_id].push(b.badge);
            }
          }
        }

        const entries: LeaderboardEntry[] = rows.map((row: {
          rank: number;
          player_name: string;
          total_won: number;
          games_won: number;
          user_id: string;
          skin_color: string;
          skin_icon: string;
        }) => ({
          rank: Number(row.rank),
          playerName: row.player_name || 'Anonymous',
          totalWon: Number(row.total_won),
          gamesWon: Number(row.games_won),
          userId: row.user_id,
          badges: badgesByUser[row.user_id] || [],
          skinColor: row.skin_color || 'normal',
          skinIcon: row.skin_icon || 'cat',
        }));

        setLeaderboard(entries);
      } catch (err) {
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

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
          <div className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
            Resets in {daysUntilReset}d {hoursUntilReset}h
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Trophy className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Weekly Leaderboard</h1>
              <p className="text-sm text-muted-foreground">Top 20 players by SC won this week</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1">Rank</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-3 text-right">SC Won</div>
              <div className="col-span-3 text-right">Wins</div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {/* Empty State */}
            {!loading && leaderboard.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Trophy className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No games played this week yet</p>
                <p className="text-sm">Be the first to compete and top the leaderboard!</p>
              </div>
            )}

            {/* Entries */}
            {!loading && leaderboard.length > 0 && (
              <div className="divide-y divide-border">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`grid grid-cols-12 gap-4 px-4 py-4 items-center transition-colors hover:bg-secondary/30 ${getRankStyle(entry.rank)} border-l-2`}
                  >
                    <div className="col-span-1 flex items-center justify-center">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="col-span-5 flex items-center gap-3">
                      <PlayerAvatar
                        skinColor={entry.skinColor}
                        skinIcon={entry.skinIcon}
                        size="md"
                        fallbackInitial={entry.playerName[0] || '?'}
                      />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-foreground truncate">{entry.playerName}</span>
                        {entry.badges.length > 0 && <UserBadges badges={entry.badges} size="sm" />}
                      </div>
                    </div>
                    <div className="col-span-3 text-right font-bold text-accent">
                      {entry.totalWon.toLocaleString()} SC
                    </div>
                    <div className="col-span-3 text-right text-muted-foreground">
                      {entry.gamesWon}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Leaderboard;
