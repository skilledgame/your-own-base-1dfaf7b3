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
 * - Debug logs with client socket ID
 */

import { WS_CONFIG } from './wsConfig';
import type { WSConnectionStatus, OutboundMessage, WSLogEntry } from './wsTypes';

type MessageCallback = (data: unknown, raw: string) => void;
type StatusCallback = (status: WSConnectionStatus) => void;
type LogCallback = (entry: WSLogEntry) => void;

// Generate a unique client socket ID for debug logging
const generateClientId = () => Math.random().toString(36).slice(2, 8);

class WSClient {
  private ws: WebSocket | null = null;
  private status: WSConnectionStatus = "disconnected";
  private messageQueue: string[] = [];
  private reconnectAttempt = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private wasSearching = false;  // Track if we were searching when disconnected
  private wasInGame = false;     // Track if we were in game when disconnected
  private clientSocketId: string = generateClientId();
  private pendingPlayerName: string | null = null;  // Store player name for reconnect
  private pendingWager: number = 0;  // Store wager for reconnect
  private pendingPlayerIds: string[] | null = null; // Store player_ids for reconnect
  private authToken: string | null = null;  // Supabase access token

  // Callbacks
  private messageCallbacks: Set<MessageCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private logCallbacks: Set<LogCallback> = new Set();

  /**
   * Set the authentication token for WebSocket connection
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
    console.log("[WS]", this.clientSocketId, "Auth token", token ? "set" : "cleared");
  }

  /**
   * Get the current auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Check if we have a valid auth token
   */
  hasAuthToken(): boolean {
    return !!this.authToken;
  }

  /**
   * Connect to the WebSocket server
   * Requires auth token to be set first
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || 
        this.ws?.readyState === WebSocket.CONNECTING) {
      console.log("[WS]", this.clientSocketId, "Already connected or connecting");
      return;
    }

    if (!this.authToken) {
      console.warn("[WS]", this.clientSocketId, "Cannot connect - no auth token. Please sign in.");
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("connecting");
    this.clientSocketId = generateClientId();
    
    // Build WebSocket URL with auth token
    const wsUrl = `${WS_CONFIG.WS_URL}?token=${encodeURIComponent(this.authToken)}`;
    console.log("[WS OPEN]", this.clientSocketId, "Connecting to:", WS_CONFIG.WS_URL, "(with auth token)");

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.log("[WS ERROR]", this.clientSocketId, error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    console.log("[WS CLOSE]", this.clientSocketId, "Disconnecting...");
    this.clearReconnectTimeout();
    
    if (this.ws) {
      this.ws.onclose = null;  // Prevent reconnect on intentional close
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

  /**
   * Send a message to the server
   * If disconnected, queues the message for later
   */
  send(message: OutboundMessage | object): void {
    const raw = JSON.stringify(message);
    
    // Log outbound message
    this.logMessage("outbound", raw, message);

    // Track state for reconnect logic
    if (typeof message === 'object' && message !== null && 'type' in message) {
      if (message.type === 'find_match') {
        this.wasSearching = true;

        // Store player name and wager for potential reconnect
        if ('playerName' in message) {
          this.pendingPlayerName = message.playerName as string;
        }
        if ('wager' in message) {
          this.pendingWager = message.wager as number;
        }

        // Store player_ids for potential reconnect
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
      console.log("[WS OUT]", this.clientSocketId, message);
      this.ws.send(raw);
    } else {
      console.log("[WS]", this.clientSocketId, "Queuing message (not connected):", message);
      if (this.messageQueue.length < WS_CONFIG.MAX_QUEUE_SIZE) {
        this.messageQueue.push(raw);
      } else {
        console.warn("[WS]", this.clientSocketId, "Message queue full, dropping message");
      }
    }
  }

  /**
   * Send raw string (for debug panel testing)
   */
  sendRaw(raw: string): void {
    this.logMessage("outbound", raw, raw);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[WS OUT]", this.clientSocketId, "raw:", raw);
      this.ws.send(raw);
    } else {
      console.log("[WS]", this.clientSocketId, "Cannot send raw - not connected");
    }
  }

  /**
   * Mark that we're searching (for reconnect logic)
   */
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

  /**
   * Mark that we're in game (for reconnect logic)
   */
  setInGame(inGame: boolean): void {
    this.wasInGame = inGame;
    if (!inGame) {
      this.wasSearching = false;
    }
  }

  /**
   * Get client socket ID for debugging
   */
  getClientId(): string {
    return this.clientSocketId;
  }

  /**
   * Subscribe to incoming messages
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  /**
   * Subscribe to connection status changes
   */
  onStatus(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    // Immediately notify with current status
    callback(this.status);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * Subscribe to log entries (for debug panel)
   */
  onLog(callback: LogCallback): () => void {
    this.logCallbacks.add(callback);
    return () => this.logCallbacks.delete(callback);
  }

  /**
   * Get current connection status
   */
  getStatus(): WSConnectionStatus {
    return this.status;
  }

  /**
   * Get queued message count
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  // ============ Private Methods ============

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("[WS OPEN]", this.clientSocketId, "Connected (authenticated)");
      this.setStatus("connected");
      this.reconnectAttempt = 0;
      this.flushQueue();
      
      // If we were searching when disconnected, resend find_match with wager
      if (this.wasSearching) {
        if (!this.pendingPlayerIds || this.pendingPlayerIds.length === 0) {
          console.warn("[WS]", this.clientSocketId, "Cannot resend find_match - missing player_ids");
        } else {
          console.log("[WS]", this.clientSocketId, "Resending find_match after reconnect");
          const payload = {
            type: "find_match" as const,
            wager: this.pendingWager || 0,
            player_ids: this.pendingPlayerIds,
            ...(this.pendingPlayerName ? { playerName: this.pendingPlayerName } : {}),
          };
          this.send(payload);
        }
      }
      
      // If we were in game when disconnected, notify via special message
      if (this.wasInGame) {
        console.log("[WS]", this.clientSocketId, "Was in game when disconnected - treating as game ended");
        // Emit a synthetic game_ended message for the hook to handle
        const syntheticMessage = {
          type: "game_ended",
          reason: "disconnect",
          winnerColor: null,
        };
        this.messageCallbacks.forEach(cb => {
          try {
            cb(syntheticMessage, JSON.stringify(syntheticMessage));
          } catch (error) {
            console.log("[WS ERROR]", this.clientSocketId, "Error in message callback:", error);
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
        // Non-JSON message
        parsed = { type: "raw", data: raw };
      }

      console.log("[WS IN]", this.clientSocketId, parsed);

      // Log inbound message
      this.logMessage("inbound", raw, parsed);

      // Notify all subscribers
      this.messageCallbacks.forEach(cb => {
        try {
          cb(parsed, raw);
        } catch (error) {
          console.log("[WS ERROR]", this.clientSocketId, "Error in message callback:", error);
        }
      });
    };

    this.ws.onerror = (error) => {
      console.log("[WS ERROR]", this.clientSocketId, error);
    };

    this.ws.onclose = (event) => {
      console.log("[WS CLOSE]", this.clientSocketId, event.code, event.reason);
      this.ws = null;
      
      // Check if auth error (typically 4001 or 4003)
      if (event.code === 4001 || event.code === 4003 || event.reason?.includes('auth')) {
        console.log("[WS]", this.clientSocketId, "Auth error - token may be expired");
        this.setStatus("disconnected");
        // Clear token so reconnect doesn't keep failing
        this.authToken = null;
        return;
      }
      
      this.scheduleReconnect();
    };
  }

  private setStatus(status: WSConnectionStatus): void {
    if (this.status === status) return;
    
    this.status = status;
    console.log("[WS] Status:", status);
    
    this.statusCallbacks.forEach(cb => {
      try {
        cb(status);
      } catch (error) {
        console.log("[WS ERROR] Error in status callback:", error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    
    // Don't reconnect if no auth token
    if (!this.authToken) {
      console.log("[WS]", this.clientSocketId, "Cannot reconnect - no auth token");
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("reconnecting");
    
    // Get delay from config based on attempt (1s → 2s → 5s → 10s)
    const delays = WS_CONFIG.RECONNECT_DELAYS_MS;
    const delay = delays[Math.min(this.reconnectAttempt, delays.length - 1)];
    
    console.log("[WS]", this.clientSocketId, `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);

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

    console.log(`[WS] Flushing ${this.messageQueue.length} queued messages`);
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
      } catch (error) {
        console.log("[WS ERROR] Error in log callback:", error);
      }
    });
  }
}

// Export singleton instance
export const wsClient = new WSClient();
