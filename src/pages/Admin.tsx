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
  FileText,
  Plus,
  Save,
  Trash2,
  Award,
  Gem,
  Sparkles,
  X,
  Mail,
  Download,
  Calendar,
  CheckCircle2,
  Wallet,
  Check,
  XCircle,
  ArrowDownRight,
  Copy,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';
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

interface Withdrawal {
  id: string;
  user_id: string;
  amount_sc: number;
  amount_usd: number;
  crypto_currency: string;
  wallet_address: string;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  payout_id: string | null;
  payout_hash: string | null;
  created_at: string;
  updated_at: string;
  user_display_name: string;
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
  // Site content state
  const [contentPages, setContentPages] = useState<{ id: string; slug: string; title: string; content: string; updated_at: string | null }[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [editingContent, setEditingContent] = useState<{ id: string; slug: string; title: string; content: string; updated_at: string | null } | null>(null);
  const [contentValue, setContentValue] = useState('');
  const [contentSaving, setContentSaving] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showAddContent, setShowAddContent] = useState(false);
  // Rank config state
  interface RankTierRow {
    id: string;
    tier_name: string;
    display_name: string;
    threshold: number;
    perks: string[];
    rakeback_percentage: number;
    sort_order: number;
    updated_at: string | null;
  }
  const [rankTiers, setRankTiers] = useState<RankTierRow[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [editingRank, setEditingRank] = useState<RankTierRow | null>(null);
  const [rankForm, setRankForm] = useState({ display_name: '', threshold: '', perks: '', rakeback_percentage: '', sort_order: '' });
  const [rankSaving, setRankSaving] = useState(false);
  // Waitlist state
  interface WaitlistEntry {
    id: string;
    email: string;
    source: string;
    verified: boolean;
    notified: boolean;
    created_at: string;
  }
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistSearch, setWaitlistSearch] = useState('');
  // Waitlist email state
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailAudience, setEmailAudience] = useState<'verified' | 'un-notified'>('verified');
  const [emailSending, setEmailSending] = useState(false);
  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'pending' | 'all'>('pending');
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null);
  const [rejectNoteId, setRejectNoteId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [completeDialogId, setCompleteDialogId] = useState<string | null>(null);
  const [completeTxHash, setCompleteTxHash] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

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

  // Fetch site content when content tab is active
  useEffect(() => {
    if (activeTab === 'content' && isAdmin) {
      fetchContentPages();
    }
  }, [activeTab, isAdmin]);

  // Fetch rank config when ranks tab is active
  useEffect(() => {
    if (activeTab === 'ranks' && isAdmin) {
      fetchRankTiers();
    }
  }, [activeTab, isAdmin]);

  // Fetch waitlist when waitlist tab is active
  useEffect(() => {
    if (activeTab === 'waitlist' && isAdmin) {
      fetchWaitlist();
    }
  }, [activeTab, isAdmin]);

  // Fetch withdrawals when withdrawals tab is active
  useEffect(() => {
    if (activeTab === 'withdrawals' && isAdmin) {
      fetchWithdrawals();
    }
  }, [activeTab, isAdmin, withdrawalFilter]);

  const fetchWaitlist = async () => {
    setWaitlistLoading(true);
    try {
      const { data, error } = await supabase
        .from('waitlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch waitlist entries' });
      } else {
        setWaitlistEntries(data || []);
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleExportWaitlistCSV = () => {
    const verified = waitlistEntries.filter(e => e.verified);
    const csv = [
      'Email,Source,Date',
      ...verified.map(e =>
        `${e.email},${e.source},${new Date(e.created_at).toISOString()}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendWaitlistEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Subject and body are required' });
      return;
    }
    setEmailSending(true);
    try {
      const { data: rawData, error } = await supabase.functions.invoke('send-waitlist-email', {
        body: {
          subject: emailSubject.trim(),
          html_body: emailBody.trim(),
          send_to: emailAudience,
        },
      });

      console.log('[Admin] send-waitlist-email response:', { rawData, error, typeOfData: typeof rawData });

      if (error) {
        // Try to extract message from FunctionsHttpError
        let msg = error.message || 'Failed to send emails';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const errBody = await error.context.json();
            msg = errBody?.error || errBody?.message || msg;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      // Parse data - handle both pre-parsed JSON and string responses
      let data = rawData;
      if (typeof rawData === 'string') {
        try { data = JSON.parse(rawData); } catch { data = {}; }
      }

      console.log('[Admin] Parsed data:', data);

      if (data?.sent > 0) {
        toast({ title: 'Emails Sent', description: `Successfully sent to ${data.sent} recipients${data.failed > 0 ? ` (${data.failed} failed)` : ''}` });
        setShowEmailCompose(false);
        setEmailSubject('');
        setEmailBody('');
        fetchWaitlist();
      } else if (data?.error) {
        toast({ variant: 'destructive', title: 'Error', description: data.error });
      } else if (data?.errors?.length > 0) {
        toast({ variant: 'destructive', title: 'Send Failed', description: data.errors[0] });
      } else {
        toast({ title: 'No Recipients', description: `No matching recipients found (debug: ${JSON.stringify(data)})` });
      }
    } catch (error: any) {
      console.error('Error sending waitlist email:', error);
      toast({ variant: 'destructive', title: 'Send Failed', description: error.message || 'Failed to send emails' });
    } finally {
      setEmailSending(false);
    }
  };

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
        return;
      }

      setActiveVisitors(data || []);
    } catch (error) {
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
    }
  };

  // ---- Rank Config Management ----
  const fetchRankTiers = async () => {
    setRankLoading(true);
    try {
      const { data, error } = await supabase
        .from('rank_config')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch rank tiers' });
      } else {
        setRankTiers(data || []);
      }
    } catch (error) {
    } finally {
      setRankLoading(false);
    }
  };

  const openRankEditor = (tier: RankTierRow) => {
    setEditingRank(tier);
    setRankForm({
      display_name: tier.display_name,
      threshold: tier.threshold.toString(),
      perks: tier.perks.join('\n'),
      rakeback_percentage: tier.rakeback_percentage.toString(),
      sort_order: tier.sort_order.toString(),
    });
  };

  const handleSaveRank = async () => {
    if (!editingRank) return;
    setRankSaving(true);
    try {
      const perksArray = rankForm.perks
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const { error } = await supabase
        .from('rank_config')
        .update({
          display_name: rankForm.display_name.trim(),
          threshold: parseInt(rankForm.threshold) || 0,
          perks: perksArray,
          rakeback_percentage: parseFloat(rankForm.rakeback_percentage) || 0,
          sort_order: parseInt(rankForm.sort_order) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingRank.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: 'Rank updated', description: `"${rankForm.display_name}" saved successfully` });
        setEditingRank(null);
        fetchRankTiers();
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save rank' });
    } finally {
      setRankSaving(false);
    }
  };

  // ---- Withdrawal Management ----
  const fetchWithdrawals = async () => {
    setWithdrawalsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const action = withdrawalFilter === 'all' ? 'list-all' : 'list';
      const statusParam = withdrawalFilter === 'pending' ? '&status=pending' : '';
      const response = await fetch(
        `${CURRENT_SUPABASE_URL}/functions/v1/process-withdrawal?action=${action}${statusParam}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch withdrawals');
      }

      setWithdrawals(result.withdrawals || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch withdrawals',
      });
    } finally {
      setWithdrawalsLoading(false);
    }
  };

  const handleApproveWithdrawal = async (withdrawalId: string) => {
    setProcessingWithdrawalId(withdrawalId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${CURRENT_SUPABASE_URL}/functions/v1/process-withdrawal?action=approve`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ withdrawal_id: withdrawalId }),
        }
      );

      const result = await response.json();
      if (!response.ok && !result.success) {
        throw new Error(result.error || 'Failed to approve');
      }

      toast({
        title: 'Withdrawal Approved',
        description: result.message || 'Withdrawal has been approved.',
      });
      fetchWithdrawals();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve withdrawal',
      });
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  const handleRejectWithdrawal = async (withdrawalId: string) => {
    setProcessingWithdrawalId(withdrawalId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${CURRENT_SUPABASE_URL}/functions/v1/process-withdrawal?action=reject`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            withdrawal_id: withdrawalId,
            admin_note: rejectNote || 'Rejected by admin',
          }),
        }
      );

      const result = await response.json();
      if (!response.ok && !result.success) {
        throw new Error(result.error || 'Failed to reject');
      }

      toast({
        title: 'Withdrawal Rejected',
        description: result.message || 'Withdrawal rejected and coins refunded.',
      });
      setRejectNoteId(null);
      setRejectNote('');
      fetchWithdrawals();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject withdrawal',
      });
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  const handleCompleteWithdrawal = async (withdrawalId: string) => {
    setProcessingWithdrawalId(withdrawalId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${CURRENT_SUPABASE_URL}/functions/v1/process-withdrawal?action=complete`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            withdrawal_id: withdrawalId,
            payout_hash: completeTxHash || null,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok && !result.success) {
        throw new Error(result.error || 'Failed to complete');
      }

      toast({
        title: 'Withdrawal Completed',
        description: 'Withdrawal marked as completed.',
      });
      setCompleteDialogId(null);
      setCompleteTxHash('');
      fetchWithdrawals();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to complete withdrawal',
      });
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  const getWithdrawalStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'approved': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'processing': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getCryptoLabel = (id: string) => {
    const map: Record<string, string> = {
      btc: 'BTC', eth: 'ETH', usdttrc20: 'USDT (TRC20)', ltc: 'LTC',
    };
    return map[id] || id.toUpperCase();
  };

  const getRankTierColor = (tier: string) => {
    switch (tier) {
      case 'diamond': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
      case 'platinum': return 'text-slate-300 border-slate-400/30 bg-slate-400/10';
      case 'gold': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      case 'silver': return 'text-gray-300 border-gray-400/30 bg-gray-400/10';
      case 'bronze': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  const getRankTierIcon = (tier: string) => {
    switch (tier) {
      case 'diamond': return <Trophy className="w-5 h-5" />;
      case 'platinum': return <Sparkles className="w-5 h-5" />;
      case 'gold': return <Crown className="w-5 h-5" />;
      case 'silver': return <Gem className="w-5 h-5" />;
      case 'bronze': return <Award className="w-5 h-5" />;
      default: return <UserIcon className="w-5 h-5" />;
    }
  };

  // ---- Site Content Management ----
  const fetchContentPages = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('slug');

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch content pages' });
      } else {
        setContentPages(data || []);
      }
    } catch (error) {
      console.error('Error fetching content pages:', error);
    } finally {
      setContentLoading(false);
    }
  };

  const handleSaveContent = async () => {
    if (!editingContent) return;
    setContentSaving(true);
    try {
      const { error } = await supabase
        .from('site_content')
        .update({
          content: contentValue,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null,
        })
        .eq('id', editingContent.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: 'Content saved', description: `"${editingContent.title}" has been updated` });
        setEditingContent(null);
        fetchContentPages();
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save content' });
    } finally {
      setContentSaving(false);
    }
  };

  const handleAddContentPage = async () => {
    if (!newSlug.trim() || !newTitle.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Slug and title are required' });
      return;
    }
    try {
      const { error } = await supabase
        .from('site_content')
        .insert({
          slug: newSlug.trim().toLowerCase().replace(/\s+/g, '-'),
          title: newTitle.trim(),
          content: '',
          updated_by: user?.id || null,
        });

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: 'Page added', description: `"${newTitle.trim()}" has been created` });
        setNewSlug('');
        setNewTitle('');
        setShowAddContent(false);
        fetchContentPages();
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add page' });
    }
  };

  const handleDeleteContentPage = async (page: { id: string; title: string }) => {
    if (!confirm(`Are you sure you want to delete "${page.title}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from('site_content')
        .delete()
        .eq('id', page.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: 'Page deleted', description: `"${page.title}" has been removed` });
        fetchContentPages();
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete page' });
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
            {isAdmin && (
              <TabsTrigger value="content" className="data-[state=active]:bg-purple-500/20">
                <FileText className="w-4 h-4 mr-2" />
                Content
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="ranks" className="data-[state=active]:bg-purple-500/20">
                <Crown className="w-4 h-4 mr-2" />
                Ranks
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="waitlist" className="data-[state=active]:bg-purple-500/20">
                <Mail className="w-4 h-4 mr-2" />
                Waitlist
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="withdrawals" className="data-[state=active]:bg-purple-500/20">
                <Wallet className="w-4 h-4 mr-2" />
                Withdrawals
              </TabsTrigger>
            )}
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

          {/* Content Management Tab */}
          {isAdmin && (
            <TabsContent value="content" className="space-y-6">
              {/* Title */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <FileText className="w-8 h-8 text-purple-400" />
                    Site Content
                  </h1>
                  <p className="text-purple-200/60 mt-1">
                    Edit text content on the website (Terms, Privacy, etc.)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowAddContent(true)}
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Page
                  </Button>
                  <Button
                    onClick={fetchContentPages}
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${contentLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Content Pages List */}
              {contentLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              ) : contentPages.length > 0 ? (
                <div className="space-y-3">
                  {contentPages.map((page) => (
                    <div
                      key={page.id}
                      className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-5 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <FileText className="w-5 h-5 text-purple-400 flex-shrink-0" />
                          <h3 className="text-white font-semibold text-lg truncate">{page.title}</h3>
                        </div>
                        <div className="flex items-center gap-4 ml-8">
                          <span className="text-purple-200/50 text-sm font-mono bg-purple-950/40 px-2 py-0.5 rounded">
                            /{page.slug}
                          </span>
                          <span className="text-purple-200/40 text-sm">
                            {page.content
                              ? `${page.content.length.toLocaleString()} chars`
                              : 'Empty — using default'}
                          </span>
                          {page.updated_at && (
                            <span className="text-purple-200/40 text-sm">
                              Updated: {new Date(page.updated_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingContent(page);
                            setContentValue(page.content);
                          }}
                          className="bg-purple-600 hover:bg-purple-500 text-white"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteContentPage(page)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-12 text-center">
                  <FileText className="w-12 h-12 text-purple-200/30 mx-auto mb-4" />
                  <p className="text-purple-200/50 text-lg">No content pages yet</p>
                  <p className="text-purple-200/30 text-sm mt-1">Click "Add Page" to create editable content</p>
                </div>
              )}

              {/* Tip */}
              <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-200/70 text-sm">
                  <strong className="text-blue-300">Tip:</strong> Content supports HTML formatting. 
                  When a page has content here, it will override the hardcoded default on the website. 
                  Leave content empty to use the built-in default text.
                </p>
              </div>
            </TabsContent>
          )}

          {/* Rank Config Tab */}
          {isAdmin && (
            <TabsContent value="ranks" className="space-y-6">
              {/* Title */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Crown className="w-8 h-8 text-yellow-400" />
                    Rank Configuration
                  </h1>
                  <p className="text-purple-200/60 mt-1">
                    Edit VIP rank tiers, thresholds, perks, and rakeback percentages
                  </p>
                </div>
                <Button
                  onClick={fetchRankTiers}
                  variant="outline"
                  className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${rankLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {/* Rank Tiers List */}
              {rankLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              ) : rankTiers.length > 0 ? (
                <div className="space-y-3">
                  {rankTiers.map((tier) => (
                    <div
                      key={tier.id}
                      className={`rounded-xl p-5 border-2 transition-all hover:scale-[1.01] ${getRankTierColor(tier.tier_name)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {getRankTierIcon(tier.tier_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-white font-bold text-lg">{tier.display_name}</h3>
                              <span className="text-xs font-mono opacity-60">({tier.tier_name})</span>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="text-sm opacity-80">
                                <Coins className="w-3.5 h-3.5 inline mr-1" />
                                {tier.threshold === 0 ? 'Starting rank' : `${tier.threshold.toLocaleString()} SC needed`}
                              </span>
                              <span className="text-sm opacity-80">
                                Rakeback: <strong>{tier.rakeback_percentage}%</strong>
                              </span>
                              <span className="text-sm opacity-60">
                                {tier.perks.length} perk{tier.perks.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {tier.perks.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {tier.perks.map((perk, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                                    {perk}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openRankEditor(tier)}
                          className="bg-white/10 hover:bg-white/20 text-white ml-4"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-12 text-center">
                  <Crown className="w-12 h-12 text-purple-200/30 mx-auto mb-4" />
                  <p className="text-purple-200/50 text-lg">No rank tiers configured</p>
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-200/70 text-sm">
                  <strong className="text-blue-300">How it works:</strong> Rank tiers are determined by total Skilled Coins wagered (lifetime). 
                  Changes here take effect immediately across the website — the VIP page, progress cards, and rakeback calculations all use these values.
                </p>
              </div>
            </TabsContent>
          )}

          {/* Waitlist Tab */}
          {isAdmin && (
            <TabsContent value="waitlist" className="space-y-6">
              {/* Title */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Mail className="w-8 h-8 text-purple-400" />
                    Waitlist
                  </h1>
                  <p className="text-purple-200/60 mt-1">
                    Pre-launch email signups from the marketing site
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowEmailCompose(true)}
                    className="bg-violet-600 hover:bg-violet-500 text-white"
                    disabled={waitlistEntries.filter(e => e.verified).length === 0}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email
                  </Button>
                  <Button
                    onClick={handleExportWaitlistCSV}
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    disabled={waitlistEntries.filter(e => e.verified).length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    onClick={fetchWaitlist}
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${waitlistLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Email Compose Dialog */}
              <Dialog open={showEmailCompose} onOpenChange={setShowEmailCompose}>
                <DialogContent className="bg-[#0a0f1a] border-purple-500/30 text-white max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <Mail className="w-5 h-5 text-violet-400" />
                      Send Email to Waitlist
                    </DialogTitle>
                    <DialogDescription className="text-purple-200/60">
                      Compose and send an email to your waitlist subscribers
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    {/* Audience selector */}
                    <div>
                      <label className="text-sm text-purple-200/70 mb-1.5 block">Audience</label>
                      <Select value={emailAudience} onValueChange={(v) => setEmailAudience(v as 'verified' | 'un-notified')}>
                        <SelectTrigger className="bg-purple-950/30 border-purple-500/30 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0f1a] border-purple-500/30">
                          <SelectItem value="verified" className="text-white hover:bg-purple-500/10">
                            All verified ({waitlistEntries.filter(e => e.verified).length})
                          </SelectItem>
                          <SelectItem value="un-notified" className="text-white hover:bg-purple-500/10">
                            Not yet notified ({waitlistEntries.filter(e => e.verified && !e.notified).length})
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="text-sm text-purple-200/70 mb-1.5 block">Subject</label>
                      <Input
                        placeholder="e.g. Skilled is launching next week! 🚀"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="bg-purple-950/30 border-purple-500/20 text-white placeholder:text-purple-200/30"
                        disabled={emailSending}
                      />
                    </div>

                    {/* Body (HTML) */}
                    <div>
                      <label className="text-sm text-purple-200/70 mb-1.5 block">Body (HTML supported)</label>
                      <Textarea
                        placeholder={"<h1>Big news!</h1>\n<p>Skilled is launching on March 1st. Your waitlist spot is secured.</p>\n<p>Get ready to play chess for real money.</p>"}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        className="bg-purple-950/30 border-purple-500/20 text-white placeholder:text-purple-200/30 min-h-[200px] font-mono text-sm"
                        disabled={emailSending}
                      />
                    </div>

                    {/* Preview */}
                    {emailBody.trim() && (
                      <div>
                        <label className="text-sm text-purple-200/70 mb-1.5 block">Preview</label>
                        <div
                          className="bg-white rounded-lg p-4 text-black text-sm max-h-[200px] overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: emailBody }}
                        />
                      </div>
                    )}
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowEmailCompose(false)}
                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      disabled={emailSending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendWaitlistEmail}
                      className="bg-violet-600 hover:bg-violet-500 text-white"
                      disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                    >
                      {emailSending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Send to {emailAudience === 'verified'
                            ? waitlistEntries.filter(e => e.verified).length
                            : waitlistEntries.filter(e => e.verified && !e.notified).length
                          } people
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <p className="text-purple-200/60 text-sm">Verified Signups</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">
                    {waitlistEntries.filter(e => e.verified).length}
                  </p>
                </div>
                <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <p className="text-purple-200/60 text-sm">Today</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-400">
                    {waitlistEntries.filter(e => {
                      const todayStart = new Date();
                      todayStart.setHours(0, 0, 0, 0);
                      return new Date(e.created_at) >= todayStart && e.verified;
                    }).length}
                  </p>
                </div>
                <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-3.5 h-3.5 text-yellow-400" />
                    <p className="text-purple-200/60 text-sm">Pending (Unverified)</p>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {waitlistEntries.filter(e => !e.verified).length}
                  </p>
                </div>
                <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <p className="text-purple-200/60 text-sm">Total Entries</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{waitlistEntries.length}</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/40" />
                <Input
                  placeholder="Search emails..."
                  value={waitlistSearch}
                  onChange={(e) => setWaitlistSearch(e.target.value)}
                  className="pl-10 bg-purple-950/30 border-purple-500/20 text-white placeholder:text-purple-200/40"
                />
              </div>

              {/* Emails Table */}
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl overflow-hidden">
                {waitlistLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-purple-500/20 hover:bg-transparent">
                        <TableHead className="text-purple-200/60">Email</TableHead>
                        <TableHead className="text-purple-200/60">Status</TableHead>
                        <TableHead className="text-purple-200/60">Emailed</TableHead>
                        <TableHead className="text-purple-200/60">Source</TableHead>
                        <TableHead className="text-purple-200/60">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waitlistEntries
                        .filter(e => !waitlistSearch || e.email.toLowerCase().includes(waitlistSearch.toLowerCase()))
                        .map((entry) => (
                        <TableRow key={entry.id} className="border-purple-500/10 hover:bg-purple-500/5">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-purple-400" />
                              <span className="text-white font-medium">{entry.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${
                              entry.verified
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${entry.verified ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
                              {entry.verified ? 'Verified' : 'Pending'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {entry.notified ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <span className="text-purple-200/30">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-purple-200/60">{entry.source}</TableCell>
                          <TableCell className="text-purple-200/60">
                            {new Date(entry.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {waitlistEntries.filter(e => !waitlistSearch || e.email.toLowerCase().includes(waitlistSearch.toLowerCase())).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-purple-200/50">
                            {waitlistSearch ? 'No matching emails' : 'No waitlist signups yet'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          )}

          {/* Withdrawals Tab */}
          {isAdmin && (
            <TabsContent value="withdrawals" className="space-y-6">
              {/* Title */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Wallet className="w-8 h-8 text-emerald-400" />
                    Withdrawal Requests
                  </h1>
                  <p className="text-purple-200/60 mt-1">
                    Review and process user withdrawal requests
                  </p>
                </div>
                <div className="flex gap-2">
                  <Select value={withdrawalFilter} onValueChange={(v) => setWithdrawalFilter(v as 'pending' | 'all')}>
                    <SelectTrigger className="w-[140px] bg-purple-950/30 border-purple-500/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0f1a] border-purple-500/30">
                      <SelectItem value="pending" className="text-white hover:bg-purple-500/10">Pending</SelectItem>
                      <SelectItem value="all" className="text-white hover:bg-purple-500/10">All</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={fetchWithdrawals}
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${withdrawalsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-yellow-200/60 text-sm">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {withdrawals.filter(w => w.status === 'pending').length}
                  </p>
                </div>
                <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-200/60 text-sm">Approved / Processing</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {withdrawals.filter(w => w.status === 'approved' || w.status === 'processing').length}
                  </p>
                </div>
                <div className="bg-green-950/30 border border-green-500/20 rounded-xl p-4">
                  <p className="text-green-200/60 text-sm">Completed</p>
                  <p className="text-2xl font-bold text-green-400">
                    {withdrawals.filter(w => w.status === 'completed').length}
                  </p>
                </div>
                <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                  <p className="text-purple-200/60 text-sm">Total USD Pending</p>
                  <p className="text-2xl font-bold text-purple-400">
                    ${withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount_usd), 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Withdrawals List */}
              {withdrawalsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              ) : withdrawals.length > 0 ? (
                <div className="space-y-3">
                  {withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-5"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Left: User & Amount */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <ArrowDownRight className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                            <h3 className="text-white font-semibold text-lg truncate">
                              {w.user_display_name}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${getWithdrawalStatusBadge(w.status)}`}>
                              {w.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm ml-8">
                            <div>
                              <span className="text-purple-200/50 block">Amount</span>
                              <span className="text-white font-medium">{w.amount_sc.toLocaleString()} SC</span>
                              <span className="text-purple-200/40 text-xs block">${Number(w.amount_usd).toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-purple-200/50 block">Crypto</span>
                              <span className="text-white font-medium">{getCryptoLabel(w.crypto_currency)}</span>
                            </div>
                            <div>
                              <span className="text-purple-200/50 block">Wallet</span>
                              <span className="text-white font-mono text-xs break-all">{w.wallet_address.slice(0, 12)}...{w.wallet_address.slice(-6)}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(w.wallet_address);
                                  toast({ title: 'Copied', description: 'Wallet address copied' });
                                }}
                                className="text-purple-400 hover:text-purple-300 ml-1"
                              >
                                <Copy className="w-3 h-3 inline" />
                              </button>
                            </div>
                            <div>
                              <span className="text-purple-200/50 block">Requested</span>
                              <span className="text-purple-200/70 text-xs">{new Date(w.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                          {w.admin_note && (
                            <div className="mt-2 ml-8 text-xs text-purple-200/40 italic">
                              Note: {w.admin_note}
                            </div>
                          )}
                          {w.payout_id && (
                            <div className="mt-1 ml-8 text-xs text-purple-200/40">
                              Payout ID: {w.payout_id}
                            </div>
                          )}
                          {w.payout_hash && (
                            <div className="mt-1 ml-8 text-xs text-green-400/70">
                              TX Hash: {w.payout_hash}
                            </div>
                          )}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 ml-8 md:ml-0 flex-shrink-0">
                          {w.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApproveWithdrawal(w.id)}
                                disabled={processingWithdrawalId === w.id}
                                className="bg-green-600 hover:bg-green-500 text-white"
                              >
                                {processingWithdrawalId === w.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 mr-1" />
                                    Approve
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setRejectNoteId(w.id);
                                  setRejectNote('');
                                }}
                                disabled={processingWithdrawalId === w.id}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {(w.status === 'approved' || w.status === 'processing') && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setCompleteDialogId(w.id);
                                setCompleteTxHash('');
                              }}
                              disabled={processingWithdrawalId === w.id}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Inline reject note input */}
                      {rejectNoteId === w.id && (
                        <div className="mt-3 ml-8 flex items-center gap-2">
                          <Input
                            placeholder="Reason for rejection (optional)"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            className="bg-purple-950/30 border-purple-500/30 text-white flex-1 h-9 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleRejectWithdrawal(w.id)}
                            disabled={processingWithdrawalId === w.id}
                            className="bg-red-600 hover:bg-red-500 text-white h-9"
                          >
                            {processingWithdrawalId === w.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Confirm Reject'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRejectNoteId(null)}
                            className="text-purple-400 h-9"
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-12 text-center">
                  <Wallet className="w-12 h-12 text-purple-200/30 mx-auto mb-4" />
                  <p className="text-purple-200/50 text-lg">
                    {withdrawalFilter === 'pending' ? 'No pending withdrawals' : 'No withdrawals found'}
                  </p>
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-200/70 text-sm">
                  <strong className="text-blue-300">How it works:</strong> When you approve a withdrawal, the system attempts to send the crypto via NOWPayments Payout API. 
                  If the automatic payout fails, you can manually send the crypto and then click "Mark Complete". 
                  Rejecting a withdrawal refunds the user's Skilled Coins.
                </p>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Edit Rank Dialog */}
      <Dialog open={!!editingRank} onOpenChange={() => setEditingRank(null)}>
        <DialogContent className="bg-[#0a0f1a] border-purple-500/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingRank && getRankTierIcon(editingRank.tier_name)}
              Edit Rank: {editingRank?.display_name}
            </DialogTitle>
            <DialogDescription className="text-purple-200/60">
              Configure this rank tier's threshold, perks, and rakeback
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-purple-200/60 mb-2 block">Display Name</label>
              <Input
                value={rankForm.display_name}
                onChange={(e) => setRankForm({ ...rankForm, display_name: e.target.value })}
                className="bg-purple-950/30 border-purple-500/30 text-white"
                placeholder="e.g. Diamond"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-purple-200/60 mb-2 block">
                  Threshold (SC wagered)
                </label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
                  <Input
                    type="number"
                    value={rankForm.threshold}
                    onChange={(e) => setRankForm({ ...rankForm, threshold: e.target.value })}
                    className="pl-10 bg-purple-950/30 border-purple-500/30 text-white"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-purple-200/60 mb-2 block">
                  Rakeback %
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={rankForm.rakeback_percentage}
                  onChange={(e) => setRankForm({ ...rankForm, rakeback_percentage: e.target.value })}
                  className="bg-purple-950/30 border-purple-500/30 text-white"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-purple-200/60 mb-2 block">
                Sort Order
              </label>
              <Input
                type="number"
                value={rankForm.sort_order}
                onChange={(e) => setRankForm({ ...rankForm, sort_order: e.target.value })}
                className="bg-purple-950/30 border-purple-500/30 text-white"
                placeholder="0"
              />
              <p className="text-purple-200/40 text-xs mt-1">Lower number = lower rank. E.g. Unranked=0, Bronze=1, etc.</p>
            </div>
            <div>
              <label className="text-sm text-purple-200/60 mb-2 block">
                Perks (one per line)
              </label>
              <textarea
                value={rankForm.perks}
                onChange={(e) => setRankForm({ ...rankForm, perks: e.target.value })}
                className="w-full h-32 p-3 bg-purple-950/30 border border-purple-500/30 rounded-lg text-white text-sm placeholder:text-purple-200/30 resize-y focus:outline-none focus:border-purple-400/50"
                placeholder={"Exclusive badge\nBasic leaderboard access\nPriority matchmaking"}
              />
              <p className="text-purple-200/40 text-xs mt-1">
                {rankForm.perks.split('\n').filter(p => p.trim()).length} perk(s)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingRank(null)}
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRank}
              disabled={rankSaving}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              {rankSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Rank
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Withdrawal Dialog */}
      <Dialog open={!!completeDialogId} onOpenChange={() => setCompleteDialogId(null)}>
        <DialogContent className="bg-[#0a0f1a] border-purple-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Mark Withdrawal Complete
            </DialogTitle>
            <DialogDescription className="text-purple-200/60">
              Confirm that the crypto has been sent to the user's wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-purple-200/60 mb-2 block">
                Transaction Hash (optional)
              </label>
              <Input
                placeholder="e.g. 0x1234...abcd"
                value={completeTxHash}
                onChange={(e) => setCompleteTxHash(e.target.value)}
                className="bg-purple-950/30 border-purple-500/30 text-white font-mono text-sm"
              />
              <p className="text-purple-200/40 text-xs mt-1">
                Paste the blockchain transaction hash for record-keeping.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompleteDialogId(null)}
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              Cancel
            </Button>
            <Button
              onClick={() => completeDialogId && handleCompleteWithdrawal(completeDialogId)}
              disabled={processingWithdrawalId === completeDialogId}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {processingWithdrawalId === completeDialogId ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Complete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Content Page Dialog */}
      <Dialog open={showAddContent} onOpenChange={setShowAddContent}>
        <DialogContent className="bg-[#0a0f1a] border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" />
              Add Content Page
            </DialogTitle>
            <DialogDescription className="text-purple-200/60">
              Create a new editable content page
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-purple-200/60 mb-2 block">Page Title</label>
              <Input
                placeholder="e.g. About Us"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-purple-950/30 border-purple-500/30 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-purple-200/60 mb-2 block">URL Slug</label>
              <Input
                placeholder="e.g. about-us"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="bg-purple-950/30 border-purple-500/30 text-white font-mono"
              />
              <p className="text-purple-200/40 text-xs mt-1">
                This is the key used to look up this content. Use lowercase with hyphens.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddContent(false)}
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddContentPage}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Content Dialog */}
      <Dialog open={!!editingContent} onOpenChange={() => setEditingContent(null)}>
        <DialogContent className="bg-[#0a0f1a] border-purple-500/30 text-white max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-purple-400" />
              Edit: {editingContent?.title}
            </DialogTitle>
            <DialogDescription className="text-purple-200/60">
              Edit the HTML content below. Leave empty to use the hardcoded default.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 py-2">
            <textarea
              className="w-full h-[400px] p-4 bg-purple-950/30 border border-purple-500/30 rounded-lg font-mono text-sm text-white placeholder:text-purple-200/30 resize-y focus:outline-none focus:border-purple-400/50"
              value={contentValue}
              onChange={(e) => setContentValue(e.target.value)}
              placeholder="Enter HTML content here... Leave empty to use the default hardcoded content."
              spellCheck={false}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-purple-200/40 text-xs">
                {contentValue.length.toLocaleString()} characters
              </p>
              {contentValue.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setContentValue('')}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                >
                  Clear (revert to default)
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingContent(null)}
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveContent}
              disabled={contentSaving}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              {contentSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
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
