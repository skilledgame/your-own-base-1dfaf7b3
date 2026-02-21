import { useEffect, useRef } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChatStore } from '@/stores/chatStore';

interface ChatPanelProps {
  channelType: string;
  channelId: string;
  title?: string;
  className?: string;
}

export function ChatPanel({ channelType, channelId, title, className }: ChatPanelProps) {
  const messages = useChatStore(state => state.messages);
  const loading = useChatStore(state => state.loading);
  const sendMessage = useChatStore(state => state.sendMessage);
  const setActiveChannel = useChatStore(state => state.setActiveChannel);
  const activeChannelId = useChatStore(state => state.activeChannelId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (channelId && channelId !== activeChannelId) {
      setActiveChannel(channelType, channelId);
    }
  }, [channelType, channelId, activeChannelId, setActiveChannel]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className={`flex flex-col bg-card rounded-xl overflow-hidden ${className || ''}`}>
      {title && (
        <div className="flex items-center gap-2 px-4 py-3 bg-secondary/30">
          <MessageCircle className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        </div>
      )}

      <ScrollArea className="flex-1 p-4 min-h-[200px] max-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Be the first to say something!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                senderName={msg.sender_name || 'Unknown'}
                senderId={msg.sender_id}
                content={msg.content}
                createdAt={msg.created_at}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <ChatInput onSend={sendMessage} />
    </div>
  );
}
