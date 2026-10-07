// #region usage-report — docs: packages/service-host/README.md#usage
// A service's own spend report (Fabric Agent Contract DEC-0021 and DEC-0027's limits,
// service-usage.schema.json) and
// the sums a host shows: today, the last 7 and the last 30 UTC days, per model. An unknown cost
// stays unknown — a sum with an unpriced call is a lower bound, never a quiet zero. Pure: no Node
// import, so a renderer may import `@passioncode-ai/fabric-service-host/usage`.
import { PROTOCOL } from './protocol';

export interface UsageTotals {
  calls: number;
  unpricedCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** null: no call in this row could be priced. */
  costUsd: number | null;
}

export interface UsageModel extends UsageTotals {
  provider: string;
  model: string;
  costBasis: 'provider' | 'price-list' | 'mixed' | 'unknown';
}

export interface UsageDay extends UsageTotals {
  date: string; // YYYY-MM-DD, UTC
  byModel: UsageModel[];
}

export interface UsageReport {
  protocol: string;
  service: { id: string; instance: string };
  generatedAt: string;
  currency: 'USD';
  days: UsageDay[];
  budget?: { period: 'day' | 'month'; limitUsd: number; spentUsd: number | null };
  /** DEC-0027: every spending limit the service applies, enforced or not (at most 64). */
  budgets?: UsageLimit[];
}

/** One spending limit (DEC-0027, FAC-SEM-031). `kind` is an open vocabulary. */
export interface UsageLimit {
  id: string;
  scope: 'machine' | 'project' | 'pool' | 'job';
  subject?: string;
  kind: string;
  period?: 'day' | 'month';
  windowSeconds?: number;
  since?: string;
  /** null only for a relative limit (velocity, or an unknown kind). */
  limitUsd: number | null;
  /** null: unknown, never 0 — and always null for per_job and approval. */
  spentUsd: number | null;
  enforced: boolean;
  tripped?: boolean;
}

/** How a limit reads for a person: stopped work, over its line, close to it, fine, not countable,
 *  a cap on each order (nothing is spent against it), a threshold for approval (never a breach),
 *  or not enforced. */
export type LimitState = 'tripped' | 'breach' | 'near' | 'ok' | 'unknown' | 'cap' | 'threshold' | 'off';
export interface LimitView extends UsageLimit { state: LimitState; share: number | null }

/** A sum a person reads: the known cost, and whether it is only a lower bound. */
export interface SpendSum {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** The priced part; null when nothing in the window could be priced and there were calls. */
  costUsd: number | null;
  /** Some calls in the window carry no price: `costUsd` is at least this much. */
  partial: boolean;
}

export interface SpendSummary {
  today: SpendSum;
  week: SpendSum;
  month: SpendSum;
  /** Over the whole report (up to 31 days), most expensive first, unknown last. */
  models: (SpendSum & { provider: string; model: string })[];
  budget: UsageReport['budget'] | null;
  /** Every limit, what needs a person first (rankLimits); empty when the report lists none. */
  limits: LimitView[];
  generatedAt: string;
}

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const count = (x: unknown) => Number.isInteger(x) && (x as number) >= 0;
const money = (x: unknown) => x === null || (typeof x === 'number' && Number.isFinite(x) && x >= 0);

function totalsProblem(row: Record<string, unknown>, at: string): string | null {
  for (const f of ['calls', 'unpricedCalls', 'inputTokens', 'outputTokens'] as const) if (!count(row[f])) return `${at}.${f} is not a count`;
  for (const f of ['cacheReadTokens', 'cacheWriteTokens'] as const) if (row[f] !== undefined && !count(row[f])) return `${at}.${f} is not a count`;
  if (!money(row.costUsd)) return `${at}.costUsd is neither a non-negative number nor null`;
  if ((row.unpricedCalls as number) > (row.calls as number)) return `${at} has more unpriced calls than calls`;
  if ((row.calls as number) > 0 && row.unpricedCalls === row.calls && row.costUsd !== null) return `${at} prices calls that it says are unpriced`;
  return null;
}

/**
 * The first thing that makes this not a usage report of the expected service, or null. Checks the
 * shape a host relies on (DEC-0021); the full schema stays in the contract.
 */
export function checkUsage(value: unknown, expected: { id: string; instance: string }): string | null {
  const r = value as Partial<UsageReport> | null;
  if (!r || typeof r !== 'object') return 'the answer is not a JSON object';
  if (r.protocol !== PROTOCOL) return `protocol is ${JSON.stringify(r.protocol)}`;
  if (!r.service || r.service.id !== expected.id || r.service.instance !== expected.instance) return `the report is for ${r.service?.id}.${r.service?.instance}, not ${expected.id}.${expected.instance}`;
  if (r.currency !== 'USD') return `currency ${JSON.stringify(r.currency)} is not USD`;
  if (typeof r.generatedAt !== 'string') return 'generatedAt is missing';
  if (!Array.isArray(r.days) || r.days.length > 31) return 'days is not a list of at most 31';
  let previous = '';
  for (const [i, day] of r.days.entries()) {
    if (!day || typeof day !== 'object' || typeof day.date !== 'string' || !DATE.test(day.date)) return `days[${i}].date is not a date`;
    if (day.date <= previous) return `days[${i}] does not run forward`;
    previous = day.date;
    const p = totalsProblem(day as unknown as Record<string, unknown>, `days[${i}]`);
    if (p) return p;
    if (!Array.isArray(day.byModel) || day.byModel.length > 32) return `days[${i}].byModel is not a list of at most 32`;
    if (day.byModel.length === 0 && (day.calls > 0 || day.inputTokens > 0 || day.outputTokens > 0 || (day.costUsd ?? 0) > 0)) return `days[${i}] has totals but names no model`;
    for (const [j, m] of day.byModel.entries()) {
      if (!m || typeof m.provider !== 'string' || typeof m.model !== 'string') return `days[${i}].byModel[${j}] names no provider and model`;
      const q = totalsProblem(m as unknown as Record<string, unknown>, `days[${i}].byModel[${j}]`);
      if (q) return q;
    }
  }
  if (r.budget !== undefined) {
    const b = r.budget;
    if (!b || !['day', 'month'].includes(b.period) || typeof b.limitUsd !== 'number' || !(b.limitUsd > 0) || !money(b.spentUsd)) return 'budget is malformed';
  }
  if (r.budgets !== undefined) {
    const p = limitsProblem(r.budgets);
    if (p) return p;
  }
  return null;
}

const LIMIT_FIELDS = new Set(['id', 'scope', 'subject', 'kind', 'period', 'windowSeconds', 'since', 'limitUsd', 'spentUsd', 'enforced', 'tripped']);
const PER_ORDER = new Set(['per_job', 'approval']);
const KNOWN_KINDS = new Set(['per_job', 'approval', 'daily', 'monthly', 'velocity', 'pool', 'emergency']);

/** The first thing that makes `budgets` unreadable for a host (DEC-0027 schema and FAC-SEM-031), or
 *  null. An unknown kind is not a problem — a host shows it generically — and neither is a breach. */
export function limitsProblem(value: unknown): string | null {
  if (!Array.isArray(value) || value.length > 64) return 'budgets is not a list of at most 64';
  const seen = new Set<string>();
  for (const [i, raw] of value.entries()) {
    const at = `budgets[${i}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return `${at} is not an object`;
    const l = raw as Record<string, unknown>;
    for (const k of Object.keys(l)) if (!LIMIT_FIELDS.has(k)) return `${at} has an unknown field ${k}`;
    if (typeof l.id !== 'string' || !l.id || l.id.length > 128) return `${at}.id is missing`;
    if (seen.has(l.id)) return `${at}.id ${l.id} appears twice`;
    seen.add(l.id);
    if (!['machine', 'project', 'pool', 'job'].includes(String(l.scope))) return `${at}.scope is not machine, project, pool or job`;
    const named = l.scope === 'project' || l.scope === 'pool';
    if (named && (typeof l.subject !== 'string' || !l.subject)) return `${at} is a ${String(l.scope)} limit without its subject`;
    if (!named && l.subject !== undefined) return `${at} is a ${String(l.scope)} limit with a subject`;
    if (typeof l.kind !== 'string' || !l.kind || l.kind.length > 64) return `${at}.kind is missing`;
    const windows = (['period', 'windowSeconds', 'since'] as const).filter((f) => l[f] !== undefined);
    if (windows.length > 1) return `${at} has more than one window`;
    if (l.period !== undefined && l.period !== 'day' && l.period !== 'month') return `${at}.period is not day or month`;
    if (l.windowSeconds !== undefined && !(Number.isInteger(l.windowSeconds) && (l.windowSeconds as number) > 0)) return `${at}.windowSeconds is not a positive whole number`;
    if (l.since !== undefined && (typeof l.since !== 'string' || !Number.isFinite(Date.parse(l.since)))) return `${at}.since is not a time`;
    if (!(l.limitUsd === null || (typeof l.limitUsd === 'number' && Number.isFinite(l.limitUsd) && l.limitUsd > 0))) return `${at}.limitUsd is not a positive amount`;
    if (l.limitUsd === null && KNOWN_KINDS.has(l.kind) && l.kind !== 'velocity') return `${at} is a ${l.kind} limit without an amount`;
    if (!money(l.spentUsd)) return `${at}.spentUsd is neither a non-negative number nor null`;
    if (typeof l.enforced !== 'boolean') return `${at}.enforced is not true or false`;
    if (l.tripped !== undefined && typeof l.tripped !== 'boolean') return `${at}.tripped is not true or false`;
    if (l.tripped === true && l.enforced !== true) return `${at} stopped work but is not enforced`;
    if (PER_ORDER.has(l.kind) && (windows.length || l.spentUsd !== null)) return `${at} is a ${l.kind} limit with a window or a spend`;
    const seconds = typeof l.windowSeconds === 'number' ? l.windowSeconds : null;
    if (l.kind === 'daily' && !(l.period === 'day' || seconds === 86_400)) return `${at} is a daily limit that does not count a day`;
    if (l.kind === 'monthly' && !(l.period === 'month' || (seconds !== null && seconds >= 28 * 86_400 && seconds <= 31 * 86_400))) return `${at} is a monthly limit that does not count a month`;
    if (l.kind === 'velocity' && seconds === null) return `${at} is a velocity limit without windowSeconds`;
    if ((l.kind === 'pool' || l.kind === 'emergency') && !windows.length) return `${at} is a ${l.kind} limit without a window`;
  }
  return null;
}

const NEAR = 0.8;
const ORDER: Record<LimitState, number> = { tripped: 0, breach: 1, near: 2, ok: 3, unknown: 4, cap: 5, threshold: 6, off: 7 };

/** Every limit, as a person should read them: what stopped work, then breaches of enforced
 *  ceilings, then the closest to their line; approval thresholds and limits that are not enforced
 *  last. Crossing an approval threshold is never a breach (DEC-0027). */
export function rankLimits(budgets: UsageLimit[]): LimitView[] {
  const views = budgets.map((l): LimitView => {
    const share = l.spentUsd !== null && l.limitUsd !== null ? l.spentUsd / l.limitUsd : null;
    const state: LimitState = !l.enforced ? 'off'
      : l.tripped ? 'tripped'
      : l.kind === 'approval' ? 'threshold'
      : l.kind === 'per_job' ? 'cap'
      : share === null ? 'unknown'
      : share > 1 ? 'breach'
      : share >= NEAR ? 'near'
      : 'ok';
    return { ...l, state, share };
  });
  return views.sort((a, b) => ORDER[a.state] - ORDER[b.state] || (b.share ?? -1) - (a.share ?? -1) || a.id.localeCompare(b.id));
}

const empty = (): SpendSum => ({ calls: 0, inputTokens: 0, outputTokens: 0, costUsd: null, partial: false });

function add(sum: SpendSum, row: UsageTotals): void {
  sum.calls += row.calls;
  sum.inputTokens += row.inputTokens;
  sum.outputTokens += row.outputTokens;
  if (row.costUsd !== null) sum.costUsd = (sum.costUsd ?? 0) + row.costUsd;
  // A row with calls and no cost is unknown whatever its unpricedCalls says: a lower bound, never complete.
  if (row.unpricedCalls > 0 || (row.calls > 0 && row.costUsd === null)) sum.partial = true;
}

/** The UTC date `days` days before `now` (0 = today). */
function utcDate(now: number, daysBack: number): string {
  return new Date(now - daysBack * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Sums a checked report for display. A window with calls but no priced call has `costUsd: null`;
 * a window with no calls has `costUsd: 0`, because nothing was spent.
 */
export function summarizeUsage(report: UsageReport, now: number): SpendSummary {
  const today = utcDate(now, 0), weekFrom = utcDate(now, 6), monthFrom = utcDate(now, 29);
  const out = { today: empty(), week: empty(), month: empty() };
  const models = new Map<string, SpendSum & { provider: string; model: string }>();
  for (const day of report.days) {
    if (day.date === today) add(out.today, day);
    if (day.date >= weekFrom && day.date <= today) add(out.week, day);
    if (day.date >= monthFrom && day.date <= today) add(out.month, day);
    for (const m of day.byModel) {
      const k = `${m.provider}\u0000${m.model}`;
      const sum = models.get(k) ?? { ...empty(), provider: m.provider, model: m.model };
      add(sum, m);
      models.set(k, sum);
    }
  }
  // No calls and no cost: nothing was spent. A cost reported without calls is kept, never zeroed.
  for (const s of [out.today, out.week, out.month, ...models.values()]) if (s.calls === 0 && s.costUsd === null) s.costUsd = 0;
  const ranked = [...models.values()].sort((a, b) => (b.costUsd ?? -1) - (a.costUsd ?? -1) || b.calls - a.calls);
  return { ...out, models: ranked, budget: report.budget ?? null, limits: rankLimits(report.budgets ?? []), generatedAt: report.generatedAt };
}
// #endregion usage-report
