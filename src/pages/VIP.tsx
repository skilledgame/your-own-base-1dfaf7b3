import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, Trophy, Sparkles, ArrowLeft, Check, Lock, X,
  Coins, Star, ChevronRight, Award, Gem, Swords, Target, Flame, Shield, LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/hooks/useProfile';
import { getRankFromDynamicConfig, formatSkilledCoins, getRankImage } from '@/lib/rankSystem';
import { useRankConfig } from '@/hooks/useRankConfig';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyStreakCard } from '@/components/stats/DailyStreakCard';
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

const RANK_CHALLENGES = [
  { 
    id: 'bronze_challenge', 
    title: 'Bronze Challenge', 
    description: 'Win 10 wager matches at 500 SC or higher',
    icon: Swords, 
    reward: 500,
    requiredRank: 'bronze',
  },
  { 
    id: 'silver_challenge', 
    title: 'Silver Challenge', 
    description: 'Win 25 wager matches at 1,000 SC',
    icon: Target, 
    reward: 1500,
    requiredRank: 'silver',
  },
  { 
    id: 'gold_challenge', 
    title: 'Gold Challenge', 
    description: 'Win 50 wager matches with a 60%+ win rate',
    icon: Flame, 
    reward: 5000,
    requiredRank: 'gold',
  },
  { 
    id: 'platinum_challenge', 
    title: 'Platinum Challenge', 
    description: 'Win 100 wager matches and maintain a 10-game streak',
    icon: Shield, 
    reward: 15000,
    requiredRank: 'platinum',
  },
  { 
    id: 'diamond_challenge', 
    title: 'Diamond Challenge', 
    description: 'Win 250 wager matches with a 65%+ win rate',
    icon: Gem, 
    reward: 50000,
    requiredRank: 'diamond',
  },
  { 
    id: 'goat_challenge', 
    title: 'GOAT Challenge', 
    description: 'Win 500 wager matches and reach a 25-game win streak',
    icon: Crown, 
    reward: 200000,
    requiredRank: 'goat',
  },
];

const RANK_UNLOCKS: Record<string, string[]> = {
  unranked: ['100 SC wager games'],
  bronze: ['500 & 1,000 SC wager games', 'Bronze badge', 'Bronze skin'],
  silver: ['Silver badge', 'Silver skin'],
  gold: ['Gold badge', 'Gold skin'],
  platinum: ['Platinum badge', 'Platinum skin'],
  diamond: ['Diamond badge', 'Diamond skin'],
  goat: ['GOAT badge', 'GOAT skin'],
};

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

/** Returns [base, light, base] gradient stops for the animated wave */
const getRankBarColors = (tier: string): [string, string, string] => {
  switch (tier) {
    case 'goat':     return ['#7c3aed', '#c084fc', '#7c3aed'];
    case 'diamond':  return ['#0ea5e9', '#7dd3fc', '#0ea5e9'];
    case 'platinum': return ['#5eead4', '#99f6e4', '#5eead4'];
    case 'gold':     return ['#d97706', '#fbbf24', '#d97706'];
    case 'silver':   return ['#6b7280', '#d1d5db', '#6b7280'];
    case 'bronze':   return ['#92400e', '#d97706', '#92400e'];
    default:         return ['#6b7280', '#9ca3af', '#6b7280'];
  }
};

export default function VIP() {
  const navigate = useNavigate();
  const { totalWageredSc, displayName, isLoading, dailyPlayStreak } = useProfile();
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [showAllChallenges, setShowAllChallenges] = useState(false);
  const { tiers, loading: rankConfigLoading } = useRankConfig();

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

  const currentChallenge = RANK_CHALLENGES.find(c => c.requiredRank === rankInfo.tierName)
    || RANK_CHALLENGES[0];

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
                {(() => {
                  const [c1, c2, c3] = getRankBarColors(rankInfo.tierName);
                  return (
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(progress, 100)}%`,
                          background: `linear-gradient(90deg, ${c1}, ${c2}, ${c3})`,
                          backgroundSize: '200% 100%',
                          animation: 'rankWave 2s ease-in-out infinite',
                        }}
                      />
                    </div>
                  );
                })()}
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

        {/* Daily Streak */}
        <DailyStreakCard currentStreak={dailyPlayStreak} />

        {/* Challenges - Current Rank + Show All */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Challenges</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Current rank challenge */}
            {(() => {
              const challenge = currentChallenge;
              const ChallengeIcon = challenge.icon;
              const hasRank = checkRankRequirement(challenge.requiredRank);
              
              return (
                <Card 
                  className={cn(
                    "relative overflow-hidden transition-all",
                    hasRank 
                      ? "bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30 hover:border-primary/50" 
                      : "bg-muted/20 border-border/50"
                  )}
                >
                  {!hasRank && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                      <div className="text-center">
                        <Lock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <span className="text-sm font-medium text-muted-foreground capitalize">
                          Unlocks at {challenge.requiredRank}
                        </span>
                      </div>
                    </div>
                  )}

                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        hasRank ? "bg-primary/20" : "bg-muted"
                      )}>
                        <ChallengeIcon className={cn(
                          "w-6 h-6",
                          hasRank ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-xs capitalize",
                        hasRank ? "border-primary/40 text-primary" : ""
                      )}>
                        {challenge.requiredRank}
                      </Badge>
                    </div>
                    
                    <h3 className="font-bold text-foreground mb-1">{challenge.title}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{challenge.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        <span className="font-bold text-yellow-500">+{formatSkilledCoins(challenge.reward)}</span>
                      </div>
                      <Button 
                        size="sm"
                        className="h-8"
                        disabled={!hasRank}
                        onClick={() => handleClaimReward(challenge.id)}
                      >
                        {hasRank ? 'Start' : 'Locked'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Show All card */}
            <Card 
              className="relative overflow-hidden transition-all border-dashed border-2 border-primary/30 hover:border-primary/50 cursor-pointer group"
              onClick={() => setShowAllChallenges(true)}
            >
              <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[200px]">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                  <LayoutGrid className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-1">Show All</h3>
                <p className="text-xs text-muted-foreground text-center">View all {RANK_CHALLENGES.length} rank challenges</p>
                <ChevronRight className="w-5 h-5 text-primary mt-3 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </div>
        </div>

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
                            {(() => {
                              const [c1, c2, c3] = getRankBarColors(rank.tier);
                              return (
                                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${Math.min(progressToNext, 100)}%`,
                                      background: `linear-gradient(90deg, ${c1}, ${c2}, ${c3})`,
                                      backgroundSize: '200% 100%',
                                      animation: 'rankWave 2s ease-in-out infinite',
                                    }}
                                  />
                                </div>
                              );
                            })()}
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

                    {/* Rank Unlocks */}
                    {RANK_UNLOCKS[rank.tier] && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {isUnlocked ? 'Unlocked' : 'Unlocks'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {RANK_UNLOCKS[rank.tier].map((unlock, unlockIndex) => (
                            <Badge 
                              key={unlockIndex} 
                              variant="secondary" 
                              className={cn(
                                "text-xs",
                                isUnlocked ? "bg-muted/50" : "bg-muted/30 text-muted-foreground"
                              )}
                            >
                              {isUnlocked ? (
                                <Check className="w-3 h-3 mr-1 text-emerald-500" />
                              ) : (
                                <Lock className="w-3 h-3 mr-1" />
                              )}
                              {unlock}
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

      {/* All Challenges Modal */}
      {showAllChallenges && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowAllChallenges(false)}
          />

          {/* Modal panel */}
          <div className="relative z-10 w-full max-w-lg mx-auto max-h-[85vh] flex flex-col bg-background border border-border/60 rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">All Challenges</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setShowAllChallenges(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Scrollable challenge list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {RANK_CHALLENGES.map((challenge) => {
                const ChallengeIcon = challenge.icon;
                const hasRank = checkRankRequirement(challenge.requiredRank);
                const isCurrent = challenge.requiredRank === rankInfo.tierName;

                return (
                  <div
                    key={challenge.id}
                    className={cn(
                      "relative rounded-xl border p-4 transition-all",
                      isCurrent
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                        : hasRank
                          ? "border-border bg-card"
                          : "border-border/40 bg-muted/10 opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                        hasRank ? "bg-primary/15" : "bg-muted"
                      )}>
                        {hasRank ? (
                          <ChallengeIcon className="w-5 h-5 text-primary" />
                        ) : (
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-sm text-foreground truncate">{challenge.title}</h3>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary shrink-0">
                              Your Rank
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{challenge.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Coins className="w-3.5 h-3.5 text-yellow-500" />
                            <span className="text-sm font-bold text-yellow-500">+{formatSkilledCoins(challenge.reward)}</span>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[10px] capitalize",
                            hasRank ? "border-primary/40 text-primary" : ""
                          )}>
                            {hasRank ? challenge.requiredRank : `Unlocks at ${challenge.requiredRank}`}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-border/50">
              <Button
                className="w-full"
                onClick={() => setShowAllChallenges(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
