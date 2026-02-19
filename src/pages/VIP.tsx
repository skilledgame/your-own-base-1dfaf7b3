import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, Trophy, Sparkles, ArrowLeft, Check, Lock, X,
  Coins, Star, ChevronLeft, ChevronRight, Award, Gem, Flame, Zap, Gift, Calendar
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
    case 'diamond': return 'from-blue-400 to-blue-600';
    case 'platinum': return 'from-sky-300 to-sky-500';
    case 'gold': return 'from-yellow-400 to-amber-500';
    case 'silver': return 'from-slate-300 to-slate-400';
    case 'bronze': return 'from-orange-600 to-orange-800';
    default: return 'from-gray-500 to-gray-600';
  }
};

/** Returns [base, light, base] gradient stops for the animated wave */
const getRankBarColors = (tier: string): [string, string, string] => {
  switch (tier) {
    case 'goat':     return ['#7c3aed', '#c084fc', '#7c3aed'];
    case 'diamond':  return ['#2563eb', '#60a5fa', '#2563eb'];
    case 'platinum': return ['#0ea5e9', '#7dd3fc', '#0ea5e9'];
    case 'gold':     return ['#d97706', '#fbbf24', '#d97706'];
    case 'silver':   return ['#94a3b8', '#cbd5e1', '#94a3b8'];
    case 'bronze':   return ['#92400e', '#d97706', '#92400e'];
    default:         return ['#6b7280', '#9ca3af', '#6b7280'];
  }
};

export default function VIP() {
  const navigate = useNavigate();
  const { totalWageredSc, displayName, isLoading, dailyPlayStreak } = useProfile();
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
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
            <h1 className="text-xl font-bold">Ranks</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 mt-16 space-y-6">
        {/* Daily Streak Bar */}
        <DailyStreakCard currentStreak={dailyPlayStreak} onClick={() => setShowStreakModal(true)} />

        {/* Current Rank Hero Card */}
        <Card className={cn(
          "overflow-hidden border-2",
          rankInfo.tierName === 'goat' ? 'border-purple-500/60' :
          rankInfo.tierName === 'diamond' ? 'border-blue-500/70' :
          rankInfo.tierName === 'platinum' ? 'border-sky-400/60' :
          rankInfo.tierName === 'gold' ? 'border-yellow-500/60' :
          rankInfo.tierName === 'silver' ? 'border-slate-400/60' :
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
                          rank.tier === 'diamond' ? 'border-blue-500/70 bg-blue-500/5' :
                          rank.tier === 'platinum' ? 'border-sky-400/70 bg-sky-400/5' :
                          rank.tier === 'gold' ? 'border-yellow-500/70 bg-yellow-500/5' :
                          rank.tier === 'silver' ? 'border-slate-400/70 bg-slate-400/5' :
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
                              rank.tier === 'diamond' ? 'bg-blue-500/20 text-blue-400' :
                              rank.tier === 'platinum' ? 'bg-sky-400/20 text-sky-300' :
                              rank.tier === 'gold' ? 'bg-yellow-500/20 text-yellow-500' :
                              rank.tier === 'silver' ? 'bg-slate-400/20 text-slate-300' :
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

      {/* Streak Detail Modal */}
      {showStreakModal && <StreakModal currentStreak={dailyPlayStreak} onClose={() => setShowStreakModal(false)} />}

      <MobileBottomNav />
    </div>
  );
}

/* ───────────────────── Streak Modal ───────────────────── */

function getStreakMilestones(currentStreak: number) {
  const fixed = [
    { days: 7, reward: 10, label: '7 Days', icon: Zap },
    { days: 14, reward: 25, label: '14 Days', icon: Gift },
    { days: 30, reward: 100, label: '30 Days', icon: Sparkles },
  ];

  const monthly: typeof fixed = [];
  let d = 60;
  while (d <= Math.max(currentStreak + 30, 90)) {
    monthly.push({ days: d, reward: 150, label: `${d} Days`, icon: d % 60 === 0 ? Crown : Trophy });
    d += 30;
  }

  return [...fixed, ...monthly];
}

function StreakModal({ currentStreak, onClose }: { currentStreak: number; onClose: () => void }) {
  const [calendarOffset, setCalendarOffset] = useState(0);

  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + calendarOffset, 1);
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDow = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const streakDates = new Set<string>();
  for (let i = 0; i < currentStreak; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    streakDates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const isStreakDay = (day: number) =>
    streakDates.has(`${viewDate.getFullYear()}-${viewDate.getMonth()}-${day}`);

  const isToday = (day: number) =>
    viewDate.getFullYear() === today.getFullYear() &&
    viewDate.getMonth() === today.getMonth() &&
    day === today.getDate();

  const milestones = getStreakMilestones(currentStreak);
  const nextMilestone = milestones.find(m => m.days > currentStreak);
  const longestStreak = currentStreak;
  const weekProgress = ((currentStreak % 7) / 7) * 100 || (currentStreak > 0 && currentStreak % 7 === 0 ? 100 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md mx-auto max-h-[90vh] flex flex-col bg-background border border-border/60 rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-foreground">Daily Streak</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Big streak hero */}
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-xl shadow-orange-500/30 mb-3">
              <Flame className="w-10 h-10 text-white" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-orange-500">{currentStreak}</span>
              <span className="text-lg font-semibold text-muted-foreground">day streak</span>
            </div>
            {nextMilestone && (
              <p className="text-sm text-muted-foreground mt-1">
                {nextMilestone.days - currentStreak} more day{nextMilestone.days - currentStreak !== 1 ? 's' : ''} until
                <span className="text-yellow-500 font-semibold"> +{nextMilestone.reward} SC</span>
              </p>
            )}
          </div>

          {/* Weekly progress ring */}
          <div className="bg-muted/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">Weekly Goal</span>
              <div className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-sm font-bold text-yellow-500">10 SC at Day 7</span>
              </div>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${weekProgress}%`,
                  background: 'linear-gradient(90deg, #8b5cf6, #a855f7, #c026d3, #e11d48, #ef4444)',
                  boxShadow: '0 0 10px rgba(168,85,247,0.3)',
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>Day {currentStreak % 7 || (currentStreak > 0 ? 7 : 0)} of 7</span>
              <span>{Math.max(0, 7 - (currentStreak % 7 || (currentStreak > 0 ? 7 : 0)))} days left</span>
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-muted/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarOffset(o => o - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{monthName}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={calendarOffset >= 0}
                onClick={() => setCalendarOffset(o => o + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Day-of-week labels */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, i) => {
                if (day === null) {
                  return <div key={`e-${i}`} className="aspect-square" />;
                }

                const streak = isStreakDay(day);
                const todayMark = isToday(day);
                const isFuture =
                  viewDate.getFullYear() === today.getFullYear() &&
                  viewDate.getMonth() === today.getMonth() &&
                  day > today.getDate();

                return (
                  <div
                    key={day}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all",
                      streak && todayMark
                        ? "bg-orange-500 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-400/50"
                        : streak
                          ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                          : todayMark
                            ? "bg-primary/15 text-primary ring-2 ring-primary/30"
                            : isFuture
                              ? "text-muted-foreground/30"
                              : "text-muted-foreground/70 hover:bg-muted/40"
                    )}
                  >
                    {streak && !todayMark ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      day
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-orange-500" />
                <span className="text-[10px] text-muted-foreground">Played</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-primary/15 ring-1 ring-primary/30" />
                <span className="text-[10px] text-muted-foreground">Today</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-orange-500">{currentStreak}</p>
              <p className="text-[11px] text-muted-foreground">Current Streak</p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-foreground">{longestStreak}</p>
              <p className="text-[11px] text-muted-foreground">Longest Streak</p>
            </div>
          </div>

          {/* Milestones */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Streak Rewards</h3>
            <div className="space-y-2">
              {milestones.map((m) => {
                const unlocked = currentStreak >= m.days;
                const MIcon = m.icon;
                return (
                  <div
                    key={m.days}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2.5 border transition-all",
                      unlocked
                        ? "border-orange-500/30 bg-orange-500/5"
                        : "border-border/40 bg-muted/10 opacity-60"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      unlocked ? "bg-orange-500/20 text-orange-500" : "bg-muted text-muted-foreground"
                    )}>
                      {unlocked ? <Check className="w-4 h-4" /> : <MIcon className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{m.label}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Coins className="w-3.5 h-3.5 text-yellow-500" />
                      <span className={cn("text-sm font-bold", unlocked ? "text-yellow-500" : "text-muted-foreground")}>
                        +{m.reward}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50">
          <Button className="w-full" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
