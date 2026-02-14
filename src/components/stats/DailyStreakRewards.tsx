import { useState, useMemo } from 'react';
import { 
  Flame, Gift, Lock, Check, Coins, Crown, 
  ChevronLeft, ChevronRight, Zap, Sparkles, Calendar
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatSkilledCoins, getRankFromDynamicConfig } from '@/lib/rankSystem';
import { useRankConfig } from '@/hooks/useRankConfig';

interface DailyStreakRewardsProps {
  currentStreak: number;
  totalWageredSc: number;
  onClaimReward?: (type: string) => void;
}

// Simulated streak data - in production, this would come from the database
const generateWeekDays = (currentStreak: number) => {
  const today = new Date();
  const days = [];
  
  for (let i = -2; i <= 4; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const isToday = i === 0;
    const isPast = i < 0;
    const dayOfStreak = currentStreak - Math.abs(i);
    
    days.push({
      date,
      label: isToday ? 'Today' : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      isToday,
      isPast,
      isCompleted: isPast && dayOfStreak > 0,
      isFuture: i > 0,
    });
  }
  
  return days;
};

// Reward tiers based on streak milestones
const STREAK_REWARDS = [
  { days: 1, reward: 50, label: 'Day 1', icon: Flame },
  { days: 3, reward: 150, label: '3 Days', icon: Zap },
  { days: 7, reward: 500, label: '7 Days', icon: Gift },
  { days: 14, reward: 1200, label: '14 Days', icon: Sparkles },
  { days: 30, reward: 3000, label: '30 Days', icon: Crown },
];

// VIP Reward tiers
const VIP_REWARDS = [
  { 
    id: 'daily', 
    title: 'Daily Bonus', 
    description: 'Claim once per day',
    icon: Coins, 
    reward: 25,
    cooldown: null,
    requiredRank: 'unranked',
    available: true,
  },
  { 
    id: 'weekly', 
    title: 'Weekly Bonus', 
    description: 'Claim once per week',
    icon: Gift, 
    reward: 200,
    cooldown: '5d',
    requiredRank: 'bronze',
    available: false,
  },
  { 
    id: 'monthly', 
    title: 'Monthly Bonus', 
    description: 'Exclusive monthly reward',
    icon: Crown, 
    reward: 1000,
    cooldown: '23d',
    requiredRank: 'silver',
    available: false,
  },
  { 
    id: 'vip', 
    title: 'VIP Exclusive', 
    description: 'Gold+ members only',
    icon: Sparkles, 
    reward: 2500,
    cooldown: null,
    requiredRank: 'gold',
    available: false,
  },
];

const getRankColor = (tier: string) => {
  switch (tier) {
    case 'diamond': return 'from-cyan-400 to-blue-500';
    case 'platinum': return 'from-slate-300 to-slate-500';
    case 'gold': return 'from-yellow-400 to-amber-500';
    case 'silver': return 'from-gray-300 to-gray-400';
    case 'bronze': return 'from-orange-500 to-orange-700';
    default: return 'from-gray-500 to-gray-600';
  }
};

export function DailyStreakRewards({ currentStreak, totalWageredSc, onClaimReward }: DailyStreakRewardsProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const days = generateWeekDays(currentStreak);
  const { tiers, rakebackTiers } = useRankConfig();
  const RANK_ORDER = useMemo(() => tiers.map(t => t.tier_name), [tiers]);
  const currentRank = getRankFromDynamicConfig(totalWageredSc, tiers);
  
  const currentRankIndex = RANK_ORDER.indexOf(currentRank.tierName);
  
  const checkRankRequirement = (requiredRank: string) => {
    const requiredIndex = RANK_ORDER.indexOf(requiredRank);
    return currentRankIndex >= requiredIndex;
  };

  // Calculate next streak milestone
  const nextMilestone = STREAK_REWARDS.find(r => r.days > currentStreak);
  const prevMilestone = [...STREAK_REWARDS].reverse().find(r => r.days <= currentStreak);
  
  const streakProgress = nextMilestone 
    ? ((currentStreak - (prevMilestone?.days || 0)) / (nextMilestone.days - (prevMilestone?.days || 0))) * 100
    : 100;

  return (
    <div className="space-y-6">
      {/* Daily Play Streak Section */}
      <Card className="bg-gradient-to-br from-card via-card to-orange-500/5 border-border overflow-hidden">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Daily Streak</h3>
                <p className="text-sm text-muted-foreground">Play daily to earn rewards</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                <span className="text-3xl font-black text-orange-500">{currentStreak}</span>
                <Flame className="w-6 h-6 text-orange-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground">day streak</p>
            </div>
          </div>

          {/* Week Calendar */}
          <div className="relative mb-5">
            <div className="flex items-center justify-between gap-2 overflow-hidden">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 shrink-0"
                onClick={() => setScrollOffset(Math.max(scrollOffset - 1, -2))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex gap-2 flex-1 justify-center">
                {days.slice(scrollOffset + 2, scrollOffset + 7).map((day, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "flex-1 max-w-[80px] rounded-xl p-3 text-center transition-all border-2",
                      day.isToday 
                        ? "bg-primary/10 border-primary shadow-lg shadow-primary/10" 
                        : day.isCompleted 
                          ? "bg-emerald-500/10 border-emerald-500/30" 
                          : "bg-muted/30 border-border/50"
                    )}
                  >
                    <p className={cn(
                      "text-xs font-semibold mb-2",
                      day.isToday ? "text-primary" : "text-muted-foreground"
                    )}>
                      {day.label}
                    </p>
                    <div className={cn(
                      "w-10 h-10 mx-auto rounded-full flex items-center justify-center",
                      day.isCompleted 
                        ? "bg-emerald-500" 
                        : day.isToday 
                          ? "bg-primary" 
                          : "bg-muted"
                    )}>
                      {day.isCompleted ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : day.isToday ? (
                        <Flame className="w-5 h-5 text-white" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 shrink-0"
                onClick={() => setScrollOffset(Math.min(scrollOffset + 1, 2))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Streak Milestones Progress */}
          <div className="bg-background/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                {nextMilestone ? `${nextMilestone.days - currentStreak} days to ${nextMilestone.label}` : 'Max streak achieved!'}
              </span>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                <Coins className="w-3 h-3 mr-1" />
                {nextMilestone ? `+${nextMilestone.reward} SC` : 'Legendary'}
              </Badge>
            </div>
            <Progress value={streakProgress} className="h-2 mb-3" />
            
            {/* Milestone markers */}
            <div className="flex justify-between">
              {STREAK_REWARDS.map((milestone) => {
                const isUnlocked = currentStreak >= milestone.days;
                const MilestoneIcon = milestone.icon;
                return (
                  <div 
                    key={milestone.days}
                    className={cn(
                      "flex flex-col items-center gap-1",
                      isUnlocked ? "text-orange-500" : "text-muted-foreground/50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      isUnlocked 
                        ? "bg-orange-500/20" 
                        : "bg-muted/50"
                    )}>
                      <MilestoneIcon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-medium">{milestone.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VIP Rewards Section */}
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                getRankColor(currentRank.tierName)
              )}>
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">VIP Rewards</h3>
                <p className="text-sm text-muted-foreground">Exclusive bonuses for your rank</p>
              </div>
            </div>
            <Badge className={cn(
              "bg-gradient-to-r text-white border-0",
              getRankColor(currentRank.tierName)
            )}>
              {currentRank.displayName}
            </Badge>
          </div>

          {/* Reward Cards Grid */}
          <div className="grid grid-cols-2 gap-3">
            {VIP_REWARDS.map((reward) => {
              const RewardIcon = reward.icon;
              const hasRank = checkRankRequirement(reward.requiredRank);
              const isAvailable = reward.available && hasRank;
              
              return (
                <div 
                  key={reward.id}
                  className={cn(
                    "relative rounded-xl border-2 p-4 transition-all",
                    isAvailable 
                      ? "bg-primary/5 border-primary/30 hover:border-primary/50" 
                      : hasRank 
                        ? "bg-muted/30 border-border" 
                        : "bg-muted/10 border-border/50 opacity-60"
                  )}
                >
                  {/* Lock overlay for non-unlocked */}
                  {!hasRank && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                      <div className="text-center">
                        <Lock className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground capitalize">
                          {reward.requiredRank}+
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      isAvailable ? "bg-primary/20" : "bg-muted"
                    )}>
                      <RewardIcon className={cn(
                        "w-5 h-5",
                        isAvailable ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    {reward.cooldown && hasRank && (
                      <Badge variant="outline" className="text-[10px] px-2">
                        {reward.cooldown}
                      </Badge>
                    )}
                  </div>
                  
                  <h4 className="font-semibold text-sm text-foreground mb-1">{reward.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{reward.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-yellow-500">
                      +{formatSkilledCoins(reward.reward)} SC
                    </span>
                    <Button 
                      size="sm" 
                      className={cn(
                        "h-7 text-xs",
                        isAvailable 
                          ? "bg-primary hover:bg-primary/90" 
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && onClaimReward?.(reward.id)}
                    >
                      {isAvailable ? 'Claim' : hasRank ? 'Claimed' : 'Locked'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Rank Progress Preview */}
      <Card className="bg-gradient-to-r from-card via-card to-primary/5 border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <h4 className="font-semibold text-foreground">Your Rank Progress</h4>
              <p className="text-xs text-muted-foreground">
                Wagered: {formatSkilledCoins(totalWageredSc)} SC
              </p>
            </div>
          </div>
          
          {/* Rank Progression */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {RANK_ORDER.map((rank, idx) => {
              const isCurrentRank = rank === currentRank.tierName;
              const isUnlocked = idx <= currentRankIndex;
              
              return (
                <div key={rank} className="flex items-center shrink-0">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-all",
                    isCurrentRank 
                      ? "border-primary bg-primary/10 scale-110" 
                      : isUnlocked 
                        ? "border-transparent bg-gradient-to-br " + getRankColor(rank)
                        : "border-border bg-muted/30"
                  )}>
                    <Crown className={cn(
                      "w-5 h-5",
                      isCurrentRank || isUnlocked ? "text-white" : "text-muted-foreground/50"
                    )} />
                  </div>
                  {idx < RANK_ORDER.length - 1 && (
                    <div className={cn(
                      "w-6 h-0.5 mx-1",
                      idx < currentRankIndex ? "bg-primary" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          
          <p className="text-xs text-center text-muted-foreground mt-3">
            {currentRank.nextMin 
              ? `${formatSkilledCoins(currentRank.nextMin - totalWageredSc)} SC to unlock next rank`
              : 'Maximum rank achieved! 🏆'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
