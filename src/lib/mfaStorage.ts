/**
 * MFA Storage Helper
 * 
 * Persists email-based 2FA verification status in localStorage with a 30-day TTL.
 * This prevents users from being forced to re-verify email 2FA every time they
 * reopen the browser (sessionStorage clears on close).
 * 
 * MFA verification should only happen at sign-in, not on every session restore.
 */

const MFA_VERIFIED_KEY = 'skilled_email_2fa_verified';
const MFA_EXPIRY_DAYS = 30;

interface MfaVerifiedData {
  verified: true;
  timestamp: number;
}

/**
 * Mark email 2FA as verified for the next 30 days.
 * Called after successful email OTP verification during login.
 */
export function setEmailMfaVerified(): void {
  try {
    const data: MfaVerifiedData = {
      verified: true,
      timestamp: Date.now(),
    };
    localStorage.setItem(MFA_VERIFIED_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable — fall through
  }
}

/**
 * Check if email 2FA was verified within the last 30 days.
 * Returns true if the user doesn't need to re-verify.
 */
export function isEmailMfaVerified(): boolean {
  try {
    const raw = localStorage.getItem(MFA_VERIFIED_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw) as MfaVerifiedData;
    if (!data?.verified || !data?.timestamp) return false;

    // Check if within 30 days
    const elapsed = Date.now() - data.timestamp;
    if (elapsed > MFA_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      clearEmailMfaVerified();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the email 2FA verification flag.
 * Called on sign-out, hard reset, or when changing 2FA method.
 */
export function clearEmailMfaVerified(): void {
  try {
    localStorage.removeItem(MFA_VERIFIED_KEY);
    // Also clean up legacy sessionStorage key if present
    sessionStorage.removeItem('email_2fa_verified');
  } catch {
    // Storage unavailable — fall through
  }
}
