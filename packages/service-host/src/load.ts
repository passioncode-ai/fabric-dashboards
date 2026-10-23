// #region load-report — docs: packages/service-host/README.md#load
// FD-93: how busy an agent is, as the service reports it (Fabric Agent Contract DEC-0104, docs/specification/agent-network.md
// §Load). The well-known document declares `{path, windowSeconds, limits}` under LOAD_EXTENSION (FAC-SEM-133: an invalid
// value is not declared, and is reported); the report at `path` is `service-load/1`, read with the descriptor token like
// the usage report, and checked by its schema and FAC-SEM-132 before anything of it is shown. Counts and durations only:
// no caller, prompt or job id ever reaches it. Pure: no Node import, so a renderer may import
// `@passioncode-ai/fabric-service-host/load`.

/** The `extensions` key of a service's load declaration (DEC-0104, protocol `fabric-load/0.1`). */
export const LOAD_EXTENSION = 'https://fabric.passioncode.ai/agent-contract/extensions/load/0.1';
export const LOAD_REPORT_TYPE = 'service-load/1';

/** The queue's own limits, per agentRef and context the service hosts. */
export interface LoadLimits { concurrency: number; perCaller: number; queueMax: number }
export interface LoadDeclaration { path: string; windowSeconds: number; limits: LoadLimits }

export interface LoadView {
  /** A valid declaration is present. */
  declared: boolean;
  /** The key is present and its value is invalid: not declared, and reported (FAC-SEM-133). */
  reported: boolean;
  declaration: LoadDeclaration | null;
  /** Why the value is invalid; a reader shows none of it then, and says so. */
  errors: string[];
}

export interface Percentiles { p50: number; p95: number }
export interface LoadRow { context: string; queued: number; running: number; completed: number; failed: number; waitMs?: Percentiles; runMs?: Percentiles }
export interface LoadWindow { start: string; byContext: LoadRow[] }
export interface LoadReport { type: typeof LOAD_REPORT_TYPE; generatedAt: string; windowSeconds: number; windows: LoadWindow[] }

export const LOAD_WINDOWS_MAX = 168;
export const LOAD_CONTEXTS_MAX = 64;
const CONTEXT = /^(?:personal|org:[A-Za-z0-9][A-Za-z0-9_-]{0,127})$/;
const ORIGIN_PATH = /^\/(?!\/)[^\s]*$/;
// The contract's strictTime (src/rfc3339.ts): `T` and an offset required, a day that exists, no leap second.
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;

/** An RFC 3339 time as epoch milliseconds, or NaN (the contract's strictTime). */
export function strictTime(value: unknown): number {
  const m = typeof value === 'string' ? RFC3339.exec(value) : null;
  if (!m) return Number.NaN;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return Number.NaN;
  return Date.parse(value as string);
}

function extra(at: string, v: Record<string, unknown>, allowed: readonly string[], out: string[]) {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) out.push(`${at} additionalProperties: ${k}`);
}

/** Every reason a load declaration is invalid (service-load-extension.schema.json, by hand). */
export function loadDeclarationErrors(v: unknown): string[] {
  if (!isPlain(v)) return ['/ type: must be object'];
  const out: string[] = [];
  extra('/', v, ['path', 'windowSeconds', 'limits'], out);
  if (typeof v.path !== 'string' || v.path.length > 256 || !ORIGIN_PATH.test(v.path)) out.push('/path: a path on the service origin (one leading slash, never two), at most 256 characters');
  if (!int(v.windowSeconds, 60, 86_400)) out.push('/windowSeconds: an integer from 60 to 86400');
  if (!isPlain(v.limits)) out.push('/limits: an object');
  else {
    extra('/limits', v.limits, ['concurrency', 'perCaller', 'queueMax'], out);
    if (!int(v.limits.concurrency, 1, 1024)) out.push('/limits/concurrency: an integer from 1 to 1024');
    if (!int(v.limits.perCaller, 1, 1024)) out.push('/limits/perCaller: an integer from 1 to 1024');
    if (!int(v.limits.queueMax, 0, 100_000)) out.push('/limits/queueMax: an integer from 0 to 100000');
  }
  return out;
}

/** The service's load declaration. Never throws; an invalid value declares nothing and is reported (FAC-SEM-133). */
export function loadOf(wellKnown: unknown): LoadView {
  const ext = isPlain(wellKnown) && isPlain(wellKnown.extensions) ? wellKnown.extensions : undefined;
  if (!ext || !Object.hasOwn(ext, LOAD_EXTENSION)) return { declared: false, reported: false, declaration: null, errors: [] };
  const value = ext[LOAD_EXTENSION];
  const errors = loadDeclarationErrors(value);
  if (errors.length) return { declared: false, reported: true, declaration: null, errors };
  const d = value as LoadDeclaration;
  return { declared: true, reported: false, declaration: { path: d.path, windowSeconds: d.windowSeconds, limits: { ...d.limits } }, errors: [] };
}

function percentiles(at: string, v: unknown, out: string[]) {
  if (v === undefined) return;
  if (!isPlain(v)) { out.push(`${at}: an object`); return; }
  extra(at, v, ['p50', 'p95'], out);
  if (!int(v.p50, 0)) out.push(`${at}/p50: a non-negative integer`);
  if (!int(v.p95, 0)) out.push(`${at}/p95: a non-negative integer`);
}

/** Every reason a report is not `service-load/1` (its schema by hand), then every FAC-SEM-132 finding. Empty: show it. */
export function loadReportProblems(v: unknown): string[] {
  if (!isPlain(v)) return ['/ type: must be object'];
  const out: string[] = [];
  extra('/', v, ['type', 'generatedAt', 'windowSeconds', 'windows'], out);
  if (v.type !== LOAD_REPORT_TYPE) out.push(`/type: ${LOAD_REPORT_TYPE}`);
  if (Number.isNaN(strictTime(v.generatedAt))) out.push('/generatedAt: an RFC 3339 time');
  if (!int(v.windowSeconds, 60, 86_400)) out.push('/windowSeconds: an integer from 60 to 86400');
  if (!Array.isArray(v.windows)) return [...out, '/windows: an array'];
  if (v.windows.length > LOAD_WINDOWS_MAX) out.push(`/windows: at most ${LOAD_WINDOWS_MAX}`);
  v.windows.forEach((w, i) => {
    const at = `/windows/${i}`;
    if (!isPlain(w)) { out.push(`${at}: an object`); return; }
    extra(at, w, ['start', 'byContext'], out);
    if (Number.isNaN(strictTime(w.start))) out.push(`${at}/start: an RFC 3339 time`);
    if (!Array.isArray(w.byContext)) { out.push(`${at}/byContext: an array`); return; }
    if (w.byContext.length > LOAD_CONTEXTS_MAX) out.push(`${at}/byContext: at most ${LOAD_CONTEXTS_MAX}`);
    w.byContext.forEach((r, j) => {
      const rat = `${at}/byContext/${j}`;
      if (!isPlain(r)) { out.push(`${rat}: an object`); return; }
      extra(rat, r, ['context', 'queued', 'running', 'completed', 'failed', 'waitMs', 'runMs'], out);
      if (typeof r.context !== 'string' || !CONTEXT.test(r.context)) out.push(`${rat}/context: personal or org:<orgId>`);
      for (const k of ['queued', 'running', 'completed', 'failed'] as const) if (!int(r[k], 0)) out.push(`${rat}/${k}: a non-negative integer`);
      percentiles(`${rat}/waitMs`, r.waitMs, out);
      percentiles(`${rat}/runMs`, r.runMs, out);
    });
  });
  return out.length ? out : semanticProblems(v as unknown as LoadReport);
}

/** FAC-SEM-132, as the contract's loadRule: windows in order one windowSeconds apart, none after generatedAt, each
 *  context once per window, p50 at most p95, a run time only where a job ended. */
function semanticProblems(r: LoadReport): string[] {
  const out: string[] = [];
  const step = r.windowSeconds * 1000;
  const generated = strictTime(r.generatedAt);
  let previous: number | undefined;
  r.windows.forEach((w, i) => {
    const start = strictTime(w.start);
    if (start > generated) out.push(`/windows/${i}/start: a window starts after the report was generated (FAC-SEM-132)`);
    if (previous !== undefined && start - previous !== step) out.push(`/windows/${i}/start: windows are not in order one windowSeconds apart (FAC-SEM-132)`);
    previous = start;
    const seen = new Set<string>();
    w.byContext.forEach((row, j) => {
      const at = `/windows/${i}/byContext/${j}`;
      if (seen.has(row.context)) out.push(`${at}/context: ${row.context} appears twice in one window (FAC-SEM-132)`);
      seen.add(row.context);
      for (const k of ['waitMs', 'runMs'] as const) { const p = row[k]; if (p && p.p50 > p.p95) out.push(`${at}/${k}: p50 is above p95 (FAC-SEM-132)`); }
      if (row.runMs && row.completed === 0 && row.failed === 0) out.push(`${at}/runMs: a run time with no job ended in the window (FAC-SEM-132)`);
    });
  });
  return out;
}

/** One context as a person reads it: the queue now, what ended in the last day, and the latest measured times. */
export interface LoadContextSummary {
  context: string;
  /** At the end of the latest window (the open one: at `generatedAt`); a context absent there is 0. */
  queued: number;
  running: number;
  /** Ended in the windows that started within a day of `generatedAt`. */
  completed: number;
  failed: number;
  /** The latest window that measured it; null when none in the report did. */
  wait: (Percentiles & { start: string }) | null;
  run: (Percentiles & { start: string }) | null;
}

export interface LoadSummary {
  generatedAt: string;
  windowSeconds: number;
  /** The report has no window at all: nothing has run yet, or the service only started. */
  empty: boolean;
  /** Every context, the sums of its rows: personal first, then organizations as written. */
  queued: number;
  running: number;
  completed: number;
  failed: number;
  contexts: LoadContextSummary[];
  /** The last windows, oldest first (at most 24), summed over contexts: what a small chart draws. */
  series: { start: string; queued: number; running: number; completed: number; failed: number }[];
  /** The report is older than two of its windows: its counts are of then, not now. */
  stale: boolean;
}

const DAY_MS = 86_400_000;
export const LOAD_SERIES_MAX = 24;

/** The sums a host shows of a report that passed `loadReportProblems`. */
export function summarizeLoad(r: LoadReport, now: number): LoadSummary {
  const generated = strictTime(r.generatedAt);
  const last = r.windows[r.windows.length - 1];
  const names: string[] = [];
  for (const w of r.windows) for (const row of w.byContext) if (!names.includes(row.context)) names.push(row.context);
  names.sort((a, b) => (a === 'personal' ? -1 : b === 'personal' ? 1 : 0));
  const contexts = names.map((context): LoadContextSummary => {
    const latest = last?.byContext.find((row) => row.context === context);
    let completed = 0; let failed = 0; let wait: LoadContextSummary['wait'] = null; let run: LoadContextSummary['run'] = null;
    for (const w of r.windows) {
      const row = w.byContext.find((x) => x.context === context);
      if (!row) continue;
      if (strictTime(w.start) > generated - DAY_MS) { completed += row.completed; failed += row.failed; }
      if (row.waitMs) wait = { ...row.waitMs, start: w.start };
      if (row.runMs) run = { ...row.runMs, start: w.start };
    }
    return { context, queued: latest?.queued ?? 0, running: latest?.running ?? 0, completed, failed, wait, run };
  });
  const sum = (k: 'queued' | 'running' | 'completed' | 'failed') => contexts.reduce((n, c) => n + c[k], 0);
  const series = r.windows.slice(-LOAD_SERIES_MAX).map((w) => ({
    start: w.start,
    queued: w.byContext.reduce((n, x) => n + x.queued, 0),
    running: w.byContext.reduce((n, x) => n + x.running, 0),
    completed: w.byContext.reduce((n, x) => n + x.completed, 0),
    failed: w.byContext.reduce((n, x) => n + x.failed, 0),
  }));
  return {
    generatedAt: r.generatedAt, windowSeconds: r.windowSeconds, empty: r.windows.length === 0,
    queued: sum('queued'), running: sum('running'), completed: sum('completed'), failed: sum('failed'),
    contexts, series, stale: now - generated > 2 * r.windowSeconds * 1000,
  };
}
// #endregion load-report
