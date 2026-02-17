import { Check, X, Clock, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { FriendRequest } from '@/stores/friendStore';

interface FriendRequestsProps {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  onAccept: (requestId: string) => Promise<void>;
  onDecline: (requestId: string) => Promise<void>;
}

export function FriendRequests({ incoming, outgoing, onAccept, onDecline }: FriendRequestsProps) {
  const handleAccept = async (requestId: string) => {
    try {
      await onAccept(requestId);
      toast.success('Friend request accepted!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept');
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await onDecline(requestId);
      toast.success('Friend request declined');
    } catch (error: any) {
      toast.error(error.message || 'Failed to decline');
    }
  };

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <UserPlus className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm font-medium">No pending requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {incoming.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Incoming ({incoming.length})
          </h3>
          <div className="space-y-2">
            {incoming.map((req) => (
              <Card key={req.id} className="bg-card border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-sm shrink-0">
                    {req.sender_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground text-sm">
                      {req.sender_name || 'Unknown'}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                      onClick={() => handleAccept(req.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDecline(req.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Sent ({outgoing.length})
          </h3>
          <div className="space-y-2">
            {outgoing.map((req) => (
              <Card key={req.id} className="bg-card border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
                    {req.receiver_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground text-sm">
                      {req.receiver_name || 'Unknown'}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">Pending</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
