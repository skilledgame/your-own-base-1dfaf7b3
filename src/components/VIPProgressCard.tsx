import { useNavigate } from 'react-router-dom';
import { Crown, Trophy, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { getRankFromTotalWagered, formatSkilledCoins } from '@/lib/rankSystem';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const VIPProgressCard = () => {
  const { user } = useAuth();
  const { totalWageredSc, displayName, isLoading } = useProfile();
  const navigate = useNavigate();

  if (isLoading) {
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

  const rankInfo = getRankFromTotalWagered(totalWageredSc);
  const progress = rankInfo.nextMin
    ? (totalWageredSc - rankInfo.currentMin) / (rankInfo.nextMin - rankInfo.currentMin)
    : 1;
  const remaining = rankInfo.nextMin ? rankInfo.nextMin - totalWageredSc : 0;
  
  const handleClick = () => {
    navigate('/vip');
  };

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
    <Card 
      className="bg-card/50 backdrop-blur-sm border-border/50 cursor-pointer hover:bg-card/70 transition-colors"
      onClick={handleClick}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${getRankColor(rankInfo.tierName)}`}>
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-foreground">{displayName || 'Player'}</h3>
            <p className={`text-sm font-semibold bg-gradient-to-r ${getRankColor(rankInfo.tierName)} bg-clip-text text-transparent`}>
              {rankInfo.displayName}
            </p>
          </div>
        </div>

        {/* Total Wagered */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Wagered</span>
            <span className="text-sm font-semibold text-foreground">
              {formatSkilledCoins(totalWageredSc)} SC
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        {rankInfo.nextMin && (
          <div className="mb-4">
            <Progress value={Math.min(progress * 100, 100)} className="h-2 mb-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Next: {rankInfo.displayName}</span>
              <span>{formatSkilledCoins(remaining)} SC remaining</span>
            </div>
          </div>
        )}

        {!rankInfo.nextMin && (
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span>Maximum rank achieved!</span>
            </div>
          </div>
        )}

        {/* Perks */}
        <div className="pt-4 border-t border-border/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Current Perks
          </p>
          <ul className="space-y-1.5">
            {rankInfo.perks.map((perk, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-foreground/80">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
