import { Flame, Coins, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyStreakCardProps {
  currentStreak: number;
  onClick?: () => void;
}

const WEEK_GOAL = 7;
const WEEK_REWARD = 100;

export function DailyStreakCard({ currentStreak, onClick }: DailyStreakCardProps) {
  const weekDay = currentStreak % WEEK_GOAL;
  const completedThisWeek = weekDay === 0 && currentStreak > 0 ? WEEK_GOAL : weekDay;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all",
        "bg-gradient-to-r from-card to-orange-500/5 border-border hover:border-orange-500/40",
        "active:scale-[0.99] cursor-pointer"
      )}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <Flame className="w-5 h-5 text-orange-500" />
        <span className="text-lg font-black text-orange-500 tabular-nums">{currentStreak}</span>
      </div>

      <div className="flex-1 flex items-center gap-1.5 justify-center">
        {Array.from({ length: WEEK_GOAL }).map((_, i) => {
          const done = i < completedThisWeek;
          const isToday = i === completedThisWeek;
          const isRewardDay = i === WEEK_GOAL - 1;

          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                  done
                    ? "bg-orange-500 text-white shadow-sm shadow-orange-500/30"
                    : isToday
                      ? "bg-orange-500/20 border-2 border-orange-500 text-orange-500"
                      : isRewardDay
                        ? "bg-yellow-500/10 border border-dashed border-yellow-500/50 text-yellow-500"
                        : "bg-muted/40 text-muted-foreground/50"
                )}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isRewardDay ? (
                  <Coins className="w-3.5 h-3.5" />
                ) : (
                  i + 1
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1 shrink-0 bg-yellow-500/10 rounded-lg px-2 py-1">
        <Coins className="w-3.5 h-3.5 text-yellow-500" />
        <span className="text-xs font-bold text-yellow-500">{WEEK_REWARD}</span>
      </div>
    </button>
  );
}
