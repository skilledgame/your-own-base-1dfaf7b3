import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nowpayments-sig',
};

// Verify NOWPayments IPN signature
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    console.log('[payment-webhook] Verifying signature...');
    console.log('[payment-webhook] Signature received:', signature);
    console.log('[payment-webhook] Secret length:', secret.length);
    
    const parsedBody = JSON.parse(body);
    const sortedKeys = Object.keys(parsedBody).sort();
    const sortedBody = JSON.stringify(
      sortedKeys.reduce((acc: Record<string, unknown>, key) => {
        acc[key] = parsedBody[key];
        return acc;
      }, {})
    );
    
    console.log('[payment-webhook] Sorted body for signature:', sortedBody);
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(sortedBody)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    console.log('[payment-webhook] Expected signature:', expectedSignature);
    console.log('[payment-webhook] Signatures match:', expectedSignature === signature);
    
    return expectedSignature === signature;
  } catch (error) {
    console.error('[payment-webhook] Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  console.log('[payment-webhook] Webhook invoked');
  console.log('[payment-webhook] Method:', req.method);
  console.log('[payment-webhook] Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    console.log('[payment-webhook] Raw body:', body);
    
    const signature = req.headers.get('x-nowpayments-sig') ?? '';
    const ipnSecret = Deno.env.get('NOWPAYMENTS_IPN_SECRET') ?? '';

    console.log('[payment-webhook] Has signature header:', !!signature);
    console.log('[payment-webhook] Has IPN secret:', !!ipnSecret);

    // SECURITY: Require IPN secret to be configured - reject if missing
    if (!ipnSecret) {
      console.error('[payment-webhook] SECURITY ERROR: NOWPAYMENTS_IPN_SECRET not configured - rejecting request');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured - IPN secret missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Require signature header - reject if missing
    if (!signature) {
      console.error('[payment-webhook] SECURITY ERROR: No signature header in request - rejecting');
      return new Response(
        JSON.stringify({ error: 'Missing signature header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the signature
    const isValid = await verifySignature(body, signature, ipnSecret);
    if (!isValid) {
      console.error('[payment-webhook] SECURITY ERROR: Invalid webhook signature - rejecting request');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[payment-webhook] Signature verified successfully');

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (parseError) {
      console.error('[payment-webhook] Failed to parse webhook body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      payment_id, 
      payment_status, 
      order_id, 
      actually_paid, 
      pay_amount, 
      pay_currency, 
      price_amount,
      invoice_id,
      outcome_amount,
      outcome_currency
    } = payload;

    console.log('[payment-webhook] Webhook payload parsed:', {
      payment_id,
      payment_status,
      order_id,
      actually_paid,
      pay_amount,
      pay_currency,
      price_amount,
      invoice_id,
      outcome_amount,
      outcome_currency
    });

    if (!order_id) {
      console.error('[payment-webhook] Missing order_id in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the transaction
    console.log('[payment-webhook] Looking up transaction for order_id:', order_id);
    const { data: transaction, error: findError } = await supabaseAdmin
      .from('crypto_transactions')
      .select('*')
      .eq('order_id', order_id)
      .maybeSingle();

    if (findError) {
      console.error('[payment-webhook] Database error finding transaction:', findError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: findError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transaction) {
      console.error('[payment-webhook] Transaction not found for order_id:', order_id);
      return new Response(
        JSON.stringify({ error: 'Transaction not found', order_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[payment-webhook] Found transaction:', {
      id: transaction.id,
      user_id: transaction.user_id,
      current_status: transaction.status,
      amount_usd: transaction.amount_usd
    });

    // Prevent double-crediting
    if (transaction.status === 'confirmed') {
      console.log('[payment-webhook] Transaction already confirmed, skipping:', order_id);
      return new Response(
        JSON.stringify({ message: 'Already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map NOWPayments status to our status
    let newStatus = transaction.status;
    let skilledCoinsToCredit = 0;

    console.log('[payment-webhook] Processing payment_status:', payment_status);

    switch (payment_status) {
      case 'waiting':
      case 'confirming':
        newStatus = 'pending';
        break;
      case 'confirmed':
      case 'sending':
        newStatus = 'processing';
        break;
      case 'finished':
        // Check if payment was sufficient (allow 1% tolerance for crypto fluctuations)
        const actuallyPaidNum = parseFloat(actually_paid) || 0;
        const payAmountNum = parseFloat(pay_amount) || 0;
        
        console.log('[payment-webhook] Payment amounts:', {
          actually_paid: actuallyPaidNum,
          pay_amount: payAmountNum,
          price_amount
        });

        if (payAmountNum > 0) {
          const paidPercentage = (actuallyPaidNum / payAmountNum) * 100;
          console.log('[payment-webhook] Paid percentage:', paidPercentage.toFixed(2) + '%');
          
          if (paidPercentage >= 99) {
            newStatus = 'confirmed';
            // Use transaction amount_usd for coin calculation
            skilledCoinsToCredit = Math.floor(transaction.amount_usd * 100); // $1 = 100 coins
            console.log('[payment-webhook] Payment sufficient, crediting:', skilledCoinsToCredit, 'coins');
          } else {
            newStatus = 'underpaid';
            console.log('[payment-webhook] Payment underpaid:', paidPercentage.toFixed(2) + '%');
          }
        } else {
          // If pay_amount is not available, trust the payment status
          newStatus = 'confirmed';
          skilledCoinsToCredit = Math.floor(transaction.amount_usd * 100);
          console.log('[payment-webhook] No pay_amount, trusting status, crediting:', skilledCoinsToCredit, 'coins');
        }
        break;
      case 'partially_paid':
        newStatus = 'underpaid';
        break;
      case 'failed':
      case 'refunded':
        newStatus = 'failed';
        break;
      case 'expired':
        newStatus = 'expired';
        break;
      default:
        console.log('[payment-webhook] Unknown payment status:', payment_status);
    }

    console.log('[payment-webhook] Status transition:', transaction.status, '->', newStatus);

    // Update transaction
    const updateData: Record<string, unknown> = {
      status: newStatus,
      payment_status: payment_status,
      amount_crypto: actually_paid || pay_amount || null,
    };

    if (newStatus === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
      updateData.skilled_coins_credited = skilledCoinsToCredit;
    }

    console.log('[payment-webhook] Updating transaction with:', updateData);

    const { error: updateError } = await supabaseAdmin
      .from('crypto_transactions')
      .update(updateData)
      .eq('order_id', order_id);

    if (updateError) {
      console.error('[payment-webhook] Failed to update transaction:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update transaction', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[payment-webhook] Transaction updated successfully');

    // Credit user's account if payment confirmed
    if (newStatus === 'confirmed' && skilledCoinsToCredit > 0) {
      console.log('[payment-webhook] Crediting user account:', {
        user_id: transaction.user_id,
        coins: skilledCoinsToCredit
      });
      
      // Get current balance
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('skilled_coins')
        .eq('user_id', transaction.user_id)
        .single();

      if (profileError) {
        console.error('[payment-webhook] Failed to get user profile:', profileError);
      } else if (profile) {
        const newBalance = profile.skilled_coins + skilledCoinsToCredit;
        console.log('[payment-webhook] Updating balance:', profile.skilled_coins, '->', newBalance);
        
        const { error: creditError } = await supabaseAdmin
          .from('profiles')
          .update({ skilled_coins: newBalance })
          .eq('user_id', transaction.user_id);
          
        if (creditError) {
          console.error('[payment-webhook] Failed to credit coins:', creditError);
        } else {
          console.log('[payment-webhook] Successfully credited coins to user');
        }
      } else {
        console.error('[payment-webhook] User profile not found for user_id:', transaction.user_id);
      }
    }

    // Also mark any matching preorder as completed (for waitlist preorders)
    // This enables the auto-credit trigger when the user signs up on the real site
    if (newStatus === 'confirmed' && order_id) {
      console.log('[payment-webhook] Checking for matching preorder with order_id:', order_id);
      const { data: preorder, error: preorderFindError } = await supabaseAdmin
        .from('preorders')
        .select('id, status')
        .eq('order_id', order_id)
        .maybeSingle();

      if (preorderFindError) {
        console.error('[payment-webhook] Error finding preorder:', preorderFindError);
      } else if (preorder && preorder.status === 'pending') {
        const { error: preorderUpdateError } = await supabaseAdmin
          .from('preorders')
          .update({ status: 'completed' })
          .eq('id', preorder.id);

        if (preorderUpdateError) {
          console.error('[payment-webhook] Failed to update preorder status:', preorderUpdateError);
        } else {
          console.log('[payment-webhook] Preorder marked as completed:', preorder.id);
        }
      } else if (!preorder) {
        console.log('[payment-webhook] No preorder found for this order_id (normal deposit)');
      }
    }

    console.log('[payment-webhook] Webhook processing complete');

    return new Response(
      JSON.stringify({ message: 'Webhook processed', status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[payment-webhook] Unhandled error:', error);
    console.error('[payment-webhook] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
