import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Wallet, AlertTriangle, Clock, CheckCircle2, XCircle, Coins, Info } from 'lucide-react';
import skilledLogo from '@/assets/skilled-logo.png';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { User } from '@supabase/supabase-js';

interface WithdrawalHistory {
  id: string;
  amount: number;
  method: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  walletAddress?: string;
}

// Mock withdrawal history
const mockHistory: WithdrawalHistory[] = [
  { id: '1', amount: 500, method: 'Bitcoin', status: 'completed', createdAt: new Date(Date.now() - 86400000 * 2), walletAddress: '1A2b3C...' },
  { id: '2', amount: 1000, method: 'Ethereum', status: 'pending', createdAt: new Date(Date.now() - 86400000), walletAddress: '0x1234...' },
];

export default function Withdraw() {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<WithdrawalHistory[]>(mockHistory);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate('/auth');
      } else {
        setUser(session.user);
        fetchBalance(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchBalance = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('skilled_coins').eq('user_id', userId).maybeSingle();
    if (data) {
      setBalance(data.skilled_coins);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const withdrawAmount = parseInt(amount);
    
    if (!withdrawAmount || withdrawAmount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid amount',
        description: 'Please enter a valid withdrawal amount.',
      });
      return;
    }

    if (withdrawAmount > balance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient balance',
        description: 'You cannot withdraw more than your current balance.',
      });
      return;
    }

    if (withdrawAmount < 100) {
      toast({
        variant: 'destructive',
        title: 'Minimum not met',
        description: 'Minimum withdrawal amount is 100 tokens.',
      });
      return;
    }

    if (!method) {
      toast({
        variant: 'destructive',
        title: 'Select method',
        description: 'Please select a withdrawal method.',
      });
      return;
    }

    if (!walletAddress.trim()) {
      toast({
        variant: 'destructive',
        title: 'Enter wallet address',
        description: 'Please enter your wallet address.',
      });
      return;
    }

    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      const newWithdrawal: WithdrawalHistory = {
        id: Date.now().toString(),
        amount: withdrawAmount,
        method,
        status: 'pending',
        createdAt: new Date(),
        walletAddress: walletAddress.slice(0, 8) + '...',
      };

      setHistory([newWithdrawal, ...history]);
      setBalance((prev) => prev - withdrawAmount);
      setAmount('');
      setWalletAddress('');
      setLoading(false);

      toast({
        title: 'Withdrawal submitted',
        description: 'Your withdrawal request is being processed.',
      });
    }, 1500);
  };

  const getStatusIcon = (status: WithdrawalHistory['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const getStatusText = (status: WithdrawalHistory['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <Link to="/">
            <img src={skilledLogo} alt="Skilled" className="h-8" />
          </Link>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
              <div className="flex items-center gap-2">
                <Coins className="w-6 h-6 text-yellow-500" />
                <span className="text-3xl font-bold text-foreground">{balance.toLocaleString()}</span>
                <span className="text-muted-foreground">tokens</span>
              </div>
            </div>
            <Wallet className="w-12 h-12 text-primary/50" />
          </div>
        </div>

        {/* Withdrawal Form */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Withdraw Tokens
          </h2>

          <form onSubmit={handleWithdraw} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount to Withdraw</Label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10"
                  min="100"
                  max={balance}
                />
              </div>
              <p className="text-xs text-muted-foreground">Minimum: 100 tokens</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Withdrawal Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select crypto wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bitcoin">Bitcoin (BTC)</SelectItem>
                  <SelectItem value="ethereum">Ethereum (ETH)</SelectItem>
                  <SelectItem value="usdt">USDT (TRC-20)</SelectItem>
                  <SelectItem value="usdc">USDC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet">Wallet Address</Label>
              <Input
                id="wallet"
                type="text"
                placeholder="Enter your wallet address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Important</p>
                <ul className="text-muted-foreground space-y-1 text-xs">
                  <li>• Withdrawals are processed within 24-48 hours</li>
                  <li>• Double-check your wallet address before submitting</li>
                  <li>• Minimum withdrawal: 100 tokens</li>
                  <li>• Network fees may apply</li>
                </ul>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : 'Submit Withdrawal'}
            </Button>
          </form>
        </div>

        {/* Withdrawal History */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Withdrawal History
          </h3>

          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No withdrawal history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <p className="font-medium text-foreground">{item.amount} tokens</p>
                      <p className="text-xs text-muted-foreground">
                        {item.method} • {item.walletAddress}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      item.status === 'completed' ? 'text-emerald-500' :
                      item.status === 'pending' ? 'text-yellow-500' :
                      'text-destructive'
                    }`}>
                      {getStatusText(item.status)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
