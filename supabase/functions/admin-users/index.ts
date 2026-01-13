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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token to verify they're admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.log('User authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin using the database function
    const { data: isPrivileged, error: roleError } = await userClient.rpc('is_privileged_user', {
      _user_id: user.id,
    });

    if (roleError || !isPrivileged) {
      console.log('User is not privileged:', roleError);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    console.log(`Admin action: ${action} by user: ${user.email}`);

    if (req.method === 'GET' && action === 'list-users') {
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

      // Merge roles into profiles
      const usersWithRoles = profiles.map((profile: any) => {
        const userRole = roles?.find((r: any) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role || 'user',
        };
      });

      console.log(`Returning ${usersWithRoles.length} users`);
      return new Response(JSON.stringify({ users: usersWithRoles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'update-balance') {
      const { userId, newBalance } = await req.json();

      if (!userId || typeof newBalance !== 'number') {
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Updating balance for ${userId} to ${newBalance}`);

      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ skilled_coins: newBalance })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating balance:', updateError);
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
      const { userId, newRole } = await req.json();

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
