/**
 * MFAChoice - 2FA Method Selection Component
 * 
 * Lets the user choose between authenticator app (TOTP) or email-based 2FA,
 * or skip 2FA setup entirely ("Maybe Later").
 * 
 * Used in:
 * - Auth page (after email verification on signup)
 */

import { Shield, Mail, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MFAChoiceProps {
  onChooseAuthenticator: () => void;
  onChooseEmail: () => void;
  onSkip: () => void;
}

export function MFAChoice({ onChooseAuthenticator, onChooseEmail, onSkip }: MFAChoiceProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Secure Your Account</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add two-factor authentication for extra security.
          <br />
          Choose your preferred method below.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {/* Authenticator App */}
        <button
          type="button"
          onClick={onChooseAuthenticator}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">Authenticator App</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use Google Authenticator, Authy, or 1Password
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </button>

        {/* Email Code */}
        <button
          type="button"
          onClick={onChooseEmail}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">Email Code</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive a verification code via email each time you log in
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
        <Clock className="w-4 h-4 mr-2" />
        Maybe Later
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        You can always enable 2FA later in Settings → Security.
      </p>
    </div>
  );
}
