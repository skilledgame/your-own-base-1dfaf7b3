import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { VIPProgressCard } from './VIPProgressCard';
import { useProfile } from '@/hooks/useProfile';
import { Skeleton } from '@/components/ui/skeleton';

export const VIPProgressSection = () => {
  const { displayName, isLoading, isReady } = useProfile();
  
  // Use display_name from profiles table, show skeleton while loading
  const username = isReady && displayName ? displayName : null;

  return (
    <section className="relative py-4 overflow-hidden">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Subtle random decorative lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-[10%] w-px h-full bg-gradient-to-b from-transparent via-white/[0.04] to-transparent transform rotate-12" />
        <div className="absolute top-0 left-[25%] w-px h-[120%] bg-gradient-to-b from-transparent via-white/[0.03] to-transparent transform -rotate-6" />
        <div className="absolute top-0 left-[45%] w-px h-full bg-gradient-to-b from-transparent via-white/[0.05] to-transparent transform rotate-3" />
        <div className="absolute top-0 right-[30%] w-px h-[110%] bg-gradient-to-b from-transparent via-white/[0.03] to-transparent transform -rotate-12" />
        <div className="absolute top-0 right-[15%] w-px h-full bg-gradient-to-b from-transparent via-white/[0.04] to-transparent transform rotate-8" />
        <div className="absolute top-0 right-[5%] w-px h-[90%] bg-gradient-to-b from-transparent via-white/[0.02] to-transparent transform -rotate-3" />
        <div className="absolute top-[20%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
        <div className="absolute top-[70%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
      </div>
      
      {/* Subtle glow accents */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto px-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-center gap-8 lg:gap-12">
          {/* Left: Welcome + VIP Progress Card */}
          <div className="flex-1 max-w-md">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">
              <span className="text-white">Welcome </span>
              {isLoading || !username ? (
                <Skeleton className="inline-block h-8 w-24 align-middle" />
              ) : (
                <span className="animate-rainbow-text font-extrabold">
                  {username}!
                </span>
              )}
            </h2>
            <VIPProgressCard />
          </div>

          {/* Right: Chess Game Card with tilt effect (smaller) */}
          <div className="hidden lg:flex justify-center">
            <Link to="/chess" className="relative group" style={{ transform: 'perspective(1000px) rotateY(-8deg) rotateX(4deg)' }}>
              {/* Card glow */}
              <div className="absolute -inset-3 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              
              {/* Main card */}
              <div 
                className="relative w-36 h-48 rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl group-hover:scale-[1.02] transition-transform duration-300"
                style={{ background: 'linear-gradient(145deg, #1e3a5f, #0f2744)' }}
              >
                {/* Chess pattern overlay */}
                <div className="absolute inset-0 opacity-10">
                  <div className="grid grid-cols-4 h-full">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className={`${i % 2 === (Math.floor(i / 4) % 2) ? 'bg-white' : 'bg-transparent'}`} />
                    ))}
                  </div>
                </div>
                
                {/* Chess piece */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[64px] drop-shadow-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                    ♟️
                  </span>
                </div>
                
                {/* Bottom gradient and label */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-cyan-900/90 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">♟️</span>
                    <span className="text-white font-bold text-xs">Chess</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-white/70 group-hover:translate-x-1 transition-transform" />
                </div>
                
                {/* Live badge */}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/90 text-white px-1.5 py-0.5 rounded-full text-[9px] font-semibold">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
