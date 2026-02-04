import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogoLink } from '@/components/LogoLink';
import { ArrowLeft, Loader2, Mail, Check, ArrowRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cn } from '@/lib/utils';

// Validation schemas
const emailSchema = z.string().email('Please enter a valid email address');
const otpSchema = z.string().length(6, 'Please enter all 6 digits');

type AuthStep = 'email' | 'otp' | 'complete';

export default function Auth() {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errors, setErrors] = useState<{ email?: string; otp?: string }>({});
  
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if already authenticated
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate('/');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const validateEmail = () => {
    try {
      emailSchema.parse(email);
      setErrors(prev => ({ ...prev, email: undefined }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, email: error.errors[0].message }));
      }
      return false;
    }
  };

  // Handle email submission - send OTP using signInWithOtp only
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail()) return;
    
    setLoading(true);
    setErrors({});

    try {
      // Use signInWithOtp for both new and existing users
      // shouldCreateUser: true allows new user creation via OTP
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // Creates user if they don't exist
        },
      });
      
      if (error) {
        throw error;
      }

      // Move to OTP step
      setStep('otp');
      setResendCooldown(60);
      toast({
        title: 'Code sent!',
        description: 'Check your email for a 6-digit verification code.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      
      // Provide user-friendly error messages
      let friendlyMessage = message;
      if (message.includes('rate limit')) {
        friendlyMessage = 'Too many attempts. Please wait a moment before trying again.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: friendlyMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input change
  const handleOtpChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setErrors(prev => ({ ...prev, otp: undefined }));

    // Auto-advance to next input
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }, [otp]);

  // Handle paste for OTP
  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedData[i] || '';
      }
      setOtp(newOtp);
      
      // Focus the last filled input or the next empty one
      const lastFilledIndex = Math.min(pastedData.length - 1, 5);
      otpInputRefs.current[lastFilledIndex]?.focus();
    }
  }, [otp]);

  // Handle OTP keydown for backspace
  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  // Verify OTP using verifyOtp
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const otpCode = otp.join('');
    
    try {
      otpSchema.parse(otpCode);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, otp: error.errors[0].message }));
      }
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });

      if (error) {
        if (error.message.includes('expired') || error.message.includes('invalid') || error.message.includes('Token')) {
          throw new Error('Invalid or expired code. Please try again or request a new code.');
        }
        throw error;
      }

      // Success! User is now authenticated
      setStep('complete');
      toast({
        title: 'Success!',
        description: 'You have been verified.',
      });
      
      // Navigate will happen automatically via auth state change
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      setErrors(prev => ({ ...prev, otp: message }));
      toast({
        variant: 'destructive',
        title: 'Verification failed',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      toast({
        title: 'Code resent!',
        description: 'Check your email for a new verification code.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to resend code';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({
        variant: 'destructive',
        title: 'Sign-in failed',
        description: message,
      });
      setGoogleLoading(false);
    }
  };

  const goBackToEmail = () => {
    setStep('email');
    setOtp(['', '', '', '', '', '']);
    setErrors({});
  };

  // Progress indicator
  const ProgressIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
        step === 'email' 
          ? "bg-primary text-primary-foreground" 
          : "bg-primary/20 text-primary"
      )}>
        {step !== 'email' ? <Check className="w-4 h-4" /> : '1'}
      </div>
      <div className={cn(
        "w-8 h-1 rounded-full transition-all",
        step !== 'email' ? "bg-primary" : "bg-muted"
      )} />
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
        step === 'otp' 
          ? "bg-primary text-primary-foreground" 
          : step === 'complete'
          ? "bg-primary/20 text-primary"
          : "bg-muted text-muted-foreground"
      )}>
        {step === 'complete' ? <Check className="w-4 h-4" /> : '2'}
      </div>
      <div className={cn(
        "w-8 h-1 rounded-full transition-all",
        step === 'complete' ? "bg-primary" : "bg-muted"
      )} />
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
        step === 'complete' 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted text-muted-foreground"
      )}>
        {step === 'complete' ? <Check className="w-4 h-4" /> : '3'}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {step === 'email' ? (
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          ) : (
            <button 
              onClick={goBackToEmail}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <LogoLink className="h-8" />
          <div className="w-16" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
            <ProgressIndicator />

            {/* Step 1: Email */}
            {step === 'email' && (
              <>
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    Welcome
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Enter your email to receive a verification code
                  </p>
                </div>

                {/* Google Sign-In Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mb-5"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Continue with Google
                </Button>

                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                  </div>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn("pl-10", errors.email && "border-destructive")}
                        required
                        autoComplete="email"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <p className="mt-5 text-xs text-center text-muted-foreground">
                  We'll send you a 6-digit code to verify your email.
                  <br />
                  New users will be automatically registered.
                </p>
              </>
            )}

            {/* Step 2: OTP Verification */}
            {step === 'otp' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    Check your email
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    We sent a 6-digit code to
                  </p>
                  <p className="text-foreground font-medium mt-1">{email}</p>
                </div>

                <form onSubmit={handleOtpSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-center block">Enter verification code</Label>
                    <div className="flex justify-center gap-2">
                      {otp.map((digit, index) => (
                        <Input
                          key={index}
                          ref={(el) => { otpInputRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onPaste={index === 0 ? handleOtpPaste : undefined}
                          className={cn(
                            "w-12 h-14 text-center text-xl font-bold",
                            "focus:ring-2 focus:ring-primary focus:border-primary",
                            errors.otp && "border-destructive"
                          )}
                          autoComplete="one-time-code"
                        />
                      ))}
                    </div>
                    {errors.otp && (
                      <p className="text-sm text-destructive text-center">{errors.otp}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading || otp.some(d => !d)}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify Code
                        <Check className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Didn't receive the code?
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="text-primary"
                  >
                    {resendCooldown > 0 ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend in {resendCooldown}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend code
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Complete */}
            {step === 'complete' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent/20 flex items-center justify-center">
                  <Check className="w-10 h-10 text-accent" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Verification Complete!
                </h1>
                <p className="text-muted-foreground text-sm mb-6">
                  Redirecting you to the app...
                </p>
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              </div>
            )}
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
