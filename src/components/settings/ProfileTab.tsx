/**
 * Profile Tab - Discord-inspired profile card
 *
 * Shows: avatar (hoverable → navigate to Avatar tab), display name with edit popup,
 * email with edit popup, member since.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Check, Loader2, Edit2, Save, X, Clock,
  AlertTriangle, Pencil,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

// ─── Rank helpers (shared) ─────────────────────────────────────
export function getRankBorderClass(tierName: string): string {
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

export function getRankGradientClass(tierName: string): string {
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

// ─── Validation ─────────────────────────────────────────────────
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed');

// ─── Props ──────────────────────────────────────────────────────
interface ProfileTabProps {
  onNavigateToAvatar?: () => void;
}

// ─── AAL2 elevation helper ──────────────────────────────────────
export async function elevateToAAL2(): Promise<boolean> {
  try {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aalData || aalData.currentLevel === 'aal2') return true;
    if (aalData.nextLevel !== 'aal2') return true;

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.find(f => f.status === 'verified');
    if (!totpFactor) return true;

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
    if (challengeError || !challenge) {
      toast.error('MFA challenge failed. Please re-verify your authenticator app.');
      return false;
    }

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
    return true;
  } catch {
    toast.error('MFA verification failed.');
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
export function ProfileTab({ onNavigateToAvatar }: ProfileTabProps) {
  const { user } = useAuth();
  const { skinColor, skinIcon, totalWageredSc } = useProfile();
  const rankInfo = getRankFromTotalWagered(totalWageredSc);

  // ── Display Name state ─────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── Edit Name Dialog ───────────────────────────────────────
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

  // ── Email change state ─────────────────────────────────────
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const emailVerified = user?.email_confirmed_at != null;

  // ── Init ───────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      fetchProfile();
      checkCooldown();
    }
  }, [user?.id]);

  // ── Profile fetch ──────────────────────────────────────────
  const fetchProfile = async () => {
    setProfileLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data) {
      setDisplayName(data.display_name || '');
      setOriginalName(data.display_name || '');
    }
    setProfileLoading(false);
  };

  // ── Cooldown ───────────────────────────────────────────────
  const checkCooldown = async () => {
    setCooldownLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_username_change_allowed', {
        for_user_id: user!.id,
      });
      if (error) { setCooldownAllowed(true); }
      else if (data) {
        setCooldownAllowed(data.allowed);
        setNextChangeAt(data.next_change_at ? new Date(data.next_change_at) : null);
      }
    } catch { setCooldownAllowed(true); }
    finally { setCooldownLoading(false); }
  };

  // ── Availability check ─────────────────────────────────────
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
          desired_name: name, for_user_id: user!.id,
        });
        if (error) { setIsAvailable(null); return; }
        setIsAvailable(data === true);
      } catch { setIsAvailable(null); }
      finally { setIsChecking(false); }
    },
    [user?.id, originalName],
  );

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
    if (!cooldownLoading && !cooldownAllowed) { setShowCooldownError(true); return; }
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
    } catch { toast.error('Failed to update username'); }
    finally { setSaving(false); }
  };

  // ── Email change ───────────────────────────────────────────
  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSavingEmail(true);
    try {
      const elevated = await elevateToAAL2();
      if (!elevated) { setSavingEmail(false); return; }

      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) { toast.error(error.message); }
      else {
        toast.success('Confirmation email sent to your new address. Please verify it.');
        setIsEditingEmail(false);
        setNewEmail('');
      }
    } catch { toast.error('Failed to update email'); }
    finally { setSavingEmail(false); }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ─── Profile Card ─────────────────────────────────────── */}
      <Card className={cn('border-2 bg-card overflow-hidden', getRankBorderClass(rankInfo.tierName))}>
        {/* Discord-style rank banner with shine */}
        <div className={cn('h-24 bg-gradient-to-r animate-banner-shine', getRankGradientClass(rankInfo.tierName))} />

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
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <Pencil className="w-6 h-6 text-white" />
              </div>
            </button>

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

      {/* ─── Member Since ─────────────────────────────────────── */}
      <Card className={cn('border bg-card', getRankBorderClass(rankInfo.tierName))}>
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
            <DialogDescription>Enter a new display name for your account.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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

            {validationError && <p className="text-sm text-destructive">{validationError}</p>}
            {!validationError && isAvailable === false && <p className="text-sm text-destructive font-medium">Username is already taken</p>}
            {!validationError && isAvailable === true && <p className="text-sm text-emerald-500">Username is available!</p>}

            <p className="text-xs text-muted-foreground">3-20 characters. Letters, numbers, and underscores only.</p>

            {showCooldownError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-amber-500 font-medium">Username change is on cooldown.</p>
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
            <Button variant="outline" onClick={closeEditNameDialog} disabled={saving} className="border-border hover:bg-muted">Cancel</Button>
            <Button onClick={handleSaveClick} disabled={saving || showCooldownError} className="bg-accent hover:bg-accent/90 text-accent-foreground">
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
            <DialogDescription>Enter your new email address. A confirmation link will be sent to verify the change.</DialogDescription>
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
            <Button variant="outline" onClick={() => { setIsEditingEmail(false); setNewEmail(''); }} disabled={savingEmail} className="border-border hover:bg-muted">Cancel</Button>
            <Button onClick={handleChangeEmail} disabled={savingEmail || !newEmail} className="bg-accent hover:bg-accent/90 text-accent-foreground">
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
              <span className="block text-amber-500 font-medium">You won't be able to change it again for 14 days.</span>
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
