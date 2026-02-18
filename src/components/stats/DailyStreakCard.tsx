import { 
  Flame, Coins, Zap, Gift, Sparkles, Crown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface DailyStreakCardProps {
  currentStreak: number;
}

const STREAK_REWARDS = [
  { days: 1, reward: 50, label: 'Day 1', icon: Flame },
  { days: 3, reward: 150, label: '3 Days', icon: Zap },
  { days: 7, reward: 500, label: '7 Days', icon: Gift },
  { days: 14, reward: 1200, label: '14 Days', icon: Sparkles },
  { days: 30, reward: 3000, label: '30 Days', icon: Crown },
];

export function DailyStreakCard({ currentStreak }: DailyStreakCardProps) {
  const nextMilestone = STREAK_REWARDS.find(r => r.days > currentStreak);
  const prevMilestone = [...STREAK_REWARDS].reverse().find(r => r.days <= currentStreak);
  
  const streakProgress = nextMilestone 
    ? ((currentStreak - (prevMilestone?.days || 0)) / (nextMilestone.days - (prevMilestone?.days || 0))) * 100
    : 100;

  return (
    <Card className="bg-gradient-to-br from-card via-card to-orange-500/5 border-border overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Daily Streak</h3>
              <p className="text-xs text-muted-foreground">
                {nextMilestone ? `${nextMilestone.days - currentStreak}d to ${nextMilestone.label} reward` : 'Max streak achieved!'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-black text-orange-500">{currentStreak}</span>
            <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
          </div>
        </div>

        <Progress value={streakProgress} className="h-2 mb-2" />

        <div className="flex justify-between">
          {STREAK_REWARDS.map((milestone) => {
            const isUnlocked = currentStreak >= milestone.days;
            const MilestoneIcon = milestone.icon;
            return (
              <div 
                key={milestone.days}
                className={cn(
                  "flex flex-col items-center gap-0.5",
                  isUnlocked ? "text-orange-500" : "text-muted-foreground/50"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  isUnlocked ? "bg-orange-500/20" : "bg-muted/50"
                )}>
                  <MilestoneIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-medium">{milestone.label}</span>
                <Badge variant="secondary" className={cn(
                  "text-[9px] px-1 py-0 h-4",
                  isUnlocked ? "bg-orange-500/10 text-orange-500" : "bg-muted/30"
                )}>
                  <Coins className="w-2.5 h-2.5 mr-0.5" />
                  {milestone.reward}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
