/**
 * BattleRoyaleModeCard - Custom card for Battle Royale chess mode (yellow themed, rook piece)
 */

import { useRef } from 'react';
import { Lock } from 'lucide-react';
import rookCharacter from '@/assets/chess-rook-battle.png';

interface BattleRoyaleModeCardProps {
  isHovered: boolean;
  isSelected: boolean;
  onHover: (isHovering: boolean) => void;
  onClick: () => void;
}

export const BattleRoyaleModeCard = ({
  isHovered,
  isSelected,
  onHover,
  onClick
}: BattleRoyaleModeCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const isActive = isHovered || isSelected;

  return (
    <div
      ref={cardRef}
      className={`
        relative flex-1 min-w-[200px] max-w-[400px] cursor-pointer
        transition-all duration-500 ease-out
        ${isActive ? 'flex-[1.3] z-20' : 'flex-1 z-10'}
        opacity-70 cursor-not-allowed
      `}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      {/* Card Container - yellow/amber themed background */}
      <div
        className={`
          relative h-[380px] sm:h-[420px] md:h-[460px] rounded-2xl overflow-hidden
          border-2 transition-all duration-500
          ${isActive 
            ? 'border-white/40' 
            : 'border-white/10'}
          ${isSelected ? 'ring-4 ring-white/30' : ''}
        `}
        style={{
          background: '#78350f',
          boxShadow: isActive 
            ? '0 0 40px rgba(245, 158, 11, 0.3)' 
            : '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Rook Character - fills entire card as background */}
        <img 
          src={rookCharacter} 
          alt="Battle Royale Mode Rook" 
          className={`
            absolute inset-0 w-full h-full object-cover
            transition-all duration-500
            ${isActive ? 'scale-105' : 'scale-100'}
          `}
        />

        {/* Bottom gradient for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-6 text-center space-y-3">
          <h2 
            className={`
              text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider
              text-white
              transition-all duration-300
              ${isActive ? 'scale-105' : ''}
            `}
            style={{
              textShadow: '0 2px 8px rgba(0,0,0,0.6)'
            }}
          >
            Battle Royale
          </h2>

          <p className="text-white/60 text-sm sm:text-base">
            Last player standing wins
          </p>

          {/* Coming Soon Badge */}
          <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 mx-auto w-fit">
            <Lock className="w-4 h-4 text-white/70" />
            <span className="text-white/70 text-sm font-semibold uppercase tracking-wider">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
