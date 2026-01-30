import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { gameId, from, to, promotion, whiteTime, blackTime } = await req.json();

    if (!gameId || !from || !to) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: gameId, from, to' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's player record
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ success: false, error: 'Player not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current game state
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ success: false, error: 'Game not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify game is active
    if (game.status !== 'active') {
      return new Response(
        JSON.stringify({ success: false, error: 'Game is not active' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify it's the player's turn
    const isWhite = game.white_player_id === player.id;
    const isBlack = game.black_player_id === player.id;
    
    if (!isWhite && !isBlack) {
      return new Response(
        JSON.stringify({ success: false, error: 'You are not a player in this game' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expectedTurn = isWhite ? 'w' : 'b';
    if (game.current_turn !== expectedTurn) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not your turn' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate move using chess.js (server-side validation)
    try {
      const { Chess } = await import('https://esm.sh/chess.js@1.0.0-beta.6');
      const chess = new Chess(game.fen);
      const move = chess.move({ from, to, promotion: promotion || 'q' });
      
      if (!move) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid move' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for game end conditions
      let newStatus = game.status;
      let winnerId: string | null = null;

      if (chess.isCheckmate()) {
        newStatus = 'finished';
        winnerId = isWhite ? game.white_player_id : game.black_player_id;
      } else if (chess.isDraw() || chess.isStalemate()) {
        newStatus = 'finished';
        winnerId = null; // Draw
      }

      // Update game with new FEN, turn, and time
      const nextTurn = game.current_turn === 'w' ? 'b' : 'w';
      const updateData: any = {
        fen: chess.fen(),
        current_turn: nextTurn,
        updated_at: new Date().toISOString(),
      };

      // Update time values if provided
      if (whiteTime !== undefined) {
        updateData.white_time = whiteTime;
      }
      if (blackTime !== undefined) {
        updateData.black_time = blackTime;
      }

      // Update status and winner if game ended
      if (newStatus === 'finished') {
        updateData.status = 'finished';
        if (winnerId) {
          updateData.winner_id = winnerId;
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('games')
        .update(updateData)
        .eq('id', gameId)
        .eq('status', 'active'); // Ensure still active (prevent race conditions)

      if (updateError) {
        console.error('[MAKE-MOVE] Update error:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update game', details: updateError.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If game ended, settle wagers
      if (newStatus === 'finished') {
        const { error: settleError } = await supabaseAdmin.rpc('settle_match', {
          p_game_id: gameId,
          p_winner_id: winnerId,
          p_reason: chess.isCheckmate() ? 'checkmate' : 'draw',
        });

        if (settleError) {
          console.error('[MAKE-MOVE] Settlement error:', settleError);
          // Don't fail the move - settlement can be retried
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          fen: chess.fen(),
          turn: nextTurn,
          gameEnded: newStatus === 'finished',
          winnerId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('[MAKE-MOVE] Move validation error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to validate move', details: (error as Error)?.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[MAKE-MOVE] Unhandled error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: (error as Error)?.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
