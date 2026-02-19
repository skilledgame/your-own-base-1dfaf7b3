/**
 * NotificationDropdown - Bell icon with dropdown showing notifications
 * Supports actionable notifications (friend requests, game invites)
 */

import { memo, useEffect, useState } from 'react';
import { Bell, Check, X, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useFriendStore } from '@/stores/friendStore';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  type: string;
  metadata: Record<string, any> | null;
  action_taken: boolean;
}

interface NotificationDropdownProps {
  className?: string;
}

export const NotificationDropdown = memo(({ className }: NotificationDropdownProps) => {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const acceptRequest = useFriendStore(state => state.acceptRequest);
  const declineRequest = useFriendStore(state => state.declineRequest);
  
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
          .limit(15);
        
        if (error) {
          console.error('[NotificationDropdown] Error fetching notifications:', error);
        } else {
          setNotifications((data || []) as Notification[]);
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

  // Subscribe to new notifications for live updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notif-live-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev].slice(0, 15));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
  
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
        
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    }
  };

  const handleAcceptFriendRequest = async (notif: Notification) => {
    const requestId = notif.metadata?.request_id;
    if (!requestId) return;

    try {
      await acceptRequest(requestId);
      await supabase
        .from('notifications')
        .update({ action_taken: true })
        .eq('id', notif.id);
      setNotifications(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, action_taken: true } : n))
      );
      toast.success('Friend request accepted!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept');
    }
  };

  const handleDeclineFriendRequest = async (notif: Notification) => {
    const requestId = notif.metadata?.request_id;
    if (!requestId) return;

    try {
      await declineRequest(requestId);
      await supabase
        .from('notifications')
        .update({ action_taken: true })
        .eq('id', notif.id);
      setNotifications(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, action_taken: true } : n))
      );
      toast.success('Friend request declined');
    } catch (error: any) {
      toast.error(error.message || 'Failed to decline');
    }
  };

  const handleJoinGame = async (notif: Notification) => {
    const rawGameId = notif.metadata?.game_id as string | undefined;
    if (!rawGameId || rawGameId === 'pending' || rawGameId === 'chess') {
      navigate('/chess');
      return;
    }

    // game_id is encoded as "roomId::lobbyCode"
    const parts = rawGameId.split('::');
    const lobbyCode = parts.length === 2 ? parts[1] : rawGameId;

    try {
      const response = await supabase.functions.invoke('join-lobby', {
        body: { lobbyCode },
      });

      if (response.error) {
        toast.error(response.data?.error || response.data?.details || response.error.message || 'Failed to join game');
        navigate('/chess');
        return;
      }

      const data = response.data;

      if (data?.success === false || data?.error) {
        toast.error(data.details || data.error || 'Failed to join game');
        navigate('/chess');
        return;
      }

      if ((data?.game || data?.gameId) && data?.roomId) {
        navigate(`/game/lobby/${data.roomId}`);
      } else {
        navigate('/chess');
      }

      await supabase
        .from('notifications')
        .update({ action_taken: true })
        .eq('id', notif.id);
    } catch {
      toast.error('Failed to join game');
      navigate('/chess');
    }
  };
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
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
              onSelect={(e) => e.preventDefault()}
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

              {/* Action buttons for friend requests */}
              {notification.type === 'friend_request' && !notification.action_taken && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    onClick={() => handleAcceptFriendRequest(notification)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => handleDeclineFriendRequest(notification)}
                  >
                    <X className="w-3 h-3 mr-1" /> Decline
                  </Button>
                </div>
              )}

              {notification.type === 'friend_request' && notification.action_taken && (
                <span className="text-slate-500 text-[10px] mt-1">Responded</span>
              )}

              {/* Action button for game invites */}
              {notification.type === 'game_invite' && !notification.action_taken && (
                <div className="mt-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-primary hover:text-primary/80 hover:bg-primary/10"
                    onClick={() => handleJoinGame(notification)}
                  >
                    <Gamepad2 className="w-3 h-3 mr-1" /> Join Game
                  </Button>
                </div>
              )}

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
