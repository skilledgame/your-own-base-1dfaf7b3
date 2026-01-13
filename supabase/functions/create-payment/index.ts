import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[create-payment] Function invoked');

  try {
    // Validate authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[create-payment] Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          code: 'MISSING_AUTH',
          message: 'Please log in to make a deposit' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Validate JWT using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('[create-payment] Token validation failed:', claimsError?.message);
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          code: 'INVALID_TOKEN',
          message: 'Your session has expired. Please log in again.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log('[create-payment] User authenticated via claims:', userId);

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('[create-payment] Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount_usd, crypto_currency, game_slug } = requestBody;
    console.log('[create-payment] Request params:', { amount_usd, crypto_currency, game_slug });

    // Validate input
    if (!amount_usd || !crypto_currency) {
      console.error('[create-payment] Missing required fields:', { amount_usd, crypto_currency });
      return new Response(
        JSON.stringify({ error: 'Missing required fields', received: { amount_usd, crypto_currency } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validAmounts = [10, 25, 50, 100, 250, 500];
    if (!validAmounts.includes(amount_usd)) {
      console.error('[create-payment] Invalid amount:', amount_usd);
      return new Response(
        JSON.stringify({ error: 'Invalid amount', validAmounts }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NOWPayments currency codes - normalized to lowercase
    const validCurrencies = ['btc', 'eth', 'usdttrc20', 'usdterc20', 'usdcsol'];
    const normalizedCurrency = crypto_currency.toLowerCase();
    if (!validCurrencies.includes(normalizedCurrency)) {
      console.error('[create-payment] Invalid cryptocurrency:', crypto_currency);
      return new Response(
        JSON.stringify({ error: 'Invalid cryptocurrency', validCurrencies }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderId = `skilled_${userId.substring(0, 8)}_${Date.now()}`;
    const nowPaymentsApiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    
    // Check if API key is present
    if (!nowPaymentsApiKey) {
      console.error('[create-payment] NOWPAYMENTS_API_KEY secret is not configured');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured - missing API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-payment] API key loaded (length):', nowPaymentsApiKey.length);

    // First, check NOWPayments API status
    console.log('[create-payment] Checking NOWPayments API status...');
    try {
      const statusResponse = await fetch('https://api.nowpayments.io/v1/status', {
        method: 'GET',
        headers: {
          'x-api-key': nowPaymentsApiKey,
        },
      });
      const statusData = await statusResponse.json();
      console.log('[create-payment] NOWPayments API status:', statusData);
      
      if (statusData.message !== 'OK') {
        console.error('[create-payment] NOWPayments API is not available:', statusData);
        return new Response(
          JSON.stringify({ error: 'Payment service temporarily unavailable', details: statusData }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (statusError) {
      console.error('[create-payment] Failed to check NOWPayments status:', statusError);
      // Continue anyway, let the main request handle failures
    }

    // Check available currencies
    console.log('[create-payment] Checking available currencies...');
    try {
      const currenciesResponse = await fetch('https://api.nowpayments.io/v1/currencies', {
        method: 'GET',
        headers: {
          'x-api-key': nowPaymentsApiKey,
        },
      });
      const currenciesData = await currenciesResponse.json();
      console.log('[create-payment] Available currencies count:', currenciesData.currencies?.length || 0);
      
      if (currenciesData.currencies && !currenciesData.currencies.includes(normalizedCurrency)) {
        console.error('[create-payment] Requested currency not available:', normalizedCurrency);
        console.log('[create-payment] Sample available currencies:', currenciesData.currencies?.slice(0, 20));
        return new Response(
          JSON.stringify({ 
            error: 'Selected cryptocurrency is not currently available',
            requested: normalizedCurrency,
            available: currenciesData.currencies?.slice(0, 20)
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (currencyError) {
      console.error('[create-payment] Failed to check currencies:', currencyError);
      // Continue anyway
    }

    // Get the webhook URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const ipnCallbackUrl = `${supabaseUrl}/functions/v1/payment-webhook`;

    // Build description with game context if present
    const orderDescription = game_slug 
      ? `Skilled Coins deposit for ${game_slug} - ${amount_usd * 100} coins`
      : `Skilled Coins deposit - ${amount_usd * 100} coins`;

    // Build request body for NOWPayments
    const invoiceRequestBody = {
      price_amount: amount_usd,
      price_currency: 'usd',
      pay_currency: normalizedCurrency,
      order_id: orderId,
      order_description: orderDescription,
      ipn_callback_url: ipnCallbackUrl,
      success_url: game_slug 
        ? `${req.headers.get('origin') || 'https://skilled.app'}/games/${game_slug}?deposit=success`
        : `${req.headers.get('origin') || 'https://skilled.app'}/deposit?status=success`,
      cancel_url: game_slug
        ? `${req.headers.get('origin') || 'https://skilled.app'}/games/${game_slug}?deposit=cancelled`
        : `${req.headers.get('origin') || 'https://skilled.app'}/deposit?status=cancelled`,
    };

    console.log('[create-payment] Creating invoice with NOWPayments:', JSON.stringify(invoiceRequestBody, null, 2));

    // Create payment with NOWPayments
    const nowPaymentsResponse = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': nowPaymentsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceRequestBody),
    });

    const responseStatus = nowPaymentsResponse.status;
    const responseHeaders = Object.fromEntries(nowPaymentsResponse.headers.entries());
    console.log('[create-payment] NOWPayments response status:', responseStatus);
    console.log('[create-payment] NOWPayments response headers:', JSON.stringify(responseHeaders));

    const responseText = await nowPaymentsResponse.text();
    console.log('[create-payment] NOWPayments raw response:', responseText);

    if (!nowPaymentsResponse.ok) {
      console.error('[create-payment] NOWPayments error response:', {
        status: responseStatus,
        body: responseText,
      });
      
      let errorMessage = 'Failed to create payment invoice';
      let errorCode = 'PAYMENT_ERROR';
      let parsedError = null;
      
      try {
        parsedError = JSON.parse(responseText);
        if (parsedError.message) {
          errorMessage = parsedError.message;
        }
        if (parsedError.code) {
          errorCode = parsedError.code;
        }
      } catch {
        // Response wasn't JSON
      }
      
      // Handle specific NOWPayments error codes
      if (errorCode === 'INVALID_API_KEY' || responseStatus === 403) {
        console.error('[create-payment] NOWPayments API key is invalid');
        return new Response(
          JSON.stringify({ 
            error: 'Payment service configuration error',
            code: 'INVALID_API_KEY',
            message: 'The payment service is temporarily unavailable. Please try again later or contact support.'
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage, 
          code: errorCode,
          message: errorMessage,
          details: parsedError || responseText,
          status: responseStatus 
        }),
        { status: responseStatus >= 500 ? 502 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let paymentData;
    try {
      paymentData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[create-payment] Failed to parse NOWPayments response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment service', raw: responseText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-payment] Invoice created successfully:', JSON.stringify(paymentData, null, 2));

    if (!paymentData.id || !paymentData.invoice_url) {
      console.error('[create-payment] Missing required fields in NOWPayments response:', paymentData);
      return new Response(
        JSON.stringify({ error: 'Invalid invoice data received', data: paymentData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store transaction in database using service role for insert
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      console.error('[create-payment] SUPABASE_SERVICE_ROLE_KEY secret is not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing service key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

    // Calculate skilled coins (100 coins per USD)
    const skilledCoins = amount_usd * 100;

    // Insert transaction (without sensitive fields)
    console.log('[create-payment] Saving transaction to database...');
    const { data: transaction, error: insertError } = await supabaseAdmin
      .from('crypto_transactions')
      .insert({
        user_id: userId,
        payment_id: paymentData.id.toString(),
        order_id: orderId,
        amount_usd: amount_usd,
        crypto_currency: normalizedCurrency,
        status: 'pending',
        skilled_coins_credited: skilledCoins,
      })
      .select()
      .single();

    if (insertError || !transaction) {
      console.error('[create-payment] Database insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save transaction', details: insertError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-payment] Transaction saved:', transaction.id);

    // Store sensitive payment details in separate table
    const { error: internalsError } = await supabaseAdmin
      .from('payment_internals')
      .insert({
        transaction_id: transaction.id,
        payment_id: paymentData.id.toString(),
        order_id: orderId,
        ipn_callback_url: ipnCallbackUrl,
        pay_address: paymentData.pay_address || null,
      });

    if (internalsError) {
      console.error('[create-payment] Failed to store payment internals:', internalsError);
      // Continue anyway, main transaction is saved
    }

    console.log('[create-payment] Payment creation complete');

    return new Response(
      JSON.stringify({
        payment_id: paymentData.id,
        invoice_url: paymentData.invoice_url,
        order_id: orderId,
        amount_usd: amount_usd,
        skilled_coins: amount_usd * 100,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create-payment] Unhandled error:', error);
    console.error('[create-payment] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
