/**
 * Lightweight dev-only performance instrumentation for game loading flow.
 *
 * Usage:
 *   import { perf } from '@/lib/perfLog';
 *   perf.mark('click_find_match');
 *   ...later...
 *   perf.mark('game_id_known');
 *   perf.summary();   // prints one-line summary
 *
 * Enable via: localStorage.setItem('chess_perf', '1');
 * Or by running in dev mode (import.meta.env.DEV).
 */

type Milestone =
  | 'click_create'
  | 'click_join'
  | 'click_matchmake'
  | 'rpc_returned'
  | 'game_id_known'
  | 'route_to_game'
  | 'ws_connected'
  | 'join_game_sent'
  | 'join_ack_received'
  | 'match_found'
  | 'board_rendered';

const enabled = (): boolean =>
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('chess_perf') === '1');

class PerfLog {
  private marks: Map<Milestone, number> = new Map();
  private origin = 0;

  /** Reset and start a new measurement session */
  start(firstMilestone: Milestone): void {
    if (!enabled()) return;
    this.marks.clear();
    this.origin = performance.now();
    this.marks.set(firstMilestone, this.origin);
    console.log(`[perf] ▶ ${firstMilestone}`);
  }

  /** Record a milestone */
  mark(milestone: Milestone): void {
    if (!enabled()) return;
    const t = performance.now();
    this.marks.set(milestone, t);
    const delta = this.origin ? Math.round(t - this.origin) : 0;
    console.log(`[perf] ● ${milestone}  +${delta}ms`);
  }

  /** Print a one-line summary of key intervals */
  summary(): void {
    if (!enabled()) return;
    const m = this.marks;
    const diff = (a: Milestone, b: Milestone): string => {
      const ta = m.get(a);
      const tb = m.get(b);
      if (ta === undefined || tb === undefined) return '---';
      return `${Math.round(tb - ta)}ms`;
    };

    // Determine the starting milestone
    const startKey: Milestone =
      m.has('click_matchmake') ? 'click_matchmake'
        : m.has('click_create') ? 'click_create'
          : m.has('click_join') ? 'click_join'
            : 'click_matchmake';

    const gameIdKey: Milestone = m.has('game_id_known') ? 'game_id_known' : 'match_found';

    const line = [
      `create->${gameIdKey.replace(/_/g, '')}=${diff(startKey, gameIdKey)}`,
      `gameId->wsConnect=${diff(gameIdKey, 'ws_connected')}`,
      m.has('join_ack_received')
        ? `wsConnect->joinAck=${diff('ws_connected', 'join_ack_received')}`
        : `wsConnect->matchFound=${diff('ws_connected', 'match_found')}`,
      `joinAck->board=${diff(m.has('join_ack_received') ? 'join_ack_received' : 'match_found', 'board_rendered')}`,
    ].join(', ');

    console.log(`[perf] ═══ ${line}`);
  }
}

export const perf = new PerfLog();
