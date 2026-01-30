/**
 * Offers Tab - Promotions, bonuses, referrals
 */

import { useState } from 'react';
import { Gift, Users, Percent, Copy, Clock, ChevronRight, Sparkles, Trophy, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Offer {
  id: string;
  title: string;
  description: string;
  value: string;
  expiresIn?: string;
  type: 'bonus' | 'referral' | 'tournament' | 'cashback';
  claimed: boolean;
}

export function OffersTab() {
  const { user } = useAuth();
  const referralCode = user?.id?.slice(0, 8).toUpperCase() || 'SKILLED';
  const referralLink = `https://playskilled.com/ref/${referralCode}`;

  const [offers] = useState<Offer[]>([
    {
      id: '1',
      title: 'Welcome Bonus',
      description: 'Get 100% match on your first deposit up to 1000 SC',
      value: '100% up to 1000 SC',
      type: 'bonus',
      claimed: false
    },
    {
      id: '2',
      title: 'Weekly Cashback',
      description: 'Get 5% back on all wagers every Monday',
      value: '5% Cashback',
      type: 'cashback',
      claimed: false
    },
    {
      id: '3',
      title: 'Weekend Tournament',
      description: 'Free entry to this weekend\'s 10,000 SC prize pool',
      value: 'Free Entry',
      expiresIn: '2 days',
      type: 'tournament',
      claimed: false
    }
  ]);

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success('Referral code copied!');
  };

  const getOfferIcon = (type: Offer['type']) => {
    switch (type) {
      case 'bonus': return Sparkles;
      case 'referral': return Users;
      case 'tournament': return Trophy;
      case 'cashback': return Percent;
      default: return Gift;
    }
  };

  const getOfferColor = (type: Offer['type']) => {
    switch (type) {
      case 'bonus': return 'from-yellow-500 to-orange-500';
      case 'referral': return 'from-blue-500 to-cyan-500';
      case 'tournament': return 'from-purple-500 to-pink-500';
      case 'cashback': return 'from-green-500 to-emerald-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Referral Program */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-primary to-accent" />
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
              <Users className="w-7 h-7 text-accent" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl font-bold">Invite & Earn</CardTitle>
              <CardDescription>Earn 10% of your friends' first deposit</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted-foreground mt-1">Referrals</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </div>
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-center">
              <p className="text-2xl font-bold text-accent">0 SC</p>
              <p className="text-xs text-muted-foreground mt-1">Earned</p>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Your Referral Code</label>
            <div className="flex items-center gap-2">
              <Input
                value={referralCode}
                readOnly
                className="bg-muted/50 border-border font-mono text-center text-lg font-bold tracking-wider"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={copyReferralCode}
                className="shrink-0 border-border hover:bg-muted"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Referral Link</label>
            <div className="flex items-center gap-2">
              <Input
                value={referralLink}
                readOnly
                className="bg-muted/50 border-border font-mono text-sm"
              />
              <Button 
                onClick={copyReferralLink}
                className="shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Offers */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Available Offers</CardTitle>
              <CardDescription>Claim your bonuses and promotions</CardDescription>
            </div>
            <Badge className="bg-accent/20 text-accent border-0">
              {offers.filter(o => !o.claimed).length} Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {offers.map((offer) => {
            const Icon = getOfferIcon(offer.type);
            const gradient = getOfferColor(offer.type);
            
            return (
              <div 
                key={offer.id}
                className="p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{offer.title}</p>
                      {offer.expiresIn && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {offer.expiresIn}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{offer.description}</p>
                    <p className="text-sm font-bold text-accent mt-2">{offer.value}</p>
                  </div>
                  <Button 
                    className="shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground"
                    onClick={() => toast.info('Coming soon!')}
                  >
                    Claim
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Deposit Bonus Progress */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Welcome Bonus Progress</CardTitle>
          <CardDescription>Wager to unlock your bonus</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="font-medium">Bonus Balance</span>
            </div>
            <span className="text-xl font-bold">0 SC</span>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-muted-foreground">Wagering Progress</span>
              <span>0 / 0 SC</span>
            </div>
            <Progress value={0} className="h-3" />
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground">
              💡 Wager your bonus amount 1x to convert it to withdrawable balance.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* VIP Perks */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Unlock VIP Perks</CardTitle>
              <CardDescription>Exclusive bonuses for VIP members</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            onClick={() => toast.info('VIP program coming soon!')}
          >
            <Trophy className="w-4 h-4 mr-2" />
            View VIP Benefits
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
