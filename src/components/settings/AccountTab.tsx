/**
 * Account Tab - Email, Phone, Display Name settings
 * 
 * Display Name section includes:
 * - Real-time availability check (case-insensitive)
 * - 14-day cooldown between name changes
 * - Confirmation dialog before saving
 * - "Username taken" error display
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Phone, User, Check, Loader2, Edit2, Save, X, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';
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

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed');

export function AccountTab() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Username validation & availability
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Cooldown state
  const [cooldownAllowed, setCooldownAllowed] = useState(true);
  const [nextChangeAt, setNextChangeAt] = useState<Date | null>(null);
  const [cooldownLoading, setCooldownLoading] = useState(true);

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
      checkCooldown();
    }
  }, [user?.id]);

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

  const checkCooldown = async () => {
    setCooldownLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_username_change_allowed', {
        for_user_id: user!.id,
      });

      if (error) {
        console.error('Error checking cooldown:', error);
        setCooldownAllowed(true); // Allow on error to not block users
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

  // Debounced availability check
  const checkAvailability = useCallback(
    async (name: string) => {
      if (!name || name.length < 3) {
        setIsAvailable(null);
        return;
      }

      // Same as current name? Always "available"
      if (name.toLowerCase() === originalName.toLowerCase()) {
        setIsAvailable(null);
        return;
      }

      // Validate format
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

        if (error) {
          setIsAvailable(null);
          return;
        }
        setIsAvailable(data === true);
      } catch {
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    },
    [user?.id, originalName]
  );

  // Debounce the check
  useEffect(() => {
    if (!isEditingName) return;

    const trimmed = displayName.trim();
    if (!trimmed) {
      setIsAvailable(null);
      setValidationError(null);
      return;
    }

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

  // Called when user clicks save — show confirmation first
  const handleSaveClick = () => {
    const trimmed = displayName.trim();

    // Same name? Just close
    if (trimmed.toLowerCase() === originalName.toLowerCase()) {
      setIsEditingName(false);
      return;
    }

    // Validate
    try {
      usernameSchema.parse(trimmed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setValidationError(error.errors[0].message);
        return;
      }
    }

    if (isAvailable !== true) return;

    // Show confirmation dialog
    setShowConfirm(true);
  };

  // Confirmed — actually save
  const handleConfirmedSave = async () => {
    if (!user?.id) return;
    const trimmed = displayName.trim();

    setShowConfirm(false);
    setSaving(true);

    try {
      // Double-check availability
      const { data: stillAvailable } = await supabase.rpc('check_username_available', {
        desired_name: trimmed,
        for_user_id: user.id,
      });

      if (!stillAvailable) {
        setIsAvailable(false);
        toast.error('Username was just taken! Please try another.');
        setSaving(false);
        return;
      }

      // Double-check cooldown
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
        .update({
          display_name: trimmed,
          display_name_changed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        if (error.message.includes('idx_profiles_display_name_unique') || error.message.includes('duplicate')) {
          setIsAvailable(false);
          toast.error('Username is already taken!');
        } else {
          toast.error('Failed to update username');
        }
      } else {
        // Also update players table
        await supabase
          .from('players')
          .update({ name: trimmed })
          .eq('user_id', user.id);

        toast.success('Username updated!');
        setOriginalName(trimmed);
        setIsEditingName(false);
        setIsAvailable(null);
        setCooldownAllowed(false);
        setNextChangeAt(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
        fetchProfile();
      }
    } catch {
      toast.error('Failed to update username');
    } finally {
      setSaving(false);
    }
  };

  const emailVerified = user?.email_confirmed_at != null;

  // Format remaining cooldown time
  const formatCooldownRemaining = () => {
    if (!nextChangeAt) return '';
    const now = new Date();
    const diff = nextChangeAt.getTime() - now.getTime();
    if (diff <= 0) return '';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const canSave =
    isEditingName &&
    !saving &&
    !isChecking &&
    !validationError &&
    displayName.trim().toLowerCase() !== originalName.toLowerCase()
      ? isAvailable === true
      : displayName.trim().toLowerCase() === originalName.toLowerCase();

  return (
    <div className="space-y-6">
      {/* Email Section */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Email Address</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={user?.email || ''}
                  disabled
                  className="pl-10 bg-muted/50 border-border text-foreground"
                />
              </div>
            </div>
          </div>
          
          {!emailVerified && (
            <div className="flex justify-end">
              <Button 
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => toast.info('Verification email sent!')}
              >
                Confirm Email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phone Section */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Phone Number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Mobile Number</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Add your phone number"
                  disabled
                  className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <Button variant="outline" className="border-border hover:bg-muted">
                Add
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Add a phone number for enhanced account security and faster recovery.
          </p>
        </CardContent>
      </Card>

      {/* Display Name Section */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Username</CardTitle>
            {/* Cooldown badge */}
            {!cooldownLoading && !cooldownAllowed && nextChangeAt && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Change available in {formatCooldownRemaining()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Display Name</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!isEditingName || saving}
                  placeholder="Enter display name"
                  maxLength={20}
                  autoComplete="off"
                  className={cn(
                    'pl-10 pr-10 border-border text-foreground',
                    isEditingName ? 'bg-background' : 'bg-muted/50',
                    isEditingName && validationError && 'border-destructive focus-visible:ring-destructive',
                    isEditingName && !validationError && isAvailable === true && 'border-emerald-500 focus-visible:ring-emerald-500',
                    isEditingName && !validationError && isAvailable === false && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
                {/* Availability indicator inside input */}
                {isEditingName && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isChecking && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    {!isChecking && isAvailable === true && !validationError && (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                    {!isChecking && (isAvailable === false || validationError) && displayName.trim().length >= 3 && displayName.trim().toLowerCase() !== originalName.toLowerCase() && (
                      <X className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              {isEditingName ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveClick}
                    disabled={!canSave || saving}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="border-border hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={startEditing}
                  disabled={cooldownLoading || !cooldownAllowed}
                  className="border-border hover:bg-muted"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Validation / availability messages */}
          {isEditingName && validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
          {isEditingName && !validationError && isAvailable === false && (
            <p className="text-sm text-destructive font-medium">Username is already taken</p>
          )}
          {isEditingName && !validationError && isAvailable === true && (
            <p className="text-sm text-emerald-500">Username is available!</p>
          )}

          {/* Cooldown info */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border">
            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                You can only change your username <span className="text-foreground font-medium">once every 14 days</span>. Choose wisely!
              </p>
              {!cooldownAllowed && nextChangeAt && (
                <p className="text-xs text-amber-500 mt-1">
                  Next change available: {nextChangeAt.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            3-20 characters. Letters, numbers, and underscores only.
          </p>
        </CardContent>
      </Card>

      {/* Account Created */}
      <Card className="border-border bg-card">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Member since</span>
            <span className="text-foreground font-medium">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              }) : 'Unknown'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Change Username?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                You're about to change your username from <span className="font-semibold text-foreground">"{originalName}"</span> to <span className="font-semibold text-foreground">"{displayName.trim()}"</span>.
              </span>
              <span className="block text-amber-500 font-medium">
                You won't be able to change it again for 14 days.
              </span>
              <span className="block">Are you sure you want to continue?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedSave}>
              Yes, Change Username
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
