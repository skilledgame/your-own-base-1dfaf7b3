import crypto from "crypto";

/**
 * Verifies NOWPayments IPN webhook signature.
 *
 * NOWPayments signs the payload with HMAC-SHA512 using your IPN secret.
 * Before hashing, the JSON keys are sorted alphabetically.
 *
 * @param rawBody  - The raw request body string (unparsed JSON)
 * @param signature - The value of the `x-nowpayments-sig` header
 * @param ipnSecret - Your NOWPAYMENTS_IPN_SECRET environment variable
 * @returns `true` if the signature is valid
 */
export function verifyNowPaymentsSignature(
  rawBody: string,
  signature: string,
  ipnSecret: string
): boolean {
  try {
    // NOWPayments requires keys to be sorted alphabetically before hashing
    const parsed = JSON.parse(rawBody);
    const sortedKeys = Object.keys(parsed).sort();
    const sortedBody: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      sortedBody[key] = parsed[key];
    }
    const sortedJson = JSON.stringify(sortedBody);

    // Compute HMAC-SHA512
    const hmac = crypto.createHmac("sha512", ipnSecret);
    hmac.update(sortedJson);
    const expectedSignature = hmac.digest("hex");

    // Timing-safe comparison to prevent timing attacks
    if (expectedSignature.length !== signature.length) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch (error) {
    console.error("[verify-signature] Verification failed:", error);
    return false;
  }
}
