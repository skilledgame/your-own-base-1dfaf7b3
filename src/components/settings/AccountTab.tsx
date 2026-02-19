/**
 * Account Tab - Discord-inspired layout
 * 
 * Sections (top to bottom):
 * 1. Profile card: avatar (hoverable → navigate to Avatar tab) + editable display name
 * 2. Change Email
 * 3. Change Password
 * 4. Two-Factor Authentication (MFA)
 * 5. Member since
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, User, Check, Loader2, Edit2, Save, X, Clock,
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
import { MFAEnroll } from '@/components/MFAEnroll';
import { clearEmailMfaVerified } from '@/lib/mfaStorage';
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
  const { user, signOut } = useAuth();
  const { skinColor, skinIcon } = useProfile();

  // ── Display Name state ──────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [cooldownAllowed, setCooldownAllowed] = useState(true);
  const [nextChangeAt, setNextChangeAt] = useState<Date | null>(null);
  const [cooldownLoading, setCooldownLoading] = useState(true);

  const [showConfirm, setShowConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!isEditingName) return;
    const trimmed = displayName.trim();
    if (!trimmed) { setIsAvailable(null); setValidationError(null); return; }
    const timer = setTimeout(() => checkAvailability(trimmed), 400);
    return () => clearTimeout(timer);
  }, [displayName, checkAvailability, isEditingName]);

  const startEditing = () => {
    if (!cooldownAllowed) return;
    setIsEditingName(true);
    setIsAvailable(null);
    setValidationError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEditing = () => {
    setIsEditingName(false);
    setDisplayName(originalName);
    setIsAvailable(null);
    setValidationError(null);
  };

  const handleSaveClick = () => {
    const trimmed = displayName.trim();
    if (trimmed.toLowerCase() === originalName.toLowerCase()) { setIsEditingName(false); return; }
    try { usernameSchema.parse(trimmed); } catch (error) {
      if (error instanceof z.ZodError) { setValidationError(error.errors[0].message); return; }
    }
    if (isAvailable !== true) return;
    setShowConfirm(true);
  };

  const handleConfirmedSave = async () => {
    if (!user?.id) return;
    const trimmed = displayName.trim();
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
        setIsEditingName(false);
        setDisplayName(originalName);
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
        setIsEditingName(false);
        setIsAvailable(null);
        setCooldownAllowed(false);
        setNextChangeAt(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
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

  // ── Password change ─────────────────────────────────────────
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    setChangingPassword(true);
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

  const canSave =
    isEditingName && !saving && !isChecking && !validationError &&
    (displayName.trim().toLowerCase() !== originalName.toLowerCase()
      ? isAvailable === true
      : true);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ─── Profile Card (Discord-style) ─────────────────────── */}
      <Card className="border-border bg-card overflow-hidden">
        {/* Banner gradient */}
        <div className="h-24 bg-gradient-to-r from-accent/60 via-primary/40 to-accent/60" />

        <div className="px-6 pb-6">
          {/* Avatar + Name row */}
          <div className="flex items-end gap-4 -mt-10">
            {/* Avatar with hover overlay */}
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

            {/* Name + edit */}
            <div className="flex-1 min-w-0 pb-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={saving}
                      placeholder="Enter display name"
                      maxLength={20}
                      autoComplete="off"
                      className={cn(
                        'pr-8 border-border text-foreground text-lg font-semibold h-10',
                        validationError && 'border-destructive focus-visible:ring-destructive',
                        !validationError && isAvailable === true && 'border-emerald-500 focus-visible:ring-emerald-500',
                        !validationError && isAvailable === false && 'border-destructive focus-visible:ring-destructive',
                      )}
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      {isChecking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      {!isChecking && isAvailable === true && !validationError && <Check className="w-4 h-4 text-emerald-500" />}
                      {!isChecking && (isAvailable === false || validationError) && displayName.trim().length >= 3 && displayName.trim().toLowerCase() !== originalName.toLowerCase() && (
                        <X className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  </div>
                  <Button size="icon" onClick={handleSaveClick} disabled={!canSave || saving} className="bg-accent hover:bg-accent/90 text-accent-foreground h-10 w-10">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="outline" onClick={cancelEditing} disabled={saving} className="border-border hover:bg-muted h-10 w-10">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold truncate">{displayName || 'Player'}</h2>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={startEditing}
                    disabled={cooldownLoading || !cooldownAllowed}
                    className="text-muted-foreground hover:text-foreground h-8 w-8"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {!cooldownLoading && !cooldownAllowed && nextChangeAt && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Change available in {formatCooldownRemaining()}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Validation / availability messages */}
          {isEditingName && validationError && (
            <p className="text-sm text-destructive mt-2 ml-[calc(6rem+1rem)]">{validationError}</p>
          )}
          {isEditingName && !validationError && isAvailable === false && (
            <p className="text-sm text-destructive font-medium mt-2 ml-[calc(6rem+1rem)]">Username is already taken</p>
          )}
          {isEditingName && !validationError && isAvailable === true && (
            <p className="text-sm text-emerald-500 mt-2 ml-[calc(6rem+1rem)]">Username is available!</p>
          )}

          {/* Cooldown info */}
          <div className="flex items-start gap-2 p-3 mt-4 rounded-lg bg-muted/30 border border-border">
            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                You can only change your username <span className="text-foreground font-medium">once every 14 days</span>. Choose wisely!
              </p>
              {!cooldownAllowed && nextChangeAt && (
                <p className="text-xs text-amber-500 mt-1">
                  Next change available: {nextChangeAt.toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            3-20 characters. Letters, numbers, and underscores only.
          </p>
        </div>
      </Card>

      {/* ─── Email Section ────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold">Email</CardTitle>
                {emailVerified ? (
                  <Badge className="bg-accent/20 text-accent border-accent/30 hover:bg-accent/20">
                    <Check className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                    Unverified
                  </Badge>
                )}
              </div>
              <CardDescription>Manage your email address</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Current Email</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={user?.email || ''} disabled className="pl-10 bg-muted/50 border-border text-foreground" />
              </div>
            </div>
          </div>

          {isEditingEmail ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">New Email Address</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
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
              <div className="flex gap-2">
                <Button
                  onClick={handleChangeEmail}
                  disabled={savingEmail || !newEmail}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {savingEmail && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Email
                </Button>
                <Button variant="outline" onClick={() => { setIsEditingEmail(false); setNewEmail(''); }} className="border-border hover:bg-muted">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setIsEditingEmail(true)} className="border-border hover:bg-muted">
              <Edit2 className="w-4 h-4 mr-2" />
              Change Email
            </Button>
          )}

          {!emailVerified && (
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => toast.info('Verification email sent!')}
            >
              Confirm Email
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── Change Password ──────────────────────────────────── */}
      {!isOAuthUser && (
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
      )}

      {/* ─── Two-Factor Authentication ────────────────────────── */}
      {!isOAuthUser && (
        <Card className="border-border bg-card">
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
                      'relative p-4 rounded-xl border-2 transition-all text-left disabled:opacity-60 disabled:cursor-default',
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
      <Card className="border-border bg-card">
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
                <span className="font-semibold text-foreground">"{displayName.trim()}"</span>.
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
