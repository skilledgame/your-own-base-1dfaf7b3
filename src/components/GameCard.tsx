import { Lock } from 'lucide-react';

interface GameCardProps {
  name: string;
  image: string;
  gradientFrom: string;
  gradientTo: string;
  isLive?: boolean;
  comingSoon?: boolean;
  showName?: boolean;
  onClick?: () => void;
}

export const GameCard = ({ 
  name, 
  image, 
  gradientFrom, 
  gradientTo, 
  isLive = false, 
  comingSoon = false,
  showName = true,
  onClick 
}: GameCardProps) => {
  // For coming soon games, make them greyed out
  const isGreyedOut = comingSoon;
  
  return (
    <div 
      onClick={!comingSoon ? onClick : undefined}
      className={`
        relative group rounded-2xl overflow-hidden aspect-[4/5] min-w-[160px] sm:min-w-[200px] flex-shrink-0
        transition-all duration-300 cursor-pointer
        ${comingSoon 
          ? 'opacity-60 cursor-not-allowed grayscale' 
          : 'md:hover:scale-105 md:hover:shadow-2xl md:hover:border-2 md:hover:border-white/80'}
        border-2 border-transparent
      `}
      style={{
        background: isGreyedOut 
          ? 'linear-gradient(135deg, #374151, #1f2937)' 
          : `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
      }}
    >
      {/* Game Image/Emoji */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-7xl sm:text-8xl drop-shadow-2xl transition-transform duration-300 group-hover:scale-110 ${isGreyedOut ? 'opacity-50' : ''}`}>
          {image}
        </span>
      </div>

      {/* Gradient overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Game Name - only show if showName is true and there's a name */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {showName && name && (
          <h3 className="text-white font-bold text-lg sm:text-xl tracking-wide uppercase text-center drop-shadow-lg">
            {name}
          </h3>
        )}
        {isLive && (
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              Live Now
            </span>
          </div>
        )}
        {comingSoon && (
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <Lock className="w-3 h-3 text-white/70" />
            <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">
              Coming Soon
            </span>
          </div>
        )}
      </div>

      {/* Shine effect on hover */}
      {!comingSoon && (
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}
    </div>
  );
};
