/**
 * ChatSupportButton - Opens Voiceflow chat widget
 * Used in desktop header
 */

import { memo } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

declare global {
  interface Window {
    voiceflow?: {
      chat: {
        open: () => void;
        close: () => void;
        toggle: () => void;
        load: (config: object) => void;
      };
    };
  }
}

export const openChatWidget = () => {
  if (window.voiceflow?.chat) {
    window.voiceflow.chat.open();
  } else {
    console.warn('[ChatSupportButton] Voiceflow widget not loaded yet');
  }
};

interface ChatSupportButtonProps {
  className?: string;
}

export const ChatSupportButton = memo(({ className }: ChatSupportButtonProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={openChatWidget}
            className={className}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Customer Support</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

ChatSupportButton.displayName = 'ChatSupportButton';
