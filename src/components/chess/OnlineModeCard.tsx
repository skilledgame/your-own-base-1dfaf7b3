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
      {/* Card Container - unified dark blue background */}
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
          background: '#0f2536',
          boxShadow: isActive 
            ? '0 0 40px rgba(14, 165, 233, 0.2)' 
            : '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Subtle vignette for depth */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.3) 100%)'
          }}
        />

        {/* Rook Character Container */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ paddingBottom: '80px' }}>
          <div 
            className={`
              relative transition-all duration-500 flex items-center justify-center
              ${isActive ? 'scale-105' : 'scale-100'}
            `}
          >
            {/* Rook Image */}
            <img 
              src={rookCharacter} 
              alt="Online Mode Rook" 
              className={`
                w-[140px] sm:w-[160px] md:w-[180px] h-auto object-contain
                transition-all duration-500
              `}
              style={{
                filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4))'
              }}
            />
            
            {/* Animated Eyes - embedded into the rook with socket effect */}
            <div 
              className="absolute pointer-events-none"
              style={{
                top: '26%',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '18px'
              }}
            >
              {/* Left Eye Socket */}
              <div 
                className="relative"
                style={{
                  width: '20px',
                  height: '20px',
                  background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {/* Left Eye */}
                <div 
                  className="relative"
                  style={{
                    width: '16px',
                    height: isBlinking ? '2px' : '16px',
                    background: 'radial-gradient(ellipse at 30% 30%, #ffffff 0%, #e8e8e8 50%, #d0d0d0 100%)',
                    borderRadius: isBlinking ? '2px' : '50%',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15), inset 0 -1px 2px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.3)',
                    transition: 'height 0.08s ease-out, border-radius 0.08s ease-out',
                    overflow: 'hidden'
                  }}
                >
                  {!isBlinking && (
                    <div 
                      className="absolute rounded-full"
                      style={{
                        width: '8px',
                        height: '8px',
                        background: 'radial-gradient(ellipse at 40% 40%, #374151 0%, #1e293b 100%)',
                        left: `calc(50% - 4px + ${eyeOffset.x * 0.8}px)`,
                        top: `calc(50% - 4px + ${eyeOffset.y * 0.8}px)`,
                        transition: isActive ? 'left 0.06s, top 0.06s' : 'all 0.25s ease-out',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)'
                      }}
                    >
                      {/* Eye shine */}
                      <div 
                        className="absolute bg-white rounded-full"
                        style={{
                          width: '2.5px',
                          height: '2.5px',
                          top: '1px',
                          right: '1px',
                          opacity: 0.9
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right Eye Socket */}
              <div 
                className="relative"
                style={{
                  width: '20px',
                  height: '20px',
                  background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {/* Right Eye */}
                <div 
                  className="relative"
                  style={{
                    width: '16px',
                    height: isBlinking ? '2px' : '16px',
                    background: 'radial-gradient(ellipse at 30% 30%, #ffffff 0%, #e8e8e8 50%, #d0d0d0 100%)',
                    borderRadius: isBlinking ? '2px' : '50%',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15), inset 0 -1px 2px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.3)',
                    transition: 'height 0.08s ease-out, border-radius 0.08s ease-out',
                    overflow: 'hidden'
                  }}
                >
                  {!isBlinking && (
                    <div 
                      className="absolute rounded-full"
                      style={{
                        width: '8px',
                        height: '8px',
                        background: 'radial-gradient(ellipse at 40% 40%, #374151 0%, #1e293b 100%)',
                        left: `calc(50% - 4px + ${eyeOffset.x * 0.8}px)`,
                        top: `calc(50% - 4px + ${eyeOffset.y * 0.8}px)`,
                        transition: isActive ? 'left 0.06s, top 0.06s' : 'all 0.25s ease-out',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)'
                      }}
                    >
                      {/* Eye shine */}
                      <div 
                        className="absolute bg-white rounded-full"
                        style={{
                          width: '2.5px',
                          height: '2.5px',
                          top: '1px',
                          right: '1px',
                          opacity: 0.9
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

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
