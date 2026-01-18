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
      console.error('[JOIN-LOBBY] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { lobbyCode, gameId } = await req.json();
    console.log(`[JOIN-LOBBY] User ${user.id} joining lobby - code: ${lobbyCode}, gameId: ${gameId}`);

    if (!lobbyCode && !gameId) {
      return new Response(
        JSON.stringify({ error: 'Lobby code or game ID required' }),
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
      console.error('[JOIN-LOBBY] Player not found:', playerError);
      return new Response(
        JSON.stringify({ error: 'Player not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[JOIN-LOBBY] Player: ${player.id} (${player.name}), credits: ${player.credits}`);

    // Find the waiting lobby
    let lobbyQuery = supabaseAdmin
      .from('games')
      .select('*')
      .eq('status', 'waiting');

    if (gameId) {
      lobbyQuery = lobbyQuery.eq('id', gameId);
    } else if (lobbyCode) {
      lobbyQuery = lobbyQuery.like('fen', `LOBBY:${lobbyCode.toUpperCase()}`);
    }

    const { data: lobby, error: lobbyError } = await lobbyQuery.maybeSingle();

    if (lobbyError) {
      console.error('[JOIN-LOBBY] Lobby query error:', lobbyError);
      return new Response(
        JSON.stringify({ error: 'Failed to find lobby' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lobby) {
      console.log('[JOIN-LOBBY] Lobby not found');
      return new Response(
        JSON.stringify({ error: 'Lobby not found or already started' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if trying to join own lobby
    if (lobby.white_player_id === player.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot join your own lobby' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check credits
    const { data: isPrivileged } = await supabaseAdmin.rpc('is_privileged_user', {
      _user_id: user.id,
    });

    if (!isPrivileged && lobby.wager > player.credits) {
      return new Response(
        JSON.stringify({ error: 'Insufficient credits for this wager' }),
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

    // Update the lobby to start the game (status 'created' initially, will be set to 'active' by lock_wager)
    const { data: updatedGame, error: updateError } = await supabaseAdmin
      .from('games')
      .update({
        black_player_id: player.id,
        status: 'created', // Will be set to 'active' by lock_wager()
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Reset to starting position
      })
      .eq('id', lobby.id)
      .eq('status', 'waiting') // Ensure still waiting (prevent race condition)
      .select()
      .single();

    if (updateError || !updatedGame) {
      console.error('[JOIN-LOBBY] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to join lobby. It may have already started.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lock wager: deduct skilled_coins from both players
    console.log(`[JOIN-LOBBY] Locking wager for game ${updatedGame.id}...`);
    const { data: lockResult, error: lockError } = await supabaseAdmin.rpc('lock_wager', {
      p_game_id: updatedGame.id
    });

    if (lockError || !lockResult?.success) {
      console.error('[JOIN-LOBBY] Failed to lock wager:', lockError || lockResult?.error);
      // Revert game status back to waiting if wager locking failed
      await supabaseAdmin
        .from('games')
        .update({ 
          status: 'waiting',
          black_player_id: lobby.white_player_id // Revert black_player_id
        })
        .eq('id', updatedGame.id);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to lock wager', 
          details: lockResult?.error || lockError?.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[JOIN-LOBBY] Wager locked successfully for game ${updatedGame.id}`);

    // Get host player info
    const { data: hostPlayer } = await supabaseAdmin
      .from('players')
      .select('id, name')
      .eq('id', lobby.white_player_id)
      .single();

    console.log(`[JOIN-LOBBY] Game ${updatedGame.id} started! Host: ${hostPlayer?.name}, Joiner: ${player.name}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        game: updatedGame,
        opponent: hostPlayer ? { id: hostPlayer.id, name: hostPlayer.name } : null,
        isWhite: false, // Joiner is always black
        message: 'Game started!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[JOIN-LOBBY] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});