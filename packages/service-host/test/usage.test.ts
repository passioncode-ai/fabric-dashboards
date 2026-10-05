// A service's own spend report (contract DEC-0021): the host checks its shape and sums it for
// display, and an unknown cost never becomes a zero.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { checkUsage, summarizeUsage, type UsageReport } from '../src/usage';

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

test('models are summed over the report, the most expensive first and the unknown last', () => {
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
