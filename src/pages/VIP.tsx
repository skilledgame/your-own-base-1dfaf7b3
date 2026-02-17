import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, Trophy, Sparkles, ArrowLeft, Check, Gift, Lock, 
  Coins, Star, Zap, Clock, ChevronRight, Award, Gem
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/hooks/useProfile';
import { getRankFromDynamicConfig, formatSkilledCoins, getRankImage } from '@/lib/rankSystem';
import { useRankConfig } from '@/hooks/useRankConfig';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const TIER_ICON_MAP: Record<string, LucideIcon> = {
  unranked: Star,
  bronze: Award,
  silver: Gem,
  gold: Crown,
  platinum: Sparkles,
  diamond: Trophy,
  goat: Trophy,
};

// VIP Reward tiers with cooldowns
const VIP_REWARDS = [
  { 
    id: 'daily', 
    title: 'Daily Bonus', 
    description: 'Claim once every 24 hours',
    icon: Coins, 
    reward: 25,
    cooldown: null,
    requiredRank: 'unranked',
    available: true,
    frequency: 'daily'
  },
  { 
    id: 'weekly', 
    title: 'Weekly Bonus', 
    description: 'Exclusive weekly reward',
    icon: Gift, 
    reward: 200,
    cooldown: '5d 12h',
    requiredRank: 'bronze',
    available: false,
    frequency: 'weekly'
  },
  { 
    id: 'monthly', 
    title: 'Monthly Bonus', 
    description: 'Premium monthly reward',
    icon: Crown, 
    reward: 1000,
    cooldown: '23d',
    requiredRank: 'silver',
    available: false,
    frequency: 'monthly'
  },
  { 
    id: 'vip', 
    title: 'VIP Exclusive', 
    description: 'Gold+ members only',
    icon: Sparkles, 
    reward: 2500,
    cooldown: null,
    requiredRank: 'gold',
    available: true,
    frequency: 'special'
  },
];

const getRankColor = (tier: string) => {
  switch (tier) {
    case 'goat': return 'from-purple-400 to-violet-600';
    case 'diamond': return 'from-cyan-400 to-blue-500';
    case 'platinum': return 'from-slate-300 to-slate-500';
    case 'gold': return 'from-yellow-400 to-amber-500';
    case 'silver': return 'from-gray-300 to-gray-400';
    case 'bronze': return 'from-orange-600 to-orange-800';
    default: return 'from-gray-500 to-gray-600';
  }
};

const getRankBgColor = (tier: string) => {
  switch (tier) {
    case 'goat': return 'bg-purple-500/10';
    case 'diamond': return 'bg-cyan-500/10';
    case 'platinum': return 'bg-slate-400/10';
    case 'gold': return 'bg-yellow-500/10';
    case 'silver': return 'bg-gray-300/10';
    case 'bronze': return 'bg-orange-600/10';
    default: return 'bg-gray-500/10';
  }
};

export default function VIP() {
  const navigate = useNavigate();
  const { totalWageredSc, displayName, isLoading } = useProfile();
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const { tiers, rakebackTiers, perks: rankPerks, loading: rankConfigLoading } = useRankConfig();

  // Build dynamic rank ladder & order from DB config
  const RANK_LADDER = useMemo(() => tiers.map(t => ({
    tier: t.tier_name,
    name: t.display_name,
    threshold: t.threshold,
    icon: TIER_ICON_MAP[t.tier_name] || Star,
  })), [tiers]);

  const RANK_ORDER = useMemo(() => tiers.map(t => t.tier_name), [tiers]);

  const rankInfo = getRankFromDynamicConfig(totalWageredSc, tiers);
  const currentRankIndex = RANK_ORDER.indexOf(rankInfo.tierName);
  const progress = rankInfo.nextMin
    ? ((totalWageredSc - rankInfo.currentMin) / (rankInfo.nextMin - rankInfo.currentMin)) * 100
    : 100;
  const remaining = rankInfo.nextMin ? rankInfo.nextMin - totalWageredSc : 0;

  const checkRankRequirement = (requiredRank: string) => {
    const requiredIndex = RANK_ORDER.indexOf(requiredRank);
    return currentRankIndex >= requiredIndex;
  };

  const currentRakeback = rakebackTiers.find(r => r.rank === rankInfo.tierName)?.percentage || 0;

  const handleClaimReward = (rewardId: string) => {
    // TODO: Implement reward claiming logic
  };

  if (isLoading || rankConfigLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            <h1 className="text-xl font-bold">VIP Rewards</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 mt-16 space-y-6">
        {/* Current Rank Hero Card */}
        <Card className={cn(
          "overflow-hidden border-2",
          rankInfo.tierName === 'goat' ? 'border-purple-500/60' :
          rankInfo.tierName === 'diamond' ? 'border-sky-400/60' :
          rankInfo.tierName === 'platinum' ? 'border-teal-300/60' :
          rankInfo.tierName === 'gold' ? 'border-yellow-500/60' :
          rankInfo.tierName === 'silver' ? 'border-gray-400/60' :
          rankInfo.tierName === 'bronze' ? 'border-amber-700/60' :
          'border-border'
        )}>
          <div className={cn(
            "h-2 bg-gradient-to-r",
            getRankColor(rankInfo.tierName)
          )} />
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                {getRankImage(rankInfo.tierName) ? (
                  <img
                    src={getRankImage(rankInfo.tierName)!}
                    alt={`${rankInfo.displayName} rank`}
                    className="w-16 h-16 object-contain drop-shadow-lg"
                    draggable={false}
                  />
                ) : (
                  <div className={cn(
                    "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                    getRankColor(rankInfo.tierName)
                  )}>
                    <Crown className="w-8 h-8 text-white" />
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{displayName || 'Player'}</p>
                  <h2 className={cn(
                    "text-2xl font-black bg-gradient-to-r bg-clip-text text-transparent",
                    getRankColor(rankInfo.tierName)
                  )}>
                    {rankInfo.displayName}
                  </h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Total Wagered</p>
                <p className="text-xl font-bold text-foreground">
                  {formatSkilledCoins(totalWageredSc)} SC
                </p>
              </div>
            </div>

            {/* Progress to next rank */}
            {rankInfo.nextMin && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress to next rank</span>
                  <span className="font-medium text-foreground">
                    {formatSkilledCoins(remaining)} SC to go
                  </span>
                </div>
                <Progress value={progress} className="h-3" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{rankInfo.displayName}</span>
                  <span>{RANK_LADDER[currentRankIndex + 1]?.name || 'Max'}</span>
                </div>
              </div>
            )}

            {!rankInfo.nextMin && (
              <div className="flex items-center justify-center gap-2 py-3 bg-yellow-500/10 rounded-xl">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-semibold text-yellow-500">Maximum rank achieved!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* VIP Rewards Grid */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Claimable Rewards</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {VIP_REWARDS.map((reward) => {
              const RewardIcon = reward.icon;
              const hasRank = checkRankRequirement(reward.requiredRank);
              const isAvailable = reward.available && hasRank;
              
              return (
                <Card 
                  key={reward.id}
                  className={cn(
                    "relative overflow-hidden transition-all",
                    isAvailable 
                      ? "bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30 hover:border-primary/50" 
                      : hasRank 
                        ? "bg-card border-border" 
                        : "bg-muted/20 border-border/50"
                  )}
                >
                  {/* Lock overlay */}
                  {!hasRank && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                      <div className="text-center">
                        <Lock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <span className="text-sm font-medium text-muted-foreground capitalize">
                          Requires {reward.requiredRank}
                        </span>
                      </div>
                    </div>
                  )}

                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        isAvailable ? "bg-primary/20" : "bg-muted"
                      )}>
                        <RewardIcon className={cn(
                          "w-6 h-6",
                          isAvailable ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      {reward.cooldown && hasRank && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Clock className="w-3 h-3" />
                          {reward.cooldown}
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="font-bold text-foreground mb-1">{reward.title}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{reward.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        <span className="font-bold text-yellow-500">+{formatSkilledCoins(reward.reward)}</span>
                      </div>
                      <Button 
                        size="sm"
                        className={cn(
                          "h-8",
                          !isAvailable && "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                        disabled={!isAvailable}
                        onClick={() => handleClaimReward(reward.id)}
                      >
                        {isAvailable ? 'Claim' : hasRank ? 'Claimed' : 'Locked'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Rakeback Section */}
        <Card className="bg-gradient-to-br from-card via-card to-emerald-500/5 border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Rakeback</h3>
                  <p className="text-sm text-muted-foreground">Earn back on every wager</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-emerald-500">{currentRakeback}%</p>
                <p className="text-xs text-muted-foreground">Current rate</p>
              </div>
            </div>

            {/* Rakeback tiers */}
            <div className="grid grid-cols-6 gap-2">
              {rakebackTiers.map((tier, idx) => {
                const isActive = tier.rank === rankInfo.tierName;
                const isUnlocked = idx <= currentRankIndex;
                
                return (
                  <div 
                    key={tier.rank}
                    className={cn(
                      "rounded-xl p-3 text-center transition-all border-2",
                      isActive 
                        ? "bg-emerald-500/10 border-emerald-500" 
                        : isUnlocked 
                          ? getRankBgColor(tier.rank) + " border-transparent"
                          : "bg-muted/30 border-border/50"
                    )}
                  >
                    <p className={cn(
                      "text-lg font-bold mb-1",
                      isActive ? "text-emerald-500" : isUnlocked ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {tier.percentage}%
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize truncate">
                      {tier.rank === 'unranked' ? 'New' : tier.rank}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Rank Ladder */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-foreground">Rank Ladder</h2>
          </div>

          <div className="space-y-3">
            {RANK_LADDER.map((rank, index) => {
              const isCurrentRank = rank.tier === rankInfo.tierName;
              const isUnlocked = totalWageredSc >= rank.threshold;
              const RankIcon = rank.icon;
              const nextRank = RANK_LADDER[index + 1];
              const progressToNext = nextRank
                ? Math.max(0, Math.min(100, ((totalWageredSc - rank.threshold) / (nextRank.threshold - rank.threshold)) * 100))
                : 100;

              return (
                <Card 
                  key={rank.tier}
                  className={cn(
                    "overflow-hidden transition-all",
                    isCurrentRank 
                      ? cn("border-2",
                          rank.tier === 'goat' ? 'border-purple-500/70 bg-purple-500/5' :
                          rank.tier === 'diamond' ? 'border-sky-400/70 bg-sky-400/5' :
                          rank.tier === 'platinum' ? 'border-teal-300/70 bg-teal-300/5' :
                          rank.tier === 'gold' ? 'border-yellow-500/70 bg-yellow-500/5' :
                          rank.tier === 'silver' ? 'border-gray-400/70 bg-gray-400/5' :
                          rank.tier === 'bronze' ? 'border-amber-700/70 bg-amber-700/5' :
                          'border-primary bg-primary/5'
                        )
                      : isUnlocked 
                        ? "border-border bg-card" 
                        : "border-border/50 bg-muted/20 opacity-70"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {getRankImage(rank.tier) ? (
                        <img
                          src={getRankImage(rank.tier)!}
                          alt={`${rank.name} rank`}
                          className="w-12 h-12 object-contain drop-shadow-md"
                          draggable={false}
                        />
                      ) : (
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                          getRankColor(rank.tier)
                        )}>
                          <RankIcon className="w-6 h-6 text-white" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-foreground">{rank.name}</h3>
                          {isCurrentRank && (
                            <Badge variant="secondary" className={cn("text-xs",
                              rank.tier === 'goat' ? 'bg-purple-500/20 text-purple-400' :
                              rank.tier === 'diamond' ? 'bg-sky-400/20 text-sky-400' :
                              rank.tier === 'platinum' ? 'bg-teal-300/20 text-teal-300' :
                              rank.tier === 'gold' ? 'bg-yellow-500/20 text-yellow-500' :
                              rank.tier === 'silver' ? 'bg-gray-400/20 text-gray-300' :
                              rank.tier === 'bronze' ? 'bg-amber-700/20 text-amber-600' :
                              'bg-primary/20 text-primary'
                            )}>
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {rank.threshold === 0 
                            ? 'Starting rank' 
                            : `${formatSkilledCoins(rank.threshold)} SC wagered`
                          }
                        </p>
                        
                        {/* Progress bar for current rank */}
                        {isCurrentRank && nextRank && (
                          <div className="mt-2">
                            <Progress value={progressToNext} className="h-1.5" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isUnlocked && (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-500" />
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Perks Preview */}
                    {isCurrentRank && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Your Perks
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(rankPerks[rank.tier] || []).slice(0, 3).map((perk, perkIndex) => (
                            <Badge 
                              key={perkIndex} 
                              variant="secondary" 
                              className="text-xs bg-muted/50"
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              {perk}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Info Note */}
        <Card className="bg-muted/30 border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              🎮 Rank is based on total Skilled Coins wagered over your lifetime. 
              Play more games to unlock higher tiers and exclusive rewards!
            </p>
          </CardContent>
        </Card>
      </div>

      <MobileBottomNav />
    </div>
  );
}
