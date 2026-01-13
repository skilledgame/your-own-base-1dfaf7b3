import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crown, Gamepad2, Target, Puzzle, Dices, Sparkles, ChevronRight } from 'lucide-react';
import { TokenBalance } from './TokenBalance';
import skilledLogo from '@/assets/skilled-logo.png';

interface HeroSectionProps {
  balance: number;
  onPlay: () => void;
}

interface GameCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  isAvailable: boolean;
  onPlay?: () => void;
}

const GameCard = ({ title, description, icon, gradient, isAvailable, onPlay }: GameCardProps) => {
  return (
    <div 
      className={`card-game relative group cursor-pointer ${!isAvailable ? 'opacity-60' : ''}`}
      onClick={isAvailable ? onPlay : undefined}
    >
      {/* Game Image/Preview */}
      <div className={`relative h-40 sm:h-48 ${gradient} flex items-center justify-center`}>
        {!isAvailable && (
          <div className="absolute inset-0 backdrop-blur-md bg-background/30 flex items-center justify-center z-10">
            <span className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold">
              Coming Soon
            </span>
          </div>
        )}
        <div className="text-foreground/80">
          {icon}
        </div>
        {isAvailable && (
          <div className="absolute bottom-3 right-3 bg-emerald text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Live
          </div>
        )}
      </div>
      
      {/* Card Content */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
        {isAvailable && (
          <Button 
            variant="default" 
            className="w-full group-hover:bg-primary/90"
            onClick={onPlay}
          >
            Play Now
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        )}
      </div>
    </div>
  );
};

export const HeroSection = ({ balance, onPlay }: HeroSectionProps) => {
  const games = [
    {
      title: 'Chess',
      description: 'Classic strategy. Wager tokens, beat the bot, double your stake.',
      icon: <Crown className="w-16 h-16" />,
      gradient: 'bg-gradient-to-br from-amber-100 to-orange-200',
      isAvailable: true,
    },
    {
      title: 'Tic Tac Toe',
      description: 'Quick matches. Simple rules, strategic gameplay.',
      icon: <Target className="w-16 h-16" />,
      gradient: 'bg-gradient-to-br from-blue-100 to-indigo-200',
      isAvailable: false,
    },
    {
      title: 'Memory Match',
      description: 'Test your memory. Find pairs before time runs out.',
      icon: <Puzzle className="w-16 h-16" />,
      gradient: 'bg-gradient-to-br from-purple-100 to-pink-200',
      isAvailable: false,
    },
    {
      title: 'Dice Duel',
      description: 'Roll the dice. Higher score wins the pot.',
      icon: <Dices className="w-16 h-16" />,
      gradient: 'bg-gradient-to-br from-green-100 to-emerald-200',
      isAvailable: false,
    },
    {
      title: 'Speed Math',
      description: 'Race against the clock. Solve equations to win.',
      icon: <Gamepad2 className="w-16 h-16" />,
      gradient: 'bg-gradient-to-br from-rose-100 to-red-200',
      isAvailable: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/">
              <img 
                src={skilledLogo} 
                alt="Skilled" 
                className="h-10 sm:h-12 w-auto"
              />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <TokenBalance balance={balance} />
            <Button variant="outline" size="sm" className="hidden sm:flex">
              Sign In
            </Button>
            <Button size="sm">
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 py-12 sm:py-16">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            <span className="text-foreground">Wager. Play. </span>
            <span className="text-gradient-rainbow">Win.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Put your skills to the test. Wager tokens on skill-based games and double your stake when you win.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" onClick={onPlay} className="px-8">
              Start Playing
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
            <Button variant="outline" size="lg" className="hidden sm:flex">
              How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* Games Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Games</h2>
            <p className="text-muted-foreground mt-1">Choose your game and start wagering</p>
          </div>
          <Button variant="ghost" className="text-muted-foreground">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {games.map((game) => (
            <GameCard
              key={game.title}
              {...game}
              onPlay={game.isAvailable ? onPlay : undefined}
            />
          ))}
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-secondary/50 border-y border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">10K+</p>
              <p className="text-sm text-muted-foreground">Active Players</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">500K</p>
              <p className="text-sm text-muted-foreground">Games Played</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">2M</p>
              <p className="text-sm text-muted-foreground">Tokens Wagered</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-foreground">95%</p>
              <p className="text-sm text-muted-foreground">Fair Play Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/">
                <img 
                  src={skilledLogo} 
                  alt="Skilled" 
                  className="h-8 w-auto"
                />
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Skilled. All rights reserved. Play responsibly.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};