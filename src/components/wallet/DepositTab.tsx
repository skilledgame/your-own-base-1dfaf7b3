/**
 * DepositTab - Deposit content for the wallet modal
 * 
 * Handles crypto deposit flow with amount selection, 
 * crypto type selection, and payment details.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Bitcoin, Loader2, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

// Predefined amounts
const AMOUNT_OPTIONS = [10, 25, 50, 100, 250, 500];

// Crypto options
const CRYPTO_OPTIONS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', icon: '₿' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', icon: 'Ξ' },
  { id: 'usdttrc20', name: 'USDT (TRC20)', symbol: 'USDT', icon: '₮' },
  { id: 'usdterc20', name: 'USDT (ERC20)', symbol: 'USDT', icon: '₮' },
  { id: 'ltc', name: 'Litecoin', symbol: 'LTC', icon: 'Ł' },
  { id: 'sol', name: 'Solana', symbol: 'SOL', icon: '◎' },
];

interface PaymentDetails {
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  orderId: string;
  paymentId: string;
  expiresAt: string;
}

export function DepositTab() {
  const { user } = useAuth();
  const [step, setStep] = useState<'amount' | 'crypto' | 'payment'>('amount');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [copied, setCopied] = useState(false);

  const finalAmount = selectedAmount || (customAmount ? parseFloat(customAmount) : 0);

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const handleContinueToPayment = async () => {
    if (!user?.id || !selectedCrypto || !finalAmount) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          amountUsd: finalAmount,
          cryptoCurrency: selectedCrypto,
        },
      });

      if (error) throw error;

      if (data?.payAddress) {
        setPaymentDetails({
          payAddress: data.payAddress,
          payAmount: data.payAmount,
          payCurrency: data.payCurrency,
          orderId: data.orderId,
          paymentId: data.paymentId,
          expiresAt: data.expiresAt,
        });
        setStep('payment');
      } else {
        throw new Error('Invalid payment response');
      }
    } catch (error: any) {
      console.error('[DepositTab] Payment creation error:', error);
      toast({
        title: 'Payment Error',
        description: error.message || 'Failed to create payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!paymentDetails?.payAddress) return;
    
    try {
      await navigator.clipboard.writeText(paymentDetails.payAddress);
      setCopied(true);
      toast({ title: 'Address copied!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const handleBack = () => {
    if (step === 'crypto') {
      setStep('amount');
    } else if (step === 'payment') {
      setStep('crypto');
      setPaymentDetails(null);
    }
  };

  // Step 1: Amount Selection
  if (step === 'amount') {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-slate-300 text-sm mb-2 block">Select Amount (USD)</Label>
          <div className="grid grid-cols-3 gap-2">
            {AMOUNT_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => handleAmountSelect(amount)}
                className={cn(
                  "py-2.5 px-3 rounded-lg font-semibold text-base transition-all",
                  "border",
                  selectedAmount === amount
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : "bg-slate-800/50 border-slate-600/50 text-slate-200 hover:border-slate-500"
                )}
              >
                ${amount}
              </button>
            ))}
          </div>
          {/* Conversion hint */}
          <p className="text-slate-500 text-xs mt-2 text-center">
            1 USD = 100 Skilled Coins
          </p>
        </div>

        <div>
          <Label className="text-slate-300 text-sm mb-1.5 block">Or enter custom amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
            <Input
              type="number"
              placeholder="0.00"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              className="pl-7 bg-slate-800/50 border-slate-600/50 text-white h-10"
              min={1}
            />
          </div>
        </div>

        {/* Summary */}
        {finalAmount > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700/50">
            <p className="text-slate-400 text-xs">You'll receive</p>
            <p className="text-xl font-bold text-emerald-400">{(finalAmount * 100).toLocaleString()} SC</p>
          </div>
        )}

        <Button
          onClick={() => setStep('crypto')}
          disabled={!finalAmount || finalAmount < 1}
          className="w-full h-10 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-semibold"
        >
          Continue - ${finalAmount || 0}
        </Button>
      </div>
    );
  }

  // Step 2: Crypto Selection
  if (step === 'crypto') {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-2"
        >
          ← Back to amount
        </button>

        <Label className="text-slate-300 text-sm block">Select Cryptocurrency</Label>
        
        <div className="grid grid-cols-2 gap-3">
          {CRYPTO_OPTIONS.map((crypto) => (
            <button
              key={crypto.id}
              onClick={() => setSelectedCrypto(crypto.id)}
              className={cn(
                "p-4 rounded-xl transition-all text-left",
                "border-2",
                selectedCrypto === crypto.id
                  ? "bg-emerald-500/20 border-emerald-500"
                  : "bg-slate-800/50 border-slate-600/50 hover:border-slate-500"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{crypto.icon}</span>
                <div>
                  <div className="font-semibold text-white">{crypto.symbol}</div>
                  <div className="text-xs text-slate-400">{crypto.name}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <Button
          onClick={handleContinueToPayment}
          disabled={!selectedCrypto || loading}
          className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Creating Payment...
            </>
          ) : (
            `Pay ${finalAmount} USD with ${CRYPTO_OPTIONS.find(c => c.id === selectedCrypto)?.symbol || 'Crypto'}`
          )}
        </Button>
      </div>
    );
  }

  // Step 3: Payment Details
  if (step === 'payment' && paymentDetails) {
    return (
      <div className="space-y-5">
        <button
          onClick={handleBack}
          className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
        >
          ← Change payment method
        </button>

        <div className="text-center">
          <div className="text-slate-400 text-xs mb-1">Send exactly</div>
          <div className="text-xl font-bold text-white">
            {paymentDetails.payAmount} {paymentDetails.payCurrency.toUpperCase()}
          </div>
          <div className="text-slate-400 text-xs">≈ ${finalAmount} USD → {(finalAmount * 100).toLocaleString()} SC</div>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={paymentDetails.payAddress} size={160} />
          </div>
        </div>

        {/* Address */}
        <div>
          <Label className="text-slate-400 text-xs mb-1 block">Payment Address</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={paymentDetails.payAddress}
              className="bg-slate-800/50 border-slate-600/50 text-white text-xs font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyAddress}
              className="border-slate-600/50 hover:bg-slate-700"
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
          <p className="text-amber-400 text-sm">
            ⏱ Waiting for payment confirmation...
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Coins will be credited automatically once confirmed
          </p>
        </div>
      </div>
    );
  }

  return null;
}
