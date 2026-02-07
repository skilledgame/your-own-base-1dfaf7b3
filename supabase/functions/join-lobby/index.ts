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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    let { lobbyCode } = requestBody;
    if (lobbyCode) {
      lobbyCode = String(lobbyCode).trim().toUpperCase();
    }

    if (!lobbyCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lobby code is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[JOIN-LOBBY] User ${user.id} joining room with code: ${lobbyCode}`);

    // Call the RPC (runs as the authenticated user, SECURITY DEFINER handles permissions)
    const { data, error } = await supabaseUser.rpc('join_private_room', {
      p_code: lobbyCode
    });

    if (error) {
      console.error('[JOIN-LOBBY] RPC error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to join room', details: error.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = data as {
      success: boolean;
      error?: string;
      room_id?: string;
      game_id?: string;
      white_player_id?: string;
      black_player_id?: string;
      white_user_id?: string;
      black_user_id?: string;
      wager?: number;
    };

    if (!result?.success) {
      console.error('[JOIN-LOBBY] RPC returned failure:', result);
      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error || 'Failed to join room',
          details: result?.error
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[JOIN-LOBBY] Joined room ${result.room_id}, game ${result.game_id}`);

    // Fetch opponent (creator) name for display
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: creatorPlayer } = await supabaseAdmin
      .from('players')
      .select('id, name')
      .eq('id', result.white_player_id)
      .maybeSingle();

    // Fetch the full game record for the frontend
    const { data: gameData } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', result.game_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        roomId: result.room_id,
        game: gameData || { id: result.game_id },
        gameId: result.game_id,
        opponent: creatorPlayer ? { id: creatorPlayer.id, name: creatorPlayer.name } : null,
        isWhite: false, // Joiner is always black (creator is white)
        wager: result.wager,
        message: 'Joined room! Game starting...'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[JOIN-LOBBY] Unhandled error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: (error as Error)?.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
