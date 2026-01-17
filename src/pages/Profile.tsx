import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Trophy, Coins, Gamepad2, Settings, LogOut, 
  Crown, Target, Award, ChevronRight, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { useAuth } from '@/contexts/AuthContext';
import { useBalanceStore } from '@/stores/balanceStore';
import skilledLogo from '@/assets/skilled-logo.png';

interface UserStats {
  wins: number;
  losses: number;
  matchesPlayed: number;
  winRate: number;
  freePlaysRemaining: number;
}

// Memoized stats card
const StatCard = memo(({ icon: Icon, value, label, color }: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  color: string;
}) => (
  <Card className="bg-card border-border">
    <CardContent className="p-4 text-center">
      <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
));
StatCard.displayName = 'StatCard';

export default function Profile() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const { balance, fetchBalance } = useBalanceStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<UserStats>({
    wins: 0,
    losses: 0,
    matchesPlayed: 0,
    winRate: 0,
    freePlaysRemaining: 3
  });
  const [loading, setLoading] = useState(true);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated || !user) {
      navigate('/auth');
      return;
    }
    
    const loadData = async () => {
      await Promise.all([
        fetchProfile(user.id),
        fetchStats(user.id),
        fetchBalance(user.id)
      ]);
      setLoading(false);
    };
    
    loadData();
  }, [isAuthenticated, user, authLoading, navigate, fetchBalance]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) {
      setProfile(data);
    }
  };

  const fetchStats = async (userId: string) => {
    // Get player ID first
    const { data: playerData } = await supabase
      .rpc('get_player_id_for_user', { _user_id: userId });

    if (playerData) {
      // Get games where user is white or black player
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .or(`white_player_id.eq.${playerData},black_player_id.eq.${playerData}`)
        .eq('status', 'finished');

      if (games) {
        const wins = games.filter(g => g.winner_id === playerData).length;
        const matchesPlayed = games.length;
        const losses = matchesPlayed - wins;
        const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;

        setStats(prev => ({
          ...prev,
          wins,
          losses,
          matchesPlayed,
          winRate
        }));
      }
    }

    // Get free plays remaining
    const { data: freePlays } = await supabase
      .rpc('get_or_create_free_plays', { p_game_slug: 'chess', p_user_id: userId });
    
    if (freePlays !== null) {
      setStats(prev => ({ ...prev, freePlaysRemaining: freePlays }));
    }
  };

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/');
  }, [signOut, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Use balance from store, fallback to profile
  const displayBalance = balance || profile?.skilled_coins || 0;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Side Menu */}
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />
      
      {/* Overlay for mobile */}
      {sideMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <img src={skilledLogo} alt="Skilled" className="h-8 w-auto" />
          <h1 className="text-lg font-semibold">Profile</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-primary/20 to-primary/5" />
          <CardContent className="pt-0 -mt-10">
            <div className="flex flex-col items-center">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center border-4 border-card">
                <User className="w-10 h-10 text-primary-foreground" />
              </div>
              
              {/* Username */}
              <h2 className="mt-3 text-xl font-bold text-foreground">
                {profile?.display_name || user?.email?.split('@')[0] || 'Player'}
              </h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>

              {/* Coin Balance */}
              <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-lg">{displayBalance.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">Coins</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Trophy} value={stats.wins} label="Wins" color="text-yellow-500" />
          <StatCard icon={Target} value={stats.losses} label="Losses" color="text-red-500" />
          <StatCard icon={Gamepad2} value={stats.matchesPlayed} label="Matches" color="text-primary" />
          <StatCard icon={Award} value={`${stats.winRate}%`} label="Win Rate" color="text-emerald-500" />
        </div>

        {/* Free Plays */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Free Games</p>
                  <p className="text-sm text-muted-foreground">Daily free plays remaining</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-primary">{stats.freePlaysRemaining}</span>
                <span className="text-muted-foreground">/ 3</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <button 
              onClick={() => navigate('/deposit')}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Coins className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Deposit Coins</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <Separator />
            
            <button 
              onClick={() => navigate('/terms')}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Terms & Privacy</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <Separator />
            
            <button 
              onClick={() => {}}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Settings</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Button 
          variant="ghost" 
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
