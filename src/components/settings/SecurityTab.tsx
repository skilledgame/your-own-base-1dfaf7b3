/**
 * Security Tab - Password, 2FA, Sessions
 */

import { useState, useEffect } from 'react';
import { Lock, Shield, Smartphone, LogOut, Eye, EyeOff, Loader2, AlertTriangle, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MFAEnroll } from '@/components/MFAEnroll';

type MFAStatus = 'loading' | 'not-enrolled' | 'enrolled' | 'enrolling';

interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: string;
}

export function SecurityTab() {
  const { signOut } = useAuth();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // MFA state
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>('loading');
  const [mfaFactors, setMfaFactors] = useState<MFAFactor[]>([]);
  const [unenrolling, setUnenrolling] = useState(false);

  // Load MFA factors on mount
  useEffect(() => {
    loadMFAFactors();
  }, []);

  const loadMFAFactors = async () => {
    setMfaStatus('loading');
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        console.error('Failed to list MFA factors:', error);
        setMfaStatus('not-enrolled');
        return;
      }

      const verifiedFactors = data.totp.filter(f => f.status === 'verified');
      setMfaFactors(verifiedFactors.map(f => ({
        id: f.id,
        friendly_name: f.friendly_name ?? 'Authenticator App',
        factor_type: f.factor_type,
        status: f.status,
      })));
      setMfaStatus(verifiedFactors.length > 0 ? 'enrolled' : 'not-enrolled');
    } catch {
      setMfaStatus('not-enrolled');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  const handleUnenrollFactor = async (factorId: string) => {
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Two-factor authentication disabled');
      // Refresh session to update AAL level
      await supabase.auth.refreshSession();
      await loadMFAFactors();
    } catch {
      toast.error('Failed to disable 2FA');
    } finally {
      setUnenrolling(false);
    }
  };

  const handleMFAEnrolled = async () => {
    toast.success('Two-factor authentication enabled!');
    setMfaStatus('enrolled');
    await loadMFAFactors();
  };

  const handleSignOutAllDevices = async () => {
    await signOut();
    toast.success('Signed out from all devices');
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card className="border-border bg-card">
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

      {/* Two-Factor Authentication */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold">Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </div>
            {mfaStatus === 'enrolled' && (
              <Badge className="bg-green-500/20 text-green-400 border-0">
                <Check className="w-3 h-3 mr-1" />
                Enabled
              </Badge>
            )}
            {mfaStatus === 'not-enrolled' && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-0">
                Not Set Up
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {mfaStatus === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {mfaStatus === 'enrolled' && (
            <div className="space-y-4">
              {mfaFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="font-medium text-sm">{factor.friendly_name}</p>
                      <p className="text-xs text-muted-foreground">Authenticator App (TOTP)</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => handleUnenrollFactor(factor.id)}
                    disabled={unenrolling}
                  >
                    {unenrolling ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <X className="w-3 h-3 mr-1" />
                        Remove
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {mfaStatus === 'not-enrolled' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Authenticator App</p>
                    <p className="text-xs text-muted-foreground">Use Google Authenticator, Authy, or 1Password</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setMfaStatus('enrolling')}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  Set Up
                </Button>
              </div>
            </div>
          )}

          {mfaStatus === 'enrolling' && (
            <div className="py-2">
              <MFAEnroll
                onEnrolled={handleMFAEnrolled}
                onSkipped={() => setMfaStatus('not-enrolled')}
                allowSkip={true}
                title="Set Up Authenticator"
                description="Scan the QR code below with your authenticator app"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Active Sessions</CardTitle>
          <CardDescription>Manage your logged-in devices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-sm">Current Session</p>
                  <p className="text-xs text-muted-foreground">This device · Active now</p>
                </div>
              </div>
              <Badge className="bg-accent/20 text-accent border-0">Active</Badge>
            </div>
          </div>

          <Separator className="bg-border" />

          <Button 
            variant="outline" 
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleSignOutAllDevices}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out All Devices
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-lg font-semibold text-destructive">Danger Zone</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
            </div>
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
