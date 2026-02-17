import { useState } from 'react';
import { Gamepad2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Friend } from '@/stores/friendStore';

interface InviteToGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friend: Friend | null;
  onInvite: (friendUserId: string, gameId: string) => Promise<void>;
}

export function InviteToGameModal({ open, onOpenChange, friend, onInvite }: InviteToGameModalProps) {
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!friend) return;
    setLoading(true);
    try {
      // For now, create a private room and invite friend
      // The game_id will be the room code - they can join via notification
      await onInvite(friend.friend_user_id, 'pending');
      toast.success(`Invite sent to ${friend.display_name}!`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-primary" />
            Invite to Game
          </DialogTitle>
          <DialogDescription>
            Send a game invite to {friend?.display_name || 'your friend'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {friend?.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-medium text-foreground">{friend?.display_name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">{friend?.chess_elo || 800} ELO</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            They will receive a notification and can join your game directly.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Send Invite
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
