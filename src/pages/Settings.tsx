/**
 * Settings Page - Collapsible sidebar with Account & Payments sections
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, X, ChevronDown } from 'lucide-react';
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

type SettingsTabType =
  | 'profile' | 'password' | 'mfa' | 'devices' | 'avatar'
  | 'subscriptions' | 'billing';

type SectionKey = 'account' | 'payments';

interface SidebarSection {
  key: SectionKey;
  label: string;
  tabs: { id: SettingsTabType; label: string }[];
}

const SECTIONS: SidebarSection[] = [
  {
    key: 'account',
    label: 'Account',
    tabs: [
      { id: 'profile', label: 'Profile' },
      { id: 'password', label: 'Password' },
      { id: 'mfa', label: 'Multi-Factor Auth' },
      { id: 'devices', label: 'Devices' },
    ],
  },
  {
    key: 'payments',
    label: 'Payments',
    tabs: [
      { id: 'subscriptions', label: 'Subscriptions' },
      { id: 'billing', label: 'Billing' },
    ],
  },
];

// Helper: find which section a tab belongs to
function getSectionForTab(tabId: SettingsTabType): SectionKey {
  for (const section of SECTIONS) {
    if (section.tabs.some(t => t.id === tabId)) return section.key;
  }
  return 'account';
}

export default function Settings() {
  const navigate = useNavigate();
  const { isAuthenticated, isAuthReady } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTabType>('profile');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['account']),
  );

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

  const toggleSection = (key: SectionKey) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleTabClick = (tabId: SettingsTabType) => {
    setActiveTab(tabId);
    // Auto-expand the section this tab belongs to
    const section = getSectionForTab(tabId);
    setExpandedSections(prev => {
      if (prev.has(section)) return prev;
      return new Set(prev).add(section);
    });
  };

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
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar — collapsible sections */}
          <nav className="md:w-56 shrink-0">
            <div className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              {SECTIONS.map((section) => {
                const isExpanded = expandedSections.has(section.key);
                const sectionHasActiveTab = section.tabs.some(t => t.id === activeTab);

                return (
                  <div key={section.key} className="contents md:block">
                    {/* Section toggle button */}
                    <button
                      onClick={() => toggleSection(section.key)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200',
                        'font-semibold text-sm',
                        sectionHasActiveTab && !isExpanded
                          ? 'bg-accent/10 text-accent'
                          : 'text-foreground hover:bg-muted/50',
                      )}
                    >
                      {section.label}
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 text-muted-foreground transition-transform duration-200',
                          isExpanded && 'rotate-180',
                        )}
                      />
                    </button>

                    {/* Collapsible sub-tabs */}
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-200',
                        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
                      )}
                    >
                      <div className="flex md:flex-col gap-0.5 pl-3 mt-0.5 mb-2">
                        {section.tabs.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id)}
                            className={cn(
                              'relative px-4 py-2 text-left text-sm font-medium rounded-lg',
                              'transition-all duration-200 whitespace-nowrap',
                              activeTab === tab.id
                                ? 'bg-accent/10 text-accent border-l-2 border-accent'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Tab Content */}
          <main className="flex-1 min-w-0">
            <div className="animate-slide-up">
              {renderTabContent()}
            </div>
          </main>
        </div>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
