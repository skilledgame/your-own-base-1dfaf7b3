/**
 * WebSocket Configuration
 * SINGLE SOURCE OF TRUTH for the chess game server
 * Change this URL to point to a different server
 */

export const WS_CONFIG = {
  // WebSocket endpoint - the ONLY backend for chess
  WS_URL: "wss://chess-server-ql28.onrender.com/ws",
  
  // Reconnection settings (1s → 2s → 5s → 10s backoff)
  RECONNECT_DELAYS_MS: [1000, 2000, 5000, 10000],
  
  // Message queue settings
  MAX_QUEUE_SIZE: 100,
} as const;
