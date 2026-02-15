/**
 * WebSocket Client Module
 * 
 * SINGLE SOURCE OF TRUTH for chess game server connection
 * 
 * Features:
 * - Authenticated connections with Supabase access token
 * - Auto-reconnect with 1s → 2s → 5s → 10s backoff
 * - Message queuing while disconnected
 * - Status callbacks
 * - Message logging for debug panel
 */

import { WS_CONFIG } from './wsConfig';
import type { WSConnectionStatus, OutboundMessage, WSLogEntry } from './wsTypes';

type MessageCallback = (data: unknown, raw: string) => void;
type StatusCallback = (status: WSConnectionStatus) => void;
type LogCallback = (entry: WSLogEntry) => void;

const generateClientId = () => Math.random().toString(36).slice(2, 8);

class WSClient {
  private ws: WebSocket | null = null;
  private status: WSConnectionStatus = "disconnected";
  private messageQueue: string[] = [];
  private reconnectAttempt = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private wasSearching = false;
  private wasInGame = false;
  private clientSocketId: string = generateClientId();
  private pendingPlayerName: string | null = null;
  private pendingWager: number = 0;
  private pendingPlayerIds: string[] | null = null;
  private authToken: string | null = null;

  private messageCallbacks: Set<MessageCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private logCallbacks: Set<LogCallback> = new Set();

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  hasAuthToken(): boolean {
    return !!this.authToken;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || 
        this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (!this.authToken) {
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("connecting");
    this.clientSocketId = generateClientId();
    
    const wsUrl = `${WS_CONFIG.WS_URL}?token=${encodeURIComponent(this.authToken)}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.clearReconnectTimeout();
    
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    
    this.setStatus("disconnected");
    this.reconnectAttempt = 0;
    this.wasSearching = false;
    this.wasInGame = false;
    this.pendingPlayerName = null;
    this.pendingWager = 0;
    this.pendingPlayerIds = null;
  }

  send(message: OutboundMessage | object): void {
    const raw = JSON.stringify(message);
    
    this.logMessage("outbound", raw, message);

    if (typeof message === 'object' && message !== null && 'type' in message) {
      if (message.type === 'find_match') {
        this.wasSearching = true;

        if ('playerName' in message) {
          this.pendingPlayerName = message.playerName as string;
        }
        if ('wager' in message) {
          this.pendingWager = message.wager as number;
        }

        if ('player_ids' in message && Array.isArray((message as any).player_ids)) {
          const ids = ((message as any).player_ids as unknown[])
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .map(v => v.trim());
          this.pendingPlayerIds = ids.length > 0 ? ids : null;
        }
      } else if (message.type === 'cancel_search') {
        this.wasSearching = false;
        this.pendingPlayerName = null;
        this.pendingWager = 0;
        this.pendingPlayerIds = null;
      }
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else {
      if (this.messageQueue.length < WS_CONFIG.MAX_QUEUE_SIZE) {
        this.messageQueue.push(raw);
      }
    }
  }

  sendRaw(raw: string): void {
    this.logMessage("outbound", raw, raw);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    }
  }

  setSearching(searching: boolean, playerName?: string, wager?: number, playerIds?: string[]): void {
    this.wasSearching = searching;

    if (playerName) {
      this.pendingPlayerName = playerName;
    }
    if (wager !== undefined) {
      this.pendingWager = wager;
    }

    if (Array.isArray(playerIds)) {
      const ids = playerIds.filter(Boolean).map(v => v.trim()).filter(v => v.length > 0);
      this.pendingPlayerIds = ids.length > 0 ? ids : null;
    }

    if (!searching) {
      this.pendingPlayerIds = null;
    }
  }

  setInGame(inGame: boolean): void {
    this.wasInGame = inGame;
    if (!inGame) {
      this.wasSearching = false;
    }
  }

  getClientId(): string {
    return this.clientSocketId;
  }

  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  onStatus(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    callback(this.status);
    return () => this.statusCallbacks.delete(callback);
  }

  onLog(callback: LogCallback): () => void {
    this.logCallbacks.add(callback);
    return () => this.logCallbacks.delete(callback);
  }

  getStatus(): WSConnectionStatus {
    return this.status;
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  // ============ Private Methods ============

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.setStatus("connected");
      this.reconnectAttempt = 0;
      this.flushQueue();
      
      // If we were searching when disconnected, resend find_match
      if (this.wasSearching) {
        if (this.pendingPlayerIds && this.pendingPlayerIds.length > 0) {
          const payload = {
            type: "find_match" as const,
            wager: this.pendingWager || 0,
            player_ids: this.pendingPlayerIds,
            ...(this.pendingPlayerName ? { playerName: this.pendingPlayerName } : {}),
          };
          this.send(payload);
        }
      }
      
      // If we were in game when disconnected, notify via synthetic message
      if (this.wasInGame) {
        const syntheticMessage = {
          type: "game_ended",
          reason: "disconnect",
          winnerColor: null,
        };
        this.messageCallbacks.forEach(cb => {
          try {
            cb(syntheticMessage, JSON.stringify(syntheticMessage));
          } catch {
            // Error in message callback
          }
        });
        this.wasInGame = false;
      }
    };

    this.ws.onmessage = (event) => {
      const raw = event.data;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { type: "raw", data: raw };
      }

      this.logMessage("inbound", raw, parsed);

      this.messageCallbacks.forEach(cb => {
        try {
          cb(parsed, raw);
        } catch {
          // Error in message callback
        }
      });
    };

    this.ws.onerror = () => {
      // WebSocket error
    };

    this.ws.onclose = (event) => {
      this.ws = null;
      
      // Check if auth error (typically 4001 or 4003)
      if (event.code === 4001 || event.code === 4003 || event.reason?.includes('auth')) {
        this.setStatus("disconnected");
        this.authToken = null;
        return;
      }
      
      this.scheduleReconnect();
    };
  }

  private setStatus(status: WSConnectionStatus): void {
    if (this.status === status) return;
    
    this.status = status;
    
    this.statusCallbacks.forEach(cb => {
      try {
        cb(status);
      } catch {
        // Error in status callback
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    
    if (!this.authToken) {
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("reconnecting");
    
    const delays = WS_CONFIG.RECONNECT_DELAYS_MS;
    const delay = delays[Math.min(this.reconnectAttempt, delays.length - 1)];

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectAttempt++;
      this.connect();
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private flushQueue(): void {
    if (this.messageQueue.length === 0) return;

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach(raw => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(raw);
      }
    });
  }

  private logMessage(direction: "inbound" | "outbound", raw: string, parsed: unknown): void {
    const entry: WSLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
      direction,
      raw,
      parsed,
    };

    this.logCallbacks.forEach(cb => {
      try {
        cb(entry);
      } catch {
        // Error in log callback
      }
    });
  }
}

// Export singleton instance
export const wsClient = new WSClient();
