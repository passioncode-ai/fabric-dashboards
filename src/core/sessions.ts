// #region sessions-data — docs: docs/reports/2026-10-24-ui-ux-iteration/sessions-and-navigation.md#data-srccoresessionsts-new-pure
// FD-103 (dossier 2026-10-24, node S2): every coding session of this Mac in one list. Four sources are merged: the
// sessions Switchboard launched (`sessions --all`), the hand-overs it still offers, the sessions it holds as stopped on
// a usage limit, and this app's own consoles with how each ended. Pure: no Electron, no file system, no clock but the
// one passed in, so Fabric can import it the day it takes the sessions over (decision V-01, question Q-1). Ids,
// folders, labels and times only: never a prompt, a transcript or a token.
import type { StopView } from './types';

/** How long an ended entry, a hand-over that did not open, and a dismissal are kept (the dossier: 24 hours). */
export const SESSION_KEEP_MS = 24 * 60 * 60_000;
/** Two sources name one session when they name one folder and starts at most this far apart (a Switchboard launch in
 *  a console records its start a few seconds after the console started it). */
export const SAME_START_MS = 2 * 60_000;
/** The console key a hand-over gets in this app: `handover.<hand-over id>` (FD-103 decision 8: a console of its own).
 *  Here, not in switchboard.ts, so this pure module and the renderer that imports it need nothing of Node. */
export const handoverOwnKey = (id: string) => `handover.${id}`;

/** How a session came to be listed: handed over by Switchboard after a limit, continued here after a limit reset,
 *  stopped by a limit and not continued yet (`limit`: a waiting stop, one this app does not continue, or one the person
 *  declined; V-1 of FIX-2), launched by Switchboard elsewhere, or opened in this app. */
export type SessionOrigin = 'handover' | 'resume' | 'limit' | 'switchboard' | 'here';
export type SessionState =
  | 'running-ours' // runs in a console of this app
  | 'running-terminal' // runs elsewhere (Switchboard launched it in Terminal or another app's console)
  | 'needs-you-resume-failed' // continued after a limit, did not take up its conversation, still runs
  | 'needs-you-not-opened' // could not open here; `reason` says why
  | 'waiting-reset' // stopped on a limit; `expectedAt` says when it is likely to continue
  | 'ended'
  | 'ended-cannot-continue' // FD-108: a limit stop of the last day whose folder or conversation is not here; `reason` says which
  | 'idle-closed' // closed after 30 idle minutes (LC-18)
  | 'ended-by-you';
export type SessionGroup = 'needs-you' | 'running' | 'waiting' | 'ended';
/** The order the groups are shown in; an empty group is not drawn. */
export const GROUP_ORDER: readonly SessionGroup[] = ['needs-you', 'running', 'waiting', 'ended'];
/** What a person may do with a row: `end` asks first; `continueNow` claims a limit stop on another account now;
 *  `dontContinue` keeps a waiting stop from being continued; `dismiss` removes the row. */
export type SessionAction = 'end' | 'reveal' | 'openConsole' | 'dismiss' | 'continueNow' | 'dontContinue' | 'continue';
/** Why a row is not running: a hand-over that did not open (`expired`, `no-folder`, `busy-disk`, `busy-cap`, `busy-swap`
 *  for the LC-17 refusal the check found (R1-B; `busy` in records of 0.8.0 builds before it), `switchboard-old`,
 *  `not-started`; `pending`, still on offer, is never listed); a stop this app does not continue (`billing`, which needs the
 *  person; `no-folder`, `no-transcript`, `resume-failed`, an ended row "Cannot be continued here"; `old` and `open` are
 *  listed by 0.8.0 builds only: from 0.8.1 such a stop is no row, FD-108); or a stop the person declined
 *  (`declined`, an ended row: "Not continued: you declined"; decision 2 of 2026-10-24); or a console the app closed as
 *  it quit (`quit`, an ended row: "Closed when the app quit"; review round 1, R1-S4). */
export type SessionReason = 'expired' | 'no-folder' | 'busy' | 'busy-disk' | 'busy-cap' | 'busy-swap' | 'switchboard-old' | 'not-started' | 'pending' | 'no-transcript' | 'resume-failed' | 'old' | 'billing' | 'open' | 'declined' | 'quit';

export interface SessionRow {
  /** Stable across polls and restarts: `c:<console key>:<start>`, `sb:<provider>:<pool>:<launch>:<folder>` (F5 of FIX-2:
   *  Switchboard's `home` names a kind of home, `runtimes/<provider>-<pool>`, shared by every session of a pool, so it
   *  does not tell two sessions apart; a folder longer than 300 characters is named by a hash), `ho:<hand-over id>`,
   *  `st:<stop event>`. */
  id: string;
  /** The console key of this app that runs or ran it, when there is one (opens the console). */
  key: string | null;
  folder: string;
  /** The folder's last name: the first line of a row. */
  project: string;
  /** The coding agent (`claude-code`, `codex`, or the runtime's name). */
  agent: string;
  account: string | null;
  /** Switchboard's context (`personal`, `org:<id>`) and the organization's name, when known. */
  context: string | null;
  contextName: string | null;
  origin: SessionOrigin;
  state: SessionState;
  group: SessionGroup;
  actions: SessionAction[];
  reason: SessionReason | null;
  /** A hand-over that did not open here and that Switchboard no longer offers: it opened it in Terminal. */
  openedInTerminal: boolean;
  startedAt: number | null;
  endedAt: number | null;
  /** A waiting stop: when Switchboard will probe it (its `probe_at`, SB-115); null when it is ready now, or when Switchboard
   *  names no probe time (a billing stop, a pool every account of which is capped: R1-S3). */
  expectedAt: number | null;
  /** A waiting stop: the accounts that could take it now (Switchboard's candidates, its order), for Continue now on
   *  another account; the chosen id goes back with `sessionsContinue`. Empty for every other row. */
  candidates: { id: string; label: string }[];
  /** FD-118: a waiting stop's reason from Switchboard (0.6.83), shown instead of "No other account has capacity";
   *  null for every other row and when Switchboard names none. */
  waitReason: StopView['waitReason'] | null;
  /** An ended row: whether Continue can take up its own conversation (a known session id, a Claude Code session whose
   *  transcript the app finds by folder and time, or an agent console's own Continue); otherwise the button reads
   *  "New session here" (decision 6 of 2026-10-24). False for every row that is not ended. */
  resumable: boolean;
  /** V-5 (FIX-2): an ended row whose console of this app holds nothing it printed (the app restarted since): its page
   *  says so instead of showing an empty console. Set by the console host; false in the pure merge. */
  consoleEmpty: boolean;
  /** The row's latest known time, the list's order (newest first). */
  at: number;
}

/** One record of Switchboard's `sessions --all` (contract *Session list*, SB-95, SB-110). */
export interface SbSessionRecord {
  home: string;
  folder: string;
  /** The route the session rides (`claude`, `codex`, …): a proxy launch of another agent records `claude` (SB-201). */
  provider: string;
  /** SB-201 (Switchboard 0.7.0): the catalog id of the agent that runs (`claude-code`, `goose`, `codex`, …); taken from
   *  the provider when Switchboard names none, as Switchboard itself fills it. */
  agent: string;
  pool: string;
  mode: string;
  account: string;
  accountId: string;
  context: string | null;
  contextName: string | null;
  /** The workflow this launch continues (a hand-over or a fallback after a limit), else null. */
  continues: string | null;
  inPlace: boolean;
  launchedAt: number | null;
  startedAt: number | null;
  state: 'starting' | 'running' | 'ended' | 'unknown';
}

/** A hand-over Switchboard still offers. */
export interface PendingHandover { id: string; dir: string; agent: string; account: string; workflow: string; offeredUntil: number }

/** A limit stop as the console host judged it, with the accounts that could take it now. */
export type StopInput = Pick<StopView, 'event' | 'session' | 'dir' | 'provider' | 'stoppedAt' | 'attempt' | 'verdict' | 'key' | 'probeAt' | 'account' | 'waitReason'> & { candidates?: { id: string; label: string }[] };

/** A console of this app that runs now. */
export interface ConsoleInput {
  key: string;
  folder: string;
  agent: string;
  startedAt: number;
  origin: 'handover' | 'resume' | 'here';
  account: string | null;
  /** A session continued after a limit that did not take up its conversation (FD-84) and still runs. */
  failedResume?: boolean;
  handoverId?: string | null;
}

/** What is kept in the settings for 24 hours: a console session that ended, and a hand-over that did not open here. */
export interface SessionRecord {
  id: string;
  key: string | null;
  folder: string;
  agent: string;
  account: string | null;
  context: string | null;
  origin: SessionOrigin;
  /** `declined`: a limit stop the person chose not to continue (the app never continues it; Switchboard's record stays).
   *  `quit`: a console this app ended as it quit (R1-S4). */
  end: 'ended' | 'idle' | 'you' | 'not-opened' | 'declined' | 'quit';
  reason: SessionReason | null;
  startedAt: number | null;
  endedAt: number;
  /** The coding agent's own session id, when known (a limit stop's): what Continue resumes. */
  sessionId: string | null;
  provider: 'claude' | 'codex' | null;
  handoverId: string | null;
}

export interface Dismissal { id: string; at: number }

export interface MergeInput {
  now: number;
  /** Null while it could not be read: a degraded source, not an empty one. */
  switchboard: SbSessionRecord[] | null;
  pending: PendingHandover[] | null;
  stops: StopInput[];
  consoles: ConsoleInput[];
  records: SessionRecord[];
  dismissed: Dismissal[];
}

export type SessionSource = 'sessions' | 'handovers' | 'recovery';
/** A source that did not answer: its last good answer is still used, and the list says it may be out of date. */
export interface SourceDegraded { source: SessionSource; reason: 'old' | 'error'; detail: string; since: number }

/** What the window gets as `status.sessions`. */
export interface SessionsStatus {
  rows: SessionRow[];
  degraded: SourceDegraded[];
  /** Whether Switchboard is installed; without it only this app's own consoles are listed. */
  switchboard: boolean;
  /** Switchboard's switch for handing sessions over to a console (`handovers set on|off`); null until read. */
  handovers: { enabled: boolean | null };
  /** Settings → Sessions → "Continue sessions after a limit reset" (SCN-083: a waiting row says when it is off). */
  autoContinue: boolean;
}

/** FD-103 (decision 9): one per taken hand-over and per automatic continue after a limit reset; the shell turns it into
 *  one system notification (node S3). `id` is the row's, so a click opens that session. */
export interface SessionNotice { kind: 'handover' | 'resume'; id: string; key: string; project: string; agent: string; at: number }

/** What a Sessions action answers. `unknown`: the row is gone; `not-allowed`: its state does not offer the action;
 *  `account`: Continue now named an account that is not a candidate; `claim`: Switchboard refused the claim; the rest are
 *  the console's own start refusals (ConsoleStartResult). */
export type SessionActionResult =
  | { ok: true; key: string | null }
  | { ok: false; reason: 'unknown' | 'not-allowed' | 'account' | 'claim' | 'no-switchboard' | 'no-folder' | 'no-runtime' | 'no-continue' | 'running' | 'switchboard' | 'terminal-only' | 'spawn' | 'admission'; detail?: string };

export const consoleRowId = (key: string, startedAt: number) => `c:${key}:${startedAt}`;
export const handoverRowId = (id: string) => `ho:${id}`;
export const stopRowId = (event: string) => `st:${event}`;
/** FNV-1a, 64 bits as hex: a stable short name for a long folder. Pure, so the renderer can import this module. */
function fnv64(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const ch of new TextEncoder().encode(text)) h = BigInt.asUintN(64, (h ^ BigInt(ch)) * 0x100000001b3n);
  return h.toString(16).padStart(16, '0');
}
/** F5 of FIX-2: one Switchboard session is its provider, pool, launch time and folder (contract *Session list*: a launch
 *  records its working directory; `home` is the pool's runtime home, the same for every session of the pool). */
const sbRowId = (r: SbSessionRecord) => {
  const folder = norm(r.folder);
  return `sb:${r.agent}:${r.provider}:${r.pool}:${r.launchedAt ?? 0}:${folder.length > 300 ? `#${fnv64(folder)}` : folder}`;
};

export function groupOf(state: SessionState): SessionGroup {
  if (state.startsWith('needs-you')) return 'needs-you';
  if (state.startsWith('running')) return 'running';
  if (state === 'waiting-reset') return 'waiting';
  return 'ended';
}

/** The dossier's table, *Every state has an action*. Show in Terminal is not offered: Switchboard does not say which
 *  window runs a session. */
export function actionsFor(state: SessionState, o: { continueNow?: boolean } = {}): SessionAction[] {
  switch (state) {
    case 'running-ours': return ['end', 'reveal'];
    case 'running-terminal': return ['reveal']; // V-6 of FIX-2: its folder, the one thing this app can show
    case 'needs-you-resume-failed': return ['openConsole', 'end'];
    case 'needs-you-not-opened': return ['dismiss'];
    case 'ended-cannot-continue': return ['dismiss'];
    case 'waiting-reset': return [...(o.continueNow ? ['continueNow' as const] : []), 'dontContinue'];
    default: return ['continue', 'dismiss'];
  }
}

const norm = (p: string) => (p.length > 1 ? p.replace(/[\\/]+$/, '') : p);
const base = (p: string) => norm(p).split(/[\\/]/).pop() || p;
/** Within the last 24 hours, and not ahead of now by more than SAME_START_MS (F6 of FIX-2: a record a year ahead is no
 *  fresh record, else it would be listed for a year). */
const fresh = (t: number | null | undefined, now: number) => typeof t === 'number' && now - t <= SESSION_KEEP_MS && t <= now + SAME_START_MS;
/** F6 of FIX-2: a time this app wrote ahead of the clock (the clock was set back since) is kept at now, never dropped:
 *  a decline written then still holds, and for a day from now, not for as long as the clock had run ahead. */
const clamp = (t: number, now: number) => Math.min(t, now);

/** Entries older than 24 hours are dropped; a malformed one is never kept; a time ahead of now is now. */
export function pruneRecords(records: readonly unknown[], now: number): SessionRecord[] {
  return records.filter((r): r is SessionRecord => isRecord(r) && now - r.endedAt <= SESSION_KEEP_MS)
    .map((r) => (r.endedAt > now || (r.startedAt ?? 0) > now ? { ...r, endedAt: clamp(r.endedAt, now), startedAt: r.startedAt === null ? null : clamp(r.startedAt, now) } : r));
}

export function pruneDismissed(dismissed: readonly unknown[], now: number): Dismissal[] {
  return dismissed.filter((d): d is Dismissal => Boolean(d) && typeof (d as Dismissal).id === 'string' && (d as Dismissal).id.length <= 400 && num((d as Dismissal).at) && now - (d as Dismissal).at <= SESSION_KEEP_MS)
    .map((d) => (d.at > now ? { id: d.id, at: now } : d));
}

const ORIGINS = new Set<SessionOrigin>(['handover', 'resume', 'limit', 'switchboard', 'here']);
const ENDS = new Set<SessionRecord['end']>(['ended', 'idle', 'you', 'not-opened', 'declined', 'quit']);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
function isRecord(r: unknown): r is SessionRecord {
  const x = r as SessionRecord;
  return Boolean(x) && typeof x === 'object' && typeof x.id === 'string' && x.id.length <= 400 && typeof x.folder === 'string' && x.folder.length > 0
    && typeof x.agent === 'string' && ORIGINS.has(x.origin) && ENDS.has(x.end) && num(x.endedAt) && (x.startedAt === null || num(x.startedAt))
    && (x.key === null || typeof x.key === 'string');
}

function row(o: Omit<SessionRow, 'project' | 'group' | 'at' | 'actions' | 'contextName' | 'openedInTerminal' | 'expectedAt' | 'candidates' | 'resumable' | 'consoleEmpty' | 'waitReason'> & Partial<Pick<SessionRow, 'actions' | 'contextName' | 'openedInTerminal' | 'expectedAt' | 'candidates' | 'resumable' | 'waitReason'>>): SessionRow {
  const group = groupOf(o.state);
  return {
    ...o, project: base(o.folder), group, actions: o.actions ?? actionsFor(o.state),
    contextName: o.contextName ?? null, openedInTerminal: o.openedInTerminal ?? false, expectedAt: o.expectedAt ?? null, candidates: o.candidates ?? [], waitReason: o.waitReason ?? null,
    resumable: group === 'ended' && (o.resumable ?? false),
    consoleEmpty: false,
    at: Math.max(o.endedAt ?? 0, o.startedAt ?? 0),
  };
}

const END_STATE: Record<Exclude<SessionRecord['end'], 'not-opened'>, SessionState> = { ended: 'ended', idle: 'idle-closed', you: 'ended-by-you', declined: 'ended', quit: 'ended' };
const END_REASON: Partial<Record<SessionRecord['end'], SessionReason>> = { declined: 'declined', quit: 'quit' };

/** The one list: deduplicated (by id, then by folder and start time), newest first. */
export function mergeSessions(i: MergeInput): SessionRow[] {
  const hidden = new Set(pruneDismissed(i.dismissed, i.now).map((d) => d.id));
  const rows: SessionRow[] = [];
  const ids = new Set<string>();
  const add = (r: SessionRow) => { if (!hidden.has(r.id) && !ids.has(r.id)) { ids.add(r.id); rows.push(r); } };
  const sb = i.switchboard ?? [];
  const used = new Set<SbSessionRecord>();
  // The Switchboard record of one of our consoles: launched in place (a console runs `switchboard launch … --in-place`
  // or `handovers run`; a Terminal session is never ours), in the same folder, the nearest start within SAME_START_MS
  // (R1-U7: the first one found could be another console's).
  const sbOf = (folder: string, startedAt: number | null) => {
    if (startedAt === null) return undefined;
    let hit: SbSessionRecord | undefined;
    for (const s of sb) {
      if (used.has(s) || !s.inPlace || norm(s.folder) !== norm(folder) || s.launchedAt === null) continue;
      const gap = Math.abs(s.launchedAt - startedAt);
      if (gap <= SAME_START_MS && (!hit || gap < Math.abs(hit.launchedAt! - startedAt))) hit = s;
    }
    if (hit) used.add(hit);
    return hit;
  };

  // 1. This app's consoles that run now.
  const consoleKeys = new Set<string>();
  for (const c of i.consoles) {
    consoleKeys.add(c.key);
    const s = sbOf(c.folder, c.startedAt);
    add(row({
      id: consoleRowId(c.key, c.startedAt), key: c.key, folder: c.folder, agent: c.agent, account: c.account ?? s?.account ?? null,
      context: s?.context ?? null, contextName: s?.contextName ?? null, origin: c.origin, reason: null,
      state: c.failedResume ? 'needs-you-resume-failed' : 'running-ours', startedAt: c.startedAt, endedAt: null,
    }));
  }

  // 2. What ended here, and hand-overs that did not open here (kept 24 h). A record the person removed is still read
  // (its row stays hidden by its dismissal) so it keeps claiming its Switchboard twin (R1-U1).
  const pending = new Set((i.pending ?? []).map((h) => h.id));
  const notOpened = new Set<string>();
  const named = new Set(i.consoles.map((c) => c.handoverId).filter((id): id is string => Boolean(id)));
  for (const r of pruneRecords(i.records, i.now)) {
    if (r.handoverId) named.add(r.handoverId);
    if (r.end === 'not-opened') {
      if (r.handoverId) notOpened.add(r.handoverId);
      add(row({
        id: r.id, key: r.key, folder: r.folder, agent: r.agent, account: r.account, context: r.context, origin: r.origin, reason: r.reason,
        state: 'needs-you-not-opened', startedAt: r.startedAt, endedAt: r.endedAt,
        openedInTerminal: r.origin === 'handover' && i.pending !== null && !pending.has(r.handoverId ?? '') && r.reason !== 'expired' && r.reason !== 'switchboard-old',
      }));
      continue;
    }
    const s = r.id.startsWith('c:') ? sbOf(r.folder, r.startedAt) : undefined; // only a console of this app has a twin
    add(row({
      id: r.id, key: r.key, folder: r.folder, agent: r.agent, account: r.account ?? s?.account ?? null, context: r.context ?? s?.context ?? null,
      contextName: s?.contextName ?? null, origin: r.end === 'declined' ? 'limit' : r.origin, reason: END_REASON[r.end] ?? null, state: END_STATE[r.end], startedAt: r.startedAt, endedAt: r.endedAt, // V-1: 0.8.0 builds wrote 'resume' for a decline
      resumable: r.sessionId !== null || r.provider === 'claude' || (r.origin === 'here' && r.key !== null),
    }));
  }

  // 3. Hand-overs Switchboard offered that this app has not acted on: one still on offer is not a row (it is taken at
  // the next read, or fails and becomes one; orchestrator 2026-10-24); one whose offer lapsed needs the person. One a
  // console or a record of this app names was taken here, however long Switchboard keeps offering it (R1-U3).
  for (const h of i.pending ?? []) {
    if (notOpened.has(h.id) || named.has(h.id) || consoleKeys.has(handoverOwnKey(h.id)) || h.offeredUntil > i.now) continue;
    add(row({
      id: handoverRowId(h.id), key: null, folder: h.dir, agent: h.agent, account: h.account || null, context: null, origin: 'handover',
      reason: 'expired', state: 'needs-you-not-opened', startedAt: null, endedAt: null,
    }));
  }

  // 4. Limit stops (decision 1 of 2026-10-24, amended after 0.8.0: FD-108). One Switchboard session is one row: its
  // latest stop, by time and then attempt (a session that stopped 44 times is one session). A stop older than a day is
  // not listed, whatever Switchboard still holds it as: this app never continues it, so nothing waits for it here. One
  // waiting for a reset, or ready for this app to continue, waits; a payment stop needs the person, with Remove; one whose
  // terminal is still open is not listed (the session is alive where it is), nor one whose session went on after it
  // (FIX-5: Switchboard keeps such a stop open); one whose folder or conversation is not
  // here, or that this app failed to continue, is Ended "Cannot be continued here", with Remove, and is not counted. One
  // another host claimed is not listed. A resumed one, or a failed one whose console still runs, is that console's row; a
  // declined one is its ended record (above).
  const latest = new Map<string, StopInput>();
  for (const s of i.stops) {
    const was = latest.get(s.session);
    if (!was || s.stoppedAt > was.stoppedAt || (s.stoppedAt === was.stoppedAt && s.attempt > was.attempt)) latest.set(s.session, s);
  }
  for (const s of latest.values()) {
    if (s.verdict === 'resumed' || s.verdict === 'claimed' || s.verdict === 'open' || s.verdict === 'old' || s.verdict === 'continued') continue;
    if (!(i.now - s.stoppedAt <= SESSION_KEEP_MS)) continue; // older than a day, or a time Switchboard did not give
    if (s.verdict === 'failed' && s.key && consoleKeys.has(s.key)) continue;
    // V-1 of FIX-2: a stop is "stopped by a limit on" the account it stopped on, never "continued after a limit reset".
    const common = { id: stopRowId(s.event), key: s.key ?? null, folder: s.dir, agent: s.provider === 'codex' ? 'codex' : 'claude-code', account: s.account ?? null, context: null, origin: 'limit' as const, startedAt: s.stoppedAt || null, endedAt: null };
    if (s.verdict === 'waiting' || s.verdict === 'resume') {
      const candidates = s.candidates ?? [];
      add(row({
        ...common, state: 'waiting-reset', reason: null, candidates, waitReason: s.waitReason ?? null,
        expectedAt: s.verdict === 'waiting' ? s.probeAt ?? null : null, // Switchboard's own probe time, never a guess (R1-S3)
        actions: actionsFor('waiting-reset', { continueNow: candidates.length > 0 }),
      }));
      continue;
    }
    if (s.verdict === 'billing') { add(row({ ...common, state: 'needs-you-not-opened', reason: 'billing', actions: ['dismiss'] })); continue; }
    add(row({ ...common, state: 'ended-cannot-continue', reason: s.verdict === 'failed' ? 'resume-failed' : s.verdict, actions: ['dismiss'] }));
  }

  // 5. Switchboard's sessions that are none of the above.
  for (const s of sb) {
    if (used.has(s)) continue;
    const running = s.state === 'running' || s.state === 'starting' || s.state === 'unknown';
    const started = s.launchedAt ?? s.startedAt;
    if (!running && !fresh(started, i.now)) continue; // ended more than a day ago, as far as can be told
    add(row({
      id: sbRowId(s), key: null, folder: s.folder, agent: s.agent,
      account: s.account || null, context: s.context, contextName: s.contextName, origin: s.continues ? 'handover' : 'switchboard', reason: null,
      // SB-201: only a Claude Code session has a Claude Code conversation to resume; a proxy launch rides `claude` too.
      state: running ? 'running-terminal' : 'ended', startedAt: started, endedAt: null, resumable: s.agent === 'claude-code',
    }));
  }

  return rows.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

export type SourceResult<T> = { ok: true; value: T } | { ok: false; reason: 'old' | 'error'; detail: string };

/** One source read on the background tick: never more than one call in flight (a poll while one runs joins it), the
 *  last good answer kept, and a failure reported as a degraded source, not as an empty list. */
export class SourceReader<T> {
  private inFlight: Promise<void> | null = null;
  private last: T | null = null;
  private failure: SourceDegraded | null = null;

  constructor(readonly source: SessionSource, private readonly read: () => Promise<SourceResult<T>>, private readonly now: () => number = Date.now) {}

  poll(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const p: Promise<void> = this.once().finally(() => { if (this.inFlight === p) this.inFlight = null; });
    this.inFlight = p;
    return p;
  }

  private async once(): Promise<void> {
    let r: SourceResult<T>;
    try { r = await this.read(); } catch (error) { r = { ok: false, reason: 'error', detail: String((error as Error)?.message ?? error).slice(0, 300) }; }
    if (r.ok) { this.last = r.value; this.failure = null; return; }
    // `since` is the first failure of a run of failures, so the window can say how long it has been out of date.
    this.failure = { source: this.source, reason: r.reason, detail: r.detail, since: this.failure?.since ?? this.now() };
  }

  get value(): T | null { return this.last; }
  get degraded(): SourceDegraded | null { return this.failure; }
}
// #endregion sessions-data
