/**
 * GiftTab - Send Skilled Coins to another user
 * 
 * Allows users to gift coins to friends by username.
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/hooks/useBalance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Gift, Loader2, AlertCircle, Search, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Minimum gift amount
const MIN_GIFT = 5;

export function GiftTab() {
  const { user } = useAuth();
  const { balance } = useBalance();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchingUser, setSearchingUser] = useState(false);
  const [recipientFound, setRecipientFound] = useState<boolean | null>(null);

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount >= MIN_GIFT && numericAmount <= balance;
  const isFormValid = isValidAmount && recipient.trim().length > 0 && recipientFound === true;

  const handleSearchUser = async () => {
    if (!recipient.trim()) return;
    
    setSearchingUser(true);
    try {
      // TODO: Implement user search via edge function
      // For now, simulate search
      await new Promise(resolve => setTimeout(resolve, 500));
      // Simulate: user found if recipient is at least 3 chars
      setRecipientFound(recipient.trim().length >= 3);
    } catch (error) {
      setRecipientFound(false);
    } finally {
      setSearchingUser(false);
    }
  };

  const handleSendGift = async () => {
    if (!isFormValid || !user?.id) return;

    setLoading(true);
    try {
      // TODO: Implement gift transfer edge function
      toast({
        title: 'Gift Feature Coming Soon',
        description: 'The gift feature is currently being developed. Stay tuned!',
      });
    } catch (error: any) {
      toast({
        title: 'Gift Error',
        description: error.message || 'Failed to send gift.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Info Banner */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex items-start gap-3">
        <Gift className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-purple-300 font-medium text-sm">Send Skilled Coins</p>
          <p className="text-slate-400 text-xs mt-1">
            Gift coins to friends and fellow players. The recipient will be notified instantly.
          </p>
        </div>
      </div>

      {/* Available Balance */}
      <div className="bg-slate-800/50 rounded-xl p-3 flex justify-between items-center">
        <span className="text-slate-400 text-sm">Your Balance</span>
        <span className="text-white font-semibold">{balance.toLocaleString()} SC</span>
      </div>

      {/* Recipient Search */}
      <div>
        <Label className="text-slate-300 text-sm mb-2 block">Recipient Username</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Enter username"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setRecipientFound(null);
              }}
              className="pl-10 bg-slate-800/50 border-slate-600/50 text-white h-11"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleSearchUser}
            disabled={!recipient.trim() || searchingUser}
            className="border-slate-600/50 hover:bg-slate-700"
          >
            {searchingUser ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
        {recipientFound === true && (
          <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
            ✓ User found
          </p>
        )}
        {recipientFound === false && (
          <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            User not found
          </p>
        )}
      </div>

      {/* Amount */}
      <div>
        <Label className="text-slate-300 text-sm mb-2 block">Gift Amount</Label>
        <Input
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-slate-800/50 border-slate-600/50 text-white h-11"
          min={MIN_GIFT}
          max={balance}
        />
        {amount && !isValidAmount && (
          <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {numericAmount < MIN_GIFT 
              ? `Minimum gift is ${MIN_GIFT} SC`
              : 'Insufficient balance'}
          </p>
        )}
      </div>

      {/* Optional Message */}
      <div>
        <Label className="text-slate-300 text-sm mb-2 block">Message (Optional)</Label>
        <Textarea
          placeholder="Add a personal message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="bg-slate-800/50 border-slate-600/50 text-white resize-none h-20"
          maxLength={200}
        />
        <p className="text-slate-500 text-xs mt-1 text-right">{message.length}/200</p>
      </div>

      {/* Send Button */}
      <Button
        onClick={handleSendGift}
        disabled={!isFormValid || loading}
        className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-semibold"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Sending...
          </>
        ) : (
          <>
            <Gift className="w-5 h-5 mr-2" />
            Send Gift {amount ? `(${amount} SC)` : ''}
          </>
        )}
      </Button>
    </div>
  );
}
