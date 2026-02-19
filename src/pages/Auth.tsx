import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogoLink } from '@/components/LogoLink';
import { MFAEnroll } from '@/components/MFAEnroll';
import { MFAVerify } from '@/components/MFAVerify';
import { MFAChoice } from '@/components/MFAChoice';
import { EmailVerify } from '@/components/EmailVerify';
import { EmailMFAVerify } from '@/components/EmailMFAVerify';
import { ChooseUsername } from '@/components/ChooseUsername';
import { ArrowLeft, Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cn } from '@/lib/utils';
import { isMfaVerified, setMfaVerified } from '@/lib/mfaStorage';

// Validation schemas
const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthStep =
  | 'email'            // Login/signup form
  | 'email-verify'     // Signup email confirmation (OTP)
  | 'choose-username'  // Choose unique username after signup
  | 'mfa-choice'       // Choose 2FA method after signup
  | 'mfa-enroll'       // TOTP authenticator enrollment
  | 'mfa-verify'       // TOTP challenge on login
  | 'email-2fa-verify' // Email-based 2FA challenge on login
  | 'complete';

// Steps that indicate the user is actively in a multi-step auth flow.
// checkAuth should NOT override these by navigating away.
const ACTIVE_FLOW_STEPS: AuthStep[] = [
  'email-verify',
  'choose-username',
  'mfa-choice',
  'mfa-enroll',
  'mfa-verify',
  'email-2fa-verify',
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [hasTotpFactor, setHasTotpFactor] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Track step in a ref so the checkAuth effect can read the latest value
  const stepRef = useRef<AuthStep>(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // Check if already fully authenticated (runs once on mount)
  useEffect(() => {
    const checkAuth = async () => {
      // If user is already in a multi-step signup/enrollment flow, don't interfere
      if (ACTIVE_FLOW_STEPS.includes(stepRef.current)) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setUserId(session.user.id);

      // OAuth users (Google, etc.) skip MFA entirely — send them home
      const provider = session.user.app_metadata?.provider;
      if (provider && provider !== 'email') {
        navigate('/');
        return;
      }

      // Check email 2FA status FIRST — if already verified within 30 days,
      // user is good (even if they also have TOTP enrolled).
      // Email 2FA is a valid alternative to TOTP, not an addition.
      // Uses localStorage with 30-day TTL so users stay signed in across
      // browser restarts without being forced to re-verify.
      const mfaMethod = session.user.user_metadata?.mfa_method;

      // If MFA was already verified within the last 30 days (any method),
      // skip the challenge and go straight home
      if (isMfaVerified()) {
        navigate('/');
        return;
      }

      // Check TOTP MFA status
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aalData) return;

      if (aalData.currentLevel === 'aal2') {
        // Already fully verified with TOTP 2FA
        navigate('/');
        return;
      }

      if (aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
        // Has TOTP factor enrolled but needs to verify — show challenge
        // Also check if email 2FA is available so user can switch
        setHasTotpFactor(true);
        setEmail(session.user.email || '');
        setStep('mfa-verify');
        return;
      }

      // No TOTP enrolled — check for email-based 2FA preference
      if (mfaMethod === 'email') {
        // Need to verify email 2FA
        setEmail(session.user.email || '');
        setStep('email-2fa-verify');
        return;
      }

      // No 2FA configured — just go home (2FA is optional now)
      navigate('/');
    };

    checkAuth();
  }, [navigate]);

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

  const validatePassword = () => {
    try {
      passwordSchema.parse(password);
      setErrors(prev => ({ ...prev, password: undefined }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, password: error.errors[0].message }));
      }
      return false;
    }
  };

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail()) return;
    if (!validatePassword()) return;
    
    setLoading(true);
    setErrors({});

    try {
      if (isLogin) {
        // ── Login flow ──
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Invalid email or password. Please try again.');
          }
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Please verify your email before logging in.');
          }
          throw error;
        }

        // Check if user has TOTP MFA enrolled
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (aalError) {
          // MFA check failed, but login succeeded - navigate home
          toast({
            title: 'Welcome back!',
            description: 'You have successfully signed in.',
          });
          navigate('/');
          return;
        }

        const loginMfaMethod = signInData.user?.user_metadata?.mfa_method;

        if (aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
          // User has TOTP MFA enrolled — show TOTP verification screen
          setHasTotpFactor(true);
          setStep('mfa-verify');
        } else if (loginMfaMethod === 'email') {
          // No TOTP but has email 2FA — send OTP and show verification
          setStep('email-2fa-verify');
        } else {
          // No 2FA at all — go home
          toast({
            title: 'Welcome back!',
            description: 'You have successfully signed in.',
          });
          navigate('/');
        }
      } else {
        // ── Signup flow ──
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        
        if (signUpError) {
          if (signUpError.message.includes('User already registered')) {
            throw new Error('An account with this email already exists. Please sign in instead.');
          }
          if (signUpError.message.includes('rate limit') || signUpError.message.includes('limit exceeded')) {
            throw new Error('Too many signup attempts. Please try again later or use Google sign-in.');
          }
          throw signUpError;
        }

        if (signUpData?.session) {
          // User has a session immediately (email confirmation disabled) — choose username
          setUserId(signUpData.session.user.id);
          toast({
            title: 'Account created!',
            description: 'Now choose your username.',
          });
          setStep('choose-username');
        } else {
          // Email confirmation required — show OTP code entry screen
          toast({
            title: 'Check your email!',
            description: 'We sent a verification code to your email.',
          });
          setStep('email-verify');
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
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

  // ── Step handlers ──

  // Email verification success (signup) → choose username
  // userId is passed directly from verifyOtp response to avoid getSession() race conditions
  const handleEmailVerified = (verifiedUserId: string) => {
    setUserId(verifiedUserId);
    toast({
      title: 'Email verified!',
      description: 'Now choose your username.',
    });
    setStep('choose-username');
  };

  // Username chosen → auto-enable email 2FA, then ask about authenticator app
  const handleUsernameChosen = async (_username: string) => {
    // Automatically enable email-based 2FA for all new signups
    try {
      await supabase.auth.updateUser({
        data: { mfa_method: 'email' },
      });
      setMfaVerified('email');
    } catch {
      // Non-critical — continue with the flow even if metadata update fails
      console.warn('Failed to auto-enable email 2FA metadata');
    }

    toast({
      title: 'Username saved!',
      description: 'Email 2FA has been enabled. Want to add an authenticator app too?',
    });
    setStep('mfa-choice');
  };

  // User chose to set up authenticator app → show TOTP enrollment
  const handleChooseAuthenticator = () => {
    setStep('mfa-enroll');
  };

  // User chose to skip authenticator setup → go home (email 2FA already enabled)
  const handleSkipAuthenticator = () => {
    toast({
      title: 'You\'re all set!',
      description: 'Email 2FA is active. You can add an authenticator app later in Settings.',
    });
    navigate('/');
  };

  // TOTP MFA verify success (login)
  // Note: MFAVerify.tsx already calls setMfaVerified('totp') internally,
  // but we set it here too as a safety net
  const handleMFAVerified = () => {
    setMfaVerified('totp');
    toast({
      title: 'Welcome back!',
      description: 'Two-factor authentication verified.',
    });
    navigate('/');
  };

  // TOTP MFA enroll success (signup)
  const handleMFAEnrolled = async () => {
    // Save the preference in user metadata
    try {
      await supabase.auth.updateUser({
        data: { mfa_method: 'totp' },
      });
    } catch {
      // Non-critical — the TOTP factor is already enrolled in Supabase MFA
    }
    // Mark MFA as verified for 30 days
    setMfaVerified('totp');
    toast({
      title: '2FA Enabled!',
      description: 'Your account is now protected with two-factor authentication.',
    });
    navigate('/');
  };

  // Email 2FA verify success (login)
  // Note: EmailMFAVerify.tsx already calls setMfaVerified('email') internally,
  // but we set it here too as a safety net
  const handleEmail2FAVerified = () => {
    setMfaVerified('email');
    toast({
      title: 'Welcome back!',
      description: 'Email verification successful.',
    });
    navigate('/');
  };

  // Go back to email step
  const goBackToEmail = () => {
    setStep('email');
    setErrors({});
    // Sign out since we're going back (user is at aal1 only)
    supabase.auth.signOut({ scope: 'local' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <LogoLink className="h-8" />
          <div className="w-16" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
            
            {/* Step: Email/Password */}
            {step === 'email' && (
              <>
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {isLogin 
                      ? 'Enter your credentials to sign in' 
                      : 'Enter your details to get started'}
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

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={cn("pl-10", errors.password && "border-destructive")}
                        required
                        autoComplete={isLogin ? "current-password" : "new-password"}
                      />
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isLogin ? 'Signing in...' : 'Creating account...'}
                      </>
                    ) : (
                      <>
                        {isLogin ? 'Sign In' : 'Create Account'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setErrors({});
                      setPassword('');
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isLogin ? (
                      <>Don't have an account? <span className="text-primary font-medium">Sign up</span></>
                    ) : (
                      <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
                    )}
                  </button>
                </div>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                  By continuing, you agree to our{' '}
                  <Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
                </p>
              </>
            )}

            {/* Step: Email Verification (after signup) */}
            {step === 'email-verify' && (
              <EmailVerify
                email={email}
                password={password}
                onVerified={handleEmailVerified}
                onBack={() => {
                  setStep('email');
                  setErrors({});
                }}
              />
            )}

            {/* Step: Choose Username (after signup email verify) */}
            {step === 'choose-username' && userId && (
              <ChooseUsername userId={userId} onComplete={handleUsernameChosen} />
            )}

            {/* Step: Authenticator app offer (email 2FA already enabled) */}
            {step === 'mfa-choice' && (
              <MFAChoice
                onChooseAuthenticator={handleChooseAuthenticator}
                onSkip={handleSkipAuthenticator}
              />
            )}

            {/* Step: TOTP MFA Verify (login with existing factor) */}
            {step === 'mfa-verify' && (
              <MFAVerify
                onVerified={handleMFAVerified}
                onBack={goBackToEmail}
                onSwitchToEmail={() => setStep('email-2fa-verify')}
              />
            )}

            {/* Step: TOTP MFA Enroll (new factor setup after choosing authenticator) */}
            {step === 'mfa-enroll' && (
              <MFAEnroll
                onEnrolled={handleMFAEnrolled}
                onSkipped={handleSkipAuthenticator}
                allowSkip={true}
              />
            )}

            {/* Step: Email 2FA Verify (login with email code) */}
            {step === 'email-2fa-verify' && (
              <EmailMFAVerify
                email={email}
                onVerified={handleEmail2FAVerified}
                onBack={goBackToEmail}
                onSwitchToAuthenticator={hasTotpFactor ? () => setStep('mfa-verify') : undefined}
              />
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
}
