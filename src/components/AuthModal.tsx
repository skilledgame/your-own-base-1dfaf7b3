/**
 * AuthModal - Rainbet-style popup auth modal
 *
 * Features:
 * - Login / Register tabs
 * - Email + Password form
 * - Google OAuth under Continue (like Stake)
 * - Terms of Service checkbox (sign-up only)
 * - Auto-enables email 2FA on signup (skips MFA choice)
 * - Inline email verification, username selection, and MFA flows
 * - Uncloseable during MFA verification steps (prevents half-logged-in state)
 * - Respects primary 2FA method (email vs TOTP) preference
 * - Skips 2FA entirely if disabled (mfa_method === 'none')
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MFAEnroll } from '@/components/MFAEnroll';
import { MFAVerify } from '@/components/MFAVerify';
import { EmailVerify } from '@/components/EmailVerify';
import { EmailMFAVerify } from '@/components/EmailMFAVerify';
import { ChooseUsername } from '@/components/ChooseUsername';
import { Loader2, Mail, Lock, ArrowRight, X, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { setMfaVerified } from '@/lib/mfaStorage';
import { useAuthModal, type AuthModalMode } from '@/contexts/AuthModalContext';
import { useUserDataStore } from '@/stores/userDataStore';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

// Validation schemas
const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthStep =
  | 'email'            // Login/signup form
  | 'email-verify'     // Signup email confirmation (OTP)
  | 'choose-username'  // Choose unique username after signup
  | 'mfa-verify'       // TOTP challenge on login
  | 'mfa-enroll'       // TOTP authenticator enrollment (optional)
  | 'email-2fa-verify' // Email-based 2FA challenge on login
  | 'complete';

/** Steps where the modal MUST NOT be closeable */
const MANDATORY_STEPS: AuthStep[] = ['mfa-verify', 'email-2fa-verify'];

export function AuthModal() {
  const { isOpen, mode, closeAuthModal } = useAuthModal();
  const { user } = useAuth();
  const [isLogin, setIsLogin] = useState(mode === 'sign-in');
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [hasTotpFactor, setHasTotpFactor] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalPopup, setLegalPopup] = useState<'terms' | 'privacy' | null>(null);
  const [legalContent, setLegalContent] = useState<string | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);

  const { toast } = useToast();

  // Fetch legal content lazily — only when the popup is opened
  useEffect(() => {
    if (!legalPopup) {
      setLegalContent(null);
      return;
    }
    let cancelled = false;
    const slug = legalPopup === 'terms' ? 'terms-and-conditions' : 'privacy-policy';
    setLegalLoading(true);
    supabase
      .from('site_content')
      .select('content')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setLegalContent(data?.content || null);
          setLegalLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLegalLoading(false);
      });
    return () => { cancelled = true; };
  }, [legalPopup]);

  // Whether the current step is a mandatory MFA step (modal cannot be closed)
  const isMfaStep = MANDATORY_STEPS.includes(step);

  // Sync state with mode when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // If opened directly to a forced-MFA mode (e.g. from App.tsx enforcement)
    if (mode === 'mfa-verify') {
      setStep('mfa-verify');
      setHasTotpFactor(true);
      setEmail(user?.email || '');
      setIsLogin(true);
      return;
    }

    if (mode === 'email-2fa-verify') {
      setStep('email-2fa-verify');
      setEmail(user?.email || '');
      setIsLogin(true);
      setHasTotpFactor(false);
      return;
    }

    // Normal sign-in / sign-up mode
    setIsLogin(mode === 'sign-in');
    setStep('email');
    setEmail('');
    setPassword('');
    setErrors({});
    setAcceptedTerms(false);
    setUserId(null);
    setHasTotpFactor(false);
    setLegalPopup(null);
  }, [isOpen, mode, user?.email]);

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

    // Require ToS acceptance for sign-up
    if (!isLogin && !acceptedTerms) {
      toast({
        variant: 'destructive',
        title: 'Terms Required',
        description: 'Please accept the Terms of Service to continue.',
      });
      return;
    }

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

        // Check user's MFA preference and Supabase AAL level
        const loginMfaMethod = signInData.user?.user_metadata?.mfa_method as string | undefined;

        const { data: aalData, error: aalError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError) {
          // Can't determine MFA status — let them in
          toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
          closeAuthModal();
          return;
        }

        const needsTotpVerify =
          aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1';

        // ── MFA routing based on user's primary method ──

        // 1) If MFA is explicitly disabled, skip it (unless Supabase forces TOTP)
        if (!loginMfaMethod || loginMfaMethod === 'none') {
          if (needsTotpVerify) {
            // Edge case: TOTP factors exist but mfa_method is 'none'.
            // Supabase still requires aal2 — must verify TOTP.
            setHasTotpFactor(true);
            setStep('mfa-verify');
          } else {
            toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
            closeAuthModal();
          }
          return;
        }

        // 2) Primary method is EMAIL → show email 2FA first
        if (loginMfaMethod === 'email') {
          setHasTotpFactor(needsTotpVerify);
          setStep('email-2fa-verify');
          return;
        }

        // 3) Primary method is TOTP (or anything else) → show TOTP if needed
        if (needsTotpVerify) {
          setHasTotpFactor(true);
          setStep('mfa-verify');
          return;
        }

        // 4) mfa_method is set but no TOTP factors (inconsistent state) — let them in
        toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
        closeAuthModal();
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
          setUserId(signUpData.session.user.id);
          toast({ title: 'Account created!', description: 'Now choose your username.' });
          setStep('choose-username');
        } else {
          toast({ title: 'Check your email!', description: 'We sent a verification code to your email.' });
          setStep('email-verify');
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
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
      // OAuth will redirect — modal closes automatically
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Sign-in failed', description: message });
      setGoogleLoading(false);
    }
  };

  // ── Step handlers ──

  const handleEmailVerified = (verifiedUserId: string) => {
    setUserId(verifiedUserId);
    toast({ title: 'Email verified!', description: 'Now choose your username.' });
    setStep('choose-username');
  };

  // Username chosen → auto-enable email 2FA, skip MFA choice, go home
  const handleUsernameChosen = async (_username: string) => {
    try {
      await supabase.auth.updateUser({
        data: { mfa_method: 'email' },
      });
      setMfaVerified('email');
    } catch {
      console.warn('Failed to auto-enable email 2FA metadata');
    }

    // Force the user data store to refresh so the username appears immediately
    // Optimistically update the display_name, then do a full re-fetch
    const store = useUserDataStore.getState();
    if (store.profile) {
      useUserDataStore.setState({
        profile: { ...store.profile, display_name: _username },
        lastFetchTime: 0, // Reset throttle so refresh() works immediately
      });
    }
    // Trigger a background refresh to get the full profile from DB
    setTimeout(() => {
      const s = useUserDataStore.getState();
      if (s.userId) {
        s.initialize(s.userId);
      }
    }, 500);

    toast({
      title: "You're all set!",
      description: 'Your account is ready. Email 2FA has been enabled.',
    });
    closeAuthModal();
  };

  // TOTP MFA verify success (login)
  const handleMFAVerified = () => {
    setMfaVerified('totp');
    toast({ title: 'Welcome back!', description: 'Two-factor authentication verified.' });
    closeAuthModal();
  };

  // TOTP MFA enroll success (signup — optional add-on)
  const handleMFAEnrolled = async () => {
    try {
      await supabase.auth.updateUser({ data: { mfa_method: 'totp' } });
    } catch { /* non-critical */ }
    setMfaVerified('totp');
    toast({ title: '2FA Enabled!', description: 'Your account is now protected with two-factor authentication.' });
    closeAuthModal();
  };

  // Email 2FA verify success (login)
  const handleEmail2FAVerified = () => {
    setMfaVerified('email');
    toast({ title: 'Welcome back!', description: 'Email verification successful.' });
    closeAuthModal();
  };

  // Go back to email step — ALWAYS signs out first to prevent half-authenticated state
  const goBackToEmail = () => {
    supabase.auth.signOut({ scope: 'local' });

    // If this was a forced MFA mode (from App.tsx enforcement), close the modal entirely
    if (mode === 'mfa-verify' || mode === 'email-2fa-verify') {
      closeAuthModal();
      return;
    }

    // Otherwise (login flow), show the login form again so user can retry
    setStep('email');
    setErrors({});
  };

  // Tab style helper
  const tabClass = (active: boolean) =>
    cn(
      'flex-1 text-center py-2.5 text-sm font-medium transition-all cursor-pointer relative',
      active
        ? 'text-white'
        : 'text-slate-400 hover:text-slate-200'
    );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // During mandatory MFA steps, prevent any close attempt
        if (!open && isMfaStep) return;
        if (!open) closeAuthModal();
      }}
    >
      <DialogContent
        className={cn(
          'bg-[#0f1923] border-slate-700/50 text-white p-0 gap-0',
          'w-[95vw] max-w-[440px] max-h-[90vh] rounded-xl',
          'shadow-2xl shadow-black/50',
          'relative overflow-hidden',
          // Override default dialog close button
          '[&>button]:hidden'
        )}
        // Prevent closing by clicking outside or pressing Escape during MFA
        onInteractOutside={(e) => { if (isMfaStep) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isMfaStep) e.preventDefault(); }}
      >
        {/* Accessible title for screen readers */}
        <DialogTitle className="sr-only">
          {isLogin ? 'Sign In' : 'Create an Account'}
        </DialogTitle>

        {/* Header with tabs and close button */}
        <div className="relative">
          {/* Close button — hidden during mandatory MFA steps */}
          {!isMfaStep && (
            <button
              onClick={closeAuthModal}
              className="absolute right-3 top-3 z-10 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Tabs - only show on email step */}
          {step === 'email' && (
            <div className="flex border-b border-slate-700/50">
              <button
                className={tabClass(isLogin)}
                onClick={() => { setIsLogin(true); setErrors({}); setPassword(''); }}
              >
                Login
                {isLogin && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-[3px] rounded-full overflow-hidden">
                    <div
                      className="w-full h-full animate-rainbow-slide"
                      style={{
                        backgroundSize: '200% 100%',
                        backgroundImage: 'linear-gradient(90deg, #ff0000, #ff5500, #ffaa00, #ffff00, #00ff00, #00ffcc, #00aaff, #0044ff, #8800ff, #cc00ff, #ff0066, #ff0000)',
                      }}
                    />
                  </div>
                )}
              </button>
              <button
                className={tabClass(!isLogin)}
                onClick={() => { setIsLogin(false); setErrors({}); setPassword(''); }}
              >
                Register
                {!isLogin && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-[3px] rounded-full overflow-hidden">
                    <div
                      className="w-full h-full animate-rainbow-slide"
                      style={{
                        backgroundSize: '200% 100%',
                        backgroundImage: 'linear-gradient(90deg, #ff0000, #ff5500, #ffaa00, #ffff00, #00ff00, #00ffcc, #00aaff, #0044ff, #8800ff, #cc00ff, #ff0066, #ff0000)',
                      }}
                    />
                  </div>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step: Email/Password */}
          {step === 'email' && (
            <>
              <h2 className="text-xl font-bold text-white mb-1">
                {isLogin ? 'Welcome Back' : 'Create an Account'}
              </h2>
              <p className="text-slate-400 text-sm mb-5">
                {isLogin
                  ? 'Enter your credentials to sign in'
                  : 'Enter your details to get started'}
              </p>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="modal-email" className="text-slate-300 text-sm">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="modal-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn(
                        'pl-10 bg-[#1a2634] border-slate-600/50 text-white placeholder:text-slate-500 focus:border-blue-500/50',
                        errors.email && 'border-red-500/50'
                      )}
                      required
                      autoComplete="email"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-400">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="modal-password" className="text-slate-300 text-sm">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="modal-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(
                        'pl-10 bg-[#1a2634] border-slate-600/50 text-white placeholder:text-slate-500 focus:border-blue-500/50',
                        errors.password && 'border-red-500/50'
                      )}
                      required
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-400">{errors.password}</p>
                  )}
                </div>

                {/* Terms of Service checkbox (sign-up only) */}
                {!isLogin && (
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <Checkbox
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                      className="mt-0.5 border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <span className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                      I have read and agree to the{' '}
                      <button
                        type="button"
                        className="text-blue-400 underline hover:text-blue-300"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalPopup('terms'); }}
                      >
                        Terms of Service
                      </button>
                      {' '}and{' '}
                      <button
                        type="button"
                        className="text-blue-400 underline hover:text-blue-300"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalPopup('privacy'); }}
                      >
                        Privacy Policy
                      </button>
                    </span>
                  </label>
                )}

                {/* Continue button */}
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0 font-semibold h-11"
                  disabled={loading || (!isLogin && !acceptedTerms)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              {/* OR divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-700/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0f1923] px-3 text-slate-500">OR</span>
                </div>
              </div>

              {/* Google Sign-In Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full bg-[#1a2634] border-slate-600/50 text-white hover:bg-[#243445] hover:text-white h-11"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              {/* Toggle login/signup link */}
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrors({});
                    setPassword('');
                    setAcceptedTerms(false);
                  }}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {isLogin ? (
                    <>Don't have an account? <span className="text-blue-400 font-medium">Sign up</span></>
                  ) : (
                    <>Already have an account? <span className="text-blue-400 font-medium">Sign in</span></>
                  )}
                </button>
              </div>
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

          {/* Step: TOTP MFA Verify (login with existing factor) */}
          {step === 'mfa-verify' && (
            <MFAVerify
              onVerified={handleMFAVerified}
              onBack={goBackToEmail}
              onSwitchToEmail={() => setStep('email-2fa-verify')}
            />
          )}

          {/* Step: TOTP MFA Enroll (new factor setup - optional) */}
          {step === 'mfa-enroll' && (
            <MFAEnroll
              onEnrolled={handleMFAEnrolled}
              onSkipped={() => closeAuthModal()}
              allowSkip={true}
            />
          )}

          {/* Step: Email 2FA Verify (login with email code) */}
          {step === 'email-2fa-verify' && (
            <EmailMFAVerify
              email={email || user?.email || ''}
              onVerified={handleEmail2FAVerified}
              onBack={goBackToEmail}
              onSwitchToAuthenticator={hasTotpFactor ? () => setStep('mfa-verify') : undefined}
            />
          )}
        </div>

        {/* ── Inline legal popup (Terms / Privacy) ── */}
        {legalPopup && (
          <div className="absolute inset-0 z-20 bg-[#0f1923] rounded-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50 shrink-0">
              <button
                onClick={() => setLegalPopup(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-semibold text-white">
                {legalPopup === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </h3>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
              {legalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : legalContent ? (
                <div
                  className="prose prose-sm prose-invert max-w-none prose-headings:text-slate-200 prose-p:text-slate-400 prose-li:text-slate-400 prose-a:text-blue-400 prose-strong:text-slate-300"
                  dangerouslySetInnerHTML={{ __html: legalContent }}
                />
              ) : (
                <p className="text-slate-400 text-sm">
                  {legalPopup === 'terms'
                    ? 'Terms of Service content is not available at this time. Please check back later.'
                    : 'Privacy Policy content is not available at this time. Please check back later.'}
                </p>
              )}
            </div>

            {/* Back button */}
            <div className="px-5 py-3 border-t border-slate-700/50 shrink-0">
              <Button
                type="button"
                variant="outline"
                className="w-full bg-[#1a2634] border-slate-600/50 text-white hover:bg-[#243445] hover:text-white"
                onClick={() => setLegalPopup(null)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Register
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
