import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, X, Shuffle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import skilledLogo from '@/assets/skilled-logo.png';

const categories = [
  { id: 'all', label: 'All Games', icon: '🎮' },
  { id: 'skilled', label: 'Skilled Originals', icon: '⭐' },
  { id: 'strategy', label: 'Strategy', icon: '♟️' },
  { id: 'action', label: 'Action', icon: '🎯' },
  { id: 'popular', label: 'Popular Games', icon: '🔥' },
];

const games = [
  { id: 'chess', name: 'Chess', provider: 'Skilled', category: 'strategy', image: '/placeholder.svg' },
  { id: 'checkers', name: 'Checkers', provider: 'Skilled', category: 'strategy', image: '/placeholder.svg' },
  { id: 'poker', name: 'Poker', provider: 'Skilled', category: 'skilled', image: '/placeholder.svg' },
  { id: 'blackjack', name: 'Blackjack', provider: 'Skilled', category: 'skilled', image: '/placeholder.svg' },
  { id: 'roulette', name: 'Roulette', provider: 'Skilled', category: 'action', image: '/placeholder.svg' },
  { id: 'slots', name: 'Slots', provider: 'Skilled', category: 'action', image: '/placeholder.svg' },
];

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  const filteredGames = games.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || game.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRandomGame = () => {
    const randomGame = games[Math.floor(Math.random() * games.length)];
    window.location.href = `/games/${randomGame.id}`;
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Side Menu */}
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />

      {/* Overlay for mobile */}
      {sideMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/">
              <img src={skilledLogo} alt="Skilled" className="h-8 w-auto" />
            </Link>
          </div>

          {/* Search Bar */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search games"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 h-12 bg-card border-border rounded-xl text-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleRandomGame}
              className="h-12 px-4 gap-2 border-border"
            >
              <Shuffle className="w-4 h-4" />
              <span className="hidden sm:inline">Random</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="sticky top-[120px] z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all
                  ${activeCategory === category.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                  }
                `}
              >
                <span>{category.icon}</span>
                <span className="text-sm font-medium">{category.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {filteredGames.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No games found</p>
            <p className="text-muted-foreground text-sm mt-2">Try a different search term or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filteredGames.map((game) => (
              <Link
                key={game.id}
                to={`/games/${game.id}`}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all hover:scale-[1.02]"
              >
                <img
                  src={game.image}
                  alt={game.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-foreground font-bold text-sm sm:text-base uppercase tracking-wide">
                    {game.name}
                  </h3>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">
                    {game.provider}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
