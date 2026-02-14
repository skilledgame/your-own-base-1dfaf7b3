import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, CURRENT_SUPABASE_URL } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import skilledLogo from '@/assets/skilled-logo.png';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Loader2,
  Users,
  Coins,
  Shield,
  Search,
  RefreshCw,
  Edit2,
  Crown,
  User as UserIcon,
  Gamepad2,
  Clock,
  Swords,
  Trophy,
  FlaskConical,
  Code,
  Globe,
  Eye,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { UserBadges, type BadgeType } from '@/components/UserBadge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  skilled_coins: number;
  created_at: string;
  role: string;
  badges: string[];
}

interface SearchEntry {
  id: string;
  user_id: string;
  display_name: string | null;
  wager: number;
  game_type: string;
  created_at: string;
}

interface ActiveGame {
  id: string;
  white_player_id: string;
  black_player_id: string;
  wager: number;
  status: string;
  game_type: string;
  created_at: string;
  white_player_name?: string;
  black_player_name?: string;
}

interface DailyPageViews {
  date: string;
  views: number;
  unique_visitors: number;
}

interface ActiveVisitor {
  session_id: string;
  user_id: string | null;
  page_path: string | null;
  last_seen_at: string;
}

export default function Admin() {
  const { isAdmin, isModerator, isPrivileged, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  // Site analytics state
  const [dailyPageViews, setDailyPageViews] = useState<DailyPageViews[]>([]);
  const [activeVisitors, setActiveVisitors] = useState<ActiveVisitor[]>([]);
  const [siteLoading, setSiteLoading] = useState(false);
  const [todayViews, setTodayViews] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!roleLoading && !isPrivileged) {
      navigate('/');
    }
  }, [roleLoading, isPrivileged, navigate]);

  useEffect(() => {
    if (isPrivileged) {
      fetchUsers();
      fetchMatchmakingData();
    }
  }, [isPrivileged]);

  // Real-time subscription for matchmaking & search updates
  useEffect(() => {
    if (!isPrivileged) return;

    const searchChannel = supabase
      .channel('admin-search-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_searches' },
        () => {
          fetchMatchmakingData();
        }
      )
      .subscribe();

    const gamesChannel = supabase
      .channel('admin-games-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => {
          fetchMatchmakingData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(searchChannel);
      supabase.removeChannel(gamesChannel);
    };
  }, [isPrivileged]);

  // Fetch site analytics when site tab is active
  useEffect(() => {
    if (activeTab === 'site' && isPrivileged) {
      fetchSiteAnalytics();
      // Refresh active visitors every 30s
      const interval = setInterval(fetchActiveVisitors, 30_000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isPrivileged]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const response = await fetch(
        `${CURRENT_SUPABASE_URL}/functions/v1/admin-users?action=list-users`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch users');
      }

      setUsers(result.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch users',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchmakingData = async () => {
    try {
      // Clean stale searches first (older than 5 min)
      await supabase.rpc('clean_stale_searches').catch(() => {});

      // Fetch active searches (WS matchmaking queue mirror)
      const { data: searchData, error: searchError } = await supabase
        .from('active_searches')
        .select('*')
        .order('created_at', { ascending: true });

      if (searchError) {
        console.error('Error fetching active searches:', searchError);
      } else {
        setSearchEntries(searchData || []);
      }

      // Fetch active games
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (gamesError) {
        console.error('Error fetching games:', gamesError);
      } else {
        // Get player names for games
        const allPlayerIds = [
          ...new Set([
            ...(gamesData?.map(g => g.white_player_id) || []),
            ...(gamesData?.map(g => g.black_player_id) || [])
          ])
        ];
        
        if (allPlayerIds.length > 0) {
          const { data: players } = await supabase
            .from('players')
            .select('id, name')
            .in('id', allPlayerIds);

          const playerMap = new Map(players?.map(p => [p.id, p.name]) || []);
          const enrichedGames = gamesData?.map(g => ({
            ...g,
            white_player_name: playerMap.get(g.white_player_id) || 'Unknown',
            black_player_name: playerMap.get(g.black_player_id) || 'Unknown'
          })) || [];
          setActiveGames(enrichedGames);
        } else {
          setActiveGames([]);
        }
      }
    } catch (error) {
      console.error('Error fetching matchmaking data:', error);
    }
  };

  const fetchSiteAnalytics = async () => {
    setSiteLoading(true);
    try {
      await Promise.all([fetchDailyPageViews(), fetchActiveVisitors(), fetchTodayViews()]);
    } finally {
      setSiteLoading(false);
    }
  };

  const fetchDailyPageViews = async () => {
    try {
      // Get page views for the last 14 days grouped by date
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data, error } = await supabase
        .from('page_views')
        .select('created_at, session_id')
        .gte('created_at', fourteenDaysAgo.toISOString());

      if (error) {
        console.error('Error fetching page views:', error);
        return;
      }

      // Group by date
      const dayMap = new Map<string, { views: number; sessions: Set<string> }>();
      
      // Initialize all 14 days
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        dayMap.set(dateKey, { views: 0, sessions: new Set() });
      }

      (data || []).forEach(row => {
        const dateKey = new Date(row.created_at).toISOString().split('T')[0];
        const entry = dayMap.get(dateKey);
        if (entry) {
          entry.views++;
          entry.sessions.add(row.session_id);
        }
      });

      const chartData: DailyPageViews[] = Array.from(dayMap.entries()).map(([date, val]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: val.views,
        unique_visitors: val.sessions.size,
      }));

      setDailyPageViews(chartData);
    } catch (error) {
      console.error('Error fetching daily page views:', error);
    }
  };

  const fetchActiveVisitors = async () => {
    try {
      // Clean stale visitors first
      await supabase.rpc('clean_stale_visitors').catch(() => {});

      const { data, error } = await supabase
        .from('active_visitors')
        .select('*')
        .gte('last_seen_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
        .order('last_seen_at', { ascending: false });

      if (error) {
        console.error('Error fetching active visitors:', error);
        return;
      }

      setActiveVisitors(data || []);
    } catch (error) {
      console.error('Error fetching active visitors:', error);
    }
  };

  const fetchTodayViews = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());

      if (!error) {
        setTodayViews(count || 0);
      }
    } catch (error) {
      console.error('Error fetching today views:', error);
    }
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setNewBalance(user.skilled_coins.toString());
    setNewRole(user.role);
    setNewBadges(user.badges || []);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const balanceChanged = parseInt(newBalance) !== editingUser.skilled_coins;
      const roleChanged = newRole !== editingUser.role;
      const badgesChanged = JSON.stringify([...newBadges].sort()) !== JSON.stringify([...(editingUser.badges || [])].sort());

      if (balanceChanged) {
        const response = await fetch(
          `${CURRENT_SUPABASE_URL}/functions/v1/admin-users?action=update-balance`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: editingUser.user_id,
              newBalance: parseInt(newBalance),
            }),
          }
        );

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to update balance');
        }
      }

      if (roleChanged && isAdmin) {
        const response = await fetch(
          `${CURRENT_SUPABASE_URL}/functions/v1/admin-users?action=update-role`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: editingUser.user_id,
              newRole: newRole,
            }),
          }
        );

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to update role');
        }
      }

      if (badgesChanged && isAdmin) {
        const response = await fetch(
          `${CURRENT_SUPABASE_URL}/functions/v1/admin-users?action=update-badges`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: editingUser.user_id,
              badges: newBadges,
            }),
          }
        );

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to update badges');
        }
      }

      toast({
        title: 'User updated',
        description: 'Changes saved successfully',
      });

      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save changes',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(term) ||
      user.display_name?.toLowerCase().includes(term) ||
      user.user_id.toLowerCase().includes(term)
    );
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'moderator':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'moderator':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPrivileged) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="border-b border-purple-500/20 p-4 sticky top-0 bg-[#0a0f1a]/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <Link to="/">
            <img src={skilledLogo} alt="Skilled" className="h-8" />
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-purple-400 text-sm font-medium">
              {isAdmin ? 'Admin' : 'Moderator'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-purple-950/30 border border-purple-500/20">
            <TabsTrigger value="users" className="data-[state=active]:bg-purple-500/20">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="matchmaking" className="data-[state=active]:bg-purple-500/20">
              <Gamepad2 className="w-4 h-4 mr-2" />
              Matchmaking
            </TabsTrigger>
            <TabsTrigger value="site" className="data-[state=active]:bg-purple-500/20">
              <Globe className="w-4 h-4 mr-2" />
              Site
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* Title */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Users className="w-8 h-8 text-purple-400" />
                  User Management
                </h1>
                <p className="text-purple-200/60 mt-1">
                  View and manage all registered users
                </p>
              </div>
              <Button
                onClick={fetchUsers}
                variant="outline"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/40" />
              <Input
                placeholder="Search by email, name, or user ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-purple-950/30 border-purple-500/20 text-white placeholder:text-purple-200/40"
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                <p className="text-purple-200/60 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white">{users.length}</p>
              </div>
              <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                <p className="text-purple-200/60 text-sm">Admins</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
              <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                <p className="text-purple-200/60 text-sm">Moderators</p>
                <p className="text-2xl font-bold text-blue-500">
                  {users.filter(u => u.role === 'moderator').length}
                </p>
              </div>
              <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                <p className="text-purple-200/60 text-sm">Total Coins</p>
                <p className="text-2xl font-bold text-green-400">
                  {users.reduce((sum, u) => sum + u.skilled_coins, 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-purple-500/20 hover:bg-transparent">
                      <TableHead className="text-purple-200/60">User</TableHead>
                      <TableHead className="text-purple-200/60">Role</TableHead>
                      <TableHead className="text-purple-200/60">Balance</TableHead>
                      <TableHead className="text-purple-200/60">Joined</TableHead>
                      <TableHead className="text-purple-200/60 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-purple-500/10 hover:bg-purple-500/5">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">
                              {user.display_name || 'No name'}
                            </p>
                            <p className="text-sm text-purple-200/50">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                              {getRoleIcon(user.role)}
                              {user.role}
                            </div>
                            {user.badges && user.badges.length > 0 && (
                              <UserBadges badges={user.badges} size="sm" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Coins className="w-4 h-4 text-yellow-500" />
                            <span className="text-white font-medium">
                              {user.skilled_coins.toLocaleString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-purple-200/60">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditUser(user)}
                            className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-purple-200/50">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* Matchmaking Tab */}
          <TabsContent value="matchmaking" className="space-y-6">
            {/* Title */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Gamepad2 className="w-8 h-8 text-purple-400" />
                  Matchmaking Monitor
                </h1>
                <p className="text-purple-200/60 mt-1">
                  Real-time view of queue and active games
                </p>
              </div>
              <Button
                onClick={fetchMatchmakingData}
                variant="outline"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${searchEntries.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  <p className="text-blue-200/60 text-sm">Players Searching</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">{searchEntries.length}</p>
              </div>
              <div className="bg-green-950/30 border border-green-500/20 rounded-xl p-4">
                <p className="text-green-200/60 text-sm">Active Games</p>
                <p className="text-2xl font-bold text-green-400">{activeGames.length}</p>
              </div>
              <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-xl p-4">
                <p className="text-yellow-200/60 text-sm">Total Wagers Searching</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {searchEntries.reduce((sum, q) => sum + q.wager, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                <p className="text-purple-200/60 text-sm">Active Game Wagers</p>
                <p className="text-2xl font-bold text-purple-400">
                  {activeGames.reduce((sum, g) => sum + g.wager * 2, 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Queue by Wager */}
            <div className="grid md:grid-cols-3 gap-4">
              {[100, 500, 1000].map(wagerAmount => {
                const playersAtWager = searchEntries.filter(q => q.wager === wagerAmount);
                return (
                  <div key={wagerAmount} className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-yellow-500" />
                        <span className="text-white font-bold">{wagerAmount.toLocaleString()}</span>
                        <span className="text-blue-200/60 text-sm">wager queue</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        playersAtWager.length > 0 
                          ? 'bg-green-500/20 text-green-400 animate-pulse' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {playersAtWager.length} searching
                      </span>
                    </div>
                    {playersAtWager.length > 0 ? (
                      <div className="space-y-2">
                        {playersAtWager.map(entry => (
                          <div key={entry.id} className="flex items-center justify-between text-sm bg-blue-900/30 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                              <span className="text-white">{entry.display_name || 'Player'}</span>
                            </div>
                            <span className="text-blue-200/50">{formatTimeAgo(entry.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-blue-200/40 text-sm text-center py-4">No players searching</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Active Games */}
            <div className="bg-green-950/20 border border-green-500/20 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Swords className="w-5 h-5 text-green-400" />
                Active Games
              </h3>
              {activeGames.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {activeGames.map(game => (
                    <div key={game.id} className="bg-green-900/30 border border-green-500/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="text-white font-bold">{game.wager} coins</span>
                        </div>
                        <span className="text-green-200/50 text-sm">{formatTimeAgo(game.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-black font-bold mb-1">W</div>
                          <p className="text-white text-sm">{game.white_player_name}</p>
                        </div>
                        <span className="text-green-400 font-bold">VS</span>
                        <div className="text-center">
                          <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-white font-bold mb-1">B</div>
                          <p className="text-white text-sm">{game.black_player_name}</p>
                        </div>
                      </div>
                      <p className="text-center text-green-200/40 text-xs mt-2">
                        Game ID: {game.id.slice(0, 8)}...
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-green-200/40 text-center py-8">No active games</p>
              )}
            </div>
          </TabsContent>

          {/* Site Analytics Tab */}
          <TabsContent value="site" className="space-y-6">
            {/* Title */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Globe className="w-8 h-8 text-purple-400" />
                  Site Analytics
                </h1>
                <p className="text-purple-200/60 mt-1">
                  Visitor activity and page view history
                </p>
              </div>
              <Button
                onClick={fetchSiteAnalytics}
                variant="outline"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${siteLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Live stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-950/30 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${activeVisitors.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  <p className="text-green-200/60 text-sm">Online Now</p>
                </div>
                <p className="text-2xl font-bold text-green-400">{activeVisitors.length}</p>
              </div>
              <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-blue-200/60 text-sm">Views Today</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">{todayViews.toLocaleString()}</p>
              </div>
              <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                  <p className="text-purple-200/60 text-sm">Avg Views / Day</p>
                </div>
                <p className="text-2xl font-bold text-purple-400">
                  {dailyPageViews.length > 0
                    ? Math.round(dailyPageViews.reduce((s, d) => s + d.views, 0) / dailyPageViews.length).toLocaleString()
                    : '0'}
                </p>
              </div>
              <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3.5 h-3.5 text-yellow-400" />
                  <p className="text-yellow-200/60 text-sm">Unique Today</p>
                </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {dailyPageViews.length > 0
                    ? dailyPageViews[dailyPageViews.length - 1]?.unique_visitors || 0
                    : 0}
                </p>
              </div>
            </div>

            {/* Page views chart */}
            <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Page Views — Last 14 Days
              </h3>
              {siteLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              ) : dailyPageViews.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyPageViews}>
                    <defs>
                      <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      stroke="#444"
                    />
                    <YAxis
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      stroke="#444"
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1a2e',
                        border: '1px solid rgba(168,85,247,0.3)',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#a855f7"
                      fill="url(#viewsGrad)"
                      strokeWidth={2}
                      name="Page Views"
                    />
                    <Area
                      type="monotone"
                      dataKey="unique_visitors"
                      stroke="#22c55e"
                      fill="url(#visitorsGrad)"
                      strokeWidth={2}
                      name="Unique Visitors"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-purple-200/40 text-center py-12">No data yet — views will appear as users visit the site</p>
              )}
            </div>

            {/* Active visitors list */}
            <div className="bg-green-950/20 border border-green-500/20 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-green-400" />
                Active Visitors
                <span className="ml-auto text-sm font-normal text-green-200/50">
                  Last 2 minutes
                </span>
              </h3>
              {activeVisitors.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {activeVisitors.map(visitor => (
                    <div
                      key={visitor.session_id}
                      className="flex items-center justify-between text-sm bg-green-900/30 rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-white">
                          {visitor.user_id ? 'Logged in user' : 'Anonymous'}
                        </span>
                        <span className="text-green-200/40 text-xs font-mono">
                          {visitor.session_id.slice(0, 12)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-green-200/60 text-xs bg-green-900/50 px-2 py-1 rounded">
                          {visitor.page_path || '/'}
                        </span>
                        <span className="text-green-200/40 text-xs">
                          {formatTimeAgo(visitor.last_seen_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-green-200/40 text-center py-8">No active visitors</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="bg-[#0a0f1a] border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-purple-400" />
              Edit User
            </DialogTitle>
            <DialogDescription className="text-purple-200/60">
              {editingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-purple-200/60 mb-2 block">
                Skilled Coins Balance
              </label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
                <Input
                  type="number"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="pl-10 bg-purple-950/30 border-purple-500/30 text-white"
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="text-sm text-purple-200/60 mb-2 block">
                  Role
                </label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="bg-purple-950/30 border-purple-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0f1a] border-purple-500/30">
                    <SelectItem value="user" className="text-white hover:bg-purple-500/10">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-gray-400" />
                        User
                      </div>
                    </SelectItem>
                    <SelectItem value="moderator" className="text-white hover:bg-purple-500/10">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        Moderator
                      </div>
                    </SelectItem>
                    <SelectItem value="admin" className="text-white hover:bg-purple-500/10">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-500" />
                        Admin
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {isAdmin && (
              <div>
                <label className="text-sm text-purple-200/60 mb-2 block">
                  Badges
                </label>
                <div className="space-y-3">
                  {([
                    { value: 'tester' as BadgeType, label: 'Tester', icon: FlaskConical, color: 'text-emerald-400' },
                    { value: 'dev' as BadgeType, label: 'Developer', icon: Code, color: 'text-blue-400' },
                    { value: 'admin' as BadgeType, label: 'Admin', icon: Shield, color: 'text-yellow-400' },
                  ]).map(({ value, label, icon: BadgeIcon, color }) => (
                    <label
                      key={value}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 cursor-pointer hover:bg-purple-500/10 transition-colors"
                    >
                      <Checkbox
                        checked={newBadges.includes(value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewBadges([...newBadges, value]);
                          } else {
                            setNewBadges(newBadges.filter((b) => b !== value));
                          }
                        }}
                        className="border-purple-500/40 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                      />
                      <BadgeIcon className={`w-4 h-4 ${color}`} />
                      <span className="text-white text-sm">{label}</span>
                    </label>
                  ))}
                </div>
                {newBadges.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    <UserBadges badges={newBadges} size="md" />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
