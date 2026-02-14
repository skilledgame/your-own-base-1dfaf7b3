import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { verifyNowPaymentsSignature } from "./lib/verify-signature";

// ----------------------------------------------------------------
// POST /api/payment-webhook
//
// Receives IPN (Instant Payment Notification) callbacks from
// NOWPayments. Body parsing is disabled so we can verify the
// HMAC-SHA512 signature against the raw body.
//
// Flow:
//   1. Read raw body
//   2. Verify x-nowpayments-sig header
//   3. Ignore non-"finished" statuses
//   4. Find matching crypto_transaction
//   5. Guard against double-processing (atomic status flip)
//   6. Credit user skilled_coins in profiles (1 USD = 100 coins)
//   7. Return 200 to NOWPayments
// ----------------------------------------------------------------

/** Disable Vercel's automatic body parsing so we receive the raw body */
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ---- Method guard ----
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Always return 200 to NOWPayments in the outer catch so they don't
  // keep retrying on transient errors. Log everything for debugging.
  try {
    // ---- Read raw body from stream ----
    const rawBody = await readRawBody(req);

    // ---- Env validation ----
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!ipnSecret) {
      console.error("[webhook] CRITICAL: NOWPAYMENTS_IPN_SECRET not set");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[webhook] CRITICAL: Supabase env vars missing");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // ---- Signature verification ----
    const signature = (req.headers["x-nowpayments-sig"] as string) ?? "";

    if (!signature) {
      console.error("[webhook] Rejected: missing x-nowpayments-sig header");
      return res.status(401).json({ error: "Missing signature" });
    }

    const isValid = verifyNowPaymentsSignature(rawBody, signature, ipnSecret);

    if (!isValid) {
      console.error("[webhook] Rejected: invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    console.log("[webhook] Signature verified");

    // ---- Parse payload ----
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("[webhook] Rejected: malformed JSON body");
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const {
      payment_status,
      invoice_id,
      order_id,
      payment_id,
      actually_paid,
      pay_amount,
      pay_currency,
    } = payload;

    console.log("[webhook] Received:", {
      payment_status,
      invoice_id,
      order_id,
      payment_id,
      actually_paid,
      pay_amount,
      pay_currency,
    });

    // ---- Only process finished payments ----
    if (payment_status !== "finished") {
      console.log(
        `[webhook] Ignoring status "${payment_status}" for invoice ${invoice_id ?? order_id}`
      );
      return res
        .status(200)
        .json({ message: `Ignored status: ${payment_status}` });
    }

    // ---- Supabase admin client (service role) ----
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---- Find matching transaction ----
    // Look up by order_id first (our generated ID), fall back to payment_id
    if (!order_id && !payment_id && !invoice_id) {
      console.error("[webhook] No order_id, payment_id, or invoice_id");
      return res.status(200).json({ error: "No identifiable reference" });
    }

    let transaction: Record<string, any> | null = null;
    let findError: any = null;

    // Primary lookup: order_id (most reliable — it's our generated ID)
    if (order_id) {
      const result = await supabase
        .from("crypto_transactions")
        .select("*")
        .eq("order_id", order_id)
        .maybeSingle();
      transaction = result.data;
      findError = result.error;
    }

    // Fallback: payment_id (the NOWPayments invoice ID we stored)
    if (!transaction && (payment_id || invoice_id)) {
      const ref = (invoice_id ?? payment_id)!.toString();
      const result = await supabase
        .from("crypto_transactions")
        .select("*")
        .eq("payment_id", ref)
        .maybeSingle();
      transaction = result.data;
      findError = result.error;
    }

    if (findError) {
      console.error("[webhook] DB lookup error:", findError.message);
      return res.status(200).json({ error: "Database error" });
    }

    if (!transaction) {
      console.error("[webhook] No transaction found for:", { order_id, payment_id, invoice_id });
      return res.status(200).json({ error: "Transaction not found" });
    }

    // ---- Double-processing prevention ----
    // Atomically flip status from "pending" to "confirmed".
    // If another webhook already flipped it, this returns zero rows.
    if (transaction.status === "confirmed") {
      console.log("[webhook] Already confirmed, skipping:", transaction.id);
      return res.status(200).json({ message: "Already processed" });
    }

    const { data: claimed, error: claimError } = await supabase
      .from("crypto_transactions")
      .update({
        status: "confirmed",
        payment_status: payment_status,
        confirmed_at: new Date().toISOString(),
        amount_crypto: actually_paid ?? pay_amount ?? null,
      })
      .eq("id", transaction.id)
      .eq("status", "pending") // optimistic lock
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("[webhook] Failed to claim transaction:", claimError.message);
      return res.status(200).json({ error: "Claim failed" });
    }

    if (!claimed) {
      // Another invocation already claimed it
      console.log("[webhook] Transaction already claimed by another worker");
      return res.status(200).json({ message: "Already processed" });
    }

    // ---- Credit user skilled_coins ----
    const coins = Math.floor(transaction.amount_usd * 100); // 1 USD = 100 coins

    console.log(
      `[webhook] Crediting ${coins} coins to user ${transaction.user_id}`
    );

    // Fetch current balance from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("skilled_coins")
      .eq("user_id", transaction.user_id)
      .single();

    if (profileError || !profile) {
      console.error(
        "[webhook] Profile not found:",
        transaction.user_id,
        profileError?.message
      );
      // Revert transaction status so it can be retried
      await supabase
        .from("crypto_transactions")
        .update({ status: "pending" })
        .eq("id", transaction.id);
      return res.status(200).json({ error: "Profile not found" });
    }

    const newBalance = (profile.skilled_coins ?? 0) + coins;

    const { error: balanceError } = await supabase
      .from("profiles")
      .update({ skilled_coins: newBalance })
      .eq("user_id", transaction.user_id);

    if (balanceError) {
      console.error(
        "[webhook] Balance update failed:",
        balanceError.message
      );
      // Revert transaction status so it can be retried
      await supabase
        .from("crypto_transactions")
        .update({ status: "pending" })
        .eq("id", transaction.id);
      return res.status(500).json({ error: "Balance update failed" });
    }

    console.log(
      `[webhook] Success: user ${transaction.user_id} skilled_coins ${profile.skilled_coins ?? 0} → ${newBalance}`
    );

    return res.status(200).json({ message: "Payment processed" });
  } catch (error) {
    console.error("[webhook] Unhandled error:", error);
    // Return 200 to prevent NOWPayments from retrying indefinitely
    // on non-recoverable errors. The error is logged for investigation.
    return res.status(200).json({ error: "Internal processing error" });
  }
}

// ---- Helpers ----

/** Read the full request body as a UTF-8 string (when bodyParser is off) */
function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

// ---- Types ----

interface WebhookPayload {
  payment_id?: number | string;
  payment_status: string;
  pay_address?: string;
  price_amount?: number;
  price_currency?: string;
  pay_amount?: number;
  pay_currency?: string;
  order_id?: string;
  order_description?: string;
  invoice_id?: number | string;
  actually_paid?: number;
  outcome_amount?: number;
  outcome_currency?: string;
}
