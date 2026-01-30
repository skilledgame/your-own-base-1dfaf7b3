/**
 * OnlineModeCard - Custom card for Online chess mode with eye-tracking effect
 */

import { useRef, useState, useEffect } from 'react';
import { Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import rookCharacter from '@/assets/chess-rook-character.png';

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
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const isActive = isHovered || isSelected;

  // Eye tracking effect
  useEffect(() => {
    if (!isActive) {
      setEyeOffset({ x: 0, y: 0 });
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;

      // Calculate relative position from card center
      const relX = e.clientX - cardCenterX;
      const relY = e.clientY - cardCenterY;

      // Normalize and limit eye movement (max 8px offset)
      const maxOffset = 8;
      const distance = Math.sqrt(relX * relX + relY * relY);
      const normalizedDistance = Math.min(distance / 200, 1);

      const offsetX = (relX / (distance || 1)) * maxOffset * normalizedDistance;
      const offsetY = (relY / (distance || 1)) * maxOffset * normalizedDistance;

      setEyeOffset({ x: offsetX, y: offsetY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isActive]);

  return (
    <div
      ref={cardRef}
      className={`
        relative flex-1 min-w-[200px] max-w-[400px] cursor-pointer
        transition-all duration-500 ease-out
        ${isActive ? 'flex-[1.3] z-20' : 'flex-1 z-10'}
      `}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      {/* Card Container */}
      <div
        className={`
          relative h-[380px] sm:h-[420px] md:h-[460px] rounded-2xl overflow-hidden
          border-2 transition-all duration-500
          ${isActive 
            ? 'border-white/60' 
            : 'border-white/20 shadow-lg'}
          ${isSelected ? 'ring-4 ring-white/40' : ''}
        `}
        style={{
          background: 'linear-gradient(180deg, #0ea5e9dd 0%, #0c4a6eee 100%)',
          boxShadow: isActive 
            ? '0 0 80px rgba(14, 165, 233, 0.5), inset 0 0 60px rgba(14, 165, 233, 0.2)' 
            : undefined
        }}
      >
        {/* Background Pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, white 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }}
        />

        {/* Rook Character Image */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className={`
              relative transition-all duration-500
              ${isActive ? 'scale-110' : 'scale-100'}
            `}
          >
            <img 
              src={rookCharacter} 
              alt="Online Mode Rook" 
              className={`
                w-[160px] sm:w-[200px] md:w-[240px] h-auto object-contain
                transition-all duration-500
                ${isActive 
                  ? 'drop-shadow-[0_0_40px_rgba(255,255,255,0.6)]' 
                  : 'drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]'}
              `}
              style={{
                filter: isActive 
                  ? 'drop-shadow(0 0 60px rgba(14, 165, 233, 0.8))' 
                  : 'drop-shadow(0 0 30px rgba(14, 165, 233, 0.5))'
              }}
            />
            
            {/* Animated Eyes Overlay */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                transition: isActive ? 'transform 0.1s ease-out' : 'transform 0.3s ease-out'
              }}
            >
              {/* Left Eye Pupil - Positioned over left eye in image */}
              <div 
                className="absolute bg-slate-900 rounded-full"
                style={{
                  width: '12%',
                  height: '6%',
                  left: '35%',
                  top: '32%',
                  boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                }}
              />
              {/* Right Eye Pupil - Positioned over right eye in image */}
              <div 
                className="absolute bg-slate-900 rounded-full"
                style={{
                  width: '12%',
                  height: '6%',
                  left: '53%',
                  top: '32%',
                  boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-6 text-center space-y-4">
          {/* Mode Icon */}
          <div 
            className={`
              w-14 h-14 mx-auto rounded-xl flex items-center justify-center
              bg-white/10 backdrop-blur-sm border border-white/20
              transition-all duration-300
              ${isActive ? 'scale-110 bg-white/20' : ''}
            `}
          >
            <Globe className="w-7 h-7 text-blue-400" />
          </div>

          {/* Title */}
          <h2 
            className={`
              text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider
              text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]
              transition-all duration-300
              ${isActive ? 'scale-105' : ''}
            `}
          >
            Online
          </h2>

          {/* Subtitle */}
          <p className="text-white/70 text-sm sm:text-base">
            Compete for Skilled Coins
          </p>

          {/* Play Button (shows on hover/active) */}
          <div 
            className={`
              transition-all duration-300 transform
              ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
            `}
          >
            <Button 
              size="lg"
              className="px-8 py-6 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0 shadow-lg"
            >
              PLAY
            </Button>
          </div>
        </div>

        {/* Shine Effect */}
        <div 
          className={`
            absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent
            transition-opacity duration-500
            ${isActive ? 'opacity-100' : 'opacity-0'}
          `}
        />
      </div>
    </div>
  );
};
