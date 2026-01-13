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

    const { gameId, winnerId, reason } = await req.json();

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

    // Idempotent: if game already finished, return existing state
    if (game.status === 'finished') {
      console.log('end-game: game already finished, returning existing state');
      
      const [whiteRes, blackRes] = await Promise.all([
        supabaseClient.from('players').select('id, credits').eq('id', game.white_player_id).maybeSingle(),
        supabaseClient.from('players').select('id, credits').eq('id', game.black_player_id).maybeSingle(),
      ]);
      
      return new Response(
        JSON.stringify({
          success: true,
          game_id: gameId,
          winner_id: game.winner_id,
          already_finished: true,
          balances: {
            white: { player_id: game.white_player_id, credits: whiteRes.data?.credits ?? null },
            black: { player_id: game.black_player_id, credits: blackRes.data?.credits ?? null },
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wager = game.wager || 0;
    console.log('end-game: wager =', wager, 'white_player_id =', game.white_player_id, 'black_player_id =', game.black_player_id);

    // Read both players
    const [whitePlayerRes, blackPlayerRes] = await Promise.all([
      supabaseClient.from('players').select('id, credits, user_id, name').eq('id', game.white_player_id).maybeSingle(),
      supabaseClient.from('players').select('id, credits, user_id, name').eq('id', game.black_player_id).maybeSingle(),
    ]);

    if (whitePlayerRes.error || !whitePlayerRes.data) {
      console.error('end-game: white player not found:', whitePlayerRes.error);
      return new Response(
        JSON.stringify({ error: 'White player not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (blackPlayerRes.error || !blackPlayerRes.data) {
      console.error('end-game: black player not found:', blackPlayerRes.error);
      return new Response(
        JSON.stringify({ error: 'Black player not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const whitePlayer = whitePlayerRes.data;
    const blackPlayer = blackPlayerRes.data;

    console.log('end-game: balances BEFORE:', {
      white: { id: whitePlayer.id, credits: whitePlayer.credits },
      black: { id: blackPlayer.id, credits: blackPlayer.credits },
    });

    // Calculate new balances
    let whiteNewCredits = whitePlayer.credits;
    let blackNewCredits = blackPlayer.credits;

    if (winnerId) {
      if (winnerId === whitePlayer.id) {
        whiteNewCredits = whitePlayer.credits + wager;
        blackNewCredits = blackPlayer.credits - wager;
      } else if (winnerId === blackPlayer.id) {
        blackNewCredits = blackPlayer.credits + wager;
        whiteNewCredits = whitePlayer.credits - wager;
      }
    }

    console.log('end-game: balances AFTER calculation:', {
      white: { id: whitePlayer.id, oldCredits: whitePlayer.credits, newCredits: whiteNewCredits },
      black: { id: blackPlayer.id, oldCredits: blackPlayer.credits, newCredits: blackNewCredits },
    });

    // Update player credits
    const creditUpdates = [];

    if (whiteNewCredits !== whitePlayer.credits) {
      creditUpdates.push(
        supabaseClient.from('players').update({ credits: whiteNewCredits }).eq('id', whitePlayer.id)
      );
    }

    if (blackNewCredits !== blackPlayer.credits) {
      creditUpdates.push(
        supabaseClient.from('players').update({ credits: blackNewCredits }).eq('id', blackPlayer.id)
      );
    }

    if (creditUpdates.length > 0) {
      const creditResults = await Promise.all(creditUpdates);
      for (const result of creditResults) {
        if (result.error) {
          console.error('end-game: failed to update player credits:', result.error);
          return new Response(
            JSON.stringify({ error: 'Failed to update credits' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Update game status
    const { error: gameUpdateError } = await supabaseClient
      .from('games')
      .update({
        status: 'finished',
        winner_id: winnerId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId);

    if (gameUpdateError) {
      console.error('end-game: failed to update game status:', gameUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update game status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('end-game SUCCESS:', {
      game_id: gameId,
      winner_id: winnerId,
      reason,
      balances: {
        white: { player_id: whitePlayer.id, credits: whiteNewCredits },
        black: { player_id: blackPlayer.id, credits: blackNewCredits },
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        game_id: gameId,
        winner_id: winnerId,
        reason: reason || 'unknown',
        balances: {
          white: { player_id: whitePlayer.id, credits: whiteNewCredits },
          black: { player_id: blackPlayer.id, credits: blackNewCredits },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
