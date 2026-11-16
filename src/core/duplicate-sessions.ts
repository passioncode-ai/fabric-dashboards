// FD-277 (fabric-switchboard 0.7.98, board thread `9a462401`): one coding session that runs in two processes. Switchboard's
// `attention` names it (`session_duplicate`) and `sessions close-copy <session id>` closes the quiet copy: of the copies
// neither busy nor running a command, the one quiet longest gets SIGTERM, then SIGKILL after ten seconds; a working copy
// is never closed. The Sessions page shows each one with that button; the closing is Switchboard's.
// #region duplicate-sessions — docs: docs/ux/scenarios.md#scn-118-close-the-quiet-copy-of-a-session-that-runs-twice

/** One session running twice: its id, the label Switchboard gives it (its folder's name) and the processes. */
export interface DuplicateSession { sessionId: string; label: string; pids: number[] }

/** A session id as Claude Code writes it; only such an id reaches `close-copy`. */
export const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;
/** How often `attention` is read, and only while the Sessions mode is on screen. */
export const DUPLICATES_MS = 60_000;

/** Whether this Switchboard closes a copy (its `sessions --help` lists `close-copy`). */
export const takesCloseCopy = (help: string): boolean => /^\s*close-copy\b/m.test(help);

/** `switchboard --json attention`: its `session_duplicate` items; null when the answer is not one. */
export function parseDuplicates(stdout: string): DuplicateSession[] | null {
  let doc: unknown;
  try { doc = JSON.parse(stdout); } catch { return null; }
  const data = (doc && typeof doc === 'object' && 'data' in doc ? (doc as { data: unknown }).data : doc) as { items?: unknown } | null;
  if (!data || !Array.isArray(data.items)) return null;
  const out: DuplicateSession[] = [];
  for (const it of data.items as Record<string, unknown>[]) {
    if (!it || it.reason !== 'session_duplicate' || typeof it.session_id !== 'string' || !SESSION_ID.test(it.session_id)) continue;
    const pids = Array.isArray(it.pids) ? it.pids.filter((p): p is number => Number.isInteger(p) && (p as number) > 0) : [];
    const label = typeof it.label === 'string' && it.label.trim() ? it.label.trim().slice(0, 120) : it.session_id.slice(0, 8);
    if (!out.some((d) => d.sessionId === it.session_id)) out.push({ sessionId: it.session_id, label, pids });
  }
  return out;
}

export function closeCopyArgv(switchboard: string, sessionId: string): string[] | null {
  return SESSION_ID.test(sessionId) ? [switchboard, '--json', 'sessions', 'close-copy', sessionId] : null;
}

/** What closing a copy answered: the process closed, or why none was (`not-two`: it no longer runs twice;
 *  `all-working`: every copy works, so none is closed; `failed`: anything else, with Switchboard's sentence). */
export type CloseCopyResult = { ok: true; closedPid: number | null } | { ok: false; why: 'not-two' | 'all-working' | 'failed'; detail?: string };

export function parseCloseCopy(code: number, stdout: string, stderr: string): CloseCopyResult {
  let doc: Record<string, unknown> | null = null;
  try { const j = JSON.parse(stdout) as unknown; if (j && typeof j === 'object') doc = j as Record<string, unknown>; } catch { /* not JSON */ }
  const data = (doc && typeof doc.data === 'object' && doc.data ? doc.data : doc) as Record<string, unknown> | null;
  const text = `${typeof doc?.code === 'string' ? doc.code : ''} ${typeof doc?.error === 'string' ? doc.error : ''} ${stderr}`;
  if (code === 0 && (!doc || doc.ok !== false)) return { ok: true, closedPid: typeof data?.closed_pid === 'number' ? data.closed_pid : null };
  if (/NOT_TWO/.test(text)) return { ok: false, why: 'not-two' };
  if (/ALL_WORKING/.test(text)) return { ok: false, why: 'all-working' };
  const said = typeof doc?.error === 'string' ? doc.error : (stderr || stdout).trim();
  return { ok: false, why: 'failed', detail: said.slice(0, 200) || `exit ${code}` };
}
// #endregion duplicate-sessions
