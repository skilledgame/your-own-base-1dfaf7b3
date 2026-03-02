import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let callerUserId: string | null = null;
    let callerEmail: string | null = null;

    // Preferred path: Supabase injects verified JWT claims when verify_jwt=true.
    const jwtClaimsHeader = req.headers.get('x-jwt-claims');
    if (jwtClaimsHeader) {
      try {
        const claims = JSON.parse(jwtClaimsHeader);
        callerUserId = typeof claims?.sub === 'string' ? claims.sub : null;
        callerEmail = typeof claims?.email === 'string' ? claims.email : null;
      } catch (err) {
        console.error('Failed to parse x-jwt-claims:', err);
      }
    }

    // Fallback path: validate bearer token explicitly.
    if (!callerUserId) {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      if (token) {
        const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
        if (!userError && user) {
          callerUserId = user.id;
          callerEmail = user.email ?? null;
        } else {
          console.log('Bearer token auth failed:', userError);
        }
      }
    }

    if (!callerUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin using the database function
    const { data: isPrivileged, error: roleError } = await adminClient.rpc('is_privileged_user', {
      _user_id: callerUserId,
    });

    if (roleError || !isPrivileged) {
      console.log('User is not privileged:', roleError);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    let parsedBody: any = null;
    let action = url.searchParams.get('action');
    if (!action && req.method === 'POST') {
      try {
        parsedBody = await req.json();
        action = parsedBody?.action || null;
      } catch {
        // Ignore body parse errors for actions that don't require JSON
      }
    }

    const getBody = async () => {
      if (parsedBody !== null) return parsedBody;
      parsedBody = await req.json();
      return parsedBody;
    };

    console.log(`Admin action: ${action} by user: ${callerEmail || callerUserId}`);

    if ((req.method === 'GET' || req.method === 'POST') && action === 'list-users') {
      // Fetch all profiles with their roles
      const { data: profiles, error: profilesError } = await adminClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await adminClient
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      }

      // Fetch badges for all users
      const { data: badges, error: badgesError } = await adminClient
        .from('user_badges')
        .select('user_id, badge');

      if (badgesError) {
        console.error('Error fetching badges:', badgesError);
      }

      // Group badges by user_id
      const badgesByUser = new Map<string, string[]>();
      for (const b of (badges || [])) {
        const existing = badgesByUser.get(b.user_id) || [];
        existing.push(b.badge);
        badgesByUser.set(b.user_id, existing);
      }

      // Merge roles and badges into profiles
      const usersWithRoles = profiles.map((profile: any) => {
        const userRole = roles?.find((r: any) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role || 'user',
          badges: badgesByUser.get(profile.user_id) || [],
        };
      });

      console.log(`Returning ${usersWithRoles.length} users`);
      return new Response(JSON.stringify({ users: usersWithRoles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'update-balance') {
      const { userId, newBalance } = await getBody();

      if (!userId || typeof newBalance !== 'number') {
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Updating balance for ${userId} to ${newBalance}`);

      // Update BOTH profiles.skilled_coins AND players.credits to keep in sync
      const { error: profileError } = await adminClient
        .from('profiles')
        .update({ skilled_coins: newBalance })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Error updating profile balance:', profileError);
      }

      const { error: playerError } = await adminClient
        .from('players')
        .update({ credits: newBalance })
        .eq('user_id', userId);

      if (playerError) {
        console.error('Error updating player credits:', playerError);
        return new Response(JSON.stringify({ error: 'Failed to update balance' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'update-role') {
      const { userId, newRole } = await getBody();

      if (!userId || !['admin', 'moderator', 'user'].includes(newRole)) {
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Updating role for ${userId} to ${newRole}`);

      // Delete existing role
      await adminClient
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Insert new role (only if not 'user' since that's the default)
      if (newRole !== 'user') {
        const { error: insertError } = await adminClient
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (insertError) {
          console.error('Error inserting role:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to update role' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'update-badges') {
      const { userId, badges } = await getBody();

      if (!userId || !Array.isArray(badges)) {
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate badge values
      const validBadges = ['tester', 'dev', 'admin'];
      const filteredBadges = badges.filter((b: string) => validBadges.includes(b));

      console.log(`Updating badges for ${userId} to [${filteredBadges.join(', ')}]`);

      // Delete all existing badges for this user
      const { error: deleteError } = await adminClient
        .from('user_badges')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting badges:', deleteError);
        return new Response(JSON.stringify({ error: 'Failed to update badges' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Insert new badges
      if (filteredBadges.length > 0) {
        const badgeRows = filteredBadges.map((badge: string) => ({
          user_id: userId,
          badge,
        }));

        const { error: insertError } = await adminClient
          .from('user_badges')
          .insert(badgeRows);

        if (insertError) {
          console.error('Error inserting badges:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to update badges' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'add-waitlist') {
      const { email } = await getBody();
      const normalizedEmail = String(email || '').trim().toLowerCase();

      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return new Response(JSON.stringify({ error: 'Invalid email' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await adminClient.rpc('join_waitlist', {
        user_email: normalizedEmail,
      });

      if (error) {
        console.error('Error adding waitlist entry:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to add waitlist entry' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, email: normalizedEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'remove-waitlist') {
      const { email } = await getBody();
      const normalizedEmail = String(email || '').trim().toLowerCase();

      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return new Response(JSON.stringify({ error: 'Invalid email' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await adminClient
        .from('waitlist')
        .delete()
        .ilike('email', normalizedEmail)
        .select('id');

      if (error) {
        console.error('Error removing waitlist entry:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to remove waitlist entry' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        email: normalizedEmail,
        deletedCount: data?.length || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Admin function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
