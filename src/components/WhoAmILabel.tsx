/**
 * WhoAmILabel - Shows current user identity next to balance
 * 
 * Displays:
 * - Display name OR email username
 * - Short user ID (first 6 chars)
 * 
 * Example: "Spinal (04d39d)"
 */

import { memo, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface WhoAmILabelProps {
  className?: string;
  showIcon?: boolean;
}

export const WhoAmILabel = memo(({ className, showIcon = true }: WhoAmILabelProps) => {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Fetch display name from profile
  useEffect(() => {
    const fetchDisplayName = async () => {
      if (!user?.id) {
        setDisplayName(null);
        setLoading(false);
        return;
      }
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data?.display_name) {
          setDisplayName(data.display_name);
        } else {
          // Fallback to email username
          setDisplayName(user.email?.split('@')[0] || null);
        }
      } catch (error) {
        console.error('[WhoAmI] Error fetching display name:', error);
        setDisplayName(user.email?.split('@')[0] || null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDisplayName();
  }, [user?.id, user?.email]);
  
  // Not ready yet
  if (!isAuthReady) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }
  
  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }
  
  const shortId = user.id.substring(0, 6);
  const name = displayName || user.email?.split('@')[0] || 'User';
  
  return (
    <div className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
      {showIcon && <User className="w-3.5 h-3.5" />}
      <span className="font-medium text-foreground truncate max-w-[100px]">
        {loading ? <Skeleton className="h-4 w-12 inline-block" /> : name}
      </span>
      <span className="text-xs opacity-60">({shortId})</span>
    </div>
  );
});

WhoAmILabel.displayName = 'WhoAmILabel';
