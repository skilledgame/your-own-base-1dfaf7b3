/**
 * Password Tab - Change password + reset password via email
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Lock, Eye, EyeOff, Loader2, Mail, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getRankFromTotalWagered } from '@/lib/rankSystem';
import { getRankBorderClass, elevateToAAL2 } from './ProfileTab';

const CODE_LENGTH = 6;
const EMPTY_CODE = Array(CODE_LENGTH).fill('');

export function PasswordTab() {
  const { user } = useAuth();
  const { totalWageredSc } = useProfile();
  const rankInfo = getRankFromTotalWagered(totalWageredSc);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Reset via email states
  const [resetStep, setResetStep] = useState<'idle' | 'code' | 'done'>('idle');
  const [resetCode, setResetCode] = useState<string[]>([...EMPTY_CODE]);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [verifyingReset, setVerifyingReset] = useState(false);
  const [resetError, setResetError] = useState('');
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== 'email';

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    setChangingPassword(true);
    const elevated = await elevateToAAL2();
    if (!elevated) { setChangingPassword(false); return; }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); } else {
      toast.success('Password updated successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  const handleResetViaEmail = async () => {
    if (!user?.email) { toast.error('No email address found'); return; }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });
      if (error) { toast.error(error.message); }
      else {
        toast.success('Reset code sent to your email!');
        setResetStep('code');
        setResetCode([...EMPTY_CODE]);
        setResetNewPassword('');
        setResetConfirmPassword('');
        setResetError('');
        // Focus first input after render
        setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
      }
    } catch { toast.error('Failed to send reset email'); }
    finally { setSendingReset(false); }
  };

  const handleCodeChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste into single input
      const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
      const newCode = [...EMPTY_CODE];
      for (let i = 0; i < digits.length; i++) newCode[i] = digits[i];
      setResetCode(newCode);
      const lastIdx = Math.min(digits.length - 1, CODE_LENGTH - 1);
      codeInputRefs.current[lastIdx]?.focus();
      return;
    }
    const digit = value.replace(/\D/g, '');
    const newCode = [...resetCode];
    newCode[index] = digit;
    setResetCode(newCode);
    if (digit && index < CODE_LENGTH - 1) {
      codeInputRefs.current[index + 1]?.focus();
    }
  }, [resetCode]);

  const handleCodePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted.length > 0) {
      const newCode = [...EMPTY_CODE];
      for (let i = 0; i < CODE_LENGTH; i++) newCode[i] = pasted[i] || '';
      setResetCode(newCode);
      const lastIdx = Math.min(pasted.length - 1, CODE_LENGTH - 1);
      codeInputRefs.current[lastIdx]?.focus();
    }
  }, []);

  const handleCodeKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !resetCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  }, [resetCode]);

  const handleVerifyAndReset = async () => {
    const code = resetCode.join('');
    if (code.length !== CODE_LENGTH) { setResetError('Please enter all 6 digits'); return; }
    if (!resetNewPassword) { setResetError('Please enter a new password'); return; }
    if (resetNewPassword.length < 8) { setResetError('Password must be at least 8 characters'); return; }
    if (resetNewPassword !== resetConfirmPassword) { setResetError('Passwords do not match'); return; }

    setVerifyingReset(true);
    setResetError('');

    try {
      // Step 1: Verify the OTP code to establish a recovery session
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: user?.email || '',
        token: code,
        type: 'recovery',
      });

      if (verifyError) {
        if (verifyError.message.includes('expired') || verifyError.message.includes('invalid')) {
          setResetError('Invalid or expired code. Please request a new one.');
        } else {
          setResetError(verifyError.message);
        }
        setResetCode([...EMPTY_CODE]);
        codeInputRefs.current[0]?.focus();
        setVerifyingReset(false);
        return;
      }

      // Step 2: Now update the password (recovery session allows this)
      const { error: updateError } = await supabase.auth.updateUser({ password: resetNewPassword });

      if (updateError) {
        setResetError(updateError.message);
        setVerifyingReset(false);
        return;
      }

      toast.success('Password has been reset successfully!');
      setResetStep('done');
    } catch {
      setResetError('Failed to reset password. Please try again.');
    } finally {
      setVerifyingReset(false);
    }
  };

  const handleResetBack = () => {
    setResetStep('idle');
    setResetCode([...EMPTY_CODE]);
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetError('');
  };

  if (isOAuthUser) {
    return (
      <div className="space-y-6">
        <Card className={cn('border bg-card', getRankBorderClass(rankInfo.tierName))}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Password</CardTitle>
                <CardDescription>Password management is not available for social login accounts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You signed in with a social provider. Password is managed by your identity provider.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card className={cn('border bg-card', getRankBorderClass(rankInfo.tierName))}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="pr-10 bg-muted/50 border-border"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">New Password</label>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="pr-10 bg-muted/50 border-border"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="bg-muted/50 border-border"
            />
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !newPassword || !confirmPassword}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {changingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* Reset via Email */}
      <Card className={cn('border bg-card', getRankBorderClass(rankInfo.tierName))}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            {resetStep === 'code' && (
              <button onClick={handleResetBack} className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              {resetStep === 'done' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <KeyRound className="w-5 h-5 text-accent" />}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {resetStep === 'idle' && 'Reset via Email'}
                {resetStep === 'code' && 'Enter Reset Code'}
                {resetStep === 'done' && 'Password Reset Complete'}
              </CardTitle>
              <CardDescription>
                {resetStep === 'idle' && "Forgot your password? We'll send a reset code to your email"}
                {resetStep === 'code' && 'Enter the 6-digit code from your email and set a new password'}
                {resetStep === 'done' && 'Your password has been successfully reset'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {resetStep === 'idle' && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border mb-4">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  A password reset code will be sent to <span className="text-foreground font-medium">{user?.email}</span>
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleResetViaEmail}
                disabled={sendingReset}
                className="border-border hover:bg-muted"
              >
                {sendingReset ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Send Reset Code
              </Button>
            </>
          )}

          {resetStep === 'code' && (
            <div className="space-y-4">
              {/* Code input */}
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Verification Code</label>
                <div className="flex gap-2 justify-start" onPaste={handleCodePaste}>
                  {resetCode.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { codeInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(idx, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                      className={cn(
                        'w-11 h-12 text-center text-lg font-semibold rounded-lg border bg-muted/50 transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent',
                        resetError ? 'border-destructive' : 'border-border'
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Check your email for the 6-digit code
                </p>
              </div>

              <Separator />

              {/* New password */}
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">New Password</label>
                <div className="relative">
                  <Input
                    type={showResetNewPassword ? 'text' : 'password'}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10 bg-muted/50 border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showResetNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Confirm New Password</label>
                <Input
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="bg-muted/50 border-border"
                />
              </div>

              {resetError && (
                <p className="text-sm text-destructive">{resetError}</p>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleVerifyAndReset}
                  disabled={verifyingReset || resetCode.join('').length !== CODE_LENGTH || !resetNewPassword || !resetConfirmPassword}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {verifyingReset && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Reset Password
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleResetViaEmail}
                  disabled={sendingReset}
                  className="text-muted-foreground"
                >
                  {sendingReset ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Resend Code
                </Button>
              </div>
            </div>
          )}

          {resetStep === 'done' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your password has been updated. You can now use your new password to log in.
              </p>
              <Button
                variant="outline"
                onClick={handleResetBack}
                className="border-border hover:bg-muted"
              >
                Done
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
