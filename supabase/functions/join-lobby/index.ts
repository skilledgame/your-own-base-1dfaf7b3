import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[JOIN-LOBBY] Function entry - method:', req.method);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    console.log('[JOIN-LOBBY] Auth header present:', !!authHeader);
    if (!authHeader) {
      console.error('[JOIN-LOBBY] Missing auth header - returning error');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header', details: 'Please provide an authorization header' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    console.log('[JOIN-LOBBY] User auth result - hasUser:', !!user, 'userId:', user?.id, 'error:', userError?.message);
    if (userError || !user) {
      console.error('[JOIN-LOBBY] Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', details: userError?.message || 'Invalid or missing authentication' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error('[JOIN-LOBBY] JSON parse error:', jsonError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body', details: (jsonError as Error)?.message || 'Failed to parse JSON' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let { lobbyCode, gameId } = requestBody;
    // Normalize lobby code - trim whitespace and convert to uppercase
    if (lobbyCode) {
      lobbyCode = String(lobbyCode).trim().toUpperCase();
    }
    console.log(`[JOIN-LOBBY] User ${user.id} joining lobby - code: ${lobbyCode}, gameId: ${gameId}`);

    if (!lobbyCode && !gameId) {
      console.error('[JOIN-LOBBY] Neither lobbyCode nor gameId provided - returning error');
      return new Response(
        JSON.stringify({ success: false, error: 'Lobby code or game ID required', details: 'Please provide either lobbyCode or gameId in the request body' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ success: false, error: 'Player not found', details: playerError?.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[JOIN-LOBBY] Player: ${player.id} (${player.name})`);

    // Find the waiting lobby
    console.log('[JOIN-LOBBY] Looking for lobby - gameId:', gameId, 'lobbyCode:', lobbyCode);
    let lobby = null;
    let lobbyError = null;

    if (gameId) {
      console.log('[JOIN-LOBBY] Searching by gameId:', gameId);
      const result = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', gameId)
        .eq('status', 'waiting')
        .maybeSingle();
      lobby = result.data;
      lobbyError = result.error;
    } else if (lobbyCode) {
      const searchPattern = `LOBBY:${lobbyCode}`;
      console.log('[JOIN-LOBBY] Searching by lobbyCode, exact pattern:', searchPattern);
      
      // Try exact match first (FEN is stored as "LOBBY:CODE" exactly)
      const exactResult = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('status', 'waiting')
        .eq('fen', searchPattern)
        .maybeSingle();
      
      lobby = exactResult.data;
      lobbyError = exactResult.error;
      
      console.log('[JOIN-LOBBY] Exact match result - found:', !!lobby, 'error:', lobbyError?.message);
      
      // If not found with exact match, try to find any waiting lobby and check FEN manually
      if (!lobby && !lobbyError) {
        console.log('[JOIN-LOBBY] Exact match not found, fetching all waiting lobbies to debug');
        const allWaitingResult = await supabaseAdmin
          .from('games')
          .select('id, fen, white_player_id, status, wager')
          .eq('status', 'waiting')
          .limit(20);
        
        console.log('[JOIN-LOBBY] All waiting lobbies:', JSON.stringify(allWaitingResult.data, null, 2));
        
        // Try to find matching lobby manually
        if (allWaitingResult.data) {
          const matchingLobby = allWaitingResult.data.find(g => 
            g.fen && g.fen.toUpperCase() === searchPattern.toUpperCase()
          );
          if (matchingLobby) {
            console.log('[JOIN-LOBBY] Found matching lobby via manual search:', matchingLobby.id);
            // Fetch full lobby data
            const fullLobbyResult = await supabaseAdmin
              .from('games')
              .select('*')
              .eq('id', matchingLobby.id)
              .single();
            lobby = fullLobbyResult.data;
            lobbyError = fullLobbyResult.error;
          }
        }
      }
    } else {
      console.error('[JOIN-LOBBY] Neither gameId nor lobbyCode provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Lobby code or game ID required', details: 'Please provide either lobbyCode or gameId' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[JOIN-LOBBY] Lobby query result - hasLobby:', !!lobby, 'lobbyId:', lobby?.id, 'lobbyFen:', lobby?.fen, 'error:', lobbyError?.message);

    if (lobbyError) {
      console.error('[JOIN-LOBBY] Lobby query error:', lobbyError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to find lobby', details: lobbyError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lobby) {
      console.log('[JOIN-LOBBY] Lobby not found - checking all waiting lobbies for debugging');
      // Debug: Get all waiting lobbies to see what's available
      const { data: allWaitingLobbies, error: debugError } = await supabaseAdmin
        .from('games')
        .select('id, fen, white_player_id, status, created_at, wager')
        .eq('status', 'waiting')
        .limit(10);
      console.log('[JOIN-LOBBY] All waiting lobbies:', JSON.stringify(allWaitingLobbies, null, 2));
      console.log('[JOIN-LOBBY] Debug query error:', debugError);
      
      const searchedPattern = lobbyCode ? `LOBBY:${lobbyCode}` : 'N/A';
      const availableCodes = allWaitingLobbies?.map(g => g.fen).filter(f => f?.startsWith('LOBBY:')).join(', ') || 'None';
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Lobby not found or already started', 
          details: `No lobby found with code: ${lobbyCode || 'N/A'}. Searched for: ${searchedPattern}. Available lobby codes: ${availableCodes}`,
          searchedPattern,
          availableLobbies: allWaitingLobbies?.length || 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if trying to join own lobby
    console.log('[JOIN-LOBBY] Checking if joining own lobby - whitePlayerId:', lobby.white_player_id, 'currentPlayerId:', player.id);
    if (lobby.white_player_id === player.id) {
      console.log('[JOIN-LOBBY] User trying to join own lobby - returning error');
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot join your own lobby', details: 'You cannot join a lobby you created' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is privileged (admin/moderator)
    const { data: isPrivileged, error: privilegedError } = await supabaseAdmin.rpc('is_privileged_user', {
      _user_id: user.id,
    });

    if (privilegedError) {
      console.error('[JOIN-LOBBY] Error checking privileged status:', privilegedError);
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
      console.error('[JOIN-LOBBY] Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch profile', details: profileError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate balance for non-privileged users
    if (!isPrivilegedUser) {
      if (!profile) {
        return new Response(
          JSON.stringify({ success: false, error: 'Profile not found. Please refresh and try again.', details: 'Your profile could not be found in the database' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (lobby.wager > profile.skilled_coins) {
        return new Response(
          JSON.stringify({ success: false, error: 'Insufficient credits for this wager', details: `Required: ${lobby.wager} SC, Available: ${profile.skilled_coins} SC` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Clean up stale games for this specific player before checking
    // This prevents stale game records from blocking new lobby joins
    const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    console.log('[JOIN-LOBBY] Cleaning up stale games for player:', player.id);
    
    // Cancel stale 'created' games (older than 5 minutes, never locked)
    const { error: cleanupCreatedError } = await supabaseAdmin
      .from('games')
      .update({ status: 'cancelled' })
      .or(`white_player_id.eq.${player.id},black_player_id.eq.${player.id}`)
      .eq('status', 'created')
      .is('wager_locked_at', null)
      .lt('created_at', staleCutoff);
    
    if (cleanupCreatedError) {
      console.warn('[JOIN-LOBBY] Error cleaning up stale created games:', cleanupCreatedError);
    }
    
    // Cancel stale 'active' games (no updates in last 5 minutes)
    // Games that haven't been updated in 5 minutes are likely abandoned
    const { error: cleanupActiveError } = await supabaseAdmin
      .from('games')
      .update({ status: 'cancelled' })
      .or(`white_player_id.eq.${player.id},black_player_id.eq.${player.id}`)
      .eq('status', 'active')
      .lt('updated_at', staleCutoff);
    
    if (cleanupActiveError) {
      console.warn('[JOIN-LOBBY] Error cleaning up stale active games:', cleanupActiveError);
    }
    
    // Cancel 'active' games still at starting position (no moves made)
    // These are games that were created but never actually played
    const { error: cleanupNoMovesError } = await supabaseAdmin
      .from('games')
      .update({ status: 'cancelled' })
      .or(`white_player_id.eq.${player.id},black_player_id.eq.${player.id}`)
      .eq('status', 'active')
      .eq('fen', startingFen);
    
    if (cleanupNoMovesError) {
      console.warn('[JOIN-LOBBY] Error cleaning up games with no moves:', cleanupNoMovesError);
    }
    
    // Cancel invalid 'active' games (both players are the same - invalid state)
    const { error: cleanupInvalidError } = await supabaseAdmin
      .from('games')
      .update({ status: 'cancelled' })
      .or(`white_player_id.eq.${player.id},black_player_id.eq.${player.id}`)
      .eq('status', 'active')
      .eq('white_player_id', 'black_player_id');
    
    if (cleanupInvalidError) {
      console.warn('[JOIN-LOBBY] Error cleaning up invalid games:', cleanupInvalidError);
    }
    
    // Continue anyway - cleanup failures shouldn't block joining

    // Check if already in a valid active or created game (after cleanup, stale games are cancelled)
    // Only check for games that are actually valid - stale games have been cleaned up above
    const { data: activeGame } = await supabaseAdmin
      .from('games')
      .select('id, status, white_player_id, black_player_id, updated_at')
      .in('status', ['active', 'created'])
      .or(`white_player_id.eq.${player.id},black_player_id.eq.${player.id}`)
      .maybeSingle();

    if (activeGame) {
      // Additional validation: ensure the game is actually valid
      // Skip if both players are the same (invalid state)
      if (activeGame.white_player_id === activeGame.black_player_id && activeGame.status === 'active') {
        console.log('[JOIN-LOBBY] Found invalid game with same player for both sides, skipping check');
        // Don't block - this is an invalid game state
      } else {
        const gameStatus = activeGame.status === 'created' ? 'a game that is being set up' : 'an active game';
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Already in a game', 
            details: `You are already in ${gameStatus} (${activeGame.id}). Please finish that game first.`,
            gameId: activeGame.id,
            gameStatus: activeGame.status
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update the lobby to start the game (status 'created' initially, will be set to 'active' by lock_wager)
    const { data: updatedGame, error: updateError } = await supabaseAdmin
      .from('games')
      .update({
        black_player_id: player.id,
        status: 'created', // Will be set to 'active' by lock_wager()
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Reset to starting position
        current_turn: 'w', // White (host) goes first
      })
      .eq('id', lobby.id)
      .eq('status', 'waiting') // Ensure still waiting (prevent race condition)
      .select()
      .single();

    if (updateError || !updatedGame) {
      console.error('[JOIN-LOBBY] Update error:', updateError, 'updateError code:', updateError?.code, 'updateError message:', updateError?.message);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to join lobby. It may have already started.', 
          details: updateError?.message || 'The lobby may have been joined by someone else or cancelled.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          success: false,
          error: 'Failed to lock wager', 
          details: lockResult?.error || lockError?.message || 'Unable to lock wager for this game'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[JOIN-LOBBY] Wager locked successfully for game ${updatedGame.id}`);

    // Refetch the game to get the updated status (lock_wager sets it to 'active')
    const { data: refetchedGame, error: refetchError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', updatedGame.id)
      .single();

    // Use refetched game if available, otherwise fall back to updatedGame
    const finalGame = refetchedGame || updatedGame;
    
    if (refetchError && !refetchedGame) {
      console.warn('[JOIN-LOBBY] Error refetching game after lock_wager:', refetchError);
      console.warn('[JOIN-LOBBY] Using updatedGame as fallback (status may be outdated)');
    }

    // Get host player info
    const { data: hostPlayer } = await supabaseAdmin
      .from('players')
      .select('id, name')
      .eq('id', lobby.white_player_id)
      .single();

    console.log(`[JOIN-LOBBY] Game ${finalGame.id} started! Status: ${finalGame.status}, Host: ${hostPlayer?.name}, Joiner: ${player.name}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        game: finalGame,
        opponent: hostPlayer ? { id: hostPlayer.id, name: hostPlayer.name } : null,
        isWhite: false, // Joiner is always black
        message: 'Game started!'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[JOIN-LOBBY] Unhandled error:', error);
    const errorMessage = (error as Error)?.message || 'Unknown error';
    const errorStack = (error as Error)?.stack || '';
    console.error('[JOIN-LOBBY] Error details:', { message: errorMessage, stack: errorStack });
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error', 
        details: errorMessage 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});