/**
 * OnlineModeCard - Custom card for Online chess mode with animated eyes
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import rookPiece from '@/assets/chess-rook-piece.png';

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
  const [isBlinking, setIsBlinking] = useState(false);
  const isActive = isHovered || isSelected;

  // Blinking effect
  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    };

    // Random blink interval between 2-5 seconds
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 3000;
      return setTimeout(() => {
        blink();
        blinkTimeout = scheduleBlink();
      }, delay);
    };

    let blinkTimeout = scheduleBlink();

    return () => clearTimeout(blinkTimeout);
  }, []);

  // Eye tracking effect
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const cardCenterY = rect.top + rect.height * 0.35; // Eyes position

    // Calculate relative position from card center
    const relX = e.clientX - cardCenterX;
    const relY = e.clientY - cardCenterY;

    // Normalize and limit eye movement (max 6px offset)
    const maxOffset = 6;
    const distance = Math.sqrt(relX * relX + relY * relY);
    const normalizedDistance = Math.min(distance / 200, 1);

    const offsetX = (relX / (distance || 1)) * maxOffset * normalizedDistance;
    const offsetY = (relY / (distance || 1)) * maxOffset * normalizedDistance;

    setEyeOffset({ x: offsetX, y: offsetY });
  }, []);

  useEffect(() => {
    if (!isActive) {
      setEyeOffset({ x: 0, y: 0 });
      return;
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isActive, handleMouseMove]);

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
          background: 'linear-gradient(180deg, #1e3a5f 0%, #0c2340 100%)',
          boxShadow: isActive 
            ? '0 0 80px rgba(14, 165, 233, 0.4), inset 0 0 60px rgba(14, 165, 233, 0.15)' 
            : undefined
        }}
      >
        {/* Subtle Background Pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        {/* Rook Piece Image - Smaller and centered */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div 
            className={`
              relative transition-all duration-500 flex items-center justify-center
              ${isActive ? 'scale-110' : 'scale-100'}
            `}
            style={{ marginTop: '20px' }}
          >
            <img 
              src={rookPiece} 
              alt="Online Mode Rook" 
              className={`
                w-[180px] sm:w-[200px] md:w-[220px] h-auto object-contain
                transition-all duration-500
                ${isActive ? 'brightness-110' : 'brightness-100'}
              `}
              style={{
                filter: isActive 
                  ? 'drop-shadow(0 0 30px rgba(14, 165, 233, 0.5))' 
                  : 'drop-shadow(0 0 15px rgba(14, 165, 233, 0.3))'
              }}
            />
            
            {/* Animated Eyes Container - positioned on the rook body */}
            <div 
              className="absolute pointer-events-none"
              style={{
                top: '38%',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '24px'
              }}
            >
              {/* Left Eye */}
              <div 
                className="relative transition-all duration-200"
                style={{
                  width: '28px',
                  height: isBlinking ? '4px' : '28px',
                  background: 'white',
                  borderRadius: isBlinking ? '4px' : '50%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}
              >
                {/* Pupil */}
                {!isBlinking && (
                  <div 
                    className="absolute bg-slate-900 rounded-full transition-all"
                    style={{
                      width: '14px',
                      height: '14px',
                      left: `calc(50% - 7px + ${eyeOffset.x}px)`,
                      top: `calc(50% - 7px + ${eyeOffset.y}px)`,
                      boxShadow: 'inset 0 0 2px rgba(0,0,0,0.5)',
                      transition: isActive ? 'left 0.05s, top 0.05s' : 'all 0.3s ease-out'
                    }}
                  >
                    {/* Eye shine */}
                    <div 
                      className="absolute bg-white rounded-full"
                      style={{
                        width: '5px',
                        height: '5px',
                        top: '2px',
                        right: '2px'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Right Eye */}
              <div 
                className="relative transition-all duration-200"
                style={{
                  width: '28px',
                  height: isBlinking ? '4px' : '28px',
                  background: 'white',
                  borderRadius: isBlinking ? '4px' : '50%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}
              >
                {/* Pupil */}
                {!isBlinking && (
                  <div 
                    className="absolute bg-slate-900 rounded-full transition-all"
                    style={{
                      width: '14px',
                      height: '14px',
                      left: `calc(50% - 7px + ${eyeOffset.x}px)`,
                      top: `calc(50% - 7px + ${eyeOffset.y}px)`,
                      boxShadow: 'inset 0 0 2px rgba(0,0,0,0.5)',
                      transition: isActive ? 'left 0.05s, top 0.05s' : 'all 0.3s ease-out'
                    }}
                  >
                    {/* Eye shine */}
                    <div 
                      className="absolute bg-white rounded-full"
                      style={{
                        width: '5px',
                        height: '5px',
                        top: '2px',
                        right: '2px'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-6 text-center space-y-4">
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
