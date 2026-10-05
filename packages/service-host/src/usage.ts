// #region usage-report — docs: packages/service-host/README.md#usage
// A service's own spend report (Fabric Agent Contract DEC-0021, service-usage.schema.json) and
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
}

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
  return null;
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
  return { ...out, models: ranked, budget: report.budget ?? null, generatedAt: report.generatedAt };
}
// #endregion usage-report
