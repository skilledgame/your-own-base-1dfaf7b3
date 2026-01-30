/**
 * Settings Page - Full Account Settings with Multiple Tabs
 * 
 * Tabs: Account, Security, Preferences, API, Verification, Offers
 * Styled uniquely for Skilled with clean dark theme and green accents
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { useAuth } from '@/contexts/AuthContext';
import skilledLogo from '@/assets/skilled-logo.png';

// Tab Components
import { AccountTab } from '@/components/settings/AccountTab';
import { SecurityTab } from '@/components/settings/SecurityTab';
import { PreferencesTab } from '@/components/settings/PreferencesTab';
import { APITab } from '@/components/settings/APITab';
import { VerificationTab } from '@/components/settings/VerificationTab';
import { OffersTab } from '@/components/settings/OffersTab';

type SettingsTabType = 'account' | 'security' | 'preferences' | 'api' | 'verification' | 'offers';

const TABS: { id: SettingsTabType; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'api', label: 'API' },
  { id: 'verification', label: 'Verification' },
  { id: 'offers', label: 'Offers' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTabType>('account');
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
      case 'account':
        return <AccountTab />;
      case 'security':
        return <SecurityTab />;
      case 'preferences':
        return <PreferencesTab />;
      case 'api':
        return <APITab />;
      case 'verification':
        return <VerificationTab />;
      case 'offers':
        return <OffersTab />;
      default:
        return <AccountTab />;
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
          {/* Sidebar Tabs */}
          <nav className="md:w-56 shrink-0">
            <div className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    relative px-4 py-2.5 text-left font-medium rounded-lg
                    transition-all duration-200 whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'bg-accent/10 text-accent border-l-2 md:border-l-2 border-b-2 md:border-b-0 border-accent'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
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
