/**
 * OnlineModeCard - Custom card for Online chess mode
 */

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import queenCharacter from '@/assets/chess-rook-character.png';

interface OnlineModeCardProps {
  isHovered: boolean;
  isSelected: boolean;
  onHover: (isHovering: boolean) => void;
  onClick: () => void;
}

export const OnlineModeCard = ({
  isHovered,
  isSelected,
  onHover,
  onClick
}: OnlineModeCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const isActive = isHovered || isSelected;

  return (
    <div
      ref={cardRef}
      className={`
        relative w-full md:flex-1 md:min-w-[200px] md:max-w-[400px] cursor-pointer
        transition-all duration-500 ease-out
        ${isActive ? 'md:flex-[1.3] z-20' : 'md:flex-1 z-10'}
      `}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      {/* Card Container - unified dark blue background */}
      <div
        className={`
          relative h-[200px] sm:h-[280px] md:h-[460px] rounded-2xl overflow-hidden
          border-2 transition-all duration-500
          ${isActive 
            ? 'border-white/40' 
            : 'border-white/10'}
          ${isSelected ? 'ring-4 ring-white/30' : ''}
        `}
        style={{
          background: '#0f2536',
          boxShadow: isActive 
            ? '0 0 40px rgba(14, 165, 233, 0.2)' 
            : '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Queen Character - fills entire card as background */}
        <img 
          src={queenCharacter} 
          alt="Online Mode Queen" 
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
            Online
          </h2>

          <p className="text-white/60 text-sm sm:text-base">
            Compete for Skilled Coins
          </p>

          <div 
            className={`
              transition-all duration-300 transform pt-1
              ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
            `}
          >
            <Button 
              size="lg"
              className="px-8 py-5 text-base font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0 shadow-lg"
            >
              PLAY
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};