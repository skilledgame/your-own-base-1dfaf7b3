import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Admin user IDs - these users will be granted admin role
// Add your admin UUIDs here:
const ADMIN_USER_IDS = [
  '04d39de7-6912-4569-93a8-9645cdc4f35b',
  '600b2a61-44a8-4723-a8db-4e30896a86fa',
];

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

    // 1. Upsert into profiles
    console.log('[ensure-user] Upserting profile...');
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        email: userEmail,
        display_name: displayName,
        skilled_coins: 0, // Default, won't overwrite if exists due to upsert
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (profileError) {
      console.error('[ensure-user] Profile upsert error:', profileError.message, profileError.details);
      // Check if it's a "row already exists" scenario which is fine
      if (!profileError.message.includes('duplicate')) {
        return new Response(
          JSON.stringify({ ok: false, error: `Profile error: ${profileError.message}`, details: profileError.details }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      createdProfiles = true;
      console.log('[ensure-user] Profile upserted successfully:', profileData?.id);
    }

    // 2. Upsert into players
    console.log('[ensure-user] Upserting player...');
    const { data: playerData, error: playerError } = await supabaseAdmin
      .from('players')
      .upsert({
        user_id: userId,
        name: displayName,
        credits: 1000, // Default starting credits
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (playerError) {
      console.error('[ensure-user] Player upsert error:', playerError.message, playerError.details);
      if (!playerError.message.includes('duplicate')) {
        return new Response(
          JSON.stringify({ ok: false, error: `Player error: ${playerError.message}`, details: playerError.details }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      createdPlayers = true;
      console.log('[ensure-user] Player upserted successfully:', playerData?.id);
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
    });

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        createdProfiles,
        createdPlayers,
        createdFreePlays,
        createdAdminRole,
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
