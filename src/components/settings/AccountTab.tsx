/**
 * Account Tab - Discord-inspired layout
 * 
 * Sections (top to bottom):
 * 1. Profile card: avatar (hoverable → navigate to Avatar tab) + display name with edit popup
 * 2. Change Email
 * 3. Change Password
 * 4. Two-Factor Authentication (MFA)
 * 5. Member since
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Check, Loader2, Edit2, Save, X, Clock,
  AlertTriangle, Lock, Shield, Smartphone, Eye, EyeOff, Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { RankBadge } from '@/components/RankBadge';
import { getRankFromTotalWagered } from '@/lib/rankSystem';
import { MFAEnroll } from '@/components/MFAEnroll';
import { clearEmailMfaVerified } from '@/lib/mfaStorage';

// ─── Rank border helper ───────────────────────────────────────
function getRankBorderClass(tierName: string): string {
  switch (tierName) {
    case 'goat': return 'border-purple-500/60';
    case 'diamond': return 'border-blue-500/70';
    case 'platinum': return 'border-sky-400/60';
    case 'gold': return 'border-yellow-500/60';
    case 'silver': return 'border-slate-400/60';
    case 'bronze': return 'border-amber-700/60';
    default: return 'border-border';
  }
}

function getRankGradientClass(tierName: string): string {
  switch (tierName) {
    case 'goat': return 'from-purple-400 to-violet-600';
    case 'diamond': return 'from-blue-400 to-blue-600';
    case 'platinum': return 'from-sky-300 to-sky-500';
    case 'gold': return 'from-yellow-400 to-amber-500';
    case 'silver': return 'from-slate-300 to-slate-400';
    case 'bronze': return 'from-orange-600 to-orange-800';
    default: return 'from-gray-500 to-gray-600';
  }
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─── Props ────────────────────────────────────────────────────
interface AccountTabProps {
  onNavigateToAvatar?: () => void;
}

// ─── Validation ───────────────────────────────────────────────
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed');

// ─── MFA Types ────────────────────────────────────────────────
type MFAStatus = 'loading' | 'not-enrolled' | 'enrolled' | 'enrolling';
type MfaMethod = 'none' | 'email' | 'totp';

interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: string;
}

// ═══════════════════════════════════════════════════════════════
export function AccountTab({ onNavigateToAvatar }: AccountTabProps) {
  const { user } = useAuth();
  const { skinColor, skinIcon, totalWageredSc } = useProfile();
  const rankInfo = getRankFromTotalWagered(totalWageredSc);

  // ── Display Name state ──────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── Edit Name Dialog ────────────────────────────────────────
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [cooldownAllowed, setCooldownAllowed] = useState(true);
  const [nextChangeAt, setNextChangeAt] = useState<Date | null>(null);
  const [cooldownLoading, setCooldownLoading] = useState(true);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showCooldownError, setShowCooldownError] = useState(false);
  const editNameInputRef = useRef<HTMLInputElement>(null);

  // ── Email change state ──────────────────────────────────────
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // ── Password state ──────────────────────────────────────────
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // ── MFA state ───────────────────────────────────────────────
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>('loading');
  const [mfaFactors, setMfaFactors] = useState<MFAFactor[]>([]);
  const [unenrolling, setUnenrolling] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<MfaMethod>('none');
  const [switchingMethod, setSwitchingMethod] = useState(false);

  const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== 'email';

  // ── Init ────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      fetchProfile();
      checkCooldown();
      loadMFAData();
    }
  }, [user?.id]);

  // ── Profile fetch ───────────────────────────────────────────
  const fetchProfile = async () => {
    setProfileLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
      setOriginalName(data.display_name || '');
    }
    setProfileLoading(false);
  };

  // ── Cooldown ────────────────────────────────────────────────
  const checkCooldown = async () => {
    setCooldownLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_username_change_allowed', {
        for_user_id: user!.id,
      });
      if (error) {
        setCooldownAllowed(true);
      } else if (data) {
        setCooldownAllowed(data.allowed);
        setNextChangeAt(data.next_change_at ? new Date(data.next_change_at) : null);
      }
    } catch {
      setCooldownAllowed(true);
    } finally {
      setCooldownLoading(false);
    }
  };

  // ── Availability check ──────────────────────────────────────
  const checkAvailability = useCallback(
    async (name: string) => {
      if (!name || name.length < 3) { setIsAvailable(null); return; }
      if (name.toLowerCase() === originalName.toLowerCase()) { setIsAvailable(null); return; }

      try {
        usernameSchema.parse(name);
        setValidationError(null);
      } catch (error) {
        if (error instanceof z.ZodError) {
          setValidationError(error.errors[0].message);
          setIsAvailable(null);
          return;
        }
      }

      setIsChecking(true);
      try {
        const { data, error } = await supabase.rpc('check_username_available', {
          desired_name: name,
          for_user_id: user!.id,
        });
        if (error) { setIsAvailable(null); return; }
        setIsAvailable(data === true);
      } catch { setIsAvailable(null); } finally { setIsChecking(false); }
    },
    [user?.id, originalName]
  );

  // Debounce availability check inside the edit dialog
  useEffect(() => {
    if (!showEditNameDialog) return;
    const trimmed = editNameValue.trim();
    if (!trimmed) { setIsAvailable(null); setValidationError(null); return; }
    const timer = setTimeout(() => checkAvailability(trimmed), 400);
    return () => clearTimeout(timer);
  }, [editNameValue, checkAvailability, showEditNameDialog]);

  const openEditNameDialog = () => {
    setEditNameValue(originalName);
    setIsAvailable(null);
    setValidationError(null);
    setShowCooldownError(false);
    setShowEditNameDialog(true);
    setTimeout(() => editNameInputRef.current?.focus(), 100);
  };

  const closeEditNameDialog = () => {
    setShowEditNameDialog(false);
    setEditNameValue('');
    setIsAvailable(null);
    setValidationError(null);
    setShowCooldownError(false);
  };

  const handleSaveClick = () => {
    // If on cooldown, show the cooldown error instead of proceeding
    if (!cooldownLoading && !cooldownAllowed) {
      setShowCooldownError(true);
      return;
    }

    const trimmed = editNameValue.trim();
    if (trimmed.toLowerCase() === originalName.toLowerCase()) { closeEditNameDialog(); return; }
    try { usernameSchema.parse(trimmed); } catch (error) {
      if (error instanceof z.ZodError) { setValidationError(error.errors[0].message); return; }
    }
    if (isAvailable !== true) return;
    setShowConfirm(true);
  };

  const handleConfirmedSave = async () => {
    if (!user?.id) return;
    const trimmed = editNameValue.trim();
    setShowConfirm(false);
    setSaving(true);

    try {
      const { data: stillAvailable } = await supabase.rpc('check_username_available', {
        desired_name: trimmed, for_user_id: user.id,
      });
      if (!stillAvailable) {
        setIsAvailable(false);
        toast.error('Username was just taken! Please try another.');
        setSaving(false);
        return;
      }

      const { data: cooldownData } = await supabase.rpc('check_username_change_allowed', {
        for_user_id: user.id,
      });
      if (cooldownData && !cooldownData.allowed) {
        setCooldownAllowed(false);
        setNextChangeAt(cooldownData.next_change_at ? new Date(cooldownData.next_change_at) : null);
        toast.error('You can only change your username once every 14 days.');
        closeEditNameDialog();
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed, display_name_changed_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) {
        if (error.message.includes('idx_profiles_display_name_unique') || error.message.includes('duplicate')) {
          setIsAvailable(false);
          toast.error('Username is already taken!');
        } else {
          toast.error('Failed to update username');
        }
      } else {
        await supabase.from('players').update({ name: trimmed }).eq('user_id', user.id);
        toast.success('Username updated!');
        setOriginalName(trimmed);
        setDisplayName(trimmed);
        setIsAvailable(null);
        setCooldownAllowed(false);
        setNextChangeAt(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
        closeEditNameDialog();
        fetchProfile();
      }
    } catch { toast.error('Failed to update username'); } finally { setSaving(false); }
  };

  // ── Email change ────────────────────────────────────────────
  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSavingEmail(true);
    try {
      // Elevate session to AAL2 if TOTP MFA is active
      const elevated = await elevateToAAL2();
      if (!elevated) { setSavingEmail(false); return; }

      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Confirmation email sent to your new address. Please verify it.');
        setIsEditingEmail(false);
        setNewEmail('');
      }
    } catch {
      toast.error('Failed to update email');
    } finally {
      setSavingEmail(false);
    }
  };

  // ── AAL2 elevation (needed when TOTP MFA is active) ────────
  const elevateToAAL2 = async (): Promise<boolean> => {
    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aalData || aalData.currentLevel === 'aal2') return true; // already elevated
      if (aalData.nextLevel !== 'aal2') return true; // no elevation needed

      // Need to elevate — get the TOTP factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find(f => f.status === 'verified');
      if (!totpFactor) return true; // no verified TOTP, shouldn't need AAL2

      // Create challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challengeError || !challenge) {
        toast.error('MFA challenge failed. Please re-verify your authenticator app.');
        return false;
      }

      // Ask user for TOTP code via prompt (simple approach)
      const code = window.prompt('Enter your 6-digit authenticator code to confirm this change:');
      if (!code || code.length !== 6) {
        toast.error('MFA verification cancelled.');
        return false;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        toast.error('Invalid authenticator code. Please try again.');
        return false;
      }

      return true; // session is now at AAL2
    } catch {
      toast.error('MFA verification failed.');
      return false;
    }
  };

  // ── Password change ─────────────────────────────────────────
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    setChangingPassword(true);

    // Elevate session to AAL2 if TOTP MFA is active
    const elevated = await elevateToAAL2();
    if (!elevated) { setChangingPassword(false); return; }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); } else {
      toast.success('Password updated successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  // ── MFA ─────────────────────────────────────────────────────
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
    } catch { toast.error('Failed to disable authenticator app'); } finally { setUnenrolling(false); }
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
    } catch { toast.error('Failed to switch 2FA method'); } finally { setSwitchingMethod(false); }
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
    } catch { toast.error('Failed to disable 2FA'); } finally { setSwitchingMethod(false); }
  };

  // ── Helpers ─────────────────────────────────────────────────
  const emailVerified = user?.email_confirmed_at != null;

  const formatCooldownRemaining = () => {
    if (!nextChangeAt) return '';
    const diff = nextChangeAt.getTime() - Date.now();
    if (diff <= 0) return '';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  };

  const canSaveInDialog =
    !saving && !isChecking && !validationError &&
    editNameValue.trim().length >= 3 &&
    (editNameValue.trim().toLowerCase() !== originalName.toLowerCase()
      ? isAvailable === true
      : false);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ─── Profile Card ─────────────────────────────────────── */}
      <Card className={cn("border-2 bg-card overflow-hidden", getRankBorderClass(rankInfo.tierName))}>
        {/* Discord-style rank banner with shine */}
        <div className={cn("h-24 bg-gradient-to-r animate-banner-shine", getRankGradientClass(rankInfo.tierName))} />

        {/* Avatar overlapping the banner */}
        <div className="relative px-6">
          <div className="-mt-10 flex items-end gap-5">
            <button
              type="button"
              onClick={onNavigateToAvatar}
              className="group relative flex-shrink-0 rounded-full ring-4 ring-card"
              title="Edit Avatar"
            >
              <PlayerAvatar skinColor={skinColor} skinIcon={skinIcon} size="xl" />
              {/* Hover overlay */}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <Pencil className="w-6 h-6 text-white" />
              </div>
            </button>

            {/* Name + edit button (aligned to avatar bottom) */}
            <div className="flex-1 min-w-0 pb-1">
              {profileLoading ? (
                <div className="space-y-1.5">
                  <div className="h-6 w-40 rounded-md bg-muted/50 animate-pulse" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold truncate">{displayName || 'Unknown'}</h2>
                  <RankBadge rank={rankInfo} size="sm" />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={openEditNameDialog}
                    className="text-muted-foreground hover:text-foreground h-8 w-8"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <CardContent className="pt-4 pb-6 space-y-4">
          <Separator className="bg-border" />

          {/* Email row */}
          <div className="flex items-center gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <p className="text-base font-medium truncate">{user?.email || 'No email'}</p>
                {emailVerified ? (
                  <Badge className="bg-accent/20 text-accent border-accent/30 hover:bg-accent/20 text-[10px] px-1.5 py-0.5">
                    <Check className="w-3 h-3 mr-0.5" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-[10px] px-1.5 py-0.5">
                    Unverified
                  </Badge>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setNewEmail(''); setIsEditingEmail(true); }}
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Email Address</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Change Password ──────────────────────────────────── */}
      {!isOAuthUser && (
        <Card className={cn("border bg-card", getRankBorderClass(rankInfo.tierName))}>
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
      )}

      {/* ─── Two-Factor Authentication ────────────────────────── */}
      {!isOAuthUser && (
        <Card className={cn("border bg-card", getRankBorderClass(rankInfo.tierName))}>
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
                      'relative p-4 rounded-md border-2 transition-all text-left disabled:opacity-60 disabled:cursor-default',
                      mfaMethod === 'email'
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-muted/30 hover:border-muted-foreground/30 hover:bg-muted/50',
                    )}
                  >
                    {mfaMethod === 'email' && (
                      <div className="absolute top-2.5 right-2.5">
                        <Check className="w-4 h-4 text-accent" />
                      </div>
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
                      'relative p-4 rounded-md border-2 transition-all text-left disabled:opacity-60 disabled:cursor-default',
                      mfaMethod === 'totp'
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-muted/30 hover:border-muted-foreground/30 hover:bg-muted/50',
                    )}
                  >
                    {mfaMethod === 'totp' && mfaStatus === 'enrolled' && (
                      <div className="absolute top-2.5 right-2.5">
                        <Check className="w-4 h-4 text-accent" />
                      </div>
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
      )}

      {/* ─── Member Since ─────────────────────────────────────── */}
      <Card className={cn("border bg-card", getRankBorderClass(rankInfo.tierName))}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Member since</span>
            <span className="text-foreground font-medium">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'Unknown'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Edit Username Dialog ─────────────────────────────── */}
      <Dialog open={showEditNameDialog} onOpenChange={(open) => { if (!open) closeEditNameDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Username</DialogTitle>
            <DialogDescription>
              Enter a new display name for your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Input */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Display Name</label>
              <div className="relative">
                <Input
                  ref={editNameInputRef}
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  disabled={saving}
                  placeholder="Enter display name"
                  maxLength={20}
                  autoComplete="off"
                  className={cn(
                    'pr-10 border-border text-foreground',
                    validationError && 'border-destructive focus-visible:ring-destructive',
                    !validationError && isAvailable === true && 'border-emerald-500 focus-visible:ring-emerald-500',
                    !validationError && isAvailable === false && 'border-destructive focus-visible:ring-destructive',
                  )}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isChecking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {!isChecking && isAvailable === true && !validationError && <Check className="w-4 h-4 text-emerald-500" />}
                  {!isChecking && (isAvailable === false || validationError) && editNameValue.trim().length >= 3 && editNameValue.trim().toLowerCase() !== originalName.toLowerCase() && (
                    <X className="w-4 h-4 text-destructive" />
                  )}
                </div>
              </div>
            </div>

            {/* Validation / availability messages */}
            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
            {!validationError && isAvailable === false && (
              <p className="text-sm text-destructive font-medium">Username is already taken</p>
            )}
            {!validationError && isAvailable === true && (
              <p className="text-sm text-emerald-500">Username is available!</p>
            )}

            <p className="text-xs text-muted-foreground">
              3-20 characters. Letters, numbers, and underscores only.
            </p>

            {/* Cooldown error — only shown after clicking Save while on cooldown */}
            {showCooldownError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-amber-500 font-medium">
                    Username change is on cooldown.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can only change your username <span className="text-foreground font-medium">once every 14 days</span>.
                  </p>
                  {nextChangeAt && (
                    <p className="text-xs text-amber-500 mt-1">
                      Next change available: {nextChangeAt.toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditNameDialog} disabled={saving} className="border-border hover:bg-muted">
              Cancel
            </Button>
            <Button
              onClick={handleSaveClick}
              disabled={saving || (showCooldownError)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Email Dialog ────────────────────────────────── */}
      <Dialog open={isEditingEmail} onOpenChange={(open) => { if (!open) { setIsEditingEmail(false); setNewEmail(''); } }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Change Email
            </DialogTitle>
            <DialogDescription>
              Enter your new email address. A confirmation link will be sent to verify the change.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Current Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={user?.email || ''} disabled className="pl-10 bg-muted/50 border-border text-foreground" />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">New Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email"
                  type="email"
                  className="pl-10 bg-muted/50 border-border text-foreground"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditingEmail(false); setNewEmail(''); }} disabled={savingEmail} className="border-border hover:bg-muted">
              Cancel
            </Button>
            <Button
              onClick={handleChangeEmail}
              disabled={savingEmail || !newEmail}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {savingEmail && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Confirmation Dialog ──────────────────────────────── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Change Username?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                You're about to change your username from{' '}
                <span className="font-semibold text-foreground">"{originalName}"</span> to{' '}
                <span className="font-semibold text-foreground">"{editNameValue.trim()}"</span>.
              </span>
              <span className="block text-amber-500 font-medium">
                You won't be able to change it again for 14 days.
              </span>
              <span className="block">Are you sure you want to continue?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedSave}>Yes, Change Username</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
