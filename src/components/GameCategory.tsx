import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameCard } from './GameCard';
import skilledMascot from '@/assets/skilled-mascot.png';

interface Game {
  name: string;
  image: string;
  gradientFrom: string;
  gradientTo: string;
  isLive?: boolean;
  comingSoon?: boolean;
  showName?: boolean;
}

interface GameCategoryProps {
  title: string;
  icon: 'flame' | 'sparkles' | 'clock' | 'star';
  games: Game[];
  onGameClick?: (gameName: string) => void;
}

const iconMap = {
  sparkles: Sparkles,
  clock: Clock,
  star: Star,
};

export const GameCategory = ({ title, icon, games, onGameClick }: GameCategoryProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const Icon = icon !== 'flame' ? iconMap[icon as keyof typeof iconMap] : null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 240;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="mb-8 max-w-5xl mx-auto px-4 sm:px-8 lg:px-16 overflow-visible">
      {/* Category Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon === 'flame' ? (
            <img src={skilledMascot} alt="Skilled" className="w-6 h-6 object-contain" />
          ) : Icon ? (
            <Icon className="w-5 h-5 text-primary" />
          ) : null}
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-secondary hover:bg-secondary/80"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-secondary hover:bg-secondary/80"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable Games Row */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-2 pl-1 scrollbar-hide -ml-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {games.map((game, index) => (
          <GameCard key={index} {...game} showName={game.showName !== false} onClick={() => onGameClick?.(game.name)} />
        ))}
      </div>
    </div>
  );
};
