import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  senderName: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export function ChatMessage({ senderName, senderId, content, createdAt }: ChatMessageProps) {
  const { user } = useAuth();
  const isOwn = user?.id === senderId;

  return (
    <div className={cn('flex flex-col gap-0.5 max-w-[80%]', isOwn ? 'ml-auto items-end' : 'items-start')}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">
          {isOwn ? 'You' : senderName}
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </span>
      </div>
      <div
        className={cn(
          'px-3 py-2 rounded-2xl text-sm leading-relaxed',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        {content}
      </div>
    </div>
  );
}
