/**
 * WithdrawalTab - Withdrawal content for the wallet modal
 * 
 * Handles crypto withdrawal flow with amount input,
 * wallet address, and crypto selection.
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowDownRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Crypto options for withdrawal
const CRYPTO_OPTIONS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', icon: '₿' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', icon: 'Ξ' },
  { id: 'usdttrc20', name: 'USDT (TRC20)', symbol: 'USDT', icon: '₮' },
  { id: 'ltc', name: 'Litecoin', symbol: 'LTC', icon: 'Ł' },
];

// Minimum withdrawal amount in USD
const MIN_WITHDRAWAL = 500;

export function WithdrawalTab() {
  const { user } = useAuth();
  const { balance, refresh } = useBalance();
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount >= MIN_WITHDRAWAL && numericAmount <= balance;
  const isFormValid = isValidAmount && walletAddress.trim().length > 10 && selectedCrypto;

  const handleWithdraw = async () => {
    if (!isFormValid || !user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-withdrawal', {
        body: {
          amount_sc: numericAmount,
          crypto_currency: selectedCrypto,
          wallet_address: walletAddress.trim(),
        },
      });

      if (error) {
        let serverMsg = error.message || 'Unknown error';
        try {
          if (error.context && typeof (error.context as any).json === 'function') {
            const errBody = await (error.context as any).json();
            serverMsg = errBody?.error || errBody?.message || JSON.stringify(errBody);
          }
        } catch (_) { /* context not readable */ }
        throw new Error(serverMsg);
      }

      if (data?.success) {
        setSubmitted(true);
        refresh(); // Refresh balance to reflect deduction
        toast({
          title: 'Withdrawal Requested',
          description: data.message || 'Your withdrawal is pending review.',
        });
      } else {
        throw new Error(data?.error || 'Failed to submit withdrawal');
      }
    } catch (error: any) {
      toast({
        title: 'Withdrawal Error',
        description: error.message || 'Failed to process withdrawal.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMaxAmount = () => {
    setAmount(balance.toString());
  };

  // Convert SC to USD (100 SC = 1 USD)
  const usdEquivalent = balance / 100;
  const withdrawalUsdValue = numericAmount / 100;

  // Success state after submitting
  if (submitted) {
    return (
      <div className="space-y-5 text-center py-6">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
        <h3 className="text-xl font-bold text-white">Withdrawal Submitted</h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto">
          Your withdrawal of {numericAmount.toLocaleString()} SC (${withdrawalUsdValue.toFixed(2)}) is now pending review. 
          You'll receive your crypto once approved.
        </p>
        <div className="bg-slate-800/50 rounded-xl p-3 text-sm space-y-1 max-w-xs mx-auto">
          <div className="flex justify-between text-slate-400">
            <span>Amount</span>
            <span className="text-white">{numericAmount.toLocaleString()} SC</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Currency</span>
            <span className="text-white">{CRYPTO_OPTIONS.find(c => c.id === selectedCrypto)?.symbol || selectedCrypto}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Status</span>
            <span className="text-yellow-400">Pending Review</span>
          </div>
        </div>
        <Button
          onClick={() => {
            setSubmitted(false);
            setAmount('');
            setWalletAddress('');
            setSelectedCrypto(null);
          }}
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          Submit Another Withdrawal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Balance Display */}
      <div className="bg-slate-800/50 rounded-xl p-4 text-center">
        <div className="text-slate-400 text-sm">Available Balance</div>
        <div className="text-2xl font-bold text-white">{balance.toLocaleString()} SC</div>
        <div className="text-slate-500 text-xs">≈ ${usdEquivalent.toFixed(2)} USD (100 SC = $1)</div>
      </div>

      {/* Amount Input */}
      <div>
        <Label className="text-slate-300 text-sm mb-2 block">Withdrawal Amount</Label>
        <div className="relative">
          <Input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-slate-800/50 border-slate-600/50 text-white h-12 text-lg pr-16"
            min={MIN_WITHDRAWAL}
            max={balance}
          />
          <button
            onClick={handleMaxAmount}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm font-medium hover:text-emerald-300"
          >
            MAX
          </button>
        </div>
        {amount && !isValidAmount && (
          <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {numericAmount < MIN_WITHDRAWAL 
              ? `Minimum withdrawal is ${MIN_WITHDRAWAL} SC`
              : 'Insufficient balance'}
          </p>
        )}
      </div>

      {/* Crypto Selection */}
      <div>
        <Label className="text-slate-300 text-sm mb-2 block">Select Cryptocurrency</Label>
        <div className="grid grid-cols-2 gap-2">
          {CRYPTO_OPTIONS.map((crypto) => (
            <button
              key={crypto.id}
              onClick={() => setSelectedCrypto(crypto.id)}
              className={cn(
                "p-3 rounded-xl transition-all text-left",
                "border-2",
                selectedCrypto === crypto.id
                  ? "bg-emerald-500/20 border-emerald-500"
                  : "bg-slate-800/50 border-slate-600/50 hover:border-slate-500"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{crypto.icon}</span>
                <span className="font-medium text-white text-sm">{crypto.symbol}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Wallet Address */}
      <div>
        <Label className="text-slate-300 text-sm mb-2 block">
          {selectedCrypto ? `${CRYPTO_OPTIONS.find(c => c.id === selectedCrypto)?.symbol || ''} ` : ''}Wallet Address
        </Label>
        <Input
          type="text"
          placeholder="Enter your wallet address"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          className="bg-slate-800/50 border-slate-600/50 text-white h-12 font-mono text-sm"
        />
      </div>

      {/* Withdrawal Info */}
      {numericAmount > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-3 space-y-2 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Withdrawal Amount</span>
            <span className="text-white">{numericAmount.toLocaleString()} SC</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>USD Value</span>
            <span className="text-white">${withdrawalUsdValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Network Fee</span>
            <span className="text-white">~$2.00</span>
          </div>
          <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-700/50">
            <span>You'll Receive</span>
            <span className="text-emerald-400 font-medium">
              ~${Math.max(0, withdrawalUsdValue - 2).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleWithdraw}
        disabled={!isFormValid || loading}
        className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-semibold"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          <>
            <ArrowDownRight className="w-5 h-5 mr-2" />
            Withdraw {amount ? `${amount} SC` : ''}
          </>
        )}
      </Button>
    </div>
  );
}
