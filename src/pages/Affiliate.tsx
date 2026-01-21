import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Gift, Copy, Check, Users, Coins, ArrowLeft, Share2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LogoLink } from '@/components/LogoLink';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { toast } from 'sonner';

export default function Affiliate() {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthReady, isAuthenticated, navigate]);

  // Generate unique invite link based on user ID
  const inviteCode = user?.id?.slice(0, 8) || 'XXXXXX';
  const inviteLink = `${window.location.origin}/auth?ref=${inviteCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Skilled!',
          text: 'Play skill-based games and win real money. Use my invite link to get started!',
          url: inviteLink,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopy();
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Side Menu */}
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <LogoLink className="h-8" />
          <h1 className="text-lg font-semibold ml-auto">Affiliate Program</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 mb-6">
            <Gift className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Earn <span className="text-emerald-400">100 Skilled Coins</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            For every friend you invite who signs up and plays their first game
          </p>
        </div>

        {/* Your Invite Link */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Your Unique Invite Link
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background border border-border rounded-lg px-4 py-3 font-mono text-sm truncate">
              {inviteLink}
            </div>
            <Button
              onClick={handleCopy}
              className="shrink-0 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button
            onClick={handleShare}
            variant="outline"
            className="w-full mt-4"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share with Friends
          </Button>
        </div>

        {/* How It Works */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-6">How It Works</h3>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold">1</span>
              </div>
              <div>
                <h4 className="font-medium mb-1">Share Your Link</h4>
                <p className="text-sm text-muted-foreground">
                  Copy your unique invite link and share it with friends via social media, messaging apps, or email.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold">2</span>
              </div>
              <div>
                <h4 className="font-medium mb-1">Friend Signs Up</h4>
                <p className="text-sm text-muted-foreground">
                  When your friend clicks your link and creates an account, they're automatically linked to you.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold">3</span>
              </div>
              <div>
                <h4 className="font-medium mb-1">Friend Plays First Game</h4>
                <p className="text-sm text-muted-foreground">
                  Once your friend completes their first game (win or lose), you both get rewarded!
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-medium mb-1 text-emerald-400">Get 100 Skilled Coins!</h4>
                <p className="text-sm text-muted-foreground">
                  100 Skilled Coins are instantly credited to your account. Your friend also gets 50 bonus coins!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Friends Invited</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <Coins className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Coins Earned</p>
          </div>
        </div>

        {/* Terms */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Referral rewards are subject to our{' '}
            <Link to="/terms" className="text-primary hover:underline">
              Terms & Conditions
            </Link>
            . Abuse of the affiliate program may result in account suspension.
          </p>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
