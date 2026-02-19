/**
 * MFAVerify - TOTP MFA Challenge/Verify Component
 * 
 * Prompts the user to enter their 6-digit TOTP code from their
 * authenticator app to complete the MFA challenge.
 * 
 * Used in:
 * - Auth page (after login for users with MFA enrolled)
 * - AppWithAuth guard (if session needs MFA verification)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Shield, ArrowLeft, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setMfaVerified } from '@/lib/mfaStorage';

interface MFAVerifyProps {
  onVerified: () => void;
  onBack?: () => void;
  onSwitchToEmail?: () => void;
  /** Custom title text */
  title?: string;
  /** Custom description text */
  description?: string;
}

export function MFAVerify({
  onVerified,
  onBack,
  onSwitchToEmail,
  title = 'Two-Factor Authentication',
  description = 'Enter the 6-digit code from your authenticator app',
}: MFAVerifyProps) {
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  const handleCodeChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...verifyCode];
    newCode[index] = digit;
    setVerifyCode(newCode);
    setError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [verifyCode]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newCode = [...verifyCode];
      for (let i = 0; i < 6; i++) {
        newCode[i] = pasted[i] || '';
      }
      setVerifyCode(newCode);
      const lastIdx = Math.min(pasted.length - 1, 5);
      inputRefs.current[lastIdx]?.focus();
    }
  }, [verifyCode]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [verifyCode]);

  const handleVerify = async () => {
    const code = verifyCode.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get user's TOTP factors
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) {
        setError(factors.error.message);
        return;
      }

      const totpFactor = factors.data.totp[0];
      if (!totpFactor) {
        setError('No authenticator factor found. Please set up 2FA again.');
        return;
      }

      // Create challenge
      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }

      // Verify code
      const verify = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code,
      });

      if (verify.error) {
        setError('Invalid code. Please try again.');
        setVerifyCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Success - session is now at aal2
      // Persist verification for 30 days so user isn't re-prompted on every
      // browser reopen, token refresh, or route change
      setMfaVerified('totp');
      onVerified();
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    const code = verifyCode.join('');
    if (code.length === 6 && !loading) {
      handleVerify();
    }
  }, [verifyCode]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {/* Code input */}
      <div className="space-y-3">
        <div className="flex justify-center gap-2">
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
                "w-11 h-12 text-center text-lg font-mono font-bold",
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
          disabled={loading || verifyCode.join('').length !== 6}
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

        {onSwitchToEmail && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onSwitchToEmail}
            disabled={loading}
          >
            <Mail className="w-4 h-4 mr-2" />
            Use email code instead
          </Button>
        )}

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
    </div>
  );
}
