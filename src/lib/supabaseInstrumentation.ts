/**
 * Supabase Instrumentation - Dev-only request tracking
 * 
 * Wraps Supabase client to track request volume by table/endpoint.
 * Enable via VITE_DEBUG_SUPABASE_CALLS=true
 * 
 * Usage: Import requestTracker and call requestTracker.track('table_name')
 *        In dev mode, a summary logs every 30s showing top endpoints.
 */

interface RequestCount {
  count: number;
  lastCall: number;
}

interface RequestSummary {
  table: string;
  count: number;
  lastCall: string;
}

class RequestTracker {
  private counts: Map<string, RequestCount> = new Map();
  private totalCalls: number = 0;
  private startTime: number = Date.now();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Only enable in dev mode with env flag
    this.isEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG_SUPABASE_CALLS === 'true';
    
    if (this.isEnabled) {
      this.startLogging();
      console.log('[Supabase Tracker] Instrumentation enabled - logging every 30s');
    }
  }

  track(table: string, operation: string = 'select'): void {
    if (!this.isEnabled) return;

    const key = `${table}:${operation}`;
    const existing = this.counts.get(key) || { count: 0, lastCall: Date.now() };
    
    this.counts.set(key, {
      count: existing.count + 1,
      lastCall: Date.now(),
    });
    
    this.totalCalls++;
  }

  private startLogging(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.logSummary();
    }, 30000); // Log every 30 seconds
  }

  private logSummary(): void {
    const runningTimeSec = Math.round((Date.now() - this.startTime) / 1000);
    const perHour = this.totalCalls > 0 ? Math.round((this.totalCalls / runningTimeSec) * 3600) : 0;

    const summary: RequestSummary[] = [];
    
    for (const [key, data] of this.counts.entries()) {
      summary.push({
        table: key,
        count: data.count,
        lastCall: new Date(data.lastCall).toLocaleTimeString(),
      });
    }

    // Sort by count descending
    summary.sort((a, b) => b.count - a.count);

    console.group(`[Supabase Tracker] Summary (${runningTimeSec}s runtime)`);
    console.log(`Total calls: ${this.totalCalls} | Projected/hour: ${perHour}`);
    console.table(summary.slice(0, 10)); // Top 10
    console.groupEnd();
  }

  reset(): void {
    this.counts.clear();
    this.totalCalls = 0;
    this.startTime = Date.now();
  }

  getTotalCalls(): number {
    return this.totalCalls;
  }

  getCallsByTable(): Map<string, RequestCount> {
    return new Map(this.counts);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// Singleton instance
export const requestTracker = new RequestTracker();

// Helper to wrap Supabase query builder with tracking
export function trackQuery<T>(table: string, operation: string = 'select'): void {
  requestTracker.track(table, operation);
}
