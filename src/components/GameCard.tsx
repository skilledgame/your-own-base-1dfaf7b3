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
  return (
    <div 
      onClick={!comingSoon ? onClick : undefined}
      className={`
        relative group rounded-2xl overflow-hidden aspect-[4/5] min-w-[160px] sm:min-w-[200px] flex-shrink-0
        transition-all duration-300 cursor-pointer
        ${comingSoon 
          ? 'cursor-not-allowed opacity-50' 
          : 'md:hover:scale-105 md:hover:shadow-2xl md:hover:border-2 md:hover:border-white/80'}
        border-2 border-transparent
      `}
      style={{
        background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
      }}
    >
      {/* Lock overlay for coming soon */}
      {comingSoon && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4">
            <Lock className="w-8 h-8 text-white/70" />
          </div>
        </div>
      )}

      {/* Game Image/Emoji */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-7xl sm:text-8xl drop-shadow-2xl transition-transform duration-300 ${comingSoon ? 'opacity-60' : 'group-hover:scale-110'}`}>
          {image}
        </span>
      </div>

      {/* Gradient overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Game Name */}
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
      </div>

      {/* Shine effect on hover */}
      {!comingSoon && (
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}
    </div>
  );
};
