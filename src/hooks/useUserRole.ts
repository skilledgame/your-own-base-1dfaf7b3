import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'moderator' | 'user';

interface UseUserRoleReturn {
  role: AppRole;
  isPrivileged: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  loading: boolean;
}

export const useUserRole = (): UseUserRoleReturn => {
  const [role, setRole] = useState<AppRole>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRole('user');
          setLoading(false);
          return;
        }

        // Use user_roles table directly (exists in schema)
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole('user');
        } else {
          setRole((data?.role as AppRole) || 'user');
        }
      } catch (error) {
        console.error('Error in useUserRole:', error);
        setRole('user');
      } finally {
        setLoading(false);
      }
    };

    fetchRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    role,
    isPrivileged: role === 'admin' || role === 'moderator',
    isModerator: role === 'moderator',
    isAdmin: role === 'admin',
    loading,
  };
};
