// A service's own spend report (contract DEC-0021): the host checks its shape and sums it for
// display, and an unknown cost never becomes a zero.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { checkUsage, rankLimits, summarizeUsage, type UsageReport } from '../src/usage';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../../test/fixtures/contract', name), 'utf8'));
const REPORT = (): UsageReport => fixture('positive_service-usage.json');
const ME = { id: 'example-agent', instance: 'default' };
const AT = (date: string) => Date.parse(`${date}T12:00:00Z`);

test('the contract\'s positive usage fixture passes the host check', () => {
  assert.equal(checkUsage(REPORT(), ME), null);
});

test('a report for another service, or in another currency, is refused', () => {
  assert.match(checkUsage(REPORT(), { id: 'example-agent', instance: 'preview' })!, /not example-agent.preview/);
  assert.match(checkUsage(fixture('negative_service-usage-not-usd.json'), ME)!, /not USD/);
});

test('the contract\'s negative fixtures that change a value the host reads are refused', () => {
  assert.match(checkUsage(fixture('negative_service-usage-negative-cost.json'), ME)!, /costUsd/);
  assert.match(checkUsage(fixture('negative_service-usage-bad-date.json'), ME)!, /date/);
});

test('a zero where every call is unpriced is refused: unknown is not $0', () => {
  const r = REPORT();
  r.days[1]!.byModel[1]!.costUsd = 0;
  assert.match(checkUsage(r, ME)!, /unpriced/);
});

test('days out of order, too many days, or more unpriced than calls are refused', () => {
  const r = REPORT();
  r.days.reverse();
  assert.match(checkUsage(r, ME)!, /run forward/);
  const many = REPORT();
  many.days = Array.from({ length: 32 }, (_, i) => ({ ...many.days[0]!, date: `2026-08-${String(i + 1).padStart(2, '0')}` }));
  assert.match(checkUsage(many, ME)!, /at most 31/);
  const rowless = REPORT();
  rowless.days[0]!.byModel = [];
  assert.match(checkUsage(rowless, ME)!, /names no model/);
  const over = REPORT();
  over.days[0]!.unpricedCalls = 99;
  assert.match(checkUsage(over, ME)!, /more unpriced/);
});

test('summing: today, the week and the month, with a lower bound where calls were unpriced', () => {
  const s = summarizeUsage(REPORT(), AT('2026-10-04'));
  assert.equal(s.today.calls, 5);
  assert.equal(s.today.costUsd, 0.31);
  assert.equal(s.today.partial, true, 'two of today\'s calls carry no price');
  assert.equal(s.week.calls, 19);
  assert.ok(Math.abs(s.week.costUsd! - 1.594) < 1e-9);
  assert.equal(s.week.partial, true);
  assert.equal(s.month.calls, 19);
  assert.deepEqual(s.budget, { period: 'month', limitUsd: 100, spentUsd: 1.594 });
});

test('a window with calls and no priced call stays unknown; a window with no calls is $0', () => {
  const r = REPORT();
  r.days = [r.days[1]!];
  r.days[0]!.byModel = [r.days[0]!.byModel[1]!];
  Object.assign(r.days[0]!, { calls: 2, unpricedCalls: 2, inputTokens: 10000, outputTokens: 1000, costUsd: null });
  const s = summarizeUsage(r, AT('2026-10-04'));
  assert.equal(s.today.costUsd, null);
  assert.equal(s.today.partial, true);
  const later = summarizeUsage(REPORT(), AT('2026-10-20'));
  assert.equal(later.today.calls, 0);
  assert.equal(later.today.costUsd, 0, 'nothing spent today');
  assert.equal(later.week.costUsd, 0);
  assert.equal(later.month.calls, 19, 'both days are inside the last 30');
});

test('models are summed over the last 30 days, the most expensive first and the unknown last', () => {
  const s = summarizeUsage(REPORT(), AT('2026-10-04'));
  assert.deepEqual(s.models.map((m) => m.model), ['claude-sonnet-5-5', 'google/gemini-3-flash', 'llama-4-8b']);
  assert.ok(Math.abs(s.models[0]!.costUsd! - 1.52) < 1e-9);
  assert.equal(s.models[0]!.calls, 15);
  assert.equal(s.models[2]!.costUsd, null);
});

test('a malformed budget is refused; an absent one is null in the summary', () => {
  const r = REPORT();
  r.budget = { period: 'month', limitUsd: 0, spentUsd: 1 };
  assert.match(checkUsage(r, ME)!, /budget/);
  const none = REPORT();
  delete none.budget;
  assert.equal(summarizeUsage(none, AT('2026-10-04')).budget, null);
});

test('D-2: calls with no cost are a lower bound even when unpricedCalls says 0; a cost without calls is kept', () => {
  const r = REPORT();
  r.days = [r.days[1]!];
  r.days[0]!.byModel = [{ ...r.days[0]!.byModel[0]!, calls: 5, unpricedCalls: 0, costUsd: null }];
  Object.assign(r.days[0]!, { calls: 5, unpricedCalls: 0, costUsd: null });
  const s = summarizeUsage(r, AT('2026-10-04'));
  assert.equal(s.today.costUsd, null);
  assert.equal(s.today.partial, true, 'five calls of unknown cost never read as complete');
  const fee = REPORT();
  fee.days = [fee.days[1]!];
  fee.days[0]!.byModel = [{ ...fee.days[0]!.byModel[0]!, calls: 0, unpricedCalls: 0, costUsd: 2 }];
  Object.assign(fee.days[0]!, { calls: 0, unpricedCalls: 0, costUsd: 2 });
  assert.equal(checkUsage(fee, ME), null);
  assert.equal(summarizeUsage(fee, AT('2026-10-04')).today.costUsd, 2, 'a cost reported without calls is not zeroed');
});

test('DEC-0027: budgets — the positive fixture reads, each negative names its problem, and a breach is shown, not refused', () => {
  const good = fixture('positive_service-usage-budgets.json');
  assert.equal(checkUsage(good, ME), null);
  assert.match(checkUsage(fixture('negative_service-usage-budgets-bad-scope.json'), ME)!, /scope is not machine, project, pool or job/);
  assert.match(checkUsage(fixture('negative_service-usage-budgets-unknown-field.json'), ME)!, /unknown field note/);
  assert.match(checkUsage(fixture('negative_service-usage-budgets-zero-limit.json'), ME)!, /limitUsd is not a positive amount/);
  const base = good.budgets as Record<string, unknown>[];
  const withOne = (patch: Record<string, unknown>, i = 0) => ({ ...good, budgets: base.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  assert.match(checkUsage({ ...good, budgets: [...base, base[0]] }, ME)!, /appears twice/);
  assert.match(checkUsage(withOne({ subject: undefined }, 2), ME)!, /without its subject/);
  assert.match(checkUsage(withOne({ subject: 'x' }), ME)!, /machine limit with a subject/);
  assert.match(checkUsage(withOne({ windowSeconds: 60 }), ME)!, /more than one window/);
  assert.match(checkUsage(withOne({ tripped: true, enforced: false }), ME)!, /stopped work but is not enforced/);
  assert.match(checkUsage(withOne({ spentUsd: 1 }, 3), ME)!, /per_job limit with a window or a spend/);
  assert.match(checkUsage(withOne({ period: undefined, windowSeconds: 3600 }, 0), ME)!, /monthly limit that does not count a month/);
  assert.match(checkUsage(withOne({ limitUsd: null }, 0), ME)!, /monthly limit without an amount/);
  assert.equal(checkUsage(withOne({ spentUsd: 150 }), ME), null, 'a breach is a truthful report');
  assert.equal(checkUsage(withOne({ kind: 'something_new', period: undefined }, 7), ME), null, 'an unknown kind is shown, never refused');
});

test('DEC-0027: limits read stopped work first, then breaches, then the closest; approval is a threshold, not a breach', () => {
  const ranked = rankLimits([
    { id: 'a.ok', scope: 'machine', kind: 'monthly', period: 'month', limitUsd: 100, spentUsd: 10, enforced: true },
    { id: 'b.off', scope: 'project', subject: 'p', kind: 'daily', period: 'day', limitUsd: 1, spentUsd: 5, enforced: false },
    { id: 'c.breach', scope: 'project', subject: 'p', kind: 'daily', period: 'day', limitUsd: 5, spentUsd: 6, enforced: true },
    { id: 'd.approval', scope: 'project', subject: 'p', kind: 'approval', limitUsd: 1, spentUsd: null, enforced: true },
    { id: 'e.tripped', scope: 'machine', kind: 'emergency', windowSeconds: 86400, limitUsd: 500, spentUsd: 501, enforced: true, tripped: true },
    { id: 'f.near', scope: 'pool', subject: 't', kind: 'pool', since: '2026-10-01T00:00:00Z', limitUsd: 10, spentUsd: 9, enforced: true },
    { id: 'g.unknown', scope: 'machine', kind: 'rate_card_review', limitUsd: 25, spentUsd: null, enforced: true },
    { id: 'h.per_job', scope: 'project', subject: 'p', kind: 'per_job', limitUsd: 2, spentUsd: null, enforced: true },
  ]);
  assert.deepEqual(ranked.map((l) => `${l.id}:${l.state}`), ['e.tripped:tripped', 'c.breach:breach', 'f.near:near', 'a.ok:ok', 'g.unknown:unknown', 'h.per_job:cap', 'd.approval:threshold', 'b.off:off']);
  assert.equal(ranked.find((l) => l.id === 'b.off')!.share, 5, 'a limit that is not enforced keeps its numbers and is still shown');
  const summary = summarizeUsage(fixture('positive_service-usage-budgets.json'), AT('2026-10-05'));
  assert.equal(summary.limits.length, 8, 'every limit of the report is kept');
  assert.equal(summarizeUsage(REPORT(), AT('2026-10-05')).limits.length, 0, 'a report without budgets has none');
});

test('DEC-0091 (CT-62): unmeasuredCalls makes the tokens a lower bound and never more than the calls', () => {
  const r: UsageReport = fixture('positive_service-usage-unmeasured.json');
  assert.equal(checkUsage(r, ME), null, 'the contract\'s positive fixture passes the host check');
  const s = summarizeUsage(r, AT('2026-10-04'));
  assert.equal(s.today.tokensPartial, true, 'one of today\'s calls has no full token count');
  assert.equal(s.week.tokensPartial, true);
  const local = s.models.find((m) => m.model === 'llama-4-8b')!;
  assert.equal(local.tokensPartial, true);
  assert.equal(s.models.find((m) => m.model === 'google/gemini-3-flash')!.tokensPartial, false, 'a model whose calls were all measured stays whole');
  assert.equal(summarizeUsage(r, AT('2026-10-03')).today.tokensPartial, false, 'a day without one stays whole');
  assert.equal(summarizeUsage(REPORT(), AT('2026-10-04')).today.tokensPartial, false, 'absent is 0');
  const over = fixture('positive_service-usage-unmeasured.json');
  over.days[1].byModel[1].unmeasuredCalls = 3;
  assert.match(checkUsage(over, ME)!, /unknown tokens than calls/);
  const fraction = fixture('positive_service-usage-unmeasured.json');
  fraction.days[1].unmeasuredCalls = 0.5;
  assert.match(checkUsage(fraction, ME)!, /unmeasuredCalls is not a count/);
});

test('FD-88: calls paid by a subscription spend no money; their list-price value is an estimate kept apart', () => {
  const totals = (calls: number, costUsd: number | null) => ({ calls, unpricedCalls: costUsd === null ? calls : 0, inputTokens: 10 * calls, outputTokens: calls, costUsd });
  const report = (rows: Record<string, unknown>[]): UsageReport => ({
    protocol: 'fabric-service/0.1', service: { ...ME }, generatedAt: '2026-10-22T12:00:00Z', currency: 'USD',
    days: [{ date: '2026-10-22', ...totals(rows.reduce((n, r) => n + (r.calls as number), 0), rows.reduce((n, r) => n + ((r.costUsd as number) ?? 0), 0)), byModel: rows }],
  } as unknown as UsageReport);
  const opus = { provider: 'anthropic', model: 'claude-opus-5-5', costBasis: 'price-list', ...totals(4, 140.47) };
  const r = report([{ ...opus, route: 'subscription' }, { ...opus, ...totals(2, 6.8), route: 'key' }]);
  assert.equal(checkUsage(r, ME), null);
  const s = summarizeUsage(r, AT('2026-10-22'));
  assert.deepEqual([s.today.costUsd, s.today.estimateUsd, s.today.calls, s.today.subscriptionCalls, s.today.partial], [6.8, 140.47, 6, 4, false]);
  assert.deepEqual(s.models.map((m) => [m.route, m.costUsd, m.estimateUsd]), [['key', 6.8, 0], ['subscription', 0, 140.47]], 'one model on two routes is two rows, money first');
  const only = summarizeUsage(report([{ ...opus, route: 'subscription' }]), AT('2026-10-22'));
  assert.deepEqual([only.month.costUsd, only.month.estimateUsd], [0, 140.47], 'a subscription alone spent no money: $0, not unknown');
  const unpriced = summarizeUsage(report([{ ...opus, ...totals(3, null), route: 'subscription' }]), AT('2026-10-22'));
  assert.deepEqual([unpriced.today.costUsd, unpriced.today.partial, unpriced.today.estimateUsd], [0, false, null], 'an unpriced subscription call makes no money unknown; its estimate is unknown (FD-97)');
  const unstated = summarizeUsage(report([{ ...opus }]), AT('2026-10-22'));
  assert.deepEqual([unstated.today.costUsd, unstated.today.estimateUsd], [140.47, 0], 'no route stated: counted as money, as before DEC-0046');
  assert.match(checkUsage(report([{ ...opus, route: 'gift' }]), ME)!, /route is not subscription, key or platform-metered/);
});

test('FD-97 (DEC-0110 usageSpend): a subscription\'s estimate is unknown when none of its calls is priced, and a lower bound when some are not', () => {
  const report = (rows: Record<string, unknown>[]): UsageReport => {
    const calls = rows.reduce((n, r) => n + (r.calls as number), 0);
    const unpriced = rows.reduce((n, r) => n + (r.unpricedCalls as number), 0);
    const priced = rows.filter((r) => r.costUsd !== null);
    return { protocol: 'fabric-service/0.1', service: { ...ME }, generatedAt: '2026-10-22T12:00:00Z', currency: 'USD',
      days: [{ date: '2026-10-22', calls, unpricedCalls: unpriced, inputTokens: 0, outputTokens: 0, costUsd: calls > 0 && unpriced === calls ? null : priced.reduce((n, r) => n + (r.costUsd as number), 0), byModel: rows }] } as unknown as UsageReport;
  };
  const row = (route: string | undefined, calls: number, costUsd: number | null, unpricedCalls = 0, model = 'm') => ({ provider: 'p', model, costBasis: 'price-list', ...(route ? { route } : {}), calls, unpricedCalls, inputTokens: 0, outputTokens: 0, costUsd });
  // Each case is one of the contract's (test/usage-rules.test.ts, usageSpend), read through the host's sums.
  const cases: [Record<string, unknown>[], number | null, boolean][] = [
    [[row('subscription', 300, 140.47), row('key', 40, 4.8, 0, 'k'), row('platform-metered', 2, 1, 0, 'pm'), row(undefined, 1, 1, 0, 'u')], 140.47, false],
    [[row('subscription', 5, 2)], 2, false],
    [[row('subscription', 3, null, 3)], null, false],
    [[row('subscription', 3, 1, 1)], 1, true],
    [[row('subscription', 0, 0), row('subscription', 3, null, 3, 'n')], null, false],
    [[], 0, false],
  ];
  for (const [rows, estimateUsd, estimatePartial] of cases) {
    const r = report(rows);
    assert.equal(checkUsage(r, ME), null, JSON.stringify(rows));
    const s = summarizeUsage(r, AT('2026-10-22'));
    assert.deepEqual([s.today.estimateUsd, s.today.estimatePartial], [estimateUsd, estimatePartial], JSON.stringify(rows));
  }
  const money = summarizeUsage(report([row('subscription', 300, 140.47), row('key', 40, 4.8, 0, 'k'), row('platform-metered', 2, 1, 0, 'pm'), row(undefined, 1, 1, 0, 'u')]), AT('2026-10-22'));
  assert.equal(money.today.costUsd, 6.8, 'money is every row off the subscription');
});

test('COPY-15 (FD-113): the per-model rows cover the same last 30 UTC days as the month, never the report\'s 31st day', () => {
  const r = REPORT();
  const day = r.days[0]!;
  const old = { ...day, date: '2026-09-04', byModel: [{ ...day.byModel[0]!, model: 'old-model' }] };
  const s = summarizeUsage({ ...r, days: [old, ...r.days] }, AT('2026-10-04'));
  assert.ok(!s.models.some((m) => m.model === 'old-model'), 'a model called only 31 days ago is outside the window');
  assert.equal(s.month.calls, s.models.reduce((n, m) => n + m.calls, 0), 'the rows add up to the month');
});
