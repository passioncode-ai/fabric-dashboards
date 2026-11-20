// #region fabric-session-link — docs: docs/ux/scenarios.md#scn-080-open-one-sessions-page
// FD-354 step 2 (the operator 2026-11-19, board `57445717`; contract DEC-0189, Fabric's `fabric-session-links/1`, shipped
// in Fabric 0.3.26): Open in Fabric and New session in Fabric on a session's page. Pure and Node-free, so the page can
// tell whether a row has a link and the main process builds the same one. A link opens a view in Fabric and acts on
// nothing (FB-8): Fabric moves a session into its console only when the person confirms it there (SL-5).
import { buildFabricLink, PROJECT_REF, RUNNER_KIND, SESSION_ID } from './fabric-links';
import type { SessionRow } from './sessions';

/** What this app calls itself in a link's `from` (SL-1): the page's claim, recorded by Fabric, never a grant. */
export const FROM = 'fabric-dashboards';

/** The coding agents whose own sessions Fabric reads and continues (Fabric 0.3.26: Claude Code and Codex). */
const RUNNERS: Readonly<Record<string, string>> = { 'claude-code': 'claude-code', claude: 'claude-code', codex: 'codex' };

/** States in which a process still runs the session: Fabric only shows it (`session/open`) and leaves it running. */
const RUNS: ReadonlySet<SessionRow['state']> = new Set(['running-ours', 'running-terminal', 'running-background', 'running-unmanaged', 'needs-you-resume-failed', 'waiting-own']);

/**
 * The coding agent's own session id of a row, a UUID in lower case, or null. Taken only from what names it: Switchboard's
 * launch record (`provider_session_id`), the id a console of this app resumed, or a transcript file named by it (as
 * `openConsolesOf` does, FD-166). Nothing else is guessed (SL-4: Fabric never guesses either).
 */
export function runnerSessionId(row: Pick<SessionRow, 'launch'>, resumed: string | null = null): string | null {
  const own = row.launch?.providerSessionId ?? null;
  if (own && SESSION_ID.test(own)) return own.toLowerCase();
  if (resumed && SESSION_ID.test(resumed)) return resumed.toLowerCase();
  const name = (row.launch?.transcript ?? '').split(/[\\/]/).pop()?.replace(/\.jsonl$/, '') ?? '';
  return SESSION_ID.test(name) ? name.toLowerCase() : null;
}

export type FabricSessionLink = { action: 'session.open' | 'session.continue' | 'session.new'; url: string };
/** What a press of Open in Fabric or New session in Fabric did: the view Fabric opened, or why none. `absent`: no app
 *  handles `fabric://` here (FB-5); `no-link`: the row has no link (`openInFabric`, `newInFabric` answer null). */
export type FabricOpenResult = { ok: true; action: FabricSessionLink['action'] } | { ok: false; reason: 'unknown' | 'no-link' | 'absent' | 'failed'; detail?: string };

/**
 * Open in Fabric for a row: `session/open` while a process still runs it (Fabric shows it and touches nothing), else
 * `session/continue` (Fabric offers to continue it in its console from its history). Null where Fabric cannot know the
 * session: another machine's, a coding agent other than Claude Code and Codex, or no session id.
 */
export function openInFabric(row: Pick<SessionRow, 'machine' | 'agent' | 'state' | 'launch'>, resumed: string | null = null): FabricSessionLink | null {
  if (row.machine !== null || !RUNNERS[row.agent]) return null;
  const session = runnerSessionId(row, resumed);
  if (!session) return null;
  const action = RUNS.has(row.state) ? 'session.open' : 'session.continue';
  return { action, url: buildFabricLink({ action, session, from: FROM }) };
}

/**
 * New session in Fabric for a row's folder: `session/new` with the folder's last name as `project` (Fabric resolves a
 * project by id, then name, then the last segment of any of its folders and worktrees; board thread `3ca40854`, message
 * `8c7317e0`), and the row's coding agent as `runner` where Fabric knows it. Null on another machine, or for a folder
 * whose name the grammar refuses (a space, a leading dot).
 */
export function newInFabric(row: Pick<SessionRow, 'machine' | 'agent' | 'folder'>): FabricSessionLink | null {
  if (row.machine !== null) return null;
  const project = row.folder.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';
  if (!PROJECT_REF.test(project)) return null;
  const runner = RUNNERS[row.agent];
  return { action: 'session.new', url: buildFabricLink({ action: 'session.new', project, ...(runner && RUNNER_KIND.test(runner) ? { runner } : {}), from: FROM }) };
}
// #endregion fabric-session-link
