import { useNavigate } from 'react-router-dom';
import { Crown, Trophy, Sparkles, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useProfile } from '@/hooks/useProfile';
import { getRankFromTotalWagered, formatSkilledCoins, RANK_THRESHOLDS, RANK_PERKS } from '@/lib/rankSystem';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Rank ladder data
const RANK_LADDER = [
  { tier: 'unranked', name: 'Unranked', threshold: RANK_THRESHOLDS.unranked },
  { tier: 'bronze', name: 'Bronze', threshold: RANK_THRESHOLDS.bronze },
  { tier: 'silver', name: 'Silver', threshold: RANK_THRESHOLDS.silver },
  { tier: 'gold', name: 'Gold', threshold: RANK_THRESHOLDS.gold },
  { tier: 'platinum', name: 'Platinum', threshold: RANK_THRESHOLDS.platinum },
  { tier: 'diamond', name: 'Diamond', threshold: RANK_THRESHOLDS.diamond },
] as const;

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

export default function VIP() {
  const navigate = useNavigate();
  const { totalWageredSc, displayName, isLoading } = useProfile();
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  const rankInfo = getRankFromTotalWagered(totalWageredSc);
  const progress = rankInfo.nextMin
    ? (totalWageredSc - rankInfo.currentMin) / (rankInfo.nextMin - rankInfo.currentMin)
    : 1;
  const remaining = rankInfo.nextMin ? rankInfo.nextMin - totalWageredSc : 0;

  if (isLoading) {
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
          <h1 className="text-xl font-bold">VIP & Rank Details</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 mt-16 space-y-6">
        {/* Current Rank Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${getRankColor(rankInfo.tierName)}`}>
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{displayName || 'Player'}</h2>
                <p className={`text-lg font-semibold bg-gradient-to-r ${getRankColor(rankInfo.tierName)} bg-clip-text text-transparent`}>
                  {rankInfo.displayName}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Total Wagered */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Wagered</span>
                <span className="text-lg font-bold text-foreground">
                  {formatSkilledCoins(totalWageredSc)} SC
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            {rankInfo.nextMin && (
              <div>
                <Progress value={Math.min(progress * 100, 100)} className="h-3 mb-2" />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Progress to {rankInfo.displayName}</span>
                  <span>{formatSkilledCoins(remaining)} SC remaining</span>
                </div>
              </div>
            )}

            {!rankInfo.nextMin && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span>Maximum rank achieved!</span>
              </div>
            )}

            {/* Current Perks */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Current Perks
              </h3>
              <ul className="space-y-2">
                {rankInfo.perks.map((perk, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                    <Sparkles className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Rank Ladder */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Rank Ladder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {RANK_LADDER.map((rank, index) => {
                const isCurrentRank = rank.tier === rankInfo.tierName;
                const isUnlocked = totalWageredSc >= rank.threshold;
                const nextRank = RANK_LADDER[index + 1];
                const progressToNext = nextRank
                  ? Math.max(0, Math.min(1, (totalWageredSc - rank.threshold) / (nextRank.threshold - rank.threshold)))
                  : 1;

                return (
                  <div key={rank.tier}>
                    <div
                      className={`
                        p-4 rounded-lg border-2 transition-all
                        ${isCurrentRank
                          ? `border-primary bg-primary/5`
                          : isUnlocked
                          ? 'border-border bg-card'
                          : 'border-border/50 bg-muted/30 opacity-60'}
                      `}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${getRankColor(rank.tier)}`}>
                            <Crown className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className={`font-bold text-lg ${isCurrentRank ? 'text-primary' : ''}`}>
                              {rank.name}
                              {isCurrentRank && (
                                <span className="ml-2 text-xs text-primary">(Current)</span>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {rank.threshold === 0
                                ? 'Starting rank'
                                : `Requires ${formatSkilledCoins(rank.threshold)} SC wagered`}
                            </p>
                          </div>
                        </div>
                        {isUnlocked && (
                          <div className="flex items-center gap-1 text-emerald-500">
                            <Check className="w-5 h-5" />
                            <span className="text-sm font-semibold">Unlocked</span>
                          </div>
                        )}
                      </div>

                      {/* Progress to next rank */}
                      {nextRank && isUnlocked && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress to {nextRank.name}</span>
                            <span>
                              {formatSkilledCoins(totalWageredSc - rank.threshold)} / {formatSkilledCoins(nextRank.threshold - rank.threshold)} SC
                            </span>
                          </div>
                          <Progress value={progressToNext * 100} className="h-2" />
                        </div>
                      )}

                      {/* Perks */}
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Perks
                        </p>
                        <ul className="space-y-1">
                          {(RANK_PERKS[rank.tier] || []).map((perk, perkIndex) => (
                            <li key={perkIndex} className="flex items-start gap-2 text-xs text-foreground/80">
                              <Sparkles className="w-3 h-3 mt-0.5 text-accent flex-shrink-0" />
                              <span>{perk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {index < RANK_LADDER.length - 1 && (
                      <div className="flex justify-center my-2">
                        <div className="w-0.5 h-4 bg-border" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Info Note */}
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              Rank is based on total Skilled Coins wagered over your lifetime. 
              Both players' wagers count toward their total when a match starts.
            </p>
          </CardContent>
        </Card>
      </div>

      <MobileBottomNav />
    </div>
  );
}
