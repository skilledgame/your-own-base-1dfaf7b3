import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[request-withdrawal] Function invoked');

  try {
    // ---- Authenticate user ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Please log in to withdraw' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!serviceRoleKey) {
      console.error('[request-withdrawal] Missing SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('[request-withdrawal] Token validation failed:', claimsError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Session expired. Please log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log('[request-withdrawal] User authenticated:', userId);

    // ---- Parse and validate input ----
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount_sc, crypto_currency, wallet_address } = body;

    if (!amount_sc || !crypto_currency || !wallet_address) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: amount_sc, crypto_currency, wallet_address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountSc = Math.floor(Number(amount_sc));
    const MIN_WITHDRAWAL_SC = 500; // 500 SC = $5

    if (isNaN(amountSc) || amountSc < MIN_WITHDRAWAL_SC) {
      return new Response(
        JSON.stringify({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL_SC} SC ($${MIN_WITHDRAWAL_SC / 100})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validCurrencies = ['btc', 'eth', 'usdttrc20', 'ltc'];
    const normalizedCurrency = crypto_currency.toLowerCase();
    if (!validCurrencies.includes(normalizedCurrency)) {
      return new Response(
        JSON.stringify({ error: 'Invalid cryptocurrency', validCurrencies }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof wallet_address !== 'string' || wallet_address.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountUsd = amountSc / 100; // 100 SC = $1

    // ---- Use service role for database operations ----
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check for existing pending withdrawal (prevent spam)
    const { data: existingPending, error: pendingError } = await adminClient
      .from('withdrawals')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingError) {
      console.error('[request-withdrawal] Error checking pending:', pendingError);
    }

    if (existingPending) {
      return new Response(
        JSON.stringify({ error: 'You already have a pending withdrawal. Please wait for it to be reviewed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Fetch current balance and deduct ----
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('skilled_coins')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.error('[request-withdrawal] Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((profile.skilled_coins ?? 0) < amountSc) {
      return new Response(
        JSON.stringify({ error: 'Insufficient balance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newBalance = (profile.skilled_coins ?? 0) - amountSc;

    // Deduct coins from profiles
    const { error: deductProfileError } = await adminClient
      .from('profiles')
      .update({ skilled_coins: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (deductProfileError) {
      console.error('[request-withdrawal] Failed to deduct from profiles:', deductProfileError);
      return new Response(
        JSON.stringify({ error: 'Failed to deduct balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also deduct from players table to keep in sync
    const { error: deductPlayerError } = await adminClient
      .from('players')
      .update({ credits: newBalance })
      .eq('user_id', userId);

    if (deductPlayerError) {
      console.error('[request-withdrawal] Failed to sync players table:', deductPlayerError);
      // Non-critical, continue
    }

    // ---- Create withdrawal record ----
    const { data: withdrawal, error: insertError } = await adminClient
      .from('withdrawals')
      .insert({
        user_id: userId,
        amount_sc: amountSc,
        amount_usd: amountUsd,
        crypto_currency: normalizedCurrency,
        wallet_address: wallet_address.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !withdrawal) {
      console.error('[request-withdrawal] Failed to create withdrawal:', insertError);
      // CRITICAL: Refund the coins since we already deducted
      await adminClient
        .from('profiles')
        .update({ skilled_coins: profile.skilled_coins, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      await adminClient
        .from('players')
        .update({ credits: profile.skilled_coins })
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ error: 'Failed to create withdrawal request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[request-withdrawal] Created withdrawal ${withdrawal.id} for ${amountSc} SC ($${amountUsd}) from user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: withdrawal.id,
        amount_sc: amountSc,
        amount_usd: amountUsd,
        crypto_currency: normalizedCurrency,
        status: 'pending',
        message: 'Withdrawal request submitted. It will be reviewed by our team.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[request-withdrawal] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
