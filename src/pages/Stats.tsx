import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, Coins, Gamepad2, TrendingUp, Flame, Target,
  Calendar, ChevronDown, Zap, Crown, Swords, Medal,
  ArrowUpRight, ArrowDownRight, Minus, BarChart3
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { formatSkilledCoins } from '@/lib/rankSystem';
import skilledLogo from '@/assets/skilled-logo.png';

interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalWagered: number;
  totalWon: number;
  netProfit: number;
  currentStreak: number;
  bestStreak: number;
  avgWager: number;
  biggestWin: number;
  freePlaysRemaining: number;
  dailyPlayStreak: number;
}

type TimePeriod = '7d' | '30d' | '90d' | 'all';

const periodLabels: Record<TimePeriod, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  'all': 'All Time'
};

export default function Stats() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const authLoading = !isAuthReady;
  const { totalWageredSc, skilledCoins } = useProfile();
  
  const [stats, setStats] = useState<PlayerStats>({
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    totalWagered: 0,
    totalWon: 0,
    netProfit: 0,
    currentStreak: 0,
    bestStreak: 0,
    avgWager: 0,
    biggestWin: 0,
    freePlaysRemaining: 3,
    dailyPlayStreak: 0
  });
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated || !user) {
      navigate('/auth');
      return;
    }
    
    fetchStats(user.id, timePeriod);
  }, [isAuthenticated, user, authLoading, navigate, timePeriod]);

  const fetchStats = async (userId: string, period: TimePeriod) => {
    setLoading(true);
    
    try {
      // Get player ID
      const { data: playerId } = await supabase
        .rpc('get_player_id_for_user', { _user_id: userId });

      if (!playerId) {
        setLoading(false);
        return;
      }

      // Calculate date filter
      let dateFilter = '';
      const now = new Date();
      if (period !== 'all') {
        const days = parseInt(period);
        const filterDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        dateFilter = filterDate.toISOString();
      }

      // Get games
      let query = supabase
        .from('games')
        .select('*')
        .or(`white_player_id.eq.${playerId},black_player_id.eq.${playerId}`)
        .eq('status', 'finished')
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data: games } = await query;

      // Calculate daily play streak from all games
      let dailyPlayStreak = 0;
      const { data: allGames } = await supabase
        .from('games')
        .select('created_at')
        .or(`white_player_id.eq.${playerId},black_player_id.eq.${playerId}`)
        .eq('status', 'finished')
        .order('created_at', { ascending: false });

      if (allGames && allGames.length > 0) {
        // Calculate consecutive days played
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const playedDates = new Set<string>();
        allGames.forEach(game => {
          const gameDate = new Date(game.created_at);
          gameDate.setHours(0, 0, 0, 0);
          playedDates.add(gameDate.toISOString());
        });
        
        // Count consecutive days from today backwards
        let currentDate = new Date(today);
        while (playedDates.has(currentDate.toISOString())) {
          dailyPlayStreak++;
          currentDate.setDate(currentDate.getDate() - 1);
        }
      }

      if (games && games.length > 0) {
        const wins = games.filter(g => g.winner_id === playerId).length;
        const losses = games.filter(g => g.winner_id && g.winner_id !== playerId).length;
        const draws = games.filter(g => !g.winner_id).length;
        const totalGames = games.length;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

        // Calculate wager stats
        const totalWagered = games.reduce((sum, g) => sum + (g.wager || 0), 0);
        const wonGames = games.filter(g => g.winner_id === playerId);
        const totalWon = wonGames.reduce((sum, g) => sum + (g.wager || 0) * 2, 0);
        const netProfit = totalWon - totalWagered;
        const avgWager = totalGames > 0 ? Math.round(totalWagered / totalGames) : 0;
        const biggestWin = wonGames.length > 0 
          ? Math.max(...wonGames.map(g => (g.wager || 0) * 2))
          : 0;

        // Calculate win streaks
        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;
        
        for (const game of games) {
          if (game.winner_id === playerId) {
            tempStreak++;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
          } else {
            if (currentStreak === 0 && tempStreak > 0) {
              currentStreak = tempStreak;
            }
            tempStreak = 0;
          }
        }
        // If still on a winning streak
        if (tempStreak > 0 && currentStreak === 0) {
          currentStreak = tempStreak;
        }

        setStats(prev => ({
          ...prev,
          totalGames,
          wins,
          losses,
          draws,
          winRate,
          totalWagered,
          totalWon,
          netProfit,
          currentStreak,
          bestStreak,
          avgWager,
          biggestWin,
          dailyPlayStreak
        }));
      } else {
        setStats(prev => ({
          ...prev,
          totalGames: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          totalWagered: 0,
          totalWon: 0,
          netProfit: 0,
          currentStreak: 0,
          bestStreak: 0,
          avgWager: 0,
          biggestWin: 0,
          dailyPlayStreak
        }));
      }

      // Get free plays
      const { data: freePlays } = await supabase
        .rpc('get_or_create_free_plays', { p_game_slug: 'chess', p_user_id: userId });
      
      if (freePlays !== null) {
        setStats(prev => ({ ...prev, freePlaysRemaining: freePlays }));
      }
    } catch (error) {
    }
    
    setLoading(false);
  };

  const handleClaimReward = (type: string) => {
    // TODO: Implement reward claiming logic
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <img src={skilledLogo} alt="Skilled" className="h-8 w-auto" />
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Player Stats</h1>
          </div>
          <div className="w-8" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Filter Bar */}
        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 justify-between bg-card border-border">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span>All Stats</span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuItem>All Stats</DropdownMenuItem>
              <DropdownMenuItem>Chess Only</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 justify-between bg-card border-border">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span>{periodLabels[timePeriod]}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              {Object.entries(periodLabels).map(([key, label]) => (
                <DropdownMenuItem 
                  key={key} 
                  onClick={() => setTimePeriod(key as TimePeriod)}
                  className={timePeriod === key ? 'bg-primary/10' : ''}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Main Stats - Two Big Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-card to-card/80 border-border overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[160px]">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                <Gamepad2 className="w-7 h-7 text-primary" />
              </div>
              <span className="text-3xl font-bold text-foreground">{loading ? '...' : stats.totalGames}</span>
              <span className="text-sm text-muted-foreground mt-1">Games Played</span>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-border overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-8 translate-x-8" />
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[160px]">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mb-3">
                <TrendingUp className="w-7 h-7 text-emerald-500" />
              </div>
              <span className="text-3xl font-bold text-foreground">{loading ? '...' : `${stats.winRate}%`}</span>
              <span className="text-sm text-muted-foreground mt-1">Win Rate</span>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <span className="text-2xl font-bold text-foreground block">{loading ? '...' : stats.wins}</span>
              <span className="text-xs text-muted-foreground">Wins</span>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Target className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <span className="text-2xl font-bold text-foreground block">{loading ? '...' : stats.losses}</span>
              <span className="text-xs text-muted-foreground">Losses</span>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Swords className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <span className="text-2xl font-bold text-foreground block">{loading ? '...' : stats.draws}</span>
              <span className="text-xs text-muted-foreground">Draws</span>
            </CardContent>
          </Card>
        </div>

        {/* Streaks & Performance */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Win Streak</p>
                  <p className="text-xl font-bold text-foreground">{stats.currentStreak} 🔥</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Medal className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Best Streak</p>
                  <p className="text-xl font-bold text-foreground">{stats.bestStreak}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Biggest Win</p>
                  <p className="text-xl font-bold text-foreground">{formatSkilledCoins(stats.biggestWin)} SC</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Wager</p>
                  <p className="text-xl font-bold text-foreground">{formatSkilledCoins(stats.avgWager)} SC</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card className="bg-gradient-to-r from-card via-card to-primary/5 border-border">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Skilled Coins Summary
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-xl bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Total Wagered</p>
                <p className="text-lg font-bold text-foreground">{formatSkilledCoins(stats.totalWagered)}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Total Won</p>
                <p className="text-lg font-bold text-emerald-500">{formatSkilledCoins(stats.totalWon)}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
                <div className="flex items-center justify-center gap-1">
                  {stats.netProfit > 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  ) : stats.netProfit < 0 ? (
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                  <p className={`text-lg font-bold ${
                    stats.netProfit > 0 ? 'text-emerald-500' : 
                    stats.netProfit < 0 ? 'text-red-500' : 'text-foreground'
                  }`}>
                    {formatSkilledCoins(Math.abs(stats.netProfit))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Free Plays */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Gamepad2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Daily Free Games</p>
                  <p className="text-sm text-muted-foreground">Resets every 24 hours</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-primary">{stats.freePlaysRemaining}</span>
                <span className="text-muted-foreground text-sm">/ 3</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={() => navigate('/chess')}
            className="h-14 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold"
          >
            <Gamepad2 className="w-5 h-5 mr-2" />
            Play Now
          </Button>
          <Button 
            onClick={() => navigate('/deposit')}
            variant="outline"
            className="h-14 border-primary/30 hover:bg-primary/10"
          >
            <Coins className="w-5 h-5 mr-2 text-yellow-500" />
            Get Coins
          </Button>
        </div>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
