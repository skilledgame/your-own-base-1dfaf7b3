/**
 * MFA Tab - Two-Factor Authentication enrollment & management
 */

import { useState, useEffect } from 'react';
import {
  Mail, Check, Loader2, X, Shield, Smartphone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getRankFromTotalWagered } from '@/lib/rankSystem';
import { MFAEnroll } from '@/components/MFAEnroll';
import { clearEmailMfaVerified } from '@/lib/mfaStorage';
import { getRankBorderClass } from './ProfileTab';

type MFAStatus = 'loading' | 'not-enrolled' | 'enrolled' | 'enrolling';
type MfaMethod = 'none' | 'email' | 'totp';

interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: string;
}

export function MFATab() {
  const { user } = useAuth();
  const { totalWageredSc } = useProfile();
  const rankInfo = getRankFromTotalWagered(totalWageredSc);

  const [mfaStatus, setMfaStatus] = useState<MFAStatus>('loading');
  const [mfaFactors, setMfaFactors] = useState<MFAFactor[]>([]);
  const [unenrolling, setUnenrolling] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<MfaMethod>('none');
  const [switchingMethod, setSwitchingMethod] = useState(false);

  const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== 'email';

  useEffect(() => {
    if (user?.id) loadMFAData();
  }, [user?.id]);

  const loadMFAData = async () => {
    setMfaStatus('loading');
    try {
      const currentMethod = (user?.user_metadata?.mfa_method as string) || 'none';
      setMfaMethod(currentMethod as MfaMethod);

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setMfaStatus('not-enrolled'); return; }

      const verifiedFactors = data.totp.filter(f => f.status === 'verified');
      setMfaFactors(verifiedFactors.map(f => ({
        id: f.id,
        friendly_name: f.friendly_name ?? 'Authenticator App',
        factor_type: f.factor_type,
        status: f.status,
      })));
      setMfaStatus(verifiedFactors.length > 0 ? 'enrolled' : 'not-enrolled');
    } catch { setMfaStatus('not-enrolled'); }
  };

  const handleUnenrollFactor = async (factorId: string) => {
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) { toast.error(error.message); return; }
      if (mfaMethod === 'totp') {
        await supabase.auth.updateUser({ data: { mfa_method: 'email' } });
        setMfaMethod('email');
        toast.success('Authenticator app removed. Switched to email 2FA.');
      } else { toast.success('Authenticator app removed.'); }
      await supabase.auth.refreshSession();
      await loadMFAData();
    } catch { toast.error('Failed to disable authenticator app'); }
    finally { setUnenrolling(false); }
  };

  const handleMFAEnrolled = async () => {
    try { await supabase.auth.updateUser({ data: { mfa_method: 'totp' } }); setMfaMethod('totp'); } catch {}
    toast.success('Authenticator app enabled!');
    setMfaStatus('enrolled');
    await loadMFAData();
  };

  const handleSwitchToEmail = async () => {
    setSwitchingMethod(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = factors?.totp?.filter(f => f.status === 'verified') ?? [];
      for (const factor of verifiedTotp) { await supabase.auth.mfa.unenroll({ factorId: factor.id }); }
      await supabase.auth.updateUser({ data: { mfa_method: 'email' } });
      clearEmailMfaVerified();
      setMfaMethod('email'); setMfaFactors([]); setMfaStatus('not-enrolled');
      await supabase.auth.refreshSession();
      toast.success('Switched to email 2FA.');
    } catch { toast.error('Failed to switch 2FA method'); }
    finally { setSwitchingMethod(false); }
  };

  const handleSwitchToApp = () => { setMfaStatus('enrolling'); };

  const handleDisable2FA = async () => {
    setSwitchingMethod(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const factor of factors?.totp ?? []) { await supabase.auth.mfa.unenroll({ factorId: factor.id }); }
      await supabase.auth.updateUser({ data: { mfa_method: 'none' } });
      clearEmailMfaVerified();
      setMfaMethod('none'); setMfaFactors([]); setMfaStatus('not-enrolled');
      await supabase.auth.refreshSession();
      toast.success('Two-factor authentication disabled.');
    } catch { toast.error('Failed to disable 2FA'); }
    finally { setSwitchingMethod(false); }
  };

  if (isOAuthUser) {
    return (
      <div className="space-y-6">
        <Card className={cn('border bg-card', getRankBorderClass(rankInfo.tierName))}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Two-Factor Authentication</CardTitle>
                <CardDescription>2FA is not available for social login accounts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You signed in with a social provider. Two-factor authentication is managed by your identity provider.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={cn('border bg-card', getRankBorderClass(rankInfo.tierName))}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold">Two-Factor Authentication</CardTitle>
              <CardDescription>Choose your default 2FA method</CardDescription>
            </div>
            {mfaMethod !== 'none' && (
              <Badge className="bg-green-500/20 text-green-400 border-0">
                <Check className="w-3 h-3 mr-1" />
                Enabled
              </Badge>
            )}
            {mfaMethod === 'none' && mfaStatus !== 'loading' && (
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

          {mfaStatus !== 'loading' && mfaStatus !== 'enrolling' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose how you want to verify your identity when logging in:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email 2FA */}
                <button
                  type="button"
                  onClick={mfaMethod !== 'email' ? handleSwitchToEmail : undefined}
                  disabled={switchingMethod || mfaMethod === 'email'}
                  className={cn(
                    'relative p-4 rounded-xl border-2 transition-all text-left disabled:opacity-60 disabled:cursor-default',
                    mfaMethod === 'email'
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-muted/30 hover:border-muted-foreground/30 hover:bg-muted/50',
                  )}
                >
                  {mfaMethod === 'email' && (
                    <div className="absolute top-2.5 right-2.5"><Check className="w-4 h-4 text-accent" /></div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', mfaMethod === 'email' ? 'bg-accent/15' : 'bg-muted/50')}>
                      <Mail className={cn('w-4 h-4', mfaMethod === 'email' ? 'text-accent' : 'text-muted-foreground')} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn('font-medium text-sm', mfaMethod === 'email' ? 'text-foreground' : 'text-muted-foreground')}>Email Code</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Receive a verification code via email each time you log in</p>
                    </div>
                  </div>
                </button>

                {/* Authenticator App */}
                <button
                  type="button"
                  onClick={mfaMethod !== 'totp' ? handleSwitchToApp : undefined}
                  disabled={switchingMethod || (mfaMethod === 'totp' && mfaStatus === 'enrolled')}
                  className={cn(
                    'relative p-4 rounded-xl border-2 transition-all text-left disabled:opacity-60 disabled:cursor-default',
                    mfaMethod === 'totp'
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-muted/30 hover:border-muted-foreground/30 hover:bg-muted/50',
                  )}
                >
                  {mfaMethod === 'totp' && mfaStatus === 'enrolled' && (
                    <div className="absolute top-2.5 right-2.5"><Check className="w-4 h-4 text-accent" /></div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', mfaMethod === 'totp' ? 'bg-accent/15' : 'bg-muted/50')}>
                      <Smartphone className={cn('w-4 h-4', mfaMethod === 'totp' ? 'text-accent' : 'text-muted-foreground')} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn('font-medium text-sm', mfaMethod === 'totp' ? 'text-foreground' : 'text-muted-foreground')}>Authenticator App</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Use Google Authenticator, Authy, or 1Password</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Enrolled TOTP factors */}
              {mfaMethod === 'totp' && mfaFactors.length > 0 && (
                <div className="space-y-2">
                  {mfaFactors.map((factor) => (
                    <div key={factor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-green-400" />
                        <div>
                          <p className="font-medium text-sm">{factor.friendly_name}</p>
                          <p className="text-xs text-muted-foreground">TOTP · Active</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10 h-8"
                        onClick={() => handleUnenrollFactor(factor.id)}
                        disabled={unenrolling}
                      >
                        {unenrolling ? <Loader2 className="w-3 h-3 animate-spin" /> : <><X className="w-3 h-3 mr-1" />Remove</>}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {switchingMethod && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Updating...</span>
                </div>
              )}

              {mfaMethod !== 'none' && (
                <>
                  <Separator className="bg-border" />
                  <Button
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleDisable2FA}
                    disabled={switchingMethod}
                  >
                    Disable Two-Factor Authentication
                  </Button>
                </>
              )}
            </div>
          )}

          {mfaStatus === 'enrolling' && (
            <div className="py-2">
              <MFAEnroll
                onEnrolled={handleMFAEnrolled}
                onSkipped={() => { setMfaStatus(mfaFactors.length > 0 ? 'enrolled' : 'not-enrolled'); }}
                allowSkip={true}
                title="Set Up Authenticator"
                description="Scan the QR code below with your authenticator app"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
