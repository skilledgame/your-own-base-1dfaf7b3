/**
 * Settings Page — redesigned sidebar with icons, sections, and polished UX
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  X,
  User,
  ImageIcon,
  Lock,
  ShieldCheck,
  Monitor,
  Sliders,
  CreditCard,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Tab Components
import { ProfileTab } from '@/components/settings/ProfileTab';
import { PasswordTab } from '@/components/settings/PasswordTab';
import { MFATab } from '@/components/settings/MFATab';
import { DevicesTab } from '@/components/settings/DevicesTab';
import { AvatarTab } from '@/components/settings/AvatarTab';
import { SubscriptionsTab } from '@/components/settings/SubscriptionsTab';
import { BillingTab } from '@/components/settings/BillingTab';
import { AppSettingsTab } from '@/components/settings/AppSettingsTab';

type SettingsTabType =
  | 'profile' | 'password' | 'mfa' | 'devices' | 'avatar'
  | 'subscriptions' | 'billing' | 'app';

interface TabItem {
  id: SettingsTabType;
  label: string;
  icon: LucideIcon;
}

interface SidebarSection {
  label: string;
  tabs: TabItem[];
}

const SECTIONS: SidebarSection[] = [
  {
    label: 'Profile',
    tabs: [
      { id: 'profile', label: 'Profile', icon: User },
      { id: 'avatar', label: 'Avatar', icon: ImageIcon },
    ],
  },
  {
    label: 'Security',
    tabs: [
      { id: 'password', label: 'Password', icon: Lock },
      { id: 'mfa', label: 'Multi-Factor Auth', icon: ShieldCheck },
      { id: 'devices', label: 'Devices', icon: Monitor },
    ],
  },
  {
    label: 'App',
    tabs: [
      { id: 'app', label: 'App Settings', icon: Sliders },
    ],
  },
  {
    label: 'Payments',
    tabs: [
      { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
      { id: 'billing', label: 'Billing', icon: Receipt },
    ],
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { isAuthenticated, isAuthReady } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTabType>('profile');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, isAuthReady, navigate]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab onNavigateToAvatar={() => setActiveTab('avatar')} />;
      case 'avatar':
        return <AvatarTab />;
      case 'password':
        return <PasswordTab />;
      case 'mfa':
        return <MFATab />;
      case 'devices':
        return <DevicesTab />;
      case 'subscriptions':
        return <SubscriptionsTab />;
      case 'billing':
        return <BillingTab />;
      case 'app':
        return <AppSettingsTab />;
      default:
        return <ProfileTab />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />

      {sideMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-8">

          {/* ─── Sidebar ─────────────────────────────────────────── */}
          <nav className="md:w-56 shrink-0">
            {/* Mobile: horizontal scroll strip */}
            <div className="flex md:hidden gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
              {SECTIONS.flatMap((s) => s.tabs).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap',
                      'border transition-colors duration-150',
                      active
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Desktop: vertical nav */}
            <div className="hidden md:flex flex-col gap-px rounded border border-border bg-card/50 p-1.5 backdrop-blur-sm">
              {SECTIONS.map((section, idx) => (
                <div key={section.label}>
                  {idx > 0 && <div className="h-px bg-border/60 mx-2 my-1.5" />}

                  <p className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40 select-none">
                    {section.label}
                  </p>

                  {section.tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          'group relative flex items-center gap-2.5 w-full px-2.5 py-[7px] text-[13px] rounded',
                          'transition-all duration-150 ease-out',
                          active
                            ? 'bg-primary/10 text-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-normal',
                        )}
                      >
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-colors duration-150',
                            active ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-muted-foreground',
                          )}
                        />
                        {tab.label}
                        {/* Right edge accent */}
                        {active && (
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-l" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </nav>

          {/* ─── Tab Content ──────────────────────────────────────── */}
          <main className="flex-1 min-w-0" style={{ '--radius': '0.375rem' } as React.CSSProperties}>
            <div key={activeTab} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
              {renderTabContent()}
            </div>
          </main>

        </div>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
