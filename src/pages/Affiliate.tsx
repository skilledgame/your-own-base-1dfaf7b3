import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Copy, Check, Users, Coins, ArrowLeft, Share2, TrendingUp, 
  Gift, Zap, Clock, Trophy, Youtube, MessageCircle, HelpCircle,
  DollarSign, Target, Sparkles, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LogoLink } from '@/components/LogoLink';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function Affiliate() {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthReady, isAuthenticated, navigate]);

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
        // User cancelled
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

  const stats = {
    totalReferred: 0,
    activeReferrals: 0,
    pendingEarnings: 0,
    totalEarnings: 0,
    conversionRate: 0,
  };

  const commissionTiers = [
    { tier: 'Starter', referrals: '1-10', rate: '10%', bonus: '100 SC per referral' },
    { tier: 'Partner', referrals: '11-50', rate: '15%', bonus: '150 SC per referral' },
    { tier: 'Elite', referrals: '51-100', rate: '20%', bonus: '200 SC per referral' },
    { tier: 'Legend', referrals: '100+', rate: '25%', bonus: '300 SC per referral' },
  ];

  const advantages = [
    { icon: Zap, title: 'Instant Payouts', description: 'Earnings credited immediately to your account' },
    { icon: Clock, title: 'Lifetime Earnings', description: 'Earn from your referrals forever, not just once' },
    { icon: TrendingUp, title: 'Tiered Commissions', description: 'Higher rates as you refer more players' },
    { icon: Gift, title: 'Bonus Rewards', description: 'Extra Skilled Coins for milestone achievements' },
  ];

  const faqs = [
    { q: 'How do I earn from referrals?', a: 'Share your unique link. When someone signs up and plays, you earn Skilled Coins plus a percentage of their wagers.' },
    { q: 'When do I get paid?', a: 'Earnings are credited instantly to your Skilled Coins balance after your referral completes their first game.' },
    { q: 'Is there a limit to referrals?', a: 'No limit! Refer as many players as you want and earn from all of them.' },
    { q: 'How long do referral earnings last?', a: 'Lifetime! You continue earning a percentage from all your referrals\' activity forever.' },
    { q: 'Can I track my referrals?', a: 'Yes, the Network tab shows all your referrals, their status, and your earnings from each.' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <LogoLink className="h-8" />
          <div className="ml-auto flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold">Partner Program</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Navigation */}
          <TabsList className="w-full justify-start bg-card border border-border rounded-xl p-1 mb-6 overflow-x-auto flex-nowrap">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="network" className="flex items-center gap-2 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Your Network</span>
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex items-center gap-2 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Earnings</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center gap-2 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Resources</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column - Stats & Link */}
              <div className="space-y-6">
                {/* Hero Card */}
                <div className="bg-gradient-to-br from-emerald-500/10 via-card to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Skilled Partner Program</h2>
                      <p className="text-sm text-muted-foreground">Earn while you grow our community</p>
                    </div>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-400">{stats.totalReferred}</p>
                      <p className="text-xs text-muted-foreground">Referrals</p>
                    </div>
                    <div className="text-center border-x border-border">
                      <p className="text-2xl font-bold text-cyan-400">{stats.totalEarnings}</p>
                      <p className="text-xs text-muted-foreground">SC Earned</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-400">{stats.conversionRate}%</p>
                      <p className="text-xs text-muted-foreground">Conv. Rate</p>
                    </div>
                  </div>

                  {/* Invite Link */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-muted-foreground">Your Referral Link</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-background/50 border border-border rounded-lg px-4 py-3 font-mono text-sm truncate">
                        {inviteLink}
                      </div>
                      <Button
                        onClick={handleCopy}
                        size="icon"
                        className="shrink-0 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <Button
                      onClick={handleShare}
                      variant="outline"
                      className="w-full border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share with Friends
                    </Button>
                  </div>
                </div>

                {/* Advantages Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {advantages.map((adv, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-4 hover:border-emerald-500/30 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                        <adv.icon className="w-5 h-5 text-emerald-400" />
                      </div>
                      <h4 className="font-semibold text-sm mb-1">{adv.title}</h4>
                      <p className="text-xs text-muted-foreground">{adv.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - Video */}
              <div className="space-y-6">
                {/* YouTube Video Embed */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-emerald-900/20 to-cyan-900/20 flex items-center justify-center relative">
                    {/* Placeholder for YouTube embed */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                      <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center mb-4 shadow-lg shadow-red-600/30">
                        <Youtube className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">How the Partner Program Works</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Watch our quick guide on maximizing your referral earnings
                      </p>
                      <Button className="mt-4 bg-red-600 hover:bg-red-500">
                        <Youtube className="w-4 h-4 mr-2" />
                        Watch Video
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 border-t border-border">
                    <h4 className="font-semibold mb-1">Skilled Partner Program Explained</h4>
                    <p className="text-sm text-muted-foreground">Learn how to earn Skilled Coins by growing our gaming community</p>
                  </div>
                </div>

                {/* Current Tier */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Your Partner Tier</h3>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">Starter</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current Rate</span>
                      <span className="font-medium">10% Commission</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sign-up Bonus</span>
                      <span className="font-medium text-emerald-400">100 SC / referral</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" />
                    </div>
                    <p className="text-xs text-muted-foreground">Refer 1 more player to unlock Partner tier (15% commission)</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Network Tab */}
          <TabsContent value="network" className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold">Your Referral Network</h3>
                  <p className="text-sm text-muted-foreground">Track all players who joined through your link</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-emerald-400">{stats.totalReferred}</span>
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
              </div>

              {stats.totalReferred === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h4 className="font-semibold mb-2">No referrals yet</h4>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                    Share your invite link to start building your network and earning rewards!
                  </p>
                  <Button onClick={handleShare} className="bg-gradient-to-r from-emerald-500 to-cyan-500">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Your Link
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Referral list would go here */}
                </div>
              )}
            </div>

            {/* Network Stats */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <Users className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.activeReferrals}</p>
                <p className="text-sm text-muted-foreground">Active Players</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Games Played</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <Coins className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Total Wagered</p>
              </div>
            </div>
          </TabsContent>

          {/* Earnings Tab */}
          <TabsContent value="earnings" className="space-y-6">
            {/* Earnings Overview */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                <Coins className="w-6 h-6 text-emerald-400 mb-2" />
                <p className="text-2xl font-bold">{stats.totalEarnings}</p>
                <p className="text-sm text-muted-foreground">Total Earned</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <Clock className="w-6 h-6 text-amber-400 mb-2" />
                <p className="text-2xl font-bold">{stats.pendingEarnings}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <TrendingUp className="w-6 h-6 text-cyan-400 mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">This Month</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <Gift className="w-6 h-6 text-pink-400 mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Bonus Rewards</p>
              </div>
            </div>

            {/* Commission Tiers */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-2">Commission Tiers</h3>
              <p className="text-sm text-muted-foreground mb-6">Earn higher rates as you grow your network</p>
              
              <div className="space-y-3">
                {commissionTiers.map((tier, i) => (
                  <div 
                    key={tier.tier}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      i === 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted/30 border-border'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        i === 0 ? 'bg-emerald-500' : 'bg-muted'
                      }`}>
                        <Trophy className={`w-5 h-5 ${i === 0 ? 'text-white' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold">{tier.tier}</h4>
                        <p className="text-sm text-muted-foreground">{tier.referrals} referrals</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400">{tier.rate}</p>
                      <p className="text-xs text-muted-foreground">{tier.bonus}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Earnings History */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">Earnings History</h3>
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No earnings yet</p>
                <p className="text-sm text-muted-foreground">Start referring to see your earnings here</p>
              </div>
            </div>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* FAQ Section */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">FAQ</h3>
                    <p className="text-sm text-muted-foreground">Common questions answered</p>
                  </div>
                </div>
                
                <Accordion type="single" collapsible className="space-y-2">
                  {faqs.map((faq, i) => (
                    <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4">
                      <AccordionTrigger className="text-left text-sm hover:no-underline">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {/* Promo Materials */}
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Promotional Tools</h3>
                      <p className="text-sm text-muted-foreground">Assets to help you promote</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-between group">
                      <span>Social Media Templates</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    <Button variant="outline" className="w-full justify-between group">
                      <span>Banner Images</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    <Button variant="outline" className="w-full justify-between group">
                      <span>Video Content</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>

                {/* Need Help */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
                  <HelpCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <h4 className="font-bold mb-2">Need Help?</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Contact our partner support team for assistance
                  </p>
                  <Button className="bg-gradient-to-r from-emerald-500 to-cyan-500">
                    Contact Support
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
