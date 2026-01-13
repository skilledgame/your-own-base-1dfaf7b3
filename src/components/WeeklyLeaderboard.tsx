import { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  coinsWon: number;
  gamesWon: number;
  avatar?: string;
}

// Mock data for initial display with realistic names
const generateMockLeaderboard = (): LeaderboardEntry[] => {
  const names = ['Marcus_Chen', 'Elena_Rodriguez', 'James_Wilson', 'Sophia_Kim', 'David_Okonkwo', 'Emma_Johansson', 'Lucas_Santos', 'Aisha_Patel', 'Ryan_Murphy', 'Yuki_Tanaka'];
  
  return names.map((name, index) => ({
    rank: index + 1,
    playerName: name,
    coinsWon: Math.floor(12000 - (index * 800) + Math.random() * 300),
    gamesWon: Math.floor(60 - (index * 4) + Math.random() * 5),
  })).sort((a, b) => b.coinsWon - a.coinsWon).map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
};

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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(generateMockLeaderboard());
  const [daysUntilReset, setDaysUntilReset] = useState(0);

  useEffect(() => {
    // Calculate days until next Monday (weekly reset)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    setDaysUntilReset(daysUntilMonday);

    // TODO: Fetch real leaderboard data from Supabase
    // For now using mock data
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
            <div className="col-span-3 text-right">Earnings</div>
            <div className="col-span-3 text-right">Games Won</div>
          </div>

          {/* Entries */}
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
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {entry.playerName[0]}
                  </div>
                  <span className="font-medium text-foreground truncate">{entry.playerName.replace('_', ' ')}</span>
                </div>
                <div className="col-span-3 text-right font-bold text-accent">
                  ${(entry.coinsWon / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="col-span-3 text-right text-muted-foreground">
                  {entry.gamesWon}
                </div>
              </div>
            ))}
          </div>

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
