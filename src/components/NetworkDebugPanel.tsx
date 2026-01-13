/**
 * Network Debug Panel
 * 
 * Shows WebSocket connection status, message logs, and testing tools.
 * Toggle visibility with the debug button.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Bug, 
  X, 
  Copy, 
  RefreshCw, 
  Unplug, 
  Send,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import type { WSConnectionStatus, WSLogEntry } from '@/lib/wsTypes';

interface NetworkDebugPanelProps {
  status: WSConnectionStatus;
  logs: WSLogEntry[];
  reconnectAttempts: number;
  queueSize?: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendRaw: (json: string) => void;
  onClearLogs: () => void;
}

export function NetworkDebugPanel({
  status,
  logs,
  reconnectAttempts,
  queueSize = 0,
  onConnect,
  onDisconnect,
  onSendRaw,
  onClearLogs,
}: NetworkDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [rawInput, setRawInput] = useState('');

  const statusColors: Record<WSConnectionStatus, string> = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    reconnecting: "bg-orange-500",
    disconnected: "bg-red-500",
  };

  const StatusIcon = status === "connected" ? Wifi : 
                     status === "disconnected" ? WifiOff : Loader2;

  const handleCopyLogs = () => {
    const logText = logs.map(l => 
      `[${l.timestamp.toISOString()}] ${l.direction.toUpperCase()}: ${l.raw}`
    ).join('\n');
    navigator.clipboard.writeText(logText);
    toast.success('Logs copied to clipboard');
  };

  const handleSend = () => {
    if (!rawInput.trim()) return;
    try {
      // Validate JSON
      JSON.parse(rawInput);
      onSendRaw(rawInput);
      setRawInput('');
    } catch {
      toast.error('Invalid JSON');
    }
  };

  const inboundLogs = logs.filter(l => l.direction === "inbound").slice(0, 20);
  const outboundLogs = logs.filter(l => l.direction === "outbound").slice(0, 20);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-20 right-4 z-50 gap-2 bg-background/80 backdrop-blur"
        onClick={() => setIsOpen(true)}
      >
        <Bug className="w-4 h-4" />
        <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-[400px] max-h-[70vh] bg-background border border-border rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Network Debug</span>
          <Badge variant="outline" className="gap-1 text-xs">
            <StatusIcon className={`w-3 h-3 ${status === "connecting" || status === "reconnecting" ? "animate-spin" : ""}`} />
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Stats */}
          <div className="p-3 border-b text-xs text-muted-foreground grid grid-cols-3 gap-2">
            <div>
              <span className="block font-medium">Reconnects</span>
              <span>{reconnectAttempts}</span>
            </div>
            <div>
              <span className="block font-medium">Queue Size</span>
              <span>{queueSize}</span>
            </div>
            <div>
              <span className="block font-medium">Messages</span>
              <span>{logs.length}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="p-3 border-b flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={status === "connected" || status === "connecting" ? onDisconnect : onConnect}
            >
              {status === "connected" || status === "connecting" ? (
                <>
                  <Unplug className="w-3 h-3" />
                  Disconnect
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Reconnect
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleCopyLogs}>
              <Copy className="w-3 h-3" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={onClearLogs}>
              Clear
            </Button>
          </div>

          {/* Raw Input */}
          <div className="p-3 border-b flex gap-2">
            <Input
              placeholder='{"type": "test", "payload": {}}'
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="text-xs font-mono"
            />
            <Button variant="default" size="sm" onClick={handleSend}>
              <Send className="w-3 h-3" />
            </Button>
          </div>

          {/* Logs */}
          <div className="grid grid-cols-2 divide-x max-h-[300px]">
            <div>
              <div className="p-2 bg-muted/30 text-xs font-semibold text-muted-foreground border-b">
                ⬇️ Inbound ({inboundLogs.length})
              </div>
              <ScrollArea className="h-[250px]">
                <div className="p-2 space-y-1">
                  {inboundLogs.map((log) => (
                    <LogEntry key={log.id} log={log} />
                  ))}
                  {inboundLogs.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No messages</p>
                  )}
                </div>
              </ScrollArea>
            </div>
            <div>
              <div className="p-2 bg-muted/30 text-xs font-semibold text-muted-foreground border-b">
                ⬆️ Outbound ({outboundLogs.length})
              </div>
              <ScrollArea className="h-[250px]">
                <div className="p-2 space-y-1">
                  {outboundLogs.map((log) => (
                    <LogEntry key={log.id} log={log} />
                  ))}
                  {outboundLogs.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No messages</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: WSLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  
  const time = log.timestamp.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });

  const typeLabel = typeof log.parsed === 'object' && log.parsed !== null && 'type' in log.parsed
    ? (log.parsed as { type: string }).type
    : 'unknown';

  return (
    <div 
      className="text-xs font-mono bg-muted/20 rounded p-1.5 cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{time}</span>
        <Badge variant="secondary" className="text-[10px] px-1 py-0">
          {typeLabel}
        </Badge>
      </div>
      {expanded && (
        <pre className="mt-1 text-[10px] whitespace-pre-wrap break-all text-foreground/80 max-h-[100px] overflow-auto">
          {JSON.stringify(log.parsed, null, 2)}
        </pre>
      )}
    </div>
  );
}
