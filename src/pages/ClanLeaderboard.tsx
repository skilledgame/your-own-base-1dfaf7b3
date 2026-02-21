import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Crown, Medal, Users, Shield, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/hooks/useClan';
import skilledLogo from '@/assets/skilled-logo.png';

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-yellow-400" />;
    case 2:
      return <Medal className="w-5 h-5 text-gray-400" />;
    case 3:
      return <Medal className="w-5 h-5 text-amber-600" />;
    default:
      return (
        <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">
          {rank}
        </span>
      );
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

export default function ClanLeaderboard() {
  const navigate = useNavigate();
  const { isAuthReady } = useAuth();
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const { leaderboard, loading, fetchLeaderboard } = useClan();

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />

      {sideMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/clan')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Clan Rankings</h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Clan</div>
            <div className="col-span-3 text-right">Trophies</div>
            <div className="col-span-3 text-right">Members</div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {!loading && leaderboard.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">No clans yet</p>
              <p className="text-xs">Be the first to create one!</p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => navigate('/clan')}
              >
                Create Clan
              </Button>
            </div>
          )}

          {!loading && leaderboard.length > 0 && (
            <div className="divide-y divide-border">
              {leaderboard.map((entry) => (
                <div
                  key={entry.clan_id}
                  className={`grid grid-cols-12 gap-4 px-4 py-3 items-center transition-colors hover:bg-secondary/30 ${getRankStyle(entry.rank)} border-l-2`}
                >
                  <div className="col-span-1 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {entry.clan_name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-foreground truncate block text-sm">
                        {entry.clan_name}
                      </span>
                      {entry.leader_name && (
                        <span className="text-[10px] text-muted-foreground">
                          Led by {entry.leader_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 text-right font-bold text-accent">
                    {entry.total_trophies.toLocaleString()}
                  </div>
                  <div className="col-span-3 text-right text-muted-foreground flex items-center justify-end gap-1">
                    <Users className="w-3 h-3" />
                    {entry.member_count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
