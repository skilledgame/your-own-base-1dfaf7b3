import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Admin user IDs - these users will be granted admin role
const ADMIN_USER_IDS = [
  '04d39de7-6912-4569-93a8-9645cdc4f35b',
  '600b2a61-44a8-4723-a8db-4e30896a86fa',
];

/**
 * Ensure User Edge Function
 * 
 * Creates profile and player records for new users.
 * Uses profiles.skilled_coins as the SINGLE source of truth.
 * New accounts start with 0 Skilled Coins.
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ensure-user] Starting user provisioning...');

    // Validate authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[ensure-user] Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized: Missing token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with anon key to validate the token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's token to get claims
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate user token and get claims
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('[ensure-user] Failed to get claims:', claimsError?.message);
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email as string | undefined;
    console.log('[ensure-user] Authenticated user:', userId, 'email:', userEmail);

    // Get user metadata from auth
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError) {
      console.warn('[ensure-user] Could not fetch user details:', userError.message);
    }

    const displayName = user?.user_metadata?.display_name 
      || user?.user_metadata?.full_name 
      || user?.user_metadata?.name
      || userEmail?.split('@')[0] 
      || 'Player';
    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

    console.log('[ensure-user] User metadata - displayName:', displayName, 'avatarUrl:', avatarUrl ? 'present' : 'none');

    // Create service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let createdProfiles = false;
    let createdPlayers = false;
    let createdFreePlays = false;
    let createdAdminRole = false;
    let skilledCoins = 0;

    // 1. Check if profile exists first (profiles.skilled_coins is the source of truth)
    console.log('[ensure-user] Checking if profile exists...');
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, skilled_coins')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingProfile) {
      // Only insert if doesn't exist - never overwrite existing data
      console.log('[ensure-user] Creating new profile...');
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: userId,
          email: userEmail,
          display_name: displayName,
          skilled_coins: 0, // New accounts start with 0 Skilled Coins
        })
        .select()
        .single();

      if (profileError && !profileError.message.includes('duplicate')) {
        console.error('[ensure-user] Profile insert error:', profileError.message);
        return new Response(
          JSON.stringify({ ok: false, error: `Profile error: ${profileError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      createdProfiles = true;
      skilledCoins = 0;
      console.log('[ensure-user] Profile created:', profileData?.id);
    } else {
      skilledCoins = existingProfile.skilled_coins;
      console.log('[ensure-user] Profile already exists with', skilledCoins, 'Skilled Coins');
    }

    // 2. Check if player exists first
    console.log('[ensure-user] Checking if player exists...');
    const { data: existingPlayer } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingPlayer) {
      // Only insert if doesn't exist
      console.log('[ensure-user] Creating new player...');
      const { data: playerData, error: playerError } = await supabaseAdmin
        .from('players')
        .insert({
          user_id: userId,
          name: displayName,
          credits: 0, // Legacy field - kept for compatibility but profiles.skilled_coins is the source of truth
        })
        .select()
        .single();

      if (playerError && !playerError.message.includes('duplicate')) {
        console.error('[ensure-user] Player insert error:', playerError.message);
        return new Response(
          JSON.stringify({ ok: false, error: `Player error: ${playerError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      createdPlayers = true;
      console.log('[ensure-user] Player created:', playerData?.id);
    } else {
      console.log('[ensure-user] Player already exists');
    }

    // 3. Ensure free_plays exists for chess
    console.log('[ensure-user] Checking free_plays...');
    const { data: freePlaysData, error: freePlaysError } = await supabaseAdmin
      .from('free_plays')
      .select('id')
      .eq('user_id', userId)
      .eq('game_slug', 'chess')
      .maybeSingle();

    if (!freePlaysData) {
      const { error: insertFreePlayError } = await supabaseAdmin
        .from('free_plays')
        .insert({
          user_id: userId,
          game_slug: 'chess',
          plays_remaining: 3,
        });

      if (insertFreePlayError && !insertFreePlayError.message.includes('duplicate')) {
        console.error('[ensure-user] Free plays insert error:', insertFreePlayError.message);
      } else {
        createdFreePlays = true;
        console.log('[ensure-user] Free plays created for chess');
      }
    } else {
      console.log('[ensure-user] Free plays already exists');
    }

    // 4. Check if user should be admin
    if (ADMIN_USER_IDS.includes(userId)) {
      console.log('[ensure-user] User is in admin list, granting admin role...');
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'admin',
        }, {
          onConflict: 'user_id,role',
          ignoreDuplicates: true,
        });

      if (roleError) {
        console.error('[ensure-user] Admin role upsert error:', roleError.message);
      } else {
        createdAdminRole = true;
        console.log('[ensure-user] Admin role granted');
      }
    }

    console.log('[ensure-user] Provisioning complete:', {
      userId,
      createdProfiles,
      createdPlayers,
      createdFreePlays,
      createdAdminRole,
      skilledCoins,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        createdProfiles,
        createdPlayers,
        createdFreePlays,
        createdAdminRole,
        skilled_coins: skilledCoins,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ensure-user] Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
