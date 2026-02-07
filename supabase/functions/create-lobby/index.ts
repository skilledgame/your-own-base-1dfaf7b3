import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client authenticated as the calling user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', details: userError?.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { wager = 100 } = requestBody;
    console.log(`[CREATE-LOBBY] User ${user.id} creating private room - wager: ${wager}`);

    // Call the RPC (runs as the authenticated user, SECURITY DEFINER handles permissions)
    const { data, error } = await supabaseUser.rpc('create_private_room', {
      p_wager: wager
    });

    if (error) {
      console.error('[CREATE-LOBBY] RPC error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create room', details: error.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // data is the JSONB result from the RPC
    const result = data as { success: boolean; error?: string; room_id?: string; code?: string; wager?: number };

    if (!result?.success) {
      console.error('[CREATE-LOBBY] RPC returned failure:', result);
      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error || 'Failed to create room',
          details: result?.error
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CREATE-LOBBY] Room created: ${result.room_id}, code: ${result.code}`);

    return new Response(
      JSON.stringify({
        success: true,
        roomId: result.room_id,
        lobbyCode: result.code,
        wager: result.wager,
        message: 'Room created, waiting for opponent'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CREATE-LOBBY] Unhandled error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: (error as Error)?.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
