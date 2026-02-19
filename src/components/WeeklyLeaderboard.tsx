import { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
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
      return <Crown className="w-5 h-5 text-yellow-400" />;
    case 2:
      return <Medal className="w-5 h-5 text-gray-400" />;
    case 3:
      return <Medal className="w-5 h-5 text-amber-600" />;
    default:
      return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
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

interface WeeklyLeaderboardProps {
  compact?: boolean;
}

export const WeeklyLeaderboard = ({ compact = false }: WeeklyLeaderboardProps) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysUntilReset, setDaysUntilReset] = useState(0);

  useEffect(() => {
    // Calculate days until next Monday (weekly reset)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    setDaysUntilReset(daysUntilMonday);
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_weekly_leaderboard');
        
        if (error) {
          console.error('Error fetching leaderboard:', error);
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
          skinColor: row.skin_color || 'purple',
          skinIcon: row.skin_icon || 'cat',
        }));

        setLeaderboard(entries);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const displayedEntries = compact ? leaderboard.slice(0, 5) : leaderboard;

  return (
    <section className={`${compact ? '' : 'py-12'} px-4`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Weekly Leaderboard</h2>
          </div>
          <div className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
            Resets in {daysUntilReset} day{daysUntilReset !== 1 ? 's' : ''}
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {/* Empty State */}
          {!loading && leaderboard.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trophy className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">No games played this week yet</p>
              <p className="text-xs">Be the first to compete!</p>
            </div>
          )}

          {/* Entries */}
          {!loading && displayedEntries.length > 0 && (
            <div className="divide-y divide-border">
              {displayedEntries.map((entry) => (
                <div
                  key={entry.rank}
                  className={`grid grid-cols-12 gap-4 px-4 py-3 items-center transition-colors hover:bg-secondary/30 ${getRankStyle(entry.rank)} border-l-2`}
                >
                  <div className="col-span-1 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>
                  <div className="col-span-5 flex items-center gap-3">
                    <PlayerAvatar
                      skinColor={entry.skinColor}
                      skinIcon={entry.skinIcon}
                      size="sm"
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

          {/* View Full Leaderboard Link */}
          {compact && (
            <Link
              to="/leaderboard"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors text-sm font-medium text-primary"
            >
              View Full Leaderboard
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};
