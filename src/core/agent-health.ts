// #region agent-health — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-11-16-agent-health-reports-become-episodes-fd-285
// FD-285 (SB-393, contract DEC-0179 `agent-health/1` at fabric-agent-contract db0d8f15): Fabric Dashboards is the one
// observer per machine. A product answers one report of what is wrong with it now (HL-1); this module reads it as the
// contract's reference code does (`worstState`, `readHealth`, `episodeKey`, src/agent-health.ts there; its vectors are
// test/fixtures/contract/vectors_agent-health.json) and holds episodes the way the agents base's `alert-episodes`
// pattern does (`agent_health.py` 1.2.0): two bad readings in a row open one, two good close it, one message on opening
// and one on closing, keyed `<product>:<check id>@<UTC day of the opening report>` (HL-6). A report nobody can read is
// one episode for the product (`blind`), never one per check, and leaves every check where it was (HL-5). The state
// lives inside `outage-alerts.json` beside FD-48's episodes, so it reaches the operator through the same channel.
import { PERSONAL_SIDE, type AlertMessage } from './outage-alerts';

export const HEALTH_SCHEMA = 'agent-health/1';
export type HealthState = 'ok' | 'unknown' | 'warn' | 'fail';
/** HL-2: best first. */
export const HEALTH_STATES: readonly HealthState[] = ['ok', 'unknown', 'warn', 'fail'];
export const HEALTH_AREAS = ['lifecycle', 'sessions', 'accounts', 'crash', 'errors', 'update', 'environment', 'security', 'connection'] as const;
/** How often a product's report is read (DEC-0179 AH-3, the backlog row: every 5 minutes). */
export const HEALTH_POLL_MS = 5 * 60_000;
/** Readings in a row that open and close an episode (`alert-episodes` defaults). */
export const HEALTH_OPEN_AFTER = 2;
export const HEALTH_CLOSE_AFTER = 2;
/** The cause of a report nobody can read: one per product. */
export const BLIND = 'blind';

export type HealthFix = { tool: string } | { capability: string };
export interface HealthCheck { id: string; area: string; state: HealthState; count: number; fix?: HealthFix | null }
export interface HealthReport { schema: string; product: string; version: string; at: number; state: HealthState; checks: HealthCheck[] }
export type HealthReason = 'no-answer' | 'schema' | 'FAC-SEM-181' | 'other-product';
export interface HealthRead { state: HealthState; reason?: HealthReason }

const MAX_AT = 253402300799; // 9999-12-31T23:59:59Z
const SLUG = /^[a-z][a-z0-9-]{1,62}$/;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const CHECK_ID = /^[a-z][a-z0-9_]{0,63}$/;
const TOOL = /^[A-Za-z0-9_.-]{1,128}$/;
const CAPABILITY = /^[a-z][a-z0-9._-]{1,127}$/;

// FAC-SEM-181's detectors, ported from the contract's src/secret-shape.ts (`secretValue`) and src/activity-rules.ts
// (`HOME_PATH`) at db0d8f15, as written there.
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*/;
const SECRET_VALUE = /(^[Bb][Ee][Aa][Rr][Ee][Rr]\s.+|(?:^|[^A-Za-z0-9]|%[0-9A-Fa-f]{2}|\\[nrt"']|\\u[0-9A-Fa-f]{4}|\\x[0-9A-Fa-f]{2}|\\[bfv0ae]|\\[0-7]{1,3}|%25[0-9A-Fa-f]{2}|\x1b\[[0-9;:]*m|(?:\\u001[bB]|\\x1[bB]|\\e|\\033|\\33)\[[0-9;:]*m)(?:sk-(?=[A-Za-z0-9_-]{0,255}?\d)(?:(?=[A-Za-z0-9_-]{0,255}?[A-Z])[A-Za-z0-9_-]{16,}|[A-Za-z0-9_-]{32,})|gh[pousr]_[A-Za-z0-9]{20,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|glpat-[A-Za-z0-9_-]{20,}))/;
const LONG_RUN = /[A-Za-z0-9+/=_-]{40,}/g;
const longSecret = (v: string) => (v.match(LONG_RUN) ?? []).some((r) => /[a-z]/.test(r) && /[A-Z]/.test(r) && /[0-9]/.test(r));
const SLASH = String.raw`(?:[\/\\]|%(?:25)?2[fF])`;
const HOME_PATH: readonly RegExp[] = [
  new RegExp(String.raw`(?:^|[^A-Za-z0-9]|%(?:25)?2[fF])(?:[Uu]sers|home)${SLASH}[A-Za-z0-9_]`),
  /(?:^|[^A-Za-z0-9])-(?:[Uu]sers|home)-[A-Za-z0-9]/,
  /(?:^|[\s"'=\/\\])~(?:[A-Za-z_][A-Za-z0-9_.-]*)?(?:[\/\\]|$)/,
];
const hidden = (v: unknown) => typeof v === 'string' && (JWT_SHAPE.test(v) || SECRET_VALUE.test(v) || longSecret(v) || HOME_PATH.some((p) => p.test(v)));

/** HL-2: the worst of `states` in the order ok < unknown < warn < fail; `unknown` for none, or when one is no state. */
export function worstState(states: readonly unknown[]): HealthState {
  let worst = -1;
  for (const s of states) {
    const i = HEALTH_STATES.indexOf(s as HealthState);
    if (typeof s !== 'string' || i < 0) return 'unknown';
    worst = Math.max(worst, i);
  }
  return worst >= 0 ? HEALTH_STATES[worst]! : 'unknown';
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, high: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= high;
const keysAre = (o: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) =>
  required.every((k) => Object.hasOwn(o, k)) && Object.keys(o).every((k) => required.includes(k) || optional.includes(k));

function fixOk(fix: unknown): boolean {
  if (fix === null) return true;
  if (!isObject(fix) || Object.keys(fix).length !== 1) return false;
  return (typeof fix.tool === 'string' && TOOL.test(fix.tool)) || (typeof fix.capability === 'string' && CAPABILITY.test(fix.capability));
}

/** schemas/agent-health.schema.json at db0d8f15: every object closed (HL-1). */
function schemaOk(a: unknown): a is HealthReport {
  if (!isObject(a) || !keysAre(a, ['schema', 'product', 'version', 'at', 'state', 'checks'])) return false;
  if (a.schema !== HEALTH_SCHEMA || typeof a.product !== 'string' || !SLUG.test(a.product) || typeof a.version !== 'string' || !SEMVER.test(a.version)) return false;
  if (!integer(a.at, MAX_AT) || !HEALTH_STATES.includes(a.state as HealthState) || !Array.isArray(a.checks) || a.checks.length > 256) return false;
  return a.checks.every((c) => isObject(c) && keysAre(c, ['id', 'area', 'state', 'count'], ['fix'])
    && typeof c.id === 'string' && CHECK_ID.test(c.id) && (HEALTH_AREAS as readonly unknown[]).includes(c.area)
    && HEALTH_STATES.includes(c.state as HealthState) && integer(c.count, Number.MAX_SAFE_INTEGER) && (!('fix' in c) || fixOk(c.fix)));
}

/** FAC-SEM-181 over a report valid by the schema: true when it finds anything. */
function facSem181(a: HealthReport): boolean {
  if (hidden(a.product)) return true;
  const ids = new Set<string>();
  for (const c of a.checks) {
    if (ids.has(c.id) || hidden(c.id)) return true;
    ids.add(c.id);
    if (isObject(c.fix) && Object.values(c.fix).some(hidden)) return true;
  }
  return a.state !== worstState(a.checks.map((c) => c.state));
}

/** HL-5: the report's state when it is valid by the schema and passes FAC-SEM-181, else unknown with the reason;
 *  `null` or `undefined` stand for no answer. */
export function readHealth(answer: unknown): HealthRead {
  if (answer === null || answer === undefined) return { state: 'unknown', reason: 'no-answer' };
  if (!schemaOk(answer)) return { state: 'unknown', reason: 'schema' };
  if (facSem181(answer)) return { state: 'unknown', reason: 'FAC-SEM-181' };
  return { state: answer.state };
}

/** HL-6: `<product>:<check id>@<YYYY-MM-DD>`, the UTC day of `at` (whole Unix seconds). */
export function episodeKey(product: string, checkId: string, at: number): string {
  return `${product}:${checkId}@${new Date(at * 1000).toISOString().slice(0, 10)}`;
}

/** What a product's command printed: the report, unwrapped from Switchboard's `{data, ok}` envelope; `null` when it is
 *  no JSON or the envelope says it failed. */
export function healthAnswerOf(stdout: string): unknown {
  let parsed: unknown;
  try { parsed = JSON.parse(stdout); } catch { return null; }
  if (isObject(parsed) && 'ok' in parsed && 'data' in parsed && Object.keys(parsed).length === 2) return parsed.ok === true ? parsed.data : null;
  return parsed;
}

export interface HealthEpisode {
  /** HL-6, also the message id's root. */
  key: string;
  openedAt: number;
  state: HealthState;
  area?: string;
  count?: number;
  fix?: string;
  reason?: HealthReason;
  closedAt?: number;
  failureDelivered?: boolean;
  recoveryDelivered?: boolean;
}
export interface HealthCause { bad: number; good: number; episode?: HealthEpisode }
export interface ProductHealth {
  /** When it was last read (ms) and what the reader counted. */
  readAt: number;
  read: HealthRead;
  version?: string;
  at?: number;
  /** The last trusted report's checks, counts and codes only (DEC-0157). */
  checks?: HealthCheck[];
  /** By check id, and `blind` for the report itself. */
  causes: Record<string, HealthCause>;
}
export type HealthBook = Record<string, ProductHealth>;

const fixName = (fix: HealthFix | null | undefined) => (!fix ? undefined : 'tool' in fix ? `tool ${fix.tool}` : `capability ${fix.capability}`);
const seconds = (ms: number) => Math.floor(ms / 1000);

/** One reading in a cause's streaks: `bad` (warn or fail, the pattern's default), `good` (ok), or `unknown`, which is
 *  never good and keeps a bad streak where it was. */
function step(cause: HealthCause, verdict: 'bad' | 'good' | 'unknown', now: number, open: () => HealthEpisode, update: (e: HealthEpisode) => HealthEpisode): HealthCause {
  const ep = cause.episode && cause.episode.closedAt === undefined ? cause.episode : undefined;
  if (verdict === 'unknown') return { ...cause, good: 0 };
  if (verdict === 'bad') {
    const bad = cause.bad + 1;
    if (ep) return { bad, good: 0, episode: update(ep) };
    // a closed episode still owing its recovery is replaced only once that message is out
    if (bad >= HEALTH_OPEN_AFTER && !(cause.episode && cause.episode.failureDelivered && !cause.episode.recoveryDelivered)) return { bad, good: 0, episode: open() };
    return { ...cause, bad, good: 0 };
  }
  const good = cause.good + 1;
  if (ep && good >= HEALTH_CLOSE_AFTER) {
    // nothing was said of an episode the channel never carried: it closes silently
    return ep.failureDelivered ? { bad: 0, good, episode: { ...ep, closedAt: now } } : { bad: 0, good };
  }
  return { ...cause, bad: 0, good };
}

/** One reading of one product (`answer` null: no answer), at `now` (ms). */
export function observeHealth(book: HealthBook, product: string, answer: unknown, now: number): HealthBook {
  let read = readHealth(answer);
  if (!read.reason && (answer as HealthReport).product !== product) read = { state: 'unknown', reason: 'other-product' };
  const prev = book[product];
  const causes: Record<string, HealthCause> = { ...(prev?.causes ?? {}) };
  const cause = (id: string) => causes[id] ?? { bad: 0, good: 0 };
  if (read.reason) {
    const blind = cause(BLIND);
    causes[BLIND] = step(blind, 'bad', now,
      () => ({ key: episodeKey(product, BLIND, seconds(now)), openedAt: now, state: 'unknown', reason: read.reason }),
      (e) => ({ ...e, reason: read.reason }));
    for (const id of Object.keys(causes)) if (id !== BLIND) causes[id] = step(causes[id]!, 'unknown', now, () => causes[id]!.episode!, (e) => e);
    return { ...book, [product]: { ...(prev ?? {}), readAt: now, read, causes } };
  }
  const report = answer as HealthReport;
  causes[BLIND] = step(cause(BLIND), 'good', now, () => cause(BLIND).episode!, (e) => e);
  const seen = new Set<string>([BLIND]);
  for (const c of report.checks) {
    seen.add(c.id);
    const verdict = c.state === 'ok' ? 'good' : c.state === 'unknown' ? 'unknown' : 'bad';
    const shape = { state: c.state, area: c.area, count: c.count, ...(fixName(c.fix) ? { fix: fixName(c.fix) } : {}) };
    causes[c.id] = step(cause(c.id), verdict, now, () => ({ key: episodeKey(product, c.id, report.at), openedAt: now, ...shape }), (e) => ({ ...e, ...shape }));
  }
  // a check missing from the report is unmeasured, never healed
  for (const id of Object.keys(causes)) if (!seen.has(id)) causes[id] = step(causes[id]!, 'unknown', now, () => causes[id]!.episode!, (e) => e);
  // a cause with nothing open, owed or bad is forgotten
  for (const [id, c] of Object.entries(causes)) if (!c.episode && c.bad === 0 && !seen.has(id)) delete causes[id];
  return { ...book, [product]: { readAt: now, read, version: report.version, at: report.at, checks: report.checks.map((c) => ({ ...c })), causes } };
}

export interface HealthWords {
  /** `{name}: {check} is {state}`. */
  open: (name: string, check: string, state: string) => string;
  back: (name: string, check: string) => string;
  /** The report itself could not be read. */
  blind: (name: string, reason: string) => string;
  blindBack: (name: string) => string;
  detail: (area: string, count: number, fix?: string) => string;
}

/** What the book owes the channel, oldest first: one message when an episode opens, one when it closes. Ids and
 *  counts only, never a label or free text (DEC-0157); the operator's own channel (FD-269: Switchboard is his). */
export function owedHealth(book: HealthBook, words: HealthWords, nameOf: (product: string) => string, allowed: (product: string) => boolean): { id: string; step: 'failure' | 'recovery'; msg: AlertMessage }[] {
  const out: { id: string; step: 'failure' | 'recovery'; msg: AlertMessage; at: number }[] = [];
  for (const [product, p] of Object.entries(book)) {
    if (!allowed(product)) continue;
    const name = nameOf(product);
    for (const [check, c] of Object.entries(p.causes)) {
      const e = c.episode;
      if (!e) continue;
      const id = `${product}|${check}`;
      const base = { serviceKey: product, side: PERSONAL_SIDE, eventId: `health:${e.key}` };
      if (!e.failureDelivered) {
        if (e.closedAt !== undefined) continue;
        const subject = check === BLIND ? words.blind(name, e.reason ?? 'no-answer') : words.open(name, check, e.state);
        const text = check === BLIND ? subject : words.detail(e.area ?? '?', e.count ?? 0, e.fix);
        out.push({ id, step: 'failure', at: e.openedAt, msg: { ...base, kind: 'failure', subject, text } });
      } else if (e.closedAt !== undefined && !e.recoveryDelivered) {
        const subject = check === BLIND ? words.blindBack(name) : words.back(name, check);
        out.push({ id, step: 'recovery', at: e.closedAt, msg: { ...base, eventId: `${base.eventId}:back`, kind: 'recovery', subject, text: subject } });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at).map(({ at: _at, ...d }) => d);
}

/** The channel answered: record it; an episode closed and told is forgotten. */
export function healthDelivered(book: HealthBook, id: string, stepName: 'failure' | 'recovery'): HealthBook {
  const sep = id.indexOf('|');
  const product = id.slice(0, sep);
  const check = id.slice(sep + 1);
  const p = book[product];
  const c = p?.causes[check];
  if (!p || !c?.episode) return book;
  const episode = { ...c.episode, ...(stepName === 'failure' ? { failureDelivered: true } : { recoveryDelivered: true }) };
  const next: HealthCause = episode.recoveryDelivered ? { bad: c.bad, good: c.good } : { ...c, episode };
  return { ...book, [product]: { ...p, causes: { ...p.causes, [check]: next } } };
}
// #endregion agent-health

// #region agent-health-products — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-11-16-agent-health-reports-become-episodes-fd-285
/** FD-285 wave 1: the products whose report the app reads, and how. Wave 2 reads the paths the agents declare
 *  (CT-337) instead of this list. */
export interface HealthProduct { product: string; name: string; argv: readonly string[] }
export const HEALTH_PRODUCTS: readonly HealthProduct[] = [
  { product: 'fabric-switchboard', name: 'Switchboard', argv: ['--json', 'health'] },
];

/** A program too old to have the command: not a broken report, the product simply offers none yet. */
export function healthCommandMissing(code: number | null, output: string): boolean {
  return code !== 0 && /unknown command|unrecognized (?:subcommand|command)|invalid choice|no such command|unexpected argument/i.test(output);
}
// #endregion agent-health-products
