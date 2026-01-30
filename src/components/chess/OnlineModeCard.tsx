/**
 * OnlineModeCard - Custom card for Online chess mode with animated eyes
 */

import { useRef, useState, useEffect, useCallback } from 'react';
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
  const [isBlinking, setIsBlinking] = useState(false);
  const isActive = isHovered || isSelected;

  // Blinking effect
  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    };

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
    const cardCenterY = rect.top + rect.height * 0.32;

    const relX = e.clientX - cardCenterX;
    const relY = e.clientY - cardCenterY;

    const maxOffset = 5;
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
          background: 'linear-gradient(180deg, #1a3a52 0%, #0f2536 100%)',
          boxShadow: isActive 
            ? '0 0 60px rgba(14, 165, 233, 0.35), inset 0 0 40px rgba(14, 165, 233, 0.1)' 
            : undefined
        }}
      >
        {/* Rook Character Container */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div 
            className={`
              relative transition-all duration-500 flex items-center justify-center
              ${isActive ? 'scale-105' : 'scale-100'}
            `}
            style={{ marginTop: '10px' }}
          >
            {/* Rook Image */}
            <img 
              src={rookCharacter} 
              alt="Online Mode Rook" 
              className={`
                w-[160px] sm:w-[180px] md:w-[200px] h-auto object-contain
                transition-all duration-500
                ${isActive ? 'brightness-110' : 'brightness-100'}
              `}
              style={{
                filter: isActive 
                  ? 'drop-shadow(0 0 20px rgba(14, 165, 233, 0.3))' 
                  : 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25))'
              }}
            />
            
            {/* Animated Eyes - positioned on the rook's upper body/face area */}
            <div 
              className="absolute pointer-events-none"
              style={{
                top: '28%',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '20px'
              }}
            >
              {/* Left Eye */}
              <div 
                className="relative"
                style={{
                  width: '18px',
                  height: isBlinking ? '2px' : '18px',
                  background: 'white',
                  borderRadius: isBlinking ? '2px' : '50%',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15), inset 0 -1px 2px rgba(0,0,0,0.1)',
                  transition: 'height 0.08s ease-out, border-radius 0.08s ease-out',
                  overflow: 'hidden'
                }}
              >
                {!isBlinking && (
                  <div 
                    className="absolute rounded-full"
                    style={{
                      width: '10px',
                      height: '10px',
                      background: '#1e293b',
                      left: `calc(50% - 5px + ${eyeOffset.x}px)`,
                      top: `calc(50% - 5px + ${eyeOffset.y}px)`,
                      transition: isActive ? 'left 0.06s, top 0.06s' : 'all 0.25s ease-out'
                    }}
                  >
                    {/* Eye shine */}
                    <div 
                      className="absolute bg-white rounded-full"
                      style={{
                        width: '3px',
                        height: '3px',
                        top: '1px',
                        right: '1px'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Right Eye */}
              <div 
                className="relative"
                style={{
                  width: '18px',
                  height: isBlinking ? '2px' : '18px',
                  background: 'white',
                  borderRadius: isBlinking ? '2px' : '50%',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15), inset 0 -1px 2px rgba(0,0,0,0.1)',
                  transition: 'height 0.08s ease-out, border-radius 0.08s ease-out',
                  overflow: 'hidden'
                }}
              >
                {!isBlinking && (
                  <div 
                    className="absolute rounded-full"
                    style={{
                      width: '10px',
                      height: '10px',
                      background: '#1e293b',
                      left: `calc(50% - 5px + ${eyeOffset.x}px)`,
                      top: `calc(50% - 5px + ${eyeOffset.y}px)`,
                      transition: isActive ? 'left 0.06s, top 0.06s' : 'all 0.25s ease-out'
                    }}
                  >
                    {/* Eye shine */}
                    <div 
                      className="absolute bg-white rounded-full"
                      style={{
                        width: '3px',
                        height: '3px',
                        top: '1px',
                        right: '1px'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-6 text-center space-y-4">
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

          <p className="text-white/70 text-sm sm:text-base">
            Compete for Skilled Coins
          </p>

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
            absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent
            transition-opacity duration-500
            ${isActive ? 'opacity-100' : 'opacity-0'}
          `}
        />
      </div>
    </div>
  );
};
