/**
 * NotificationDropdown - Bell icon with dropdown showing notifications
 */

import { memo, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NotificationDropdownProps {
  className?: string;
}

export const NotificationDropdown = memo(({ className }: NotificationDropdownProps) => {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.id) {
        setNotifications([]);
        setLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (error) {
          console.error('[NotificationDropdown] Error fetching notifications:', error);
        } else {
          setNotifications(data || []);
        }
      } catch (error) {
        console.error('[NotificationDropdown] Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (isAuthReady && isAuthenticated) {
      fetchNotifications();
    }
  }, [user?.id, isAuthReady, isAuthenticated]);
  
  // Mark all as read when dropdown opens
  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    
    if (open && user?.id) {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase
          .from('notifications')
          .update({ read: true })
          .in('id', unreadIds);
        
        // Update local state
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    }
  };
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Not ready or not authenticated
  if (!isAuthReady || !isAuthenticated || !user) {
    return null;
  }
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button 
          className={cn(
            "relative p-2 rounded-lg",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-slate-700/50",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            className
          )}
        >
          <Bell className="w-5 h-5" />
          
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        sideOffset={8}
        className="w-80 max-h-96 overflow-y-auto bg-slate-800 border-slate-700 rounded-xl shadow-xl shadow-black/30 z-50"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="font-semibold text-white">Notifications</h3>
        </div>
        
        {loading ? (
          <div className="px-4 py-8 text-center text-slate-400">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem 
              key={notification.id}
              className={cn(
                "flex flex-col items-start gap-1 px-4 py-3 cursor-default",
                "focus:bg-slate-700/50",
                !notification.read && "bg-slate-700/30"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium text-white text-sm">
                  {notification.title}
                </span>
                {!notification.read && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                {notification.message}
              </p>
              <span className="text-slate-500 text-[10px] mt-1">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

NotificationDropdown.displayName = 'NotificationDropdown';
