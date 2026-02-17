/**
 * MFAChoice - Authenticator App Setup Offer
 * 
 * Shown after signup when email 2FA has been auto-enabled.
 * Offers the user the option to also set up an authenticator app (TOTP)
 * for stronger security, or skip and keep email-only 2FA.
 * 
 * Used in:
 * - Auth page (after username selection on signup)
 */

import { Shield, ArrowRight, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MFAChoiceProps {
  onChooseAuthenticator: () => void;
  onSkip: () => void;
}

export function MFAChoice({ onChooseAuthenticator, onSkip }: MFAChoiceProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Two-Factor Authentication</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your account security is important to us.
        </p>
      </div>

      {/* Email 2FA already enabled badge */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Check className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-emerald-500" />
            <p className="font-medium text-sm text-emerald-500">Email 2FA enabled</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            You'll receive a code via email each time you log in.
          </p>
        </div>
      </div>

      {/* Authenticator app option */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground text-center">
          Want even stronger security? Add an authenticator app.
        </p>
        <button
          type="button"
          onClick={onChooseAuthenticator}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">Set Up Authenticator App</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use Google Authenticator, Authy, or 1Password
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </button>
      </div>

      {/* Skip */}
      <Button
        type="button"
        variant="ghost"
        className="w-full text-muted-foreground"
        onClick={onSkip}
      >
        Maybe Later
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        You can add an authenticator app anytime in Settings → Security.
      </p>
    </div>
  );
}
