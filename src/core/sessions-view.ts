// #region sessions-view — docs: docs/ux/scenarios.md#scn-078-see-every-coding-session-in-one-place
// FD-103 (dossier node S3): how the Sessions mode words a row. Pure (no DOM, no Electron), so the sidebar, the All
// sessions page, the session page, the tray and the notification say the same words, and a test reads them.
import { t, type Lang } from './i18n';
import { GROUP_ORDER, type SessionGroup, type SessionRow } from './sessions';

/** The coding agent's name as a person reads it. */
export function agentName(agent: string): string {
  if (agent === 'claude-code' || agent === 'claude') return 'Claude Code';
  if (agent === 'codex') return 'Codex';
  return agent;
}

/** The time of day a row is shown with, in the reader's language: 13:37 in Russian, 1:37 PM in English (V-7 of FIX-2: no
 *  leading zero before a 12-hour clock's hour). */
export function clock(lang: Lang, at: number): string {
  return new Date(at).toLocaleTimeString(lang, { hour: lang === 'ru' ? '2-digit' : 'numeric', minute: '2-digit' });
}

/** FD-124: the launch facts Switchboard recorded, as label and value pairs in reading order; empty when it kept none. */
export function chainFacts(lang: Lang, r: SessionRow): { label: string; value: string }[] {
  const l = r.launch;
  if (!l) return [];
  const out: { label: string; value: string }[] = [];
  if (l.by.surface) out.push({ label: t(lang, 'sessions.chain.started'), value: t(lang, `sessions.chain.started.${l.by.surface}`) });
  const asker = l.by.by ?? l.by.program;
  if (asker) out.push({ label: t(lang, 'sessions.chain.asker'), value: asker });
  if (l.ended) out.push({ label: t(lang, 'sessions.chain.ended'), value: t(lang, `sessions.chain.ended.${l.ended}`, { time: l.endedAt ? clock(lang, l.endedAt) : '' }).replace(/, $/, '') });
  if (l.continuedAs) out.push({ label: t(lang, 'sessions.chain.went'), value: t(lang, `sessions.chain.went.${l.continuedAs.kind}`, { id: l.continuedAs.id }) });
  if (l.turns !== null) out.push({ label: t(lang, 'sessions.chain.turns'), value: String(l.turns) });
  return out;
}

/** The groups in GROUP_ORDER, each with its rows (newest first, as the list comes); an empty group is not drawn. */
export function groupRows(rows: readonly SessionRow[]): { group: SessionGroup; rows: SessionRow[] }[] {
  return GROUP_ORDER.map((group) => ({ group, rows: rows.filter((r) => r.group === group) })).filter((g) => g.rows.length > 0);
}

/** SCN-077 step 4: what the switch's badge counts. */
export const waitingForYou = (rows: readonly SessionRow[]): number => rows.filter((r) => r.group === 'needs-you').length;
export const runningCount = (rows: readonly SessionRow[]): number => rows.filter((r) => r.group === 'running').length;

/** SCN-078 step 2: the second line of a row, "Claude Code · claude4 · handed over · 14:02". */
export function secondLine(lang: Lang, r: SessionRow): string {
  const when = r.startedAt ?? r.at;
  return [agentName(r.agent), r.account, t(lang, `sessions.origin.${r.origin}`), when ? clock(lang, when) : null].filter(Boolean).join(' · ');
}

/** R1-V1: a sidebar row's two lines. The first is the project with the time beside it, right-aligned and never cut; the
 *  second is "account · how it came", led by the coding agent only when it is not Claude Code (the usual one), so two rows
 *  of one folder are told apart within the sidebar's width. FD-107: an ended row shows when it ended, the time the Ended
 *  group is ordered by (newest first), so 13:02 never sits under 12:27; how it came is said in the sidebar's own shorter
 *  words (`sessions.navOrigin.*`), which fit its width in both languages. */
export function navLines(lang: Lang, r: SessionRow): { time: string | null; sub: string } {
  const when = r.group === 'ended' ? (r.endedAt ?? r.at) : (r.startedAt ?? r.at);
  const agent = agentName(r.agent);
  return {
    time: when ? clock(lang, when) : null,
    sub: [agent === 'Claude Code' ? null : agent, r.account, t(lang, `sessions.navOrigin.${r.origin}`)].filter(Boolean).join(' · '),
  };
}

/** R1-V4: the strip a session's page draws over its console once the session is over, or null. The page's header already
 *  says how it ended (an idle close, the person's End, the app quitting, a clean end at a time), so the strip is drawn
 *  only for what the header does not say: an unclean exit's code. */
export function pageExitLine(lang: Lang, s: { state: string; exitCode: number | null; signal: number | null }, idle: boolean): string | null {
  if (s.state !== 'exited' || idle || s.signal || s.exitCode === null || s.exitCode === 0) return null;
  return t(lang, 'console.exited', { code: s.exitCode });
}

/** The state in words (SCN-081 to SCN-084); never a glyph alone. A waiting row says when it continues. */
export function stateWords(lang: Lang, r: SessionRow, o: { autoContinue?: boolean } = {}): string {
  switch (r.state) {
    case 'needs-you-not-opened': {
      const why = t(lang, `sessions.reason.${r.reason ?? 'not-started'}`);
      return r.openedInTerminal ? `${why} ${t(lang, 'sessions.openedInTerminal')}` : why;
    }
    case 'ended-cannot-continue': // FD-108
      return t(lang, 'sessions.state.cannotContinue', { why: t(lang, `sessions.cannot.${r.reason ?? 'resume-failed'}`) });
    case 'waiting-reset':
      if (o.autoContinue === false) return t(lang, 'sessions.state.autoOff');
      return r.expectedAt ? t(lang, 'sessions.state.waitingAt', { time: clock(lang, r.expectedAt) }) : t(lang, 'sessions.state.waiting');
    case 'ended':
      if (r.reason === 'declined') return t(lang, 'sessions.state.declined');
      if (r.reason === 'quit') return t(lang, 'sessions.state.quit'); // R1-S4
      return t(lang, 'sessions.state.ended', { time: clock(lang, r.endedAt ?? r.at) });
    // FD-107: every ended state with an end of its own says when, so a card's order (by its end) reads in its words.
    case 'idle-closed':
    case 'ended-by-you':
      return t(lang, `sessions.state.${r.state}`, { time: clock(lang, r.endedAt ?? r.at) });
    default:
      return t(lang, `sessions.state.${r.state}`);
  }
}

/** The short state word a sidebar row names to a screen reader (the group heading shows it on screen). */
export function stateShort(lang: Lang, r: SessionRow): string {
  if (r.group === 'needs-you') return t(lang, 'sessions.short.needs-you');
  if (r.group === 'waiting') return t(lang, 'sessions.short.waiting');
  return stateWords(lang, r);
}

/** SCN-080: the header's origin chip. V-1 of FIX-2: a limit stop names the account it stopped on; V-3: a continue that did
 *  not take up its conversation says it was tried, never that it continued. */
export function originChip(lang: Lang, r: SessionRow): string {
  const when = r.startedAt ?? r.at;
  const time = when ? clock(lang, when) : '';
  if (r.origin === 'limit') return r.account ? t(lang, 'sessions.chip.limit', { account: r.account, time }) : t(lang, 'sessions.chip.limitNoAccount', { time });
  if (r.origin === 'resume' && r.state === 'needs-you-resume-failed') return t(lang, 'sessions.chip.resumeTried', { time });
  return t(lang, `sessions.chip.${r.origin}`, { time });
}

/** SCN-080: the context chip when Switchboard names one, else null. */
export function contextChip(lang: Lang, r: SessionRow): string | null {
  if (!r.context) return null;
  if (r.context === 'personal') return t(lang, 'sessions.context.personal');
  return t(lang, 'sessions.context.org', { organization: r.contextName ?? r.context.replace(/^org:/, '') });
}

/** Decision 6 of 2026-10-24: Continue takes up the conversation when it is known, else starts a new session there. */
export const continueLabel = (lang: Lang, r: SessionRow): string => t(lang, r.resumable ? 'sessions.continue' : 'sessions.newHere');

/** SCN-081: "Show in Finder" on macOS, "Show in Explorer" on Windows, "Show folder" elsewhere. */
export function revealLabel(lang: Lang, platform: 'mac' | 'windows' | 'other'): string {
  return platform === 'windows' ? t(lang, 'sessions.revealWindows') : t(lang, 'sessions.reveal');
}

/** SCN-085: the tray's Sessions line, a part at zero left out; null when nothing runs or waits. */
export function traySessionsLine(lang: Lang, rows: readonly SessionRow[]): string | null {
  const running = runningCount(rows);
  const waiting = waitingForYou(rows);
  if (running && waiting) return t(lang, 'tray.sessions.both', { running, waiting });
  if (running) return t(lang, 'tray.sessions.running', { running });
  if (waiting) return t(lang, 'tray.sessions.waiting', { waiting });
  return null;
}

/** VIS-05 (SCN-080 step 4): Esc always reaches the coding agent; a Tab within this long after it leaves the terminal. */
export const ESC_TAB_MS = 1000;

/** What a key press in the terminal does: `pass` reaches the coding agent; `leave` moves focus out of the terminal
 *  (back with Shift). `lastEscAt` is when Esc was last pressed (null for never). */
export function terminalKey(e: { key: string; shiftKey?: boolean; type?: string }, lastEscAt: number | null, now: number): 'pass' | 'leave' | 'leave-back' {
  if (e.type && e.type !== 'keydown') return 'pass';
  if (e.key === 'Tab' && lastEscAt !== null && now - lastEscAt <= ESC_TAB_MS) return e.shiftKey ? 'leave-back' : 'leave';
  return 'pass';
}

/** UX-18: where the Sessions mode lands for a page that names a row: that row, or All sessions once it is gone. A row
 *  continued into a new one is followed by its console key; `wait` holds the page while a row may still arrive (a
 *  notification clicked before the next read, the page remembered at launch). */
export function resolveSessionRoute(rows: readonly SessionRow[] | null, id: string, o: { follow?: string | null; wait?: boolean } = {}): { found: SessionRow | null; gone: boolean; settled: boolean } {
  if (!rows) return { found: null, gone: false, settled: false }; // not read yet: wait, never bounce
  const byId = rows.find((r) => r.id === id) ?? null;
  if (o.follow) {
    // A Continue names the console it started: its row is the page now; until it is listed the old row stays on show.
    const byKey = rows.find((r) => r.key === o.follow && r.group !== 'ended') ?? null;
    return byKey ? { found: byKey, gone: false, settled: true } : { found: byId, gone: false, settled: false };
  }
  return { found: byId, gone: !byId && !o.wait, settled: Boolean(byId) };
}
// #endregion sessions-view
