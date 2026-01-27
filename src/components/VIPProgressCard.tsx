import { useEffect, useState } from 'react';
import { Crown, Trophy, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getRankFromTotalWagered, formatSkilledCoins } from '@/lib/rankSystem';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const VIPProgressCard = () => {
  const { user } = useAuth();
  const [totalWagered, setTotalWagered] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
          setLoading(false);
          return;
        }

        // total_wagered_sc column doesn't exist yet, default to 0
        setTotalWagered(0);
        setDisplayName(data?.display_name || user.email?.split('@')[0] || 'Player');
        setLoading(false);
      } catch (err) {
        console.error('Error in fetchProfile:', err);
        setLoading(false);
      }
    };

    fetchProfile();

    // Subscribe to profile changes
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as { display_name?: string };
          if (newData.display_name !== undefined) {
            setDisplayName(newData.display_name || user.email?.split('@')[0] || 'Player');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-2 w-full mb-4" />
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  const rankInfo = getRankFromTotalWagered(totalWagered);
  const progress = rankInfo.nextMin
    ? ((totalWagered ?? 0) - rankInfo.currentMin) / (rankInfo.nextMin - rankInfo.currentMin)
    : 1;
  const remaining = rankInfo.nextMin ? rankInfo.nextMin - (totalWagered ?? 0) : 0;

  const getRankColor = (tier: string) => {
    switch (tier) {
      case 'diamond':
        return 'from-cyan-400 to-blue-500';
      case 'platinum':
        return 'from-slate-300 to-slate-500';
      case 'gold':
        return 'from-yellow-400 to-amber-500';
      case 'silver':
        return 'from-gray-300 to-gray-400';
      case 'bronze':
        return 'from-orange-600 to-orange-800';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardContent className="p-4">
        {/* Header - Compact */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${getRankColor(rankInfo.tierName)}`}>
            <Crown className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-foreground truncate">{displayName || 'Player'}</h3>
            <p className={`text-xs font-semibold bg-gradient-to-r ${getRankColor(rankInfo.tierName)} bg-clip-text text-transparent`}>
              {rankInfo.displayName}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Wagered</span>
            <p className="text-sm font-semibold text-foreground">{formatSkilledCoins(totalWagered)} SC</p>
          </div>
        </div>

        {/* Progress Bar - Compact */}
        {rankInfo.nextMin && (
          <div className="mb-3">
            <Progress value={Math.min(progress * 100, 100)} className="h-1.5 mb-1" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Next: {rankInfo.displayName}</span>
              <span>{formatSkilledCoins(remaining)} SC to go</span>
            </div>
          </div>
        )}

        {!rankInfo.nextMin && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Trophy className="w-3 h-3 text-yellow-500" />
            <span>Maximum rank achieved!</span>
          </div>
        )}

        {/* Perks - Compact horizontal */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex flex-wrap gap-2">
            {rankInfo.perks.slice(0, 2).map((perk, index) => (
              <span key={index} className="inline-flex items-center gap-1 text-xs text-foreground/70 bg-muted/50 px-2 py-1 rounded-full">
                <Sparkles className="w-3 h-3 text-accent flex-shrink-0" />
                {perk}
              </span>
            ))}
            {rankInfo.perks.length > 2 && (
              <span className="text-xs text-muted-foreground px-2 py-1">+{rankInfo.perks.length - 2} more</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
