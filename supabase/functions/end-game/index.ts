import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * End Game Edge Function
 * 
 * PART C: Now uses the idempotent settle_game RPC for transaction-safe settlement.
 * Safe to retry multiple times - will not double-pay.
 */

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
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { gameId, winnerId: providedWinnerId, reason } = await req.json();

    if (!gameId) {
      return new Response(
        JSON.stringify({ error: 'Missing gameId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's player record
    const { data: player, error: playerError } = await supabaseClient
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: 'Player not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get game and verify user is participant
    const { data: game, error: gameError } = await supabaseClient
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: 'Game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is a participant
    if (game.white_player_id !== player.id && game.black_player_id !== player.id) {
      return new Response(
        JSON.stringify({ error: 'Not a participant in this game' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine winner if not provided but reason indicates one
    let finalWinnerId = providedWinnerId;
    if (!finalWinnerId && reason) {
      if (reason === 'timeout') {
        // Determine winner based on who timed out (opponent of current turn)
        // If it's white's turn and they timed out, black wins
        // If it's black's turn and they timed out, white wins
        if (game.current_turn === 'w') {
          finalWinnerId = game.black_player_id; // White timed out, black wins
        } else if (game.current_turn === 'b') {
          finalWinnerId = game.white_player_id; // Black timed out, white wins
        }
      } else if (reason === 'resignation') {
        // The player who called resign loses, opponent wins
        if (player.id === game.white_player_id) {
          finalWinnerId = game.black_player_id; // White resigned, black wins
        } else {
          finalWinnerId = game.white_player_id; // Black resigned, white wins
        }
      }
    }

    console.log('end-game: calling settle_game RPC with:', { gameId, winnerId: finalWinnerId, reason });

    // Use the idempotent settle_game RPC
    // This is transaction-safe and can be retried without double-paying
    const { data: settlementResult, error: settlementError } = await supabaseClient
      .rpc('settle_game', {
        p_game_id: gameId,
        p_winner_id: finalWinnerId || null,
        p_reason: reason || 'unknown'
      });

    if (settlementError) {
      console.error('end-game: settle_game RPC error:', settlementError);
      return new Response(
        JSON.stringify({ error: 'Settlement failed', details: settlementError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('end-game: settle_game RPC result:', settlementResult);

    // Check RPC result
    if (!settlementResult?.success) {
      console.error('end-game: settlement returned failure:', settlementResult);
      return new Response(
        JSON.stringify({ 
          error: settlementResult?.error || 'Settlement failed',
          game_id: gameId 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return success with settlement details
    return new Response(
      JSON.stringify({
        success: true,
        game_id: gameId,
        winner_id: settlementResult.winner_id,
        reason: reason || 'unknown',
        already_settled: settlementResult.already_settled || false,
        settlement_tx_id: settlementResult.settlement_tx_id,
        balances: settlementResult.balances,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('end-game: unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
