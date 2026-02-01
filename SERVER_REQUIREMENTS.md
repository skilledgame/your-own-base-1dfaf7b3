# WebSocket Server Requirements for Timer Sync

## Overview
The frontend has been updated to use server-authoritative timers. The WebSocket server MUST be updated to support this.

## Required Server Changes

### 1. Timer Storage on Server
Store game clocks with server timestamps:
```typescript
interface GameClock {
  whiteMsRemaining: number;  // Milliseconds remaining for white
  blackMsRemaining: number;  // Milliseconds remaining for black
  currentTurn: 'w' | 'b';
  lastTickServerTimeMs: number;  // Server timestamp when clocks were last updated
}
```

### 2. Update Clocks on Every Move
When processing a move:
1. Calculate elapsed time since `lastTickServerTimeMs`
2. Deduct from the side whose turn it was
3. Add increment (3 seconds = 3000ms) to the side that just moved
4. Update `lastTickServerTimeMs` to current server time
5. Send `move_applied` message with timer data:

```typescript
{
  type: "move_applied",
  fen: string,
  turn: "w" | "b",
  whiteTime: number,  // Seconds remaining
  blackTime: number,  // Seconds remaining
  serverTimeMs: number  // Server timestamp (milliseconds since epoch)
}
```

### 3. Add `sync_game` Message Handler
When client sends `{ type: "sync_game", gameId: string }`:

1. Calculate current clock values based on server time
2. Send `game_sync` response:

```typescript
{
  type: "game_sync",
  gameId: string,
  fen: string,
  turn: "w" | "b",
  whiteTime: number,  // Seconds remaining (calculated from server time)
  blackTime: number,  // Seconds remaining (calculated from server time)
  serverTimeMs: number,  // Current server timestamp
  status: "active" | "ended",
  wager?: number
}
```

### 4. Update `match_found` Message
Include initial timer snapshot:
```typescript
{
  type: "match_found",
  gameId: string,
  dbGameId?: string,
  color: "w" | "b",
  fen: string,
  wager: number,
  whiteTime: 60,  // Initial time in seconds
  blackTime: 60,  // Initial time in seconds
  serverTimeMs: number,  // Server timestamp
  opponent?: { name: string }
}
```

### 5. Periodic Clock Updates
Every 1-2 seconds, broadcast clock updates to both players:
```typescript
{
  type: "clock_update",
  gameId: string,
  whiteTime: number,
  blackTime: number,
  serverTimeMs: number,
  currentTurn: "w" | "b"
}
```

### 6. Resign Handling
Make resign idempotent:
- If game already ended → return success (no-op)
- Otherwise → end game and broadcast `game_ended` with final state

### 7. Time Loss Detection
On each clock tick:
- If active player's time <= 0 → end game immediately
- Broadcast `game_ended` with reason "time_loss"

## Critical: Server Time Calculation

**ALWAYS** calculate clocks based on server time, not client time:

```typescript
function calculateCurrentClocks(game: GameClock): { white: number, black: number } {
  const nowMs = Date.now();
  const elapsedMs = nowMs - game.lastTickServerTimeMs;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  
  let whiteTime = game.whiteMsRemaining / 1000;  // Convert to seconds
  let blackTime = game.blackMsRemaining / 1000;
  
  // Only count down for the side whose turn it is
  if (game.currentTurn === 'w') {
    whiteTime = Math.max(0, whiteTime - elapsedSeconds);
  } else {
    blackTime = Math.max(0, blackTime - elapsedSeconds);
  }
  
  return { white: whiteTime, black: blackTime };
}
```

## Testing Checklist
- [ ] Timer starts at 60 seconds
- [ ] Timer adds 3 seconds on move
- [ ] Timer syncs correctly after tab switch
- [ ] Timer syncs correctly after reconnect
- [ ] Both players see same timer values
- [ ] Resign works and is idempotent
- [ ] Time loss detection works
- [ ] Game end messages include final timer state
