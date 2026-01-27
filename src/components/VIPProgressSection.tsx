import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { VIPProgressCard } from './VIPProgressCard';
import { useProfile } from '@/hooks/useProfile';

export const VIPProgressSection = () => {
  const { displayName } = useProfile();
  
  // Use display_name from profiles table
  const username = displayName || 'Player';

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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-[1fr,auto] gap-4 items-center">
          {/* Left: Welcome + VIP Progress Card */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">
              <span className="text-white">Welcome </span>
              <span className="animate-rainbow-text font-extrabold">
                {username}!
              </span>
            </h2>
            <VIPProgressCard />
          </div>

          {/* Right: Chess Game Card with tilt effect (smaller) */}
          <div className="hidden lg:flex justify-end">
            <Link to="/games/chess" className="relative group" style={{ transform: 'perspective(1000px) rotateY(-8deg) rotateX(4deg)' }}>
              {/* Card glow */}
              <div className="absolute -inset-3 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              
              {/* Main card */}
              <div 
                className="relative w-44 h-56 rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl group-hover:scale-[1.02] transition-transform duration-300"
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
                  <span className="text-[80px] drop-shadow-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                    ♟️
                  </span>
                </div>
                
                {/* Bottom gradient and label */}
                <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-cyan-900/90 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">♟️</span>
                    <span className="text-white font-bold text-sm">Chess</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/70 group-hover:translate-x-1 transition-transform" />
                </div>
                
                {/* Live badge */}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-semibold">
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
