/**
 * RedeemTab - Redeem promo codes and gift cards
 * 
 * Allows users to enter promotional codes for bonuses.
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ticket, Loader2, Gift, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function RedeemTab() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentRedemption, setRecentRedemption] = useState<{
    code: string;
    amount: number;
  } | null>(null);

  const isValidCode = code.trim().length >= 4;

  const handleRedeem = async () => {
    if (!isValidCode || !user?.id) return;

    setLoading(true);
    try {
      // TODO: Implement promo code redemption edge function
      // For now, show coming soon message
      toast({
        title: 'Promo Codes Coming Soon',
        description: 'The promo code system is being set up. Check back soon!',
      });
    } catch (error: any) {
      toast({
        title: 'Redemption Error',
        description: error.message || 'Invalid or expired code.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4 text-center">
        <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <h3 className="text-white font-semibold">Redeem Your Code</h3>
        <p className="text-slate-400 text-sm mt-1">
          Enter a promo code or gift card to claim your bonus
        </p>
      </div>

      {/* Recent Redemption Success */}
      {recentRedemption && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-emerald-300 font-medium">Code Redeemed!</p>
            <p className="text-slate-400 text-sm">
              +{recentRedemption.amount} SC added to your balance
            </p>
          </div>
        </div>
      )}

      {/* Code Input */}
      <div>
        <Label className="text-slate-300 text-sm mb-2 block">Enter Code</Label>
        <div className="relative">
          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            type="text"
            placeholder="PROMO-CODE-2024"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="pl-11 bg-slate-800/50 border-slate-600/50 text-white h-12 text-lg font-mono tracking-wider uppercase"
            maxLength={30}
          />
        </div>
      </div>

      {/* Redeem Button */}
      <Button
        onClick={handleRedeem}
        disabled={!isValidCode || loading}
        className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Validating...
          </>
        ) : (
          <>
            <Gift className="w-5 h-5 mr-2" />
            Redeem Code
          </>
        )}
      </Button>

      {/* Info Section */}
      <div className="space-y-3">
        <h4 className="text-slate-300 text-sm font-medium">Where to find codes?</h4>
        <ul className="text-slate-400 text-sm space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">•</span>
            <span>Follow us on social media for exclusive promo codes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">•</span>
            <span>Receive gift cards from friends</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">•</span>
            <span>Check your email for special offers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">•</span>
            <span>VIP members receive monthly bonus codes</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
