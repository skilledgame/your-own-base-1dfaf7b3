import { Flame, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyStreakCardProps {
  currentStreak: number;
  onClick?: () => void;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_GOAL = 7;
const WEEK_REWARD = 100;

export function DailyStreakCard({ currentStreak, onClick }: DailyStreakCardProps) {
  const weekDay = currentStreak % WEEK_GOAL;
  const completedThisWeek = weekDay === 0 && currentStreak > 0 ? WEEK_GOAL : weekDay;
  const progressPct = (completedThisWeek / WEEK_GOAL) * 100;
  const todayDow = new Date().getDay();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border border-border/60 bg-card px-4 py-3 transition-all",
        "hover:border-violet-500/40 active:scale-[0.99] cursor-pointer"
      )}
    >
      {/* Day-of-week labels */}
      <div className="flex items-center mb-2.5">
        <div className="flex items-center gap-1 shrink-0 mr-3">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-black text-orange-500 tabular-nums">{currentStreak}</span>
        </div>

        <div className="flex-1 grid grid-cols-7">
          {DAY_LABELS.map((label, i) => {
            const isCurrentDay = i === todayDow;
            const isDone = (() => {
              const diff = (todayDow - i + 7) % 7;
              return diff < completedThisWeek || (diff === 0 && completedThisWeek > 0);
            })();

            return (
              <span
                key={i}
                className={cn(
                  "text-center text-xs font-bold transition-all",
                  isCurrentDay
                    ? "text-foreground"
                    : isDone
                      ? "text-violet-400"
                      : "text-muted-foreground/40"
                )}
              >
                {label}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-3 opacity-70">
          <Coins className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-xs font-bold text-yellow-500">{WEEK_REWARD}</span>
        </div>
      </div>

      {/* Rainbow progress bar */}
      <div className="flex items-center">
        <div className="w-[calc(theme(spacing.4)+theme(spacing.3)+1.25rem)] shrink-0 mr-3" />

        <div className="flex-1 relative h-3 rounded-full bg-muted/30 overflow-visible">
          {/* Filled rainbow portion */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(progressPct, 100)}%`,
              background: 'linear-gradient(90deg, #f43f5e, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6)',
              backgroundSize: '200% 100%',
              animation: 'rainbowShift 4s linear infinite',
              boxShadow: '0 0 12px rgba(139,92,246,0.3), 0 0 4px rgba(249,115,22,0.2)',
            }}
          />

          {/* Glowing marker at progress tip */}
          {completedThisWeek > 0 && completedThisWeek < WEEK_GOAL && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 transition-all duration-500 ease-out"
              style={{ left: `${progressPct}%` }}
            >
              <div className="relative">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-lg"
                  style={{ boxShadow: '0 0 16px rgba(168,85,247,0.6), 0 0 8px rgba(249,115,22,0.4)' }}
                >
                  <div className="w-2.5 h-2.5 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #f97316, #a855f7)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Reward icon at the end */}
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 z-10">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center transition-all",
              completedThisWeek >= WEEK_GOAL
                ? "bg-yellow-500 shadow-lg shadow-yellow-500/40"
                : "bg-muted/60 border border-border/60"
            )}>
              <Coins className={cn(
                "w-3 h-3",
                completedThisWeek >= WEEK_GOAL ? "text-white" : "text-muted-foreground/50"
              )} />
            </div>
          </div>
        </div>

        <div className="w-[calc(theme(spacing.3)+1.25rem+theme(spacing.1))] shrink-0 ml-3" />
      </div>

    </button>
  );
}
