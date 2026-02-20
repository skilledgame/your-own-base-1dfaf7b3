/**
 * Settings Page - Sidebar with Profile, Security, App & Payments section headers
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, X } from 'lucide-react';
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

interface SidebarSection {
  label: string;
  tabs: { id: SettingsTabType; label: string }[];
}

const SECTIONS: SidebarSection[] = [
  {
    label: 'Profile',
    tabs: [
      { id: 'profile', label: 'Profile' },
      { id: 'avatar', label: 'Avatar' },
    ],
  },
  {
    label: 'Security',
    tabs: [
      { id: 'password', label: 'Password' },
      { id: 'mfa', label: 'Multi-Factor Auth' },
      { id: 'devices', label: 'Devices' },
    ],
  },
  {
    label: 'App',
    tabs: [
      { id: 'app', label: 'App Settings' },
    ],
  },
  {
    label: 'Payments',
    tabs: [
      { id: 'subscriptions', label: 'Subscriptions' },
      { id: 'billing', label: 'Billing' },
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
          {/* Sidebar */}
          <nav className="md:w-52 shrink-0">
            <div className="flex md:flex-col gap-0.5 overflow-x-auto pb-2 md:pb-0 scrollbar-hide md:border-r md:border-border md:pr-4">
              {SECTIONS.map((section, idx) => (
                <div key={section.label} className="contents md:block">
                  {/* Spacer between sections */}
                  {idx > 0 && <div className="hidden md:block h-5" />}

                  {/* Section header */}
                  <p className="hidden md:block px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 select-none">
                    {section.label}
                  </p>

                  {/* Tabs */}
                  {section.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'group relative px-3 py-1.5 text-left text-sm rounded-md w-full',
                        'transition-colors duration-150 ease-out whitespace-nowrap',
                        activeTab === tab.id
                          ? 'text-foreground bg-muted/80 font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-normal',
                      )}
                    >
                      {/* Active indicator bar */}
                      <span
                        className={cn(
                          'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-sm',
                          'transition-all duration-200 ease-out',
                          activeTab === tab.id
                            ? 'h-4 bg-primary opacity-100'
                            : 'h-0 bg-primary opacity-0 group-hover:h-2 group-hover:opacity-40',
                        )}
                      />
                      {tab.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </nav>

          {/* Tab Content */}
          <main className="flex-1 min-w-0">
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
