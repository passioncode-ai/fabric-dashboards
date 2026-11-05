// #region ops-digest — docs: docs/RUNBOOK.md#log-digests
// FD-144 (ADR-0188 in Fabric, the operator's relay of 2026-11-04): the app reads its own log. Every line `main.log`
// takes is counted by operation and outcome in the hour it was written; each closed hour folds into one
// `ops.digest.hourly@1`, and each closed UTC day's hours into one `ops.digest.daily@1`. Pure arithmetic, no model.
// The shape and the folds follow Fabric's reference (`apps/desktop/src/shared/opsDigest.ts` at `e1eecec0`) until the
// contract's schema (CT-219) lands. Counts only: an operation is a name, never a path, an identifier or a detail.
import fs from 'node:fs';
import path from 'node:path';

export type DigestOutcome = 'ok' | 'failed' | 'unknown';
export interface OpCount { op: string; ok: number; failed: number; unknown: number }
export interface HourlyDigest {
  schema: 'ops.digest.hourly@1';
  /** The hour's start and end, ISO, end exclusive. */
  from: string;
  to: string;
  ops: OpCount[];
  total: { ok: number; failed: number; unknown: number };
  /** Operations whose failures rose past the threshold against the previous hour. */
  risen: Array<{ op: string; failed: number; previous: number }>;
}
export interface DailyDigest {
  schema: 'ops.digest.daily@1';
  /** The UTC day, YYYY-MM-DD. */
  day: string;
  /** How many hourly digests the day holds (24 when the app ran all day). */
  hours: number;
  ops: OpCount[];
  total: { ok: number; failed: number; unknown: number };
  risen: Array<{ op: string; hours: number; failed: number }>;
}

/** A failure count is a rise when it is at least this many in the hour and at least twice the previous hour's (a
 *  previous hour with none counts as one): ADR-0188's rule. */
export const RISE_MIN_FAILED = 10;
export const RISE_FACTOR = 2;
const HOUR_MS = 60 * 60_000;
/** Digest files older than this many months are removed when a new month's file is started. */
export const KEEP_MONTHS = 3;

export const hourStart = (at: number): number => Math.floor(at / HOUR_MS) * HOUR_MS;
export type HourCounts = Map<string, { ok: number; failed: number; unknown: number }>;

export function countInto(counts: HourCounts, op: string, outcome: DigestOutcome): void {
  const c = counts.get(op) ?? { ok: 0, failed: 0, unknown: 0 };
  c[outcome]++;
  counts.set(op, c);
}

const byName = (a: OpCount, b: OpCount): number => (a.op < b.op ? -1 : a.op > b.op ? 1 : 0);
const sumOf = (ops: OpCount[]) => ops.reduce((t, c) => ({ ok: t.ok + c.ok, failed: t.failed + c.failed, unknown: t.unknown + c.unknown }), { ok: 0, failed: 0, unknown: 0 });

export function foldHour(counts: HourCounts, from: number, previous: HourlyDigest | null): HourlyDigest {
  const ops = [...counts.entries()].map(([op, c]) => ({ op, ...c })).sort(byName);
  // The previous digest counts only when it is the hour just before; a gap (the app was closed) compares with nothing.
  const prevOf = new Map((previous && Date.parse(previous.to) === from ? previous.ops : []).map((c) => [c.op, c.failed]));
  const risen = ops
    .filter((c) => c.failed >= RISE_MIN_FAILED && c.failed >= RISE_FACTOR * Math.max(1, prevOf.get(c.op) ?? 0))
    .map((c) => ({ op: c.op, failed: c.failed, previous: prevOf.get(c.op) ?? 0 }));
  return { schema: 'ops.digest.hourly@1', from: new Date(from).toISOString(), to: new Date(from + HOUR_MS).toISOString(), ops, total: sumOf(ops), risen };
}

/** The day's hourly digests (those whose hour starts on that UTC day) folded into one; null for a day with no hours,
 *  which has no daily digest (OD-5 of the contract's DEC-0153, FD-153). */
export function foldDay(day: string, hourly: readonly HourlyDigest[]): DailyDigest | null {
  // An hour written twice (an older build after a crash) is folded once: its first line counts, as every reader's does.
  const seen = new Set<string>();
  const mine = hourly.filter((h) => h.from.slice(0, 10) === day && !seen.has(h.from) && seen.add(h.from));
  if (mine.length === 0) return null;
  const sum = new Map<string, OpCount>();
  const rose = new Map<string, { hours: number; failed: number }>();
  for (const h of mine) {
    for (const c of h.ops) {
      const s = sum.get(c.op) ?? { op: c.op, ok: 0, failed: 0, unknown: 0 };
      s.ok += c.ok; s.failed += c.failed; s.unknown += c.unknown;
      sum.set(c.op, s);
    }
    for (const r of h.risen) {
      const x = rose.get(r.op) ?? { hours: 0, failed: 0 };
      x.hours++; x.failed += r.failed;
      rose.set(r.op, x);
    }
  }
  const ops = [...sum.values()].sort(byName);
  const risen = [...rose.entries()].map(([op, x]) => ({ op, ...x })).sort((a, b) => b.failed - a.failed || (a.op < b.op ? -1 : 1));
  return { schema: 'ops.digest.daily@1', day, hours: mine.length, ops, total: sumOf(ops), risen };
}

/** The log's structured events (LC-12 `<op> <outcome>`, and the JSON lines `{"event","outcome"}`) whose operation
 *  this app names; prose lines are not counted rather than guessed at. */
const OPS = new Set(['update_check', 'update_download', 'update_install', 'update_restart', 'auto_update', 'estate_check', 'dock_hide', 'fabric_button', 'analytics.flush']);
// OD-3 (DEC-0153) lets a product publish its own map of outcomes (docs/RUNBOOK.md#log-digests, FD-153): ok when the
// operation did what it was asked; failed when it tried and could not; unknown for an answer of setup or policy (the
// app is not in Applications, the release needs a person, a restart refused while a console runs), so an unfinished
// setup never reads as a rise of failures.
// An outcome the map does not name is unknown, never ok (test/ops-digest.test.ts *FD-153* checks the code's against it).
export const OK_OUTCOMES = new Set(['available', 'current', 'done', 'installed', 'newer_while_ready', 'ok', 'ready', 'requested', 'restaged', 'started', 'resumed', 'confirmed', 'on', 'off', 'opened', 'recovered', 'sent', 'shipit_removed']);
export const UNKNOWN_OUTCOMES = new Set(['unsupported', 'needs_migration', 'refused', 'denied', 'skipped', 'held', 'misplaced', 'staging_lost']);
export const FAILED_OUTCOME = /fail|error|mismatch|timeout|^kept$|^dropped$/;
const outcomeOf = (w: string): DigestOutcome => (UNKNOWN_OUTCOMES.has(w) ? 'unknown' : FAILED_OUTCOME.test(w) ? 'failed' : OK_OUTCOMES.has(w) ? 'ok' : 'unknown');

/** One log line (without its timestamp) as an operation and an outcome, or null when it is not one this app counts. */
export function classify(line: string): { op: string; outcome: DigestOutcome } | null {
  if (/^(uncaught|unhandled):/.test(line)) return { op: 'crash', outcome: 'failed' };
  if (line.startsWith('{')) {
    try {
      const j = JSON.parse(line) as { event?: unknown; outcome?: unknown };
      if (typeof j.event === 'string' && OPS.has(j.event) && typeof j.outcome === 'string') return { op: j.event, outcome: outcomeOf(j.outcome) };
    } catch { /* not JSON */ }
    return null;
  }
  const alerts = /^alerts: (sent |[^ ]+ not delivered )/.exec(line);
  if (alerts) return { op: 'alerts', outcome: alerts[1]!.startsWith('sent') ? 'ok' : 'failed' };
  const names = /^agent_names read=\d+ failed=(\d+)/.exec(line);
  if (names) return { op: 'agent_names', outcome: names[1] === '0' ? 'ok' : 'failed' };
  const m = /^([a-z][a-z0-9_]*) ([a-z][a-z0-9_]*):?(?: |$)/.exec(line);
  if (!m || !OPS.has(m[1]!)) return null;
  return { op: m[1]!, outcome: outcomeOf(m[2]!) };
}

const monthOf = (iso: string) => iso.slice(0, 7);
const readLines = <T>(file: string): T[] => {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l) as T]; } catch { return []; } }); } catch { return []; }
};

/** Counts the log as it is written and writes the digests: `hourly-YYYY-MM.jsonl` and `daily-YYYY-MM.jsonl` in `dir`
 *  (0700, files 0600, appended). The open hour is kept in `open.json` across a quit, so a restart in the same hour
 *  neither loses nor doubles it. */
export class OpsDigester {
  private hour: number | null = null;
  private counts: HourCounts = new Map();
  private last: HourlyDigest | null = null;
  private checkedDay: string | null = null;

  constructor(private readonly dir: string, private readonly now: () => number = Date.now) {
    try {
      const open = JSON.parse(fs.readFileSync(path.join(dir, 'open.json'), 'utf8')) as { hour: number; ops: OpCount[] };
      this.hour = open.hour;
      for (const c of open.ops) this.counts.set(c.op, { ok: c.ok, failed: c.failed, unknown: c.unknown });
    } catch { /* none */ }
    const at = this.now();
    this.last = [...this.monthsBack(at).flatMap((iso) => readLines<HourlyDigest>(this.file('hourly', iso)))].at(-1) ?? null;
    // FD-153: after a crash `open.json` holds an hour the minute timer has already written; it is not written again.
    if (this.hour !== null && this.last && this.hour <= Date.parse(this.last.from)) { this.hour = null; this.counts = new Map(); }
  }

  /** This month and the one before, oldest first: where a day still to fold can be. */
  private monthsBack(at: number): string[] {
    const d = new Date(at);
    const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString();
    return [prev, d.toISOString()];
  }

  private file(kind: 'hourly' | 'daily', iso: string): string { return path.join(this.dir, `${kind}-${monthOf(iso)}.jsonl`); }

  private append(kind: 'hourly' | 'daily', iso: string, row: object): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const file = this.file(kind, iso);
    const fresh = !fs.existsSync(file);
    fs.appendFileSync(file, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    if (fresh) this.prune(iso);
  }

  private prune(iso: string): void {
    const [y, m] = monthOf(iso).split('-').map(Number) as [number, number];
    const oldest = (y * 12 + m - 1) - KEEP_MONTHS;
    for (const f of fs.readdirSync(this.dir)) {
      const mm = /^(hourly|daily)-(\d{4})-(\d{2})\.jsonl$/.exec(f);
      if (mm && Number(mm[2]) * 12 + Number(mm[3]) - 1 < oldest) fs.rmSync(path.join(this.dir, f), { force: true });
    }
  }

  /** One line the log took (without its timestamp), at the time it was written. */
  record(line: string, at = this.now()): void {
    const c = classify(line);
    if (!c) return;
    this.roll(at);
    countInto(this.counts, c.op, c.outcome);
  }

  /** Closes every hour that has ended and every UTC day that has ended; called on a timer and at quit. */
  roll(now = this.now()): void {
    const h = hourStart(now);
    // OD-1 (DEC-0153): an hour the app ran through is written even when nothing was counted, so the next hour
    // compares with zero; an hour it did not run is a gap and is not written.
    if (this.hour !== null && this.hour < h) {
      const d = foldHour(this.counts, this.hour, this.last);
      this.append('hourly', d.from, d);
      this.last = d;
      this.counts = new Map();
    }
    if (this.hour === null || this.hour < h) this.hour = h;
    // FD-153 (OD-5): once a UTC day, and at the first roll after a start, every closed day that has hours and no daily
    // digest is folded, so an app closed over midnight still writes the days it ran.
    const today = new Date(now).toISOString().slice(0, 10);
    if (this.checkedDay !== today) {
      this.checkedDay = today;
      this.foldClosedDays(now, today);
    }
  }

  private foldClosedDays(now: number, today: string): void {
    const months = this.monthsBack(now);
    const hourly = months.flatMap((iso) => readLines<HourlyDigest>(this.file('hourly', iso)));
    const done = new Set(months.flatMap((iso) => readLines<DailyDigest>(this.file('daily', iso))).map((d) => d.day));
    const days = [...new Set(hourly.map((h) => h.from.slice(0, 10)))].filter((d) => d < today && !done.has(d)).sort();
    for (const day of days) {
      const daily = foldDay(day, hourly);
      if (daily) this.append('daily', `${day}T00:00:00Z`, daily);
    }
  }

  /** At quit: the hours that ended are written, the open one is kept for the next start. */
  save(now = this.now()): void {
    this.roll(now);
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const ops = [...this.counts.entries()].map(([op, c]) => ({ op, ...c }));
    fs.writeFileSync(path.join(this.dir, 'open.json'), JSON.stringify({ hour: this.hour, ops }), { mode: 0o600 });
  }
}
// #endregion ops-digest
