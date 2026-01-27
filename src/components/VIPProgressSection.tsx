import { Link } from 'react-router-dom';
import { Crown, Coins, ArrowRight } from 'lucide-react';
import { VIPProgressCard } from './VIPProgressCard';
import { Button } from './ui/button';
import { Card } from './ui/card';

export const VIPProgressSection = () => {
  return (
    <section className="relative py-16 overflow-hidden">
      {/* Reuse pre-login hero background styling */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '32px 32px'
      }} />
      
      {/* Subtle glow accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left: VIP Progress Card */}
          <div>
            <VIPProgressCard />
          </div>

          {/* Right: Feature Tiles */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {/* Chess Arena Tile */}
            <Link to="/games/chess">
              <Card className="group relative h-48 overflow-hidden border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 hover:from-slate-700/80 hover:to-slate-800/80 transition-all cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative h-full p-6 flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Crown className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Chess Arena</h3>
                    <p className="text-sm text-slate-400">Compete in ranked matches</p>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-400 group-hover:translate-x-1 transition-transform">
                    <span className="text-sm font-semibold">Play Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            </Link>

            {/* Deposit Tile */}
            <Link to="/deposit">
              <Card className="group relative h-48 overflow-hidden border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 hover:from-slate-700/80 hover:to-slate-800/80 transition-all cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative h-full p-6 flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Coins className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Deposit</h3>
                    <p className="text-sm text-slate-400">Add Skilled Coins to your account</p>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400 group-hover:translate-x-1 transition-transform">
                    <span className="text-sm font-semibold">Deposit Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
