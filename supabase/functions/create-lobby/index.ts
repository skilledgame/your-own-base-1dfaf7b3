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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('[CREATE-LOBBY] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { wager = 100, gameType = 'chess', lobbyCode } = await req.json();
    console.log(`[CREATE-LOBBY] User ${user.id} creating lobby - wager: ${wager}, gameType: ${gameType}, code: ${lobbyCode || 'auto'}`);

    // Validate wager
    const allowedWagers = [100, 500, 1000, 5000];
    const minWager = 50;
    const maxWager = 100000;
    
    if (wager < minWager || wager > maxWager) {
      return new Response(
        JSON.stringify({ error: `Wager must be between ${minWager} and ${maxWager} coins` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's player record
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, credits, name')
      .eq('user_id', user.id)
      .single();

    if (playerError || !player) {
      console.error('[CREATE-LOBBY] Player not found:', playerError);
      return new Response(
        JSON.stringify({ error: 'Player not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CREATE-LOBBY] Player: ${player.id} (${player.name})`);

    // Check if user is privileged (admin/moderator)
    const { data: isPrivileged, error: privilegedError } = await supabaseAdmin.rpc('is_privileged_user', {
      _user_id: user.id,
    });

    if (privilegedError) {
      console.error('[CREATE-LOBBY] Error checking privileged status:', privilegedError);
      // Continue anyway - treat as non-privileged if check fails
    }

    const isPrivilegedUser = isPrivileged === true;

    // Check skilled_coins from profiles (not players.credits)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('skilled_coins')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[CREATE-LOBBY] Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate balance for non-privileged users
    if (!isPrivilegedUser) {
      if (!profile) {
        return new Response(
          JSON.stringify({ error: 'Profile not found. Please refresh and try again.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (wager > profile.skilled_coins) {
        return new Response(
          JSON.stringify({ error: 'Insufficient credits' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if already in a waiting lobby
    const { data: existingLobby } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('status', 'waiting')
      .eq('white_player_id', player.id)
      .maybeSingle();

    if (existingLobby) {
      console.log('[CREATE-LOBBY] Player already has a waiting lobby:', existingLobby.id);
      return new Response(
        JSON.stringify({ error: 'You already have a waiting lobby' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already in an active game
    const { data: activeGame } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('status', 'active')
      .or(`white_player_id.eq.${player.id},black_player_id.eq.${player.id}`)
      .maybeSingle();

    if (activeGame) {
      return new Response(
        JSON.stringify({ error: 'Already in an active game' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate lobby code if not provided
    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const finalLobbyCode = lobbyCode || generateCode();

    // Create a game with status 'waiting' - white player is the host
    // black_player_id will be a placeholder until someone joins
    const { data: gameData, error: gameError } = await supabaseAdmin
      .from('games')
      .insert({
        white_player_id: player.id,
        black_player_id: player.id, // Placeholder - will be updated when opponent joins
        wager: wager,
        white_time: 60,
        black_time: 60,
        game_type: gameType,
        status: 'waiting',
        fen: `LOBBY:${finalLobbyCode}`, // Store lobby code in FEN temporarily
      })
      .select()
      .single();

    if (gameError) {
      console.error('[CREATE-LOBBY] Game creation error:', gameError);
      return new Response(
        JSON.stringify({ error: 'Failed to create lobby' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CREATE-LOBBY] Lobby created: ${gameData.id}, code: ${finalLobbyCode}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        game: gameData,
        lobbyCode: finalLobbyCode,
        message: 'Lobby created, waiting for opponent'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CREATE-LOBBY] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});