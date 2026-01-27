import { Link } from 'react-router-dom';
import { Crown, ChevronRight, Sparkles } from 'lucide-react';
import { VIPProgressCard } from './VIPProgressCard';
import { Button } from './ui/button';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';

export const VIPProgressSection = () => {
  const { user } = useAuth();
  const { displayName, isLoading } = useProfile();
  
  const username = displayName || user?.email?.split('@')[0] || 'Player';

  return (
    <section className="relative py-8 overflow-hidden">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Subtle random decorative lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Diagonal lines */}
        <div className="absolute top-0 left-[10%] w-px h-full bg-gradient-to-b from-transparent via-white/[0.04] to-transparent transform rotate-12" />
        <div className="absolute top-0 left-[25%] w-px h-[120%] bg-gradient-to-b from-transparent via-white/[0.03] to-transparent transform -rotate-6" />
        <div className="absolute top-0 left-[45%] w-px h-full bg-gradient-to-b from-transparent via-white/[0.05] to-transparent transform rotate-3" />
        <div className="absolute top-0 right-[30%] w-px h-[110%] bg-gradient-to-b from-transparent via-white/[0.03] to-transparent transform -rotate-12" />
        <div className="absolute top-0 right-[15%] w-px h-full bg-gradient-to-b from-transparent via-white/[0.04] to-transparent transform rotate-8" />
        <div className="absolute top-0 right-[5%] w-px h-[90%] bg-gradient-to-b from-transparent via-white/[0.02] to-transparent transform -rotate-3" />
        
        {/* Horizontal accent lines */}
        <div className="absolute top-[20%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
        <div className="absolute top-[70%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
      </div>
      
      {/* Subtle glow accents */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Welcome Message */}
        <div className="mb-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-1">
            Welcome{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              {username}!
            </span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-center">
          {/* Left: VIP Progress Card */}
          <div>
            <VIPProgressCard />
          </div>

          {/* Right: Chess Game Card (from logged-out screen style) */}
          <Link to="/games/chess" className="block">
            <div className="card-game relative group cursor-pointer">
              {/* Game Preview */}
              <div className="relative h-32 bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center rounded-t-lg">
                <Crown className="w-14 h-14 text-foreground/80" />
                <div className="absolute bottom-2 right-2 bg-emerald text-primary-foreground px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Live
                </div>
              </div>
              
              {/* Card Content */}
              <div className="p-4 bg-card rounded-b-lg border border-t-0 border-border">
                <h3 className="font-semibold text-lg text-foreground mb-1">Chess</h3>
                <p className="text-sm text-muted-foreground mb-3">Classic strategy. Wager tokens, beat opponents, double your stake.</p>
                <Button 
                  variant="default" 
                  className="w-full group-hover:bg-primary/90"
                >
                  Play Now
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
};
