import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Trophy, 
  Shield,
  CheckCircle,
  Zap,
  ArrowLeft,
  ArrowRight,
  Menu,
  Settings,
  FileText,
  Moon,
  HelpCircle,
  Mail,
  Gamepad2,
  Users,
  Target,
  Award,
  Scale
} from 'lucide-react';
import skilledLogo from '@/assets/skilled-logo.png';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';

const HowItWorks = () => {
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-20 md:pb-0">
      {/* Desktop Side Menu */}
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />
      {sideMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSideMenuOpen(false)} />
      )}
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/">
              <img src={skilledLogo} alt="Skilled" className="h-8 sm:h-10 w-auto" />
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
                <Link to="/">
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  Games
                </Link>
              </Button>
              <Button variant="ghost" className="text-foreground bg-secondary/50">
                How It Works
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <Link to="/">Play Now</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help & FAQ
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Us
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Terms & Conditions
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Shield className="mr-2 h-4 w-4" />
                  Privacy Policy
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={isDarkMode}
                  onCheckedChange={setIsDarkMode}
                  className="cursor-pointer"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  Dark Mode
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Games
          </Link>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            How <span className="text-primary">Skilled</span> Works
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A fair, transparent platform where your abilities determine your success. No luck, no gambling—just pure skill-based competition.
          </p>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                step: '1', 
                title: 'Choose Your Game', 
                desc: 'Browse our library of skill-based games. From classics like Chess to arcade favorites—find your competitive edge.',
                icon: Gamepad2 
              },
              { 
                step: '2', 
                title: 'Get Matched Instantly', 
                desc: 'Our matchmaking pairs you with real opponents at similar skill levels for fair, balanced competition.',
                icon: Users 
              },
              { 
                step: '3', 
                title: 'Compete & Win', 
                desc: 'Outplay your opponent and earn fixed rewards. Top performers receive prizes based on their performance.',
                icon: Trophy 
              },
            ].map((item, index) => (
              <div key={index} className="relative group">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative glass-card rounded-2xl p-8 hover-lift text-center h-full">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <item.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-sm font-bold text-primary mb-2">Step {item.step}</div>
                  <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 100% Skill-Based Section */}
      <section className="py-20 px-4 bg-secondary/30">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">
            100% Skill-Based. <span className="text-primary">Zero Gambling.</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            Every outcome on Skilled is determined purely by your abilities. There are no dice rolls, no random draws, no house edge. Just you versus your opponent, skill versus skill.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {[
              { label: 'Fair Matchmaking', desc: 'Play against equally skilled opponents' },
              { label: 'Transparent Rules', desc: 'Clear game mechanics, no hidden tricks' },
              { label: 'Fixed Prize Pools', desc: 'Know exactly what you can win' },
              { label: 'No Luck Mechanics', desc: 'Pure skill determines every outcome' },
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border text-left">
                <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-sm text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Game Categories */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Games for Every <span className="text-primary">Skill</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Whether you're a strategic mastermind or quick-reflex champion, there's a game for you.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                title: 'Strategy Games', 
                desc: 'Chess, Checkers, Go, and more. Perfect for tactical minds who think ahead.',
                icon: Target,
                games: ['Chess', 'Checkers', 'Go', 'Reversi', 'Backgammon']
              },
              { 
                title: 'Arcade Games', 
                desc: 'Quick reflexes and hand-eye coordination. Fast-paced competitive fun.',
                icon: Zap,
                games: ['Flappy Bird', 'Snake', 'Tetris', 'Pong', 'Breakout']
              },
              { 
                title: 'Brain Games', 
                desc: 'Test your knowledge, memory, and mental speed against others.',
                icon: Award,
                games: ['Trivia', 'Speed Math', 'Memory', 'Reaction', 'Typing Race']
              },
            ].map((category, index) => (
              <div key={index} className="glass-card rounded-2xl p-6 hover-lift">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <category.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{category.title}</h3>
                <p className="text-muted-foreground mb-4">{category.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {category.games.map((game, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-secondary text-sm">
                      {game}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fair Play Section */}
      <section className="py-20 px-4 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Scale className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Built on <span className="text-primary">Fairness</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Skilled is designed from the ground up to ensure every competition is fair. Our platform uses skill-based matchmaking, verified game outcomes, and transparent prize distribution.
              </p>
              <ul className="space-y-4">
                {[
                  'Skill-based matchmaking pairs you with similar players',
                  'All game results are verified and transparent',
                  'Fixed prizes—no house edge or hidden fees',
                  'Equal opportunity for all players to succeed',
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-8 bg-primary/20 rounded-full blur-3xl" />
                <div className="relative grid grid-cols-2 gap-4">
                  {['♟\uFE0E', '🎮', '🧠', '🏆'].map((emoji, i) => (
                    <div 
                      key={i}
                      className="w-32 h-32 rounded-2xl bg-background border border-border flex items-center justify-center text-5xl hover-lift"
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] bg-primary/15 rounded-full blur-3xl" />
        </div>
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-bold mb-4">
            Ready to <span className="text-primary">compete</span>?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of players competing in skill-based games.
          </p>
          <Button
            size="lg"
            asChild
            className="h-14 px-10 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
          >
            <Link to="/">
              Start Playing
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/">
            <img src={skilledLogo} alt="Skilled" className="h-6 w-auto opacity-60" />
          </Link>
          <p className="text-sm text-muted-foreground">
            © 2025 Skilled. All rights reserved.
          </p>
        </div>
      </footer>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
};

export default HowItWorks;
