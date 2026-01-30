import { useState } from 'react';
import { 
  Flame, Check, Coins, ChevronLeft, ChevronRight, Zap, Gift, Sparkles, Crown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface DailyStreakCardProps {
  currentStreak: number;
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

export function DailyStreakCard({ currentStreak }: DailyStreakCardProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const days = generateWeekDays(currentStreak);

  // Calculate next streak milestone
  const nextMilestone = STREAK_REWARDS.find(r => r.days > currentStreak);
  const prevMilestone = [...STREAK_REWARDS].reverse().find(r => r.days <= currentStreak);
  
  const streakProgress = nextMilestone 
    ? ((currentStreak - (prevMilestone?.days || 0)) / (nextMilestone.days - (prevMilestone?.days || 0))) * 100
    : 100;

  return (
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
  );
}
