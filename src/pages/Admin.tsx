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
} from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  skilled_coins: number;
  created_at: string;
  role: string;
}

interface QueueEntry {
  id: string;
  player_id: string;
  wager: number;
  game_type: string;
  created_at: string;
  player_name?: string;
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

export default function Admin() {
  const { isAdmin, isModerator, isPrivileged, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
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

  // Real-time subscription for queue updates
  useEffect(() => {
    if (!isPrivileged) return;

    const queueChannel = supabase
      .channel('admin-queue-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
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
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(gamesChannel);
    };
  }, [isPrivileged]);

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
      // Fetch queue entries (using service role through the types)
      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .order('created_at', { ascending: true });

      if (queueError) {
        console.error('Error fetching queue:', queueError);
      } else {
        // Get player names for queue entries
        const playerIds = queueData?.map(q => q.player_id) || [];
        if (playerIds.length > 0) {
          const { data: players } = await supabase
            .from('players')
            .select('id, name')
            .in('id', playerIds);

          const playerMap = new Map(players?.map(p => [p.id, p.name]) || []);
          const enrichedQueue = queueData?.map(q => ({
            ...q,
            player_name: playerMap.get(q.player_id) || 'Unknown'
          })) || [];
          setQueueEntries(enrichedQueue);
        } else {
          setQueueEntries([]);
        }
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

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setNewBalance(user.skilled_coins.toString());
    setNewRole(user.role);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const balanceChanged = parseInt(newBalance) !== editingUser.skilled_coins;
      const roleChanged = newRole !== editingUser.role;

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
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                            {getRoleIcon(user.role)}
                            {user.role}
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
                <p className="text-blue-200/60 text-sm">Players in Queue</p>
                <p className="text-2xl font-bold text-blue-400">{queueEntries.length}</p>
              </div>
              <div className="bg-green-950/30 border border-green-500/20 rounded-xl p-4">
                <p className="text-green-200/60 text-sm">Active Games</p>
                <p className="text-2xl font-bold text-green-400">{activeGames.length}</p>
              </div>
              <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-xl p-4">
                <p className="text-yellow-200/60 text-sm">Total Wagers in Queue</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {queueEntries.reduce((sum, q) => sum + q.wager, 0).toLocaleString()}
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
                const playersAtWager = queueEntries.filter(q => q.wager === wagerAmount);
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
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {playersAtWager.length} waiting
                      </span>
                    </div>
                    {playersAtWager.length > 0 ? (
                      <div className="space-y-2">
                        {playersAtWager.map(entry => (
                          <div key={entry.id} className="flex items-center justify-between text-sm bg-blue-900/30 rounded-lg px-3 py-2">
                            <span className="text-white">{entry.player_name}</span>
                            <span className="text-blue-200/50">{formatTimeAgo(entry.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-blue-200/40 text-sm text-center py-4">No players waiting</p>
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
