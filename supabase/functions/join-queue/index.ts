import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Join Queue Edge Function
 * 
 * Validates user has enough SKILLED COINS and joins matchmaking queue.
 * Uses profiles.skilled_coins as the single source of truth.
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
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { wager = 100, gameType = 'chess' } = await req.json();
    console.log(`[JOIN-QUEUE] User ${user.id} joining queue - wager: ${wager}, gameType: ${gameType}`);

    // Validate wager is one of the allowed stake amounts
    const allowedWagers = [100, 500, 1000];
    if (!allowedWagers.includes(wager)) {
      console.log(`[JOIN-QUEUE] Invalid wager amount: ${wager}`);
      return new Response(
        JSON.stringify({ error: 'Invalid wager amount. Must be 100, 500, or 1000 Skilled Coins.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile for skilled_coins (single source of truth)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('skilled_coins')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[JOIN-QUEUE] Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found. Please refresh and try again.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's player record for matchmaking
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, name')
      .eq('user_id', user.id)
      .single();

    if (playerError || !player) {
      console.error('[JOIN-QUEUE] Player not found:', playerError);
      return new Response(
        JSON.stringify({ error: 'Player not found. Please create a player first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[JOIN-QUEUE] Player found: ${player.id} (${player.name}), skilled_coins: ${profile.skilled_coins}`);

    // Check if user is a privileged user (admin/moderator)
    const { data: isPrivileged } = await supabaseAdmin.rpc('is_privileged_user', {
      _user_id: user.id,
    });

    // Validate skilled_coins (skip for privileged users)
    if (!isPrivileged && wager > profile.skilled_coins) {
      console.log(`[JOIN-QUEUE] Insufficient Skilled Coins: ${profile.skilled_coins} < ${wager}`);
      return new Response(
        JSON.stringify({ error: 'Insufficient Skilled Coins' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up any stale queue entries first
    await supabaseAdmin.rpc('clean_stale_queue_entries');

    // Check if already in queue
    const { data: existingEntry } = await supabaseAdmin
      .from('matchmaking_queue')
      .select('id, wager, game_type')
      .eq('player_id', player.id)
      .maybeSingle();

    if (existingEntry) {
      // Already in queue is NOT an error - it's a valid state
      console.log(`[JOIN-QUEUE] Player already in queue: ${existingEntry.id} - returning success`);
      return new Response(
        JSON.stringify({ 
          matched: false,
          inQueue: true,
          queuePosition: 1,
          wager: existingEntry.wager,
          gameType: existingEntry.game_type,
          message: 'Already searching for opponent'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      console.log(`[JOIN-QUEUE] Player already in active game: ${activeGame.id}`);
      return new Response(
        JSON.stringify({ error: 'Already in an active game' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look for opponent with EXACT same wager and game type
    const { data: queueData, error: queueError } = await supabaseAdmin
      .from('matchmaking_queue')
      .select('id, player_id, wager, game_type, created_at')
      .eq('game_type', gameType)
      .eq('wager', wager)
      .neq('player_id', player.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (queueError) {
      console.error('[JOIN-QUEUE] Queue query error:', queueError);
      return new Response(
        JSON.stringify({ error: 'Failed to check queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (queueData && queueData.length > 0) {
      // Found opponent with matching wager - create game
      const opponentEntry = queueData[0];
      console.log(`[JOIN-QUEUE] Match found! Opponent: ${opponentEntry.player_id}, wager: ${wager}`);

      // Remove opponent from queue FIRST to prevent race conditions
      const { error: deleteError } = await supabaseAdmin
        .from('matchmaking_queue')
        .delete()
        .eq('id', opponentEntry.id);

      if (deleteError) {
        console.error('[JOIN-QUEUE] Failed to remove opponent from queue:', deleteError);
        // Opponent might have been matched by another request - retry by adding to queue
      } else {
        // Random color assignment
        const isWhite = Math.random() > 0.5;
        const whitePlayerId = isWhite ? player.id : opponentEntry.player_id;
        const blackPlayerId = isWhite ? opponentEntry.player_id : player.id;

        // Create game with proper time settings (60 seconds base + 5 second increment)
        // Status is 'created' initially, will be set to 'active' by lock_wager()
        const { data: gameData, error: gameError } = await supabaseAdmin
          .from('games')
          .insert({
            white_player_id: whitePlayerId,
            black_player_id: blackPlayerId,
            wager: wager,
            white_time: 60,
            black_time: 60,
            game_type: gameType,
            status: 'created',  // Will be set to 'active' by lock_wager()
          })
          .select()
          .single();

        if (gameError) {
          console.error('[JOIN-QUEUE] Game creation error:', gameError);
          // Re-add opponent to queue if game creation failed
          await supabaseAdmin
            .from('matchmaking_queue')
            .insert({
              player_id: opponentEntry.player_id,
              wager: opponentEntry.wager,
              game_type: opponentEntry.game_type,
            });
          return new Response(
            JSON.stringify({ error: 'Failed to create game' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Lock wager: deduct skilled_coins from both players' profiles
        console.log(`[JOIN-QUEUE] Locking wager for game ${gameData.id}...`);
        const { data: lockResult, error: lockError } = await supabaseAdmin.rpc('lock_wager', {
          p_game_id: gameData.id
        });

        if (lockError || !lockResult?.success) {
          console.error('[JOIN-QUEUE] Failed to lock wager:', lockError || lockResult?.error);
          // Delete the game if wager locking failed
          await supabaseAdmin.from('games').delete().eq('id', gameData.id);
          // Re-add opponent to queue
          await supabaseAdmin
            .from('matchmaking_queue')
            .insert({
              player_id: opponentEntry.player_id,
              wager: opponentEntry.wager,
              game_type: opponentEntry.game_type,
            });
          return new Response(
            JSON.stringify({ 
              error: 'Failed to lock wager', 
              details: lockResult?.error || lockError?.message 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[JOIN-QUEUE] Wager locked successfully for game ${gameData.id}`);

        // Get opponent info
        const { data: opponentData } = await supabaseAdmin
          .from('players')
          .select('id, name')
          .eq('id', opponentEntry.player_id)
          .single();

        console.log(`[JOIN-QUEUE] Game ${gameData.id} created and wager locked successfully`);

        return new Response(
          JSON.stringify({ 
            matched: true, 
            game: gameData,
            opponent: opponentData ? { id: opponentData.id, name: opponentData.name } : null,
            isWhite
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No opponent found - add to queue
    console.log(`[JOIN-QUEUE] No match found, adding to queue`);
    const { error: insertError } = await supabaseAdmin
      .from('matchmaking_queue')
      .insert({ 
        player_id: player.id, 
        wager,
        game_type: gameType
      });

    if (insertError) {
      console.error('[JOIN-QUEUE] Queue insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to join queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current queue count for same wager
    const { count: queueCount } = await supabaseAdmin
      .from('matchmaking_queue')
      .select('id', { count: 'exact', head: true })
      .eq('game_type', gameType)
      .eq('wager', wager);

    console.log(`[JOIN-QUEUE] Player ${player.id} added to queue. Queue size: ${queueCount}`);

    return new Response(
      JSON.stringify({ 
        matched: false, 
        inQueue: true,
        queuePosition: queueCount || 1,
        wager,
        gameType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[JOIN-QUEUE] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
