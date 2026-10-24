// FD-101: the sums a host shows, read differentially against the contract's own `usageSpend` (DEC-0110). 20,000 cases
// from a seeded generator, so a failure names a case that comes back on every run. Each case is one to four agents,
// each with its own report; every window (today, the last 7 and the last 30 UTC days) of the sum across agents must
// equal `usageSpend` over all the agents' rows in that window, and each agent's own window over its own rows.
import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeUsage, type SpendSum, type UsageModel, type UsageReport } from '@passioncode-ai/fabric-service-host/usage';
import { sumSpend, type SpendEntry, type SpendWindow } from '../src/core/spend';
import { usageSpend, type UsageSpend } from './contract/usage-spend';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const CASES = 20_000;

/** mulberry32: a small seeded PRNG, so the cases are the same on every run and every machine. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Row = UsageModel & { date: string };
const ROUTES = ['subscription', 'key', 'platform-metered', undefined] as const;
const date = (daysBack: number) => new Date(NOW - daysBack * 86_400_000).toISOString().slice(0, 10);

/** One row FAC-SEM-025 admits: unknown cost exactly when every call of a row with calls is unpriced. */
function row(rand: () => number, i: number): Row {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const route = pick(ROUTES);
  const calls = rand() < 0.25 ? 0 : 1 + Math.floor(rand() * 5);
  const unpriced = calls === 0 ? 0 : pick([0, 0, calls, Math.floor(rand() * (calls + 1))]);
  const price = () => pick([0, 0.5, 1.25, Math.round(rand() * 1000) / 100, 1e-7]);
  const costUsd = calls > 0 && unpriced === calls ? null : calls === 0 ? (rand() < 0.5 ? null : price()) : price();
  return {
    date: pick([date(0), date(0), date(1), date(6), date(7), date(29), date(30)]),
    provider: 'p', model: `m${i}`, costBasis: 'price-list', ...(route ? { route } : {}),
    calls, unpricedCalls: unpriced, inputTokens: calls, outputTokens: calls, costUsd,
  };
}

/** A report whose days hold the rows; a day's totals are the sum of its rows (FAC-SEM-025). */
function report(rows: Row[]): UsageReport {
  const days = [...new Set(rows.map((r) => r.date))].sort().map((d) => {
    const byModel = rows.filter((r) => r.date === d).map(({ date: _date, ...m }) => m);
    const calls = byModel.reduce((n, m) => n + m.calls, 0);
    const unpricedCalls = byModel.reduce((n, m) => n + m.unpricedCalls, 0);
    const known = byModel.filter((m) => m.costUsd !== null);
    return { date: d, calls, unpricedCalls, inputTokens: calls, outputTokens: calls,
      costUsd: calls > 0 && unpricedCalls === calls ? null : known.reduce((n, m) => n + (m.costUsd as number), 0), byModel };
  });
  return { protocol: 'fabric-service/0.1', service: { id: 'a', instance: 'default' }, generatedAt: new Date(NOW).toISOString(), currency: 'USD', days };
}

const FROM: Record<SpendWindow, string> = { today: date(0), week: date(6), month: date(29) };
const inWindow = (rows: Row[], w: SpendWindow) => rows.filter((r) => r.date >= FROM[w] && r.date <= date(0)).map(({ date: _date, ...m }) => m);
const close = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));

/** What differs between the host's sum and the contract's, or null. A null money is "unknown", so the host's
 *  `partial` (some call carries no price) is true there; otherwise it is the contract's lower bound. */
function differs(got: SpendSum, want: UsageSpend): string | null {
  const wantPartial = want.moneyUsd === null ? true : want.moneyLowerBound;
  if (got.calls !== want.calls) return `calls ${got.calls} != ${want.calls}`;
  if (got.subscriptionCalls !== want.subscriptionCalls) return `subscriptionCalls ${got.subscriptionCalls} != ${want.subscriptionCalls}`;
  if (!close(got.costUsd, want.moneyUsd)) return `money ${got.costUsd} != ${want.moneyUsd}`;
  if (got.partial !== wantPartial) return `money lower bound ${got.partial} != ${wantPartial}`;
  if (!close(got.estimateUsd, want.estimateUsd)) return `estimate ${got.estimateUsd} != ${want.estimateUsd}`;
  if (got.estimatePartial !== want.estimateLowerBound) return `estimate lower bound ${got.estimatePartial} != ${want.estimateLowerBound}`;
  return null;
}

test(`FD-101: ${CASES} seeded cases: the sum across agents, and each agent's own, is the contract's usageSpend (DEC-0110)`, () => {
  const rand = prng(0xfd101);
  const failures: string[] = [];
  let failed = 0;
  for (let c = 0; c < CASES; c++) {
    const agents = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => Array.from({ length: Math.floor(rand() * 5) }, (_, i) => row(rand, i)));
    const entries: SpendEntry[] = agents.map((rows, i) => ({ key: `a${i}.default`, kind: 'report', summary: summarizeUsage(report(rows), NOW) }));
    for (const w of ['today', 'week', 'month'] as const) {
      const checks: [string, SpendSum, Row[]][] = [['across agents', sumSpend(entries, w), agents.flat()]];
      agents.forEach((rows, i) => checks.push([`agent ${i}`, (entries[i] as Extract<SpendEntry, { kind: 'report' }>).summary[w], rows]));
      for (const [who, got, rows] of checks) {
        const want = usageSpend(inWindow(rows, w));
        assert.ok(want, 'the generator makes only rows the contract admits');
        const why = differs(got, want);
        if (!why) continue;
        failed++;
        if (failures.length < 5) failures.push(`case ${c} ${w} ${who}: ${why}; rows ${JSON.stringify(agents)}`);
        break;
      }
    }
  }
  assert.equal(failed, 0, `${failed} windows differ from usageSpend; first ones:\n${failures.join('\n')}`);
});
