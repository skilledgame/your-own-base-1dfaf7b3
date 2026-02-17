/**
 * MFAEnroll - TOTP MFA Enrollment Component
 * 
 * Shows a QR code for the user to scan with their authenticator app,
 * then verifies the code they enter to complete enrollment.
 * 
 * Used in:
 * - Auth page (after signup or login for users without MFA)
 * - Settings > Security tab
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Shield, Copy, Check, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MFAEnrollProps {
  onEnrolled: () => void;
  onSkipped?: () => void;
  /** Whether user can skip enrollment (e.g. false = mandatory on signup) */
  allowSkip?: boolean;
  /** Custom title text */
  title?: string;
  /** Custom description text */
  description?: string;
}

export function MFAEnroll({
  onEnrolled,
  onSkipped,
  allowSkip = false,
  title = 'Set Up Two-Factor Authentication',
  description = 'Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)',
}: MFAEnrollProps) {
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(true);
  const [copied, setCopied] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start enrollment on mount
  useEffect(() => {
    let cancelled = false;

    const startEnroll = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
        });

        if (cancelled) return;

        if (error) {
          setError(error.message);
          return;
        }

        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (err) {
        if (!cancelled) {
          setError('Failed to start enrollment. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setEnrolling(false);
        }
      }
    };

    startEnroll();

    return () => {
      cancelled = true;
    };
  }, []);

  // Focus first input when QR is shown
  useEffect(() => {
    if (qrCode && inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [qrCode]);

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
      // Create challenge
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }

      // Verify the code
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });

      if (verify.error) {
        setError(verify.error.message);
        setVerifyCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Success!
      onEnrolled();
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    const code = verifyCode.join('');
    if (code.length === 6 && !loading) {
      handleVerify();
    }
  }, [verifyCode]);

  if (enrolling) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Setting up 2FA...</p>
      </div>
    );
  }

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

      {/* QR Code */}
      {qrCode && (
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <img src={qrCode} alt="Scan this QR code with your authenticator app" className="w-48 h-48" />
          </div>
        </div>
      )}

      {/* Manual secret */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowSecret(!showSecret)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <QrCode className="w-3 h-3" />
          {showSecret ? 'Hide' : "Can't scan? Enter code manually"}
        </button>
        {showSecret && secret && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <code className="text-xs bg-muted px-3 py-1.5 rounded font-mono tracking-wider break-all">
              {secret}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleCopySecret}
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        )}
      </div>

      {/* Verification code input */}
      <div className="space-y-3">
        <p className="text-sm text-center text-muted-foreground">
          Enter the 6-digit code from your app
        </p>
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
            <>
              <Shield className="w-4 h-4 mr-2" />
              Enable 2FA
            </>
          )}
        </Button>

        {allowSkip && onSkipped && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onSkipped}
            disabled={loading}
          >
            Skip for now
          </Button>
        )}
      </div>
    </div>
  );
}
