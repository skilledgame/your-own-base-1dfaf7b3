/**
 * Settings Page — redesigned sidebar with icons, sections, and polished UX
 * Uses the same site-wide header (logo, balance, user controls) as other pages.
 * Sidebar aligns under the logo, content aligns under the right-hand controls.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  User,
  ImageIcon,
  Lock,
  ShieldCheck,
  Monitor,
  Sliders,
  CreditCard,
  Receipt,
  Shield,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { LogoLink } from '@/components/LogoLink';
import { UserDropdown } from '@/components/UserDropdown';
import { FriendsButton } from '@/components/FriendsButton';
import { BalanceDepositPill } from '@/components/BalanceDepositPill';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { SkilledCoinsDisplay } from '@/components/SkilledCoinsDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletModal } from '@/contexts/WalletModalContext';
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
  const { isAuthenticated, isAuthReady, isPrivileged } = useAuth();
  const { openWallet } = useWalletModal();
  const [activeTab, setActiveTab] = useState<SettingsTabType>('profile');

  // Layout state — mirrors LandingPage / ChessHome pattern
  const [sideMenuOpen, setSideMenuOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

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
    <div className="min-h-screen bg-background overflow-x-hidden pb-16 md:pb-0">
      {/* Desktop Side Menu */}
      <DesktopSideMenu
        isOpen={sideMenuOpen}
        onToggle={() => setSideMenuOpen(!sideMenuOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        variant="black"
      />

      {/* Overlay for mobile only */}
      {sideMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      {/* Main content wrapper — pushes right on desktop when side menu opens */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${sideMenuOpen ? (sidebarCollapsed ? 'md:ml-16' : 'md:ml-72') : 'md:ml-0'}
        `}
      >
        {/* ─── Site Header (same as other pages) ──────────────────────── */}
        <header
          className={`
            fixed top-0 z-40 bg-background/95 backdrop-blur-xl
            transition-all duration-300 ease-out
            ${sideMenuOpen ? (sidebarCollapsed ? 'md:left-16 left-0 right-0' : 'md:left-72 left-0 right-0') : 'left-0 right-0'}
          `}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
            {/* Left: Logo */}
            <div className="flex items-center">
              <LogoLink className="h-12 sm:h-14" />
            </div>

            {/* Center: Balance + Deposit (only when authenticated) */}
            {isAuthenticated && (
              <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2">
                <BalanceDepositPill isPrivileged={isPrivileged} />
              </div>
            )}

            {/* Right: Auth/User controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isAuthenticated ? (
                <>
                  {isPrivileged && (
                    <Button variant="ghost" size="sm" asChild className="hidden sm:flex text-purple-400 hover:text-purple-300 hover:bg-purple-500/10">
                      <Link to="/admin">
                        <Shield className="w-4 h-4 mr-1" />
                        Admin
                      </Link>
                    </Button>
                  )}
                  {/* Search icon */}
                  <Button variant="ghost" size="icon" asChild className="hidden sm:flex text-muted-foreground hover:text-foreground">
                    <Link to="/search">
                      <Search className="w-5 h-5" />
                    </Link>
                  </Button>
                  {/* Notification bell */}
                  <div className="hidden sm:flex">
                    <NotificationDropdown />
                  </div>
                  {/* User dropdown */}
                  <div className="hidden sm:flex items-center">
                    <UserDropdown />
                  </div>
                  {/* Friends button */}
                  <div className="hidden sm:flex">
                    <FriendsButton />
                  </div>
                  {/* Mobile: Show balance pill */}
                  <div className="sm:hidden">
                    <button onClick={() => openWallet('deposit')}>
                      <SkilledCoinsDisplay size="sm" isPrivileged={isPrivileged} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/search">
                      <Search className="w-5 h-5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" asChild className="hidden sm:flex text-muted-foreground hover:text-foreground">
                    <Link to="/auth">Sign In</Link>
                  </Button>
                  <Button asChild className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0 font-semibold">
                    <Link to="/auth">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ─── Settings Content ───────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
          {/* Subtle lighter background box behind the entire settings area */}
          <div className="rounded-2xl bg-muted/15 border border-border/30 p-4 sm:p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 md:gap-10">

              {/* ─── Settings Sidebar (aligned under logo — left side) ──── */}
              <nav className="md:w-52 shrink-0">
                {/* Page title above sidebar on desktop */}
                <div className="hidden md:flex items-center gap-2.5 mb-4">
                  <SettingsIcon className="w-5 h-5 text-muted-foreground" />
                  <h1 className="text-xl font-bold">Settings</h1>
                </div>

                {/* Mobile: page title + horizontal scroll strip */}
                <div className="md:hidden mb-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <SettingsIcon className="w-5 h-5 text-muted-foreground" />
                    <h1 className="text-xl font-bold">Settings</h1>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
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
                </div>

                {/* Desktop: vertical nav — in-page, not scrollable */}
                <div className="hidden md:flex flex-col gap-px rounded-lg border border-border bg-card/50 p-2 backdrop-blur-sm">
                  {SECTIONS.map((section, idx) => (
                    <div key={section.label}>
                      {idx > 0 && <div className="h-px bg-border/60 mx-2 my-2.5" />}

                      <p className="px-2.5 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40 select-none">
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
                              'group relative flex items-center gap-2.5 w-full px-2.5 py-2.5 text-[13px] rounded-md',
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
                              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-primary rounded-l" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* Spacer to extend sidebar visually */}
                  <div className="flex-1 min-h-[10rem]" />
                </div>
              </nav>

              {/* ─── Tab Content (aligned right — under user controls) ──── */}
              <main className="flex-1 min-w-0" style={{ '--radius': '0.375rem' } as React.CSSProperties}>
                <div key={activeTab} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  {renderTabContent()}
                </div>
              </main>

            </div>
          </div>
        </div>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
