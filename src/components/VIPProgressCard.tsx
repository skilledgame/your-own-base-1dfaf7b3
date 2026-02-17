import { useNavigate } from 'react-router-dom';
import { Crown, Trophy, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { getRankFromDynamicConfig, formatSkilledCoins, getRankImage } from '@/lib/rankSystem';
import { useRankConfig } from '@/hooks/useRankConfig';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const VIPProgressCard = () => {
  const { user } = useAuth();
  const { totalWageredSc, displayName, isLoading } = useProfile();
  const { tiers } = useRankConfig();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <Skeleton className="h-8 w-32 mb-3" />
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-1.5 w-full mb-3" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  const rankInfo = getRankFromDynamicConfig(totalWageredSc, tiers);
  const progress = rankInfo.nextMin
    ? (totalWageredSc - rankInfo.currentMin) / (rankInfo.nextMin - rankInfo.currentMin)
    : 1;
  const remaining = rankInfo.nextMin ? rankInfo.nextMin - totalWageredSc : 0;
  
  const handleClick = () => {
    navigate('/vip');
  };

  const getRankColor = (tier: string) => {
    switch (tier) {
      case 'goat':
        return 'from-purple-400 to-violet-600';
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
      <CardContent className="p-4">
        {/* Header - Compact */}
        <div className="flex items-center gap-3 mb-3">
          {getRankImage(rankInfo.tierName) ? (
            <img
              src={getRankImage(rankInfo.tierName)!}
              alt={`${rankInfo.displayName} rank`}
              className="w-8 h-8 object-contain drop-shadow-sm"
              draggable={false}
            />
          ) : (
            <div className={`p-2 rounded-lg bg-gradient-to-br ${getRankColor(rankInfo.tierName)}`}>
              <Crown className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-foreground truncate">{displayName || 'Player'}</h3>
            <p className={`text-xs font-semibold bg-gradient-to-r ${getRankColor(rankInfo.tierName)} bg-clip-text text-transparent`}>
              {rankInfo.displayName}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Wagered</span>
            <p className="text-sm font-semibold text-foreground">{formatSkilledCoins(totalWageredSc)} SC</p>
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
