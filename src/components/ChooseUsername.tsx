/**
 * ChooseUsername - Username selection component for the Auth flow
 *
 * Shown after email verification on signup. User must pick a unique
 * username (3-20 chars, letters/numbers/underscores). Checks availability
 * in real-time against the profiles table (case-insensitive).
 *
 * Used in:
 * - Auth page (after signup email verification, before 2FA choice)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check, X, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { z } from 'zod';

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed');

interface ChooseUsernameProps {
  userId: string;
  onComplete: (username: string) => void;
}

export function ChooseUsername({ userId, onComplete }: ChooseUsernameProps) {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Debounced username availability check using a secure DB function
  const checkAvailability = useCallback(
    async (name: string) => {
      if (!name || name.length < 3) {
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
        // Use SECURITY DEFINER RPC to reliably check across all profiles
        const { data, error } = await supabase.rpc('check_username_available', {
          desired_name: name,
          for_user_id: userId,
        });

        if (error) {
          console.error('Error checking username:', error);
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
    [userId]
  );

  // Debounce
  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setIsAvailable(null);
      setValidationError(null);
      return;
    }
    const timer = setTimeout(() => checkAvailability(trimmed), 400);
    return () => clearTimeout(timer);
  }, [username, checkAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();

    try {
      usernameSchema.parse(trimmed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setValidationError(error.errors[0].message);
        return;
      }
    }

    if (!isAvailable) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Double-check availability right before saving (prevent race conditions)
      const { data: stillAvailable } = await supabase.rpc('check_username_available', {
        desired_name: trimmed,
        for_user_id: userId,
      });

      if (!stillAvailable) {
        setSubmitError('That username was just taken! Please try another.');
        setIsAvailable(false);
        return;
      }

      // Update profile — use upsert to handle race with ensure-user
      // (profile may not exist yet if ensure-user hasn't completed)
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { user_id: userId, display_name: trimmed },
          { onConflict: 'user_id' }
        );

      if (error) {
        if (error.message.includes('idx_profiles_display_name_unique') || error.message.includes('duplicate')) {
          setSubmitError('That username was just taken! Please try another.');
          setIsAvailable(false);
          return;
        }
        throw error;
      }

      // Also update players table for consistency
      await supabase
        .from('players')
        .update({ name: trimmed })
        .eq('user_id', userId);

      onComplete(trimmed);
    } catch (error) {
      console.error('Error saving username:', error);
      setSubmitError('Failed to save username. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Choose Your Username</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This is how other players will see you
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              id="username"
              type="text"
              placeholder="Enter your gaming name"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setSubmitError(null);
              }}
              className={cn(
                'pl-10 pr-10',
                validationError && 'border-destructive focus-visible:ring-destructive',
                !validationError && isAvailable === true && 'border-emerald-500 focus-visible:ring-emerald-500',
                !validationError && isAvailable === false && 'border-destructive focus-visible:ring-destructive'
              )}
              maxLength={20}
              autoComplete="off"
              disabled={isSubmitting}
            />

            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isChecking && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
              {!isChecking && isAvailable === true && !validationError && (
                <Check className="w-4 h-4 text-emerald-500" />
              )}
              {!isChecking && (isAvailable === false || validationError) && username.trim().length >= 3 && (
                <X className="w-4 h-4 text-destructive" />
              )}
            </div>
          </div>

          {/* Messages */}
          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
          {!validationError && isAvailable === false && (
            <p className="text-sm text-destructive">
              Username is already taken, please choose another.
            </p>
          )}
          {!validationError && isAvailable === true && (
            <p className="text-sm text-emerald-500">Username is available!</p>
          )}
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <p className="text-xs text-muted-foreground">
            3-20 characters. Letters, numbers, and underscores only.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !isAvailable || isChecking || !!validationError}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </form>
    </div>
  );
}
