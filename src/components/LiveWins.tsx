import { useState, useEffect, useRef } from 'react';
import { Coins } from 'lucide-react';

interface Win {
  id: string;
  playerName: string;
  amount: number;
  game: string;
  gameIcon: string;
  timestamp: Date;
  gradientFrom: string;
  gradientTo: string;
}

// Generate mock live wins data - Chess only with Skilled Coins
const generateMockWins = (): Win[] => {
  const chessGame = { game: 'Chess', icon: '♟️', from: '#5B3E99', to: '#3d2766' };
  const names = ['Marcus_C', 'Elena_R', 'James_W', 'Sophia_K', 'David_O', 'Emma_J', 'Lucas_S', 'Aisha_P', 'Ryan_M'];
  const amounts = [50, 100, 150, 200, 250, 300, 500, 750, 1000, 1500];
  
  return Array.from({ length: 12 }, (_, i) => {
    return {
      id: `win-${i}`,
      playerName: names[Math.floor(Math.random() * names.length)],
      amount: amounts[Math.floor(Math.random() * amounts.length)],
      game: chessGame.game,
      gameIcon: chessGame.icon,
      gradientFrom: chessGame.from,
      gradientTo: chessGame.to,
      timestamp: new Date(Date.now() - Math.random() * 3600000),
    };
  });
};

export const LiveWins = () => {
  const [wins, setWins] = useState<Win[]>(generateMockWins());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll animation
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationId: number;
    let scrollPosition = 0;
    const scrollSpeed = 0.5;

    const animate = () => {
      scrollPosition += scrollSpeed;
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      
      if (scrollPosition >= maxScroll) {
        scrollPosition = 0;
      }
      
      scrollContainer.scrollLeft = scrollPosition;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    // Pause on hover
    const handleMouseEnter = () => cancelAnimationFrame(animationId);
    const handleMouseLeave = () => {
      animationId = requestAnimationFrame(animate);
    };

    scrollContainer.addEventListener('mouseenter', handleMouseEnter);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Add new wins periodically - Chess only
  useEffect(() => {
    const interval = setInterval(() => {
      const chessGame = { game: 'Chess', icon: '♟️', from: '#5B3E99', to: '#3d2766' };
      const names = ['Marcus_C', 'Elena_R', 'James_W', 'Sophia_K', 'David_O', 'Emma_J'];
      const amounts = [50, 100, 150, 200, 250, 300, 500, 750, 1000];
      
      const newWin: Win = {
        id: `win-${Date.now()}`,
        playerName: names[Math.floor(Math.random() * names.length)],
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        game: chessGame.game,
        gameIcon: chessGame.icon,
        gradientFrom: chessGame.from,
        gradientTo: chessGame.to,
        timestamp: new Date(),
      };
      
      setWins((prev) => [newWin, ...prev.slice(0, 11)]);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-6 px-0 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-16 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-semibold text-foreground bg-accent/20 px-3 py-1 rounded-full">
            Recent Wins
          </span>
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-16">
        <div 
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollBehavior: 'auto' }}
      >
        {/* Duplicate wins for seamless loop */}
        {[...wins, ...wins].map((win, index) => (
          <div
            key={`${win.id}-${index}`}
            className="flex-shrink-0 w-[140px] group cursor-pointer"
          >
            {/* Game Card */}
            <div 
              className="relative h-[100px] rounded-xl overflow-hidden transition-transform duration-300 group-hover:scale-105"
              style={{ 
                background: `linear-gradient(135deg, ${win.gradientFrom}, ${win.gradientTo})` 
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl drop-shadow-lg">{win.gameIcon}</span>
              </div>
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                <span className="text-white/90 text-xs font-bold uppercase tracking-wider drop-shadow">
                  {win.game}
                </span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            
            {/* Win Info */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-gradient-rainbow flex items-center justify-center overflow-hidden">
                  <Coins className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                  {win.playerName}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent font-bold text-sm">
              {win.amount.toLocaleString()}
              <Coins className="w-4 h-4 text-yellow-500" />
            </div>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
};
