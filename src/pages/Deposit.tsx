import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import skilledLogo from '@/assets/skilled-logo.png';
import { 
  ArrowLeft, 
  Loader2, 
  Coins, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Wallet,
  Shield,
  Copy,
  RefreshCw,
  LogIn
} from 'lucide-react';
import { User, Session } from '@supabase/supabase-js';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { QRCodeSVG } from 'qrcode.react';

interface Transaction {
  id: string;
  payment_id: string;
  order_id: string;
  amount_usd: number;
  crypto_currency: string;
  skilled_coins_credited: number;
  status: string;
  created_at: string;
}

interface PaymentDetails {
  payment_id: string;
  invoice_url: string;
  order_id: string;
  amount_usd: number;
  skilled_coins: number;
}

interface PaymentError {
  error: string;
  code?: string;
  message?: string;
  details?: string;
}

const DEPOSIT_AMOUNTS = [
  { usd: 10, coins: 1000 },
  { usd: 25, coins: 2500, popular: true },
  { usd: 50, coins: 5000 },
  { usd: 100, coins: 10000 },
  { usd: 250, coins: 25000 },
  { usd: 500, coins: 50000 },
];

const CRYPTO_OPTIONS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', icon: '₿' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', icon: 'Ξ' },
  { id: 'usdttrc20', name: 'USDT (TRC20)', symbol: 'USDT', icon: '₮' },
  { id: 'usdterc20', name: 'USDT (ERC20)', symbol: 'USDT', icon: '₮' },
  { id: 'usdcsol', name: 'USDC (Solana)', symbol: 'USDC', icon: '$' },
];

export default function Deposit() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchBalance();
      fetchTransactions();
    }
  }, [user]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      toast({
        title: 'Payment initiated!',
        description: 'Your payment is being processed. Coins will be credited once confirmed.',
      });
      // Refresh balance and transactions
      if (user) {
        fetchBalance();
        fetchTransactions();
      }
    } else if (status === 'cancelled') {
      toast({
        variant: 'destructive',
        title: 'Payment cancelled',
        description: 'Your payment was cancelled.',
      });
    }
  }, [searchParams, toast, user]);

  const fetchBalance = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('skilled_coins')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data && !error) {
      setBalance(data.skilled_coins);
    }
  };

  const fetchTransactions = async () => {
    if (!session) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-transactions', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.transactions) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const handleDeposit = async () => {
    if (!selectedAmount || !selectedCrypto) return;

    // Clear previous errors and payment details
    setErrorMessage(null);
    setPaymentDetails(null);

    // Check if user is logged in
    if (!session) {
      setErrorMessage('Please log in to make a deposit.');
      toast({
        variant: 'destructive',
        title: 'Login required',
        description: 'You must be logged in to deposit coins.',
      });
      return;
    }

    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          amount_usd: selectedAmount,
          crypto_currency: selectedCrypto,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create payment');
      }

      // Check if response contains an error
      if (data?.error) {
        const paymentError = data as PaymentError;
        const errorMsg = paymentError.message || paymentError.details || paymentError.error;
        
        // Handle specific error codes
        if (paymentError.code === 'MISSING_AUTH' || paymentError.code === 'INVALID_TOKEN') {
          setErrorMessage('Your session has expired. Please log in again.');
          toast({
            variant: 'destructive',
            title: 'Session expired',
            description: 'Please log in again to continue.',
          });
          navigate('/auth');
          return;
        }
        
        throw new Error(errorMsg);
      }

      if (data?.invoice_url) {
        setPaymentDetails(data as PaymentDetails);
        toast({
          title: 'Payment invoice created!',
          description: 'Complete your payment using the details below.',
        });
        // Refresh transactions after a delay
        setTimeout(fetchTransactions, 2000);
      } else {
        throw new Error('No payment details received');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create payment';
      setErrorMessage(message);
      toast({
        variant: 'destructive',
        title: 'Payment error',
        description: message,
      });
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  const resetPayment = () => {
    setPaymentDetails(null);
    setErrorMessage(null);
    setSelectedAmount(null);
    setSelectedCrypto(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'underpaid':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getCryptoName = (id: string) => {
    return CRYPTO_OPTIONS.find(c => c.id === id)?.name || id.toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />
        
        {sideMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSideMenuOpen(false)}
          />
        )}

        <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <Link to="/">
              <img src={skilledLogo} alt="Skilled" className="h-8" />
            </Link>
            <div className="w-24" />
          </div>
        </header>

        <main className="max-w-md mx-auto p-6 mt-20">
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Login Required</h1>
              <p className="text-muted-foreground">
                Please log in or create an account to deposit Skilled Coins.
              </p>
            </div>
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => navigate('/auth')}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Log In to Continue
            </Button>
          </div>
        </main>

        <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
      </div>
    );
  }

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
      <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <Link to="/">
            <img src={skilledLogo} alt="Skilled" className="h-8" />
          </Link>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold">{balance.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Deposit Skilled Coins</h1>
          <p className="text-muted-foreground">Purchase coins to enter skill-based tournaments</p>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your Balance</p>
              <div className="flex items-center gap-3">
                <Coins className="w-8 h-8 text-yellow-500" />
                <span className="text-4xl font-bold text-foreground">{balance.toLocaleString()}</span>
                <span className="text-xl text-muted-foreground">Skilled Coins</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { fetchBalance(); fetchTransactions(); }}
                title="Refresh balance"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
              <Wallet className="w-12 h-12 text-primary/30" />
            </div>
          </div>
        </div>

        {/* Payment Details (shown after invoice created) */}
        {paymentDetails && (
          <div className="bg-card border-2 border-primary rounded-2xl p-6 space-y-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
              <h2 className="text-xl font-bold text-foreground">Payment Invoice Created!</h2>
              <p className="text-muted-foreground">Complete your payment using the details below</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG 
                  value={paymentDetails.invoice_url} 
                  size={180}
                  level="H"
                />
              </div>
            </div>

            {/* Payment Info */}
            <div className="space-y-3">
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                <p className="font-semibold text-foreground">
                  ${paymentDetails.amount_usd} USD → {paymentDetails.skilled_coins.toLocaleString()} Skilled Coins
                </p>
              </div>
              
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Order ID</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm text-foreground truncate">{paymentDetails.order_id}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(paymentDetails.order_id, 'Order ID')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                onClick={() => window.open(paymentDetails.invoice_url, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Payment Page
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={resetPayment}
              >
                New Deposit
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Your coins will be credited automatically once the payment is confirmed.
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && !paymentDetails && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Payment Error</p>
                <p className="text-sm text-destructive/80">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Deposit Form (hidden when payment details are shown) */}
        {!paymentDetails && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
            {/* Step 1: Select Amount */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
                Select Amount
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DEPOSIT_AMOUNTS.map((option) => (
                  <button
                    key={option.usd}
                    onClick={() => setSelectedAmount(option.usd)}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      selectedAmount === option.usd
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 bg-secondary/50'
                    }`}
                  >
                    {option.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-xs font-semibold bg-primary text-primary-foreground rounded-full">
                        Popular
                      </span>
                    )}
                    <div className="text-2xl font-bold text-foreground">${option.usd}</div>
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <Coins className="w-4 h-4 text-yellow-500" />
                      {option.coins.toLocaleString()} coins
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select Crypto */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
                Select Cryptocurrency
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CRYPTO_OPTIONS.map((crypto) => (
                  <button
                    key={crypto.id}
                    onClick={() => setSelectedCrypto(crypto.id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedCrypto === crypto.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 bg-secondary/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">{crypto.icon}</div>
                    <div className="font-semibold text-foreground">{crypto.symbol}</div>
                    <div className="text-xs text-muted-foreground">{crypto.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Deposit Button */}
            <Button
              size="lg"
              className="w-full"
              disabled={!selectedAmount || !selectedCrypto || processing}
              onClick={handleDeposit}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating invoice...
                </>
              ) : (
                <>
                  Deposit ${selectedAmount || 0} for {selectedAmount ? (selectedAmount * 100).toLocaleString() : 0} Coins
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-secondary/50 border border-border rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Important Information</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Skilled Coins are <strong>virtual credits only</strong> with no cash value</li>
                <li>Coins are <strong>non-refundable</strong> and <strong>cannot be withdrawn</strong></li>
                <li>Coins can only be used for entry into skill-based chess tournaments on Skilled</li>
                <li>By depositing, you confirm you are of legal age in your jurisdiction</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        {transactions.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Transactions</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTransactions}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(tx.status)}
                    <div>
                      <p className="font-medium text-foreground">
                        ${tx.amount_usd} • {getCryptoName(tx.crypto_currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()} • {tx.status}
                      </p>
                    </div>
                  </div>
                  {tx.status === 'confirmed' && (
                    <div className="flex items-center gap-1 text-emerald-500">
                      <Coins className="w-4 h-4" />
                      <span className="font-semibold">+{tx.skilled_coins_credited.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}