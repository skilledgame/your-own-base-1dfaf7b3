/**
 * MFA Storage Helper
 * 
 * Persists MFA verification status in localStorage with a 30-day TTL.
 * Covers BOTH email-based and TOTP-based 2FA.
 * 
 * This prevents users from being forced to re-verify MFA every time they:
 * - Reopen the browser (sessionStorage would be lost)
 * - Navigate to a new page (useEffect re-runs)
 * - Have their token refreshed (AAL level can momentarily be stale)
 * 
 * MFA verification should ONLY happen at sign-in time, not during
 * session restore or routine token refreshes.
 */

const MFA_VERIFIED_KEY = 'skilled_mfa_verified';
const MFA_EXPIRY_DAYS = 30;

interface MfaVerifiedData {
  verified: true;
  method: 'email' | 'totp';
  timestamp: number;
}

/**
 * Mark MFA as verified for the next 30 days.
 * Called after successful MFA verification during login (email OTP or TOTP).
 */
export function setMfaVerified(method: 'email' | 'totp'): void {
  try {
    const data: MfaVerifiedData = {
      verified: true,
      method,
      timestamp: Date.now(),
    };
    localStorage.setItem(MFA_VERIFIED_KEY, JSON.stringify(data));
    // Also clean up legacy sessionStorage key
    sessionStorage.removeItem('email_2fa_verified');
  } catch {
    // Storage unavailable — fall through
  }
}

/**
 * Check if MFA was verified within the last 30 days.
 * Returns true if the user doesn't need to re-verify — regardless of method.
 */
export function isMfaVerified(): boolean {
  try {
    const raw = localStorage.getItem(MFA_VERIFIED_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw) as MfaVerifiedData;
    if (!data?.verified || !data?.timestamp) return false;

    // Check if within 30 days
    const elapsed = Date.now() - data.timestamp;
    if (elapsed > MFA_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      clearMfaVerified();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the MFA verification flag.
 * Called on sign-out, hard reset, or when changing 2FA method.
 */
export function clearMfaVerified(): void {
  try {
    localStorage.removeItem(MFA_VERIFIED_KEY);
    // Also clean up legacy keys
    localStorage.removeItem('skilled_email_2fa_verified');
    sessionStorage.removeItem('email_2fa_verified');
  } catch {
    // Storage unavailable — fall through
  }
}

// Legacy aliases for backward compatibility during migration
export const setEmailMfaVerified = () => setMfaVerified('email');
export const isEmailMfaVerified = isMfaVerified;
export const clearEmailMfaVerified = clearMfaVerified;
