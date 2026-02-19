/**
 * Password Tab - Change password + reset password via email
 */

import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, Mail, KeyRound } from 'lucide-react';
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

export function PasswordTab() {
  const { user } = useAuth();
  const { totalWageredSc } = useProfile();
  const rankInfo = getRankFromTotalWagered(totalWageredSc);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

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
      else { toast.success('Password reset link sent to your email!'); }
    } catch { toast.error('Failed to send reset email'); }
    finally { setSendingReset(false); }
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
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Reset via Email</CardTitle>
              <CardDescription>Forgot your password? We'll send a reset link to your email</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border mb-4">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              A password reset link will be sent to <span className="text-foreground font-medium">{user?.email}</span>
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleResetViaEmail}
            disabled={sendingReset}
            className="border-border hover:bg-muted"
          >
            {sendingReset ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Send Reset Link
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
