import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// ----------------------------------------------------------------
// POST /api/create-invoice
//
// Body: { userId: string, amountUSD: number }
// Returns: { payment_url: string }
//
// Creates a NOWPayments invoice, stores a pending row in
// crypto_transactions, and returns the hosted payment page URL.
// ----------------------------------------------------------------

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ---- Method guard ----
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ---- Env validation ----
    const nowApiKey = process.env.NOWPAYMENTS_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!nowApiKey || !supabaseUrl || !serviceRoleKey) {
      console.error("[create-invoice] Missing environment variables");
      return res
        .status(500)
        .json({ error: "Server configuration error" });
    }

    // ---- Input validation ----
    const { userId, amountUSD } = req.body ?? {};

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Invalid or missing userId" });
    }
    if (
      amountUSD === undefined ||
      typeof amountUSD !== "number" ||
      amountUSD <= 0
    ) {
      return res
        .status(400)
        .json({ error: "Invalid or missing amountUSD" });
    }

    // ---- Create NOWPayments invoice ----
    const orderId = `deposit_${userId.substring(0, 8)}_${Date.now()}`;

    const invoicePayload = {
      price_amount: amountUSD,
      price_currency: "usd",
      order_id: orderId,
      order_description: `Deposit $${amountUSD} USD — ${amountUSD * 100} coins`,
      ipn_callback_url: buildWebhookUrl(req),
      success_url: buildFrontendUrl(req, "/deposit?status=success"),
      cancel_url: buildFrontendUrl(req, "/deposit?status=cancelled"),
    };

    console.log(
      "[create-invoice] Creating invoice:",
      JSON.stringify(invoicePayload)
    );

    const nowRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": nowApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!nowRes.ok) {
      const errBody = await nowRes.text();
      console.error(
        "[create-invoice] NOWPayments error:",
        nowRes.status,
        errBody
      );
      return res
        .status(502)
        .json({ error: "Failed to create payment invoice" });
    }

    const invoiceData = await nowRes.json();

    if (!invoiceData.id || !invoiceData.invoice_url) {
      console.error(
        "[create-invoice] Unexpected NOWPayments response:",
        invoiceData
      );
      return res
        .status(502)
        .json({ error: "Invalid response from payment provider" });
    }

    console.log(
      "[create-invoice] Invoice created:",
      invoiceData.id
    );

    // ---- Store pending transaction in Supabase ----
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const skilledCoins = amountUSD * 100; // 1 USD = 100 coins

    const { error: insertError } = await supabase
      .from("crypto_transactions")
      .insert({
        user_id: userId,
        payment_id: invoiceData.id.toString(),
        order_id: orderId,
        amount_usd: amountUSD,
        crypto_currency: "pending", // user selects on NOWPayments hosted page
        skilled_coins_credited: skilledCoins,
        status: "pending",
      });

    if (insertError) {
      console.error(
        "[create-invoice] Supabase insert error:",
        insertError
      );
      return res
        .status(500)
        .json({ error: "Failed to record transaction" });
    }

    console.log("[create-invoice] Transaction stored for user:", userId);

    // ---- Return payment URL ----
    return res.status(200).json({
      payment_url: invoiceData.invoice_url,
    });
  } catch (error) {
    console.error("[create-invoice] Unhandled error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ---- Helpers ----

/** Build the absolute URL for the webhook callback */
function buildWebhookUrl(req: VercelRequest): string {
  // Prefer explicit env var, fall back to request host
  const base =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    req.headers.host;
  return `https://${base}/api/payment-webhook`;
}

/** Build an absolute frontend URL (for success/cancel redirects) */
function buildFrontendUrl(req: VercelRequest, path: string): string {
  const base =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    req.headers.host;
  return `https://${base}${path}`;
}
