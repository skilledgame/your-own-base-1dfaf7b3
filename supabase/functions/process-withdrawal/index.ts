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

  console.log('[process-withdrawal] Function invoked');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const nowPaymentsApiKey = Deno.env.get('NOWPAYMENTS_API_KEY') ?? '';

    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Authenticate admin ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin/moderator privilege
    const { data: isPrivileged, error: roleError } = await userClient.rpc('is_privileged_user', {
      _user_id: user.id,
    });

    if (roleError || !isPrivileged) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-withdrawal] Admin ${user.email} authenticated`);

    // ---- Parse request ----
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- LIST: Get all withdrawals for admin review ----
    if (req.method === 'GET' && action === 'list') {
      const status = url.searchParams.get('status') || 'pending';

      const { data: withdrawals, error: listError } = await adminClient
        .from('withdrawals')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: true });

      if (listError) {
        console.error('[process-withdrawal] List error:', listError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch withdrawals' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Enrich with user display names
      const userIds = [...new Set((withdrawals || []).map(w => w.user_id))];
      let profileMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', userIds);

        for (const p of (profiles || [])) {
          profileMap.set(p.user_id, p.display_name || p.email || 'Unknown');
        }
      }

      const enriched = (withdrawals || []).map(w => ({
        ...w,
        user_display_name: profileMap.get(w.user_id) || 'Unknown',
      }));

      return new Response(
        JSON.stringify({ withdrawals: enriched }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- LIST ALL: Get all withdrawals regardless of status ----
    if (req.method === 'GET' && action === 'list-all') {
      const { data: withdrawals, error: listError } = await adminClient
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (listError) {
        console.error('[process-withdrawal] List-all error:', listError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch withdrawals' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Enrich with user display names
      const userIds = [...new Set((withdrawals || []).map(w => w.user_id))];
      let profileMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', userIds);

        for (const p of (profiles || [])) {
          profileMap.set(p.user_id, p.display_name || p.email || 'Unknown');
        }
      }

      const enriched = (withdrawals || []).map(w => ({
        ...w,
        user_display_name: profileMap.get(w.user_id) || 'Unknown',
      }));

      return new Response(
        JSON.stringify({ withdrawals: enriched }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- APPROVE: Approve and send payout via NOWPayments ----
    if (req.method === 'POST' && action === 'approve') {
      const body = await req.json();
      const { withdrawal_id, admin_note } = body;

      if (!withdrawal_id) {
        return new Response(
          JSON.stringify({ error: 'withdrawal_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch the withdrawal
      const { data: withdrawal, error: fetchError } = await adminClient
        .from('withdrawals')
        .select('*')
        .eq('id', withdrawal_id)
        .single();

      if (fetchError || !withdrawal) {
        return new Response(
          JSON.stringify({ error: 'Withdrawal not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (withdrawal.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: `Withdrawal is already ${withdrawal.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark as approved
      const { error: approveError } = await adminClient
        .from('withdrawals')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_note: admin_note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id)
        .eq('status', 'pending'); // optimistic lock

      if (approveError) {
        console.error('[process-withdrawal] Approve error:', approveError);
        return new Response(
          JSON.stringify({ error: 'Failed to approve withdrawal' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ---- Call NOWPayments Payout API ----
      if (!nowPaymentsApiKey) {
        console.error('[process-withdrawal] NOWPAYMENTS_API_KEY not configured');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Withdrawal approved but payout API key not configured. Please send crypto manually.',
            withdrawal_id,
            status: 'approved',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[process-withdrawal] Sending payout: ${withdrawal.amount_usd} USD in ${withdrawal.crypto_currency} to ${withdrawal.wallet_address}`);

      try {
        // First get the estimated amount in crypto
        const estimateResponse = await fetch(
          `https://api.nowpayments.io/v1/estimate?amount=${withdrawal.amount_usd}&currency_from=usd&currency_to=${withdrawal.crypto_currency}`,
          {
            headers: { 'x-api-key': nowPaymentsApiKey },
          }
        );
        const estimateData = await estimateResponse.json();
        console.log('[process-withdrawal] Estimate response:', JSON.stringify(estimateData));

        if (!estimateData.estimated_amount) {
          // Mark as approved but note the issue
          await adminClient
            .from('withdrawals')
            .update({
              status: 'approved',
              admin_note: `${admin_note || ''} [Auto: Could not estimate crypto amount. Manual payout required.]`.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', withdrawal_id);

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Withdrawal approved. Could not estimate crypto amount — please send payout manually.',
              withdrawal_id,
              status: 'approved',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create the payout
        const payoutBody = {
          ipn_callback_url: `${supabaseUrl}/functions/v1/payment-webhook`,
          withdrawals: [
            {
              address: withdrawal.wallet_address,
              currency: withdrawal.crypto_currency,
              amount: estimateData.estimated_amount,
              ipn_callback_url: `${supabaseUrl}/functions/v1/payment-webhook`,
            },
          ],
        };

        console.log('[process-withdrawal] Creating payout:', JSON.stringify(payoutBody));

        const payoutResponse = await fetch('https://api.nowpayments.io/v1/payout', {
          method: 'POST',
          headers: {
            'x-api-key': nowPaymentsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payoutBody),
        });

        const payoutData = await payoutResponse.json();
        console.log('[process-withdrawal] Payout response:', JSON.stringify(payoutData));

        if (payoutResponse.ok && payoutData.id) {
          // Payout created successfully
          await adminClient
            .from('withdrawals')
            .update({
              status: 'processing',
              payout_id: payoutData.id.toString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', withdrawal_id);

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Payout sent via NOWPayments! It will be processed shortly.',
              withdrawal_id,
              payout_id: payoutData.id,
              estimated_crypto_amount: estimateData.estimated_amount,
              status: 'processing',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Payout API failed — withdrawal stays as approved for manual handling
          console.error('[process-withdrawal] NOWPayments payout failed:', payoutData);

          await adminClient
            .from('withdrawals')
            .update({
              admin_note: `${admin_note || ''} [Auto: NOWPayments payout failed: ${payoutData.message || JSON.stringify(payoutData)}. Manual payout required.]`.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', withdrawal_id);

          return new Response(
            JSON.stringify({
              success: true,
              message: `Withdrawal approved. NOWPayments payout failed: ${payoutData.message || 'Unknown error'}. Please send crypto manually.`,
              withdrawal_id,
              status: 'approved',
              payout_error: payoutData,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (payoutError) {
        console.error('[process-withdrawal] Payout error:', payoutError);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Withdrawal approved. Automatic payout failed — please send crypto manually.',
            withdrawal_id,
            status: 'approved',
            payout_error: payoutError instanceof Error ? payoutError.message : 'Unknown error',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ---- REJECT: Reject and refund coins ----
    if (req.method === 'POST' && action === 'reject') {
      const body = await req.json();
      const { withdrawal_id, admin_note } = body;

      if (!withdrawal_id) {
        return new Response(
          JSON.stringify({ error: 'withdrawal_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch the withdrawal
      const { data: withdrawal, error: fetchError } = await adminClient
        .from('withdrawals')
        .select('*')
        .eq('id', withdrawal_id)
        .single();

      if (fetchError || !withdrawal) {
        return new Response(
          JSON.stringify({ error: 'Withdrawal not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (withdrawal.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: `Withdrawal is already ${withdrawal.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Refund coins to user
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('skilled_coins')
        .eq('user_id', withdrawal.user_id)
        .single();

      if (profileError || !profile) {
        console.error('[process-withdrawal] Profile not found for refund:', profileError);
        return new Response(
          JSON.stringify({ error: 'Failed to find user profile for refund' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const refundedBalance = (profile.skilled_coins ?? 0) + withdrawal.amount_sc;

      // Refund profiles
      const { error: refundProfileError } = await adminClient
        .from('profiles')
        .update({ skilled_coins: refundedBalance, updated_at: new Date().toISOString() })
        .eq('user_id', withdrawal.user_id);

      if (refundProfileError) {
        console.error('[process-withdrawal] Refund profile error:', refundProfileError);
        return new Response(
          JSON.stringify({ error: 'Failed to refund balance' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Sync players table
      await adminClient
        .from('players')
        .update({ credits: refundedBalance })
        .eq('user_id', withdrawal.user_id);

      // Mark as rejected
      const { error: rejectError } = await adminClient
        .from('withdrawals')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_note: admin_note || 'Withdrawal rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id);

      if (rejectError) {
        console.error('[process-withdrawal] Reject update error:', rejectError);
      }

      console.log(`[process-withdrawal] Rejected withdrawal ${withdrawal_id}, refunded ${withdrawal.amount_sc} SC to user ${withdrawal.user_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Withdrawal rejected. ${withdrawal.amount_sc} SC refunded to user.`,
          withdrawal_id,
          status: 'rejected',
          refunded_sc: withdrawal.amount_sc,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- MARK COMPLETE: Manually mark as completed (for manual payouts) ----
    if (req.method === 'POST' && action === 'complete') {
      const body = await req.json();
      const { withdrawal_id, payout_hash, admin_note } = body;

      if (!withdrawal_id) {
        return new Response(
          JSON.stringify({ error: 'withdrawal_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: completeError } = await adminClient
        .from('withdrawals')
        .update({
          status: 'completed',
          payout_hash: payout_hash || null,
          admin_note: admin_note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id)
        .in('status', ['approved', 'processing']);

      if (completeError) {
        console.error('[process-withdrawal] Complete error:', completeError);
        return new Response(
          JSON.stringify({ error: 'Failed to mark as completed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Withdrawal marked as completed', withdrawal_id, status: 'completed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: list, list-all, approve, reject, complete' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-withdrawal] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
