import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Skull, RotateCcw, Home, Coins, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameResultModalProps {
  isWin: boolean;
  /** Change in Skilled Coins (positive for win, negative for loss) */
  coinsChange: number;
  /** New Skilled Coins balance after the game */
  newBalance: number;
  reason: string;
  onPlayAgain: () => void;
  onGoHome: () => void;
}

// Format reason to be more readable
const formatReason = (reason: string): string => {
  const reasonMap: Record<string, string> = {
    'checkmate': 'Checkmate',
    'resignation': 'Resignation',
    'resign': 'Resignation',
    'timeout': 'Timeout',
    'disconnect': 'Disconnect',
    'opponent_resigned': 'Opponent Resigned',
    'opponent_left': 'Opponent Left',
    'stalemate': 'Stalemate',
    'draw': 'Draw',
  };
  return reasonMap[reason.toLowerCase()] || reason.charAt(0).toUpperCase() + reason.slice(1);
};

// Sparkle particles for victory
const VictorySparkles = () => {
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; delay: number; size: number }>>([]);

  useEffect(() => {
    const newSparkles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
      size: Math.random() * 4 + 2,
    }));
    setSparkles(newSparkles);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      {sparkles.map((s) => (
        <div
          key={s.id}
          className="absolute animate-pulse"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: '2s',
          }}
        >
          <Sparkles 
            className="text-emerald-400/60" 
            style={{ width: s.size * 3, height: s.size * 3 }} 
          />
        </div>
      ))}
    </div>
  );
};

// Confetti for victory
const Confetti = () => {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; color: string; size: number }>>([]);

  useEffect(() => {
    const colors = ['#22c55e', '#10b981', '#14b8a6', '#34d399', '#6ee7b7'];
    const newParticles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: '-20px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animation: `confetti-fall 3s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { 
            transform: translateY(0) rotate(0deg) scale(1); 
            opacity: 1; 
          }
          100% { 
            transform: translateY(100vh) rotate(720deg) scale(0.5); 
            opacity: 0; 
          }
        }
      `}</style>
    </div>
  );
};

// Stat chip component
const StatChip = ({ 
  label, 
  value, 
  icon: Icon, 
  isWin 
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  isWin: boolean;
}) => (
  <div
    className={cn(
      "flex flex-col items-center gap-1 px-4 py-3 rounded-xl border backdrop-blur-sm transition-all",
      isWin 
        ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]" 
        : "bg-slate-500/10 border-slate-500/30 shadow-[0_0_15px_rgba(148,163,184,0.1)]"
    )}
  >
    <Icon className={cn(
      "w-4 h-4",
      isWin ? "text-emerald-400" : "text-slate-400"
    )} />
    <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
    <span className={cn(
      "font-bold text-lg",
      isWin ? "text-emerald-400" : "text-slate-300"
    )}>
      {value}
    </span>
  </div>
);

export const GameResultModal = ({
  isWin,
  coinsChange,
  newBalance,
  reason,
  onPlayAgain,
  onGoHome,
}: GameResultModalProps) => {
  // Guard: Ensure all props have defaults
  const safeIsWin = isWin ?? false;
  const safeCoinsChange = coinsChange ?? 0;
  const safeNewBalance = newBalance ?? 0;
  const safeReason = reason || "Game ended";
  
  const isFreePlay = safeCoinsChange === 0;
  const formattedReason = formatReason(safeReason);

  return (
    <>
      {safeIsWin && <Confetti />}
      
      {/* Backdrop with radial glow */}
      <div className="fixed inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-40 p-4">
        {/* Radial glow effect behind card */}
        <div 
          className={cn(
            "absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-30 pointer-events-none",
            isWin 
              ? "bg-gradient-radial from-emerald-500/50 to-transparent" 
              : "bg-gradient-radial from-slate-500/30 to-transparent"
          )}
          style={{
            background: isWin 
              ? 'radial-gradient(circle, rgba(34,197,94,0.3) 0%, transparent 70%)' 
              : 'radial-gradient(circle, rgba(148,163,184,0.2) 0%, transparent 70%)'
          }}
        />

        {/* Main card */}
        <div
          className={cn(
            "relative border rounded-2xl max-w-[420px] w-full animate-scale-in overflow-hidden",
            isWin 
              ? "border-emerald-500/40 shadow-[0_0_60px_rgba(34,197,94,0.2)]" 
              : "border-slate-500/30 shadow-[0_0_60px_rgba(148,163,184,0.1)]"
          )}
          style={{
            background: isWin
              ? 'linear-gradient(135deg, hsl(260 25% 10%) 0%, hsl(150 20% 8%) 100%)'
              : 'linear-gradient(135deg, hsl(260 25% 10%) 0%, hsl(220 15% 8%) 100%)'
          }}
        >
          {/* Top gradient border line */}
          <div 
            className={cn(
              "absolute top-0 left-0 right-0 h-[2px]",
              isWin 
                ? "bg-gradient-to-r from-transparent via-emerald-500 to-transparent" 
                : "bg-gradient-to-r from-transparent via-slate-500 to-transparent"
            )}
          />

          {/* Diagonal sheen effect */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              background: 'linear-gradient(135deg, transparent 30%, white 50%, transparent 70%)',
              backgroundSize: '200% 200%',
            }}
          />

          {/* Sparkles for victory only */}
          {isWin && <VictorySparkles />}

          {/* Content */}
          <div className="relative z-10 p-6 sm:p-8">
            {/* Badge tag */}
            <div className="flex justify-center mb-4">
              <span 
                className={cn(
                  "px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full border",
                  safeIsWin 
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" 
                    : "bg-slate-500/20 border-slate-500/40 text-slate-400"
                )}
              >
                {safeIsWin ? "+WIN" : "GG"}
              </span>
            </div>

            {/* Icon with glow */}
            <div className="flex justify-center mb-4">
              <div
                className={cn(
                  "relative w-24 h-24 rounded-full flex items-center justify-center",
                  safeIsWin 
                    ? "bg-emerald-500/10" 
                    : "bg-slate-500/10"
                )}
              >
                {/* Pulsing glow ring */}
                <div 
                  className={cn(
                    "absolute inset-0 rounded-full animate-pulse",
                    safeIsWin 
                      ? "shadow-[0_0_30px_rgba(34,197,94,0.4)]" 
                      : "shadow-[0_0_20px_rgba(148,163,184,0.2)]"
                  )}
                  style={{ animationDuration: '2s' }}
                />
                
                {safeIsWin ? (
                  <Trophy className="w-12 h-12 text-emerald-400 animate-float drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                ) : (
                  <Skull className="w-12 h-12 text-slate-400 drop-shadow-[0_0_10px_rgba(148,163,184,0.3)]" />
                )}
              </div>
            </div>

            {/* Headline */}
            <h2
              className={cn(
                "text-4xl sm:text-5xl font-bold text-center mb-2 tracking-tight",
                safeIsWin 
                  ? "text-emerald-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]" 
                  : "text-slate-300"
              )}
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {safeIsWin ? "VICTORY" : "DEFEAT"}
            </h2>

            {/* Subtext */}
            <p className={cn(
              "text-center mb-6 text-sm",
              safeIsWin ? "text-emerald-300/70" : "text-slate-400"
            )}>
              {safeIsWin ? `You won by ${formattedReason}` : `You lost by ${formattedReason}`}
            </p>

            {/* Stats chips */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatChip 
                label="Wager" 
                value={isFreePlay ? "Free" : `${Math.abs(safeCoinsChange)}`}
                icon={Coins}
                isWin={safeIsWin}
              />
              <StatChip 
                label="Result" 
                value={safeIsWin ? "Win" : "Loss"}
                icon={safeIsWin ? TrendingUp : TrendingDown}
                isWin={safeIsWin}
              />
              <StatChip 
                label="Change" 
                value={safeCoinsChange === 0 ? "+0" : (safeCoinsChange > 0 ? `+${safeCoinsChange}` : `${safeCoinsChange}`)}
                icon={Coins}
                isWin={safeIsWin}
              />
            </div>

            {/* New Balance */}
            <div className={cn(
              "flex items-center justify-center gap-2 py-3 px-4 rounded-xl mb-6 border",
              safeIsWin 
                ? "bg-emerald-500/5 border-emerald-500/20" 
                : "bg-slate-500/5 border-slate-500/20"
            )}>
              <span className="text-muted-foreground text-sm">New Balance:</span>
              <span className={cn(
                "font-bold text-xl",
                safeIsWin ? "text-emerald-400" : "text-slate-300"
              )}>
                {safeNewBalance.toLocaleString()}
              </span>
              <Coins className={cn(
                "w-4 h-4 ml-1",
                safeIsWin ? "text-emerald-400" : "text-slate-400"
              )} />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                className={cn(
                  "flex-1 h-12 font-semibold transition-all duration-200",
                  "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50",
                  "hover:-translate-y-0.5 hover:shadow-lg"
                )}
                onClick={onGoHome}
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
              <Button 
                className={cn(
                  "flex-1 h-12 font-semibold transition-all duration-200",
                  "hover:-translate-y-0.5",
                  safeIsWin 
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]" 
                    : "bg-slate-600 hover:bg-slate-500 text-white shadow-[0_0_15px_rgba(148,163,184,0.2)] hover:shadow-[0_0_25px_rgba(148,163,184,0.3)]"
                )}
                onClick={onPlayAgain}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Play Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
