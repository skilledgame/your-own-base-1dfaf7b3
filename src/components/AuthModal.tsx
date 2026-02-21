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
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { MFAEnroll } from '@/components/MFAEnroll';
import { MFAVerify } from '@/components/MFAVerify';
import { EmailVerify } from '@/components/EmailVerify';
import { EmailMFAVerify } from '@/components/EmailMFAVerify';
import { ChooseUsername } from '@/components/ChooseUsername';
import { Loader2, Mail, Lock, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { isMfaVerified, setMfaVerified } from '@/lib/mfaStorage';
import { useAuthModal, type AuthModalMode } from '@/contexts/AuthModalContext';
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

export function AuthModal() {
  const { isOpen, mode, openAuthModal, closeAuthModal } = useAuthModal();
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

  const { toast } = useToast();

  // Sync isLogin with mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLogin(mode === 'sign-in');
      setStep('email');
      setEmail('');
      setPassword('');
      setErrors({});
      setAcceptedTerms(false);
      setUserId(null);
      setHasTotpFactor(false);
    }
  }, [isOpen, mode]);

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

        // Check if user has TOTP MFA enrolled
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError) {
          toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
          closeAuthModal();
          return;
        }

        const loginMfaMethod = signInData.user?.user_metadata?.mfa_method;

        if (aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
          setHasTotpFactor(true);
          setStep('mfa-verify');
        } else if (loginMfaMethod === 'email') {
          setStep('email-2fa-verify');
        } else {
          toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
          closeAuthModal();
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

  // Go back to email step
  const goBackToEmail = () => {
    setStep('email');
    setErrors({});
    supabase.auth.signOut({ scope: 'local' });
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent
        className={cn(
          'bg-[#0f1923] border-slate-700/50 text-white p-0 gap-0',
          'w-[95vw] max-w-[440px] rounded-xl',
          'shadow-2xl shadow-black/50',
          // Override default dialog close button
          '[&>button]:hidden'
        )}
      >
        {/* Accessible title for screen readers */}
        <DialogTitle className="sr-only">
          {isLogin ? 'Sign In' : 'Create an Account'}
        </DialogTitle>

        {/* Header with tabs and close button */}
        <div className="relative">
          {/* Close button */}
          <button
            onClick={closeAuthModal}
            className="absolute right-3 top-3 z-10 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Tabs - only show on email step */}
          {step === 'email' && (
            <div className="flex border-b border-slate-700/50">
              <button
                className={tabClass(isLogin)}
                onClick={() => { setIsLogin(true); setErrors({}); setPassword(''); }}
              >
                Login
                {isLogin && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
              <button
                className={tabClass(!isLogin)}
                onClick={() => { setIsLogin(false); setErrors({}); setPassword(''); }}
              >
                Register
                {!isLogin && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-full" />
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
                      I am over the age of 18 and agree to the{' '}
                      <Link
                        to="/terms"
                        className="text-blue-400 underline hover:text-blue-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms of Service
                      </Link>
                      {' '}and{' '}
                      <Link
                        to="/privacy"
                        className="text-blue-400 underline hover:text-blue-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                )}

                {/* Continue button */}
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold h-11"
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
              email={email}
              onVerified={handleEmail2FAVerified}
              onBack={goBackToEmail}
              onSwitchToAuthenticator={hasTotpFactor ? () => setStep('mfa-verify') : undefined}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
