import { useState } from 'react';
import { Gift, Calendar, Target, Users, Trophy } from 'lucide-react';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useLanguage } from '@/contexts/LanguageContext';

const rewardCards = [
  { icon: Calendar, translationKey: 'rewards.daily', descKey: 'rewards.daily_desc', color: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400' },
  { icon: Target, translationKey: 'rewards.challenges', descKey: 'rewards.challenges_desc', color: 'from-blue-500/20 to-cyan-500/20', iconColor: 'text-blue-400' },
  { icon: Users, translationKey: 'rewards.referral', descKey: 'rewards.referral_desc', color: 'from-green-500/20 to-emerald-500/20', iconColor: 'text-green-400' },
  { icon: Trophy, translationKey: 'rewards.leaderboard', descKey: 'rewards.leaderboard_desc', color: 'from-purple-500/20 to-pink-500/20', iconColor: 'text-purple-400' },
];

const Rewards = () => {
  const { t } = useLanguage();
  const [sideMenuOpen, setSideMenuOpen] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth >= 768;
    return false;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <DesktopSideMenu
        isOpen={sideMenuOpen}
        onToggle={() => setSideMenuOpen(!sideMenuOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        variant="black"
      />

      {sideMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      <div
        className={`
          transition-all duration-300 ease-out
          ${sideMenuOpen ? (sidebarCollapsed ? 'md:ml-16' : 'md:ml-72') : 'md:ml-0'}
        `}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16">
          {/* Header */}
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <Gift className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{t('rewards.title')}</h1>
              <p className="text-muted-foreground mt-1">{t('rewards.description')}</p>
            </div>
          </div>

          {/* Reward Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
            {rewardCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div
                  key={idx}
                  className="relative group rounded-2xl border border-border bg-card p-6 hover:border-primary/30 transition-all duration-200"
                >
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${card.color} mb-4`}>
                    <Icon className={`w-6 h-6 ${card.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{t(card.translationKey)}</h3>
                  <p className="text-muted-foreground leading-relaxed">{t(card.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
};

export default Rewards;
