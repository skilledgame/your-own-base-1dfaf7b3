/**
 * EmailMFAVerify - Email-based 2FA Verification Component
 * 
 * Sends a one-time code to the user's email and verifies it.
 * Used during login for users who have chosen email-based 2FA.
 * 
 * Different from EmailVerify (signup email confirmation) — this is
 * specifically for the 2FA challenge on login.
 * 
 * Used in:
 * - Auth page (during login for users with email 2FA enabled)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const CODE_LENGTH = 8;
const EMPTY_CODE = Array(CODE_LENGTH).fill('');

interface EmailMFAVerifyProps {
  email: string;
  onVerified: () => void;
  onBack?: () => void;
}

export function EmailMFAVerify({ email, onVerified, onBack }: EmailMFAVerifyProps) {
  const [verifyCode, setVerifyCode] = useState<string[]>([...EMPTY_CODE]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Send OTP on mount
  useEffect(() => {
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus first input when ready
  useEffect(() => {
    if (!sending) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [sending]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const sendCode = async () => {
    setSending(true);
    setError('');
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        setError('Failed to send verification code. ' + otpError.message);
      } else {
        setResendCooldown(60);
      }
    } catch {
      setError('Failed to send verification code.');
    } finally {
      setSending(false);
    }
  };

  const handleCodeChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...verifyCode];
    newCode[index] = digit;
    setVerifyCode(newCode);
    setError('');

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [verifyCode]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted.length > 0) {
      const newCode = [...EMPTY_CODE];
      for (let i = 0; i < CODE_LENGTH; i++) {
        newCode[i] = pasted[i] || '';
      }
      setVerifyCode(newCode);
      const lastIdx = Math.min(pasted.length - 1, CODE_LENGTH - 1);
      inputRefs.current[lastIdx]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [verifyCode]);

  const handleVerify = async () => {
    const code = verifyCode.join('');
    if (code.length !== CODE_LENGTH) {
      setError(`Please enter all ${CODE_LENGTH} digits`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (verifyError) {
        if (verifyError.message.includes('expired') || verifyError.message.includes('invalid')) {
          setError('Invalid or expired code. Please try again or resend.');
        } else {
          setError(verifyError.message);
        }
        setVerifyCode([...EMPTY_CODE]);
        inputRefs.current[0]?.focus();
        return;
      }

      if (data?.session) {
        // Mark email 2FA as verified for this session
        sessionStorage.setItem('email_2fa_verified', 'true');
        onVerified();
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when all digits entered
  useEffect(() => {
    const code = verifyCode.join('');
    if (code.length === CODE_LENGTH && !loading && !sending) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyCode]);

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        setError('Failed to resend code. ' + otpError.message);
      } else {
        setResendCooldown(60);
        setVerifyCode([...EMPTY_CODE]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Mask email
  const maskedEmail = (() => {
    const [local, domain] = email.split('@');
    if (local.length <= 3) return `${local[0]}***@${domain}`;
    return `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 6))}@${domain}`;
  })();

  if (sending) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Sending verification code...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Check Your Email</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We sent a verification code to
        </p>
        <p className="text-sm font-medium text-foreground mt-0.5">{maskedEmail}</p>
      </div>

      {/* Code input */}
      <div className="space-y-3">
        <div className="flex justify-center gap-1.5">
          {verifyCode.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={cn(
                "w-10 h-12 text-center text-lg font-mono font-bold px-0",
                error && "border-destructive"
              )}
              disabled={loading}
            />
          ))}
        </div>
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          onClick={handleVerify}
          className="w-full"
          disabled={loading || verifyCode.join('').length !== CODE_LENGTH}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </Button>

        {/* Resend */}
        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
        >
          {resending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Resending...
            </>
          ) : resendCooldown > 0 ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Resend code in {resendCooldown}s
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Resend code
            </>
          )}
        </Button>

        {onBack && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onBack}
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to login
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Didn't receive the email? Check your spam folder.
      </p>
    </div>
  );
}
