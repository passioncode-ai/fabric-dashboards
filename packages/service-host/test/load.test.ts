// FD-93: a service's load (contract DEC-0104): the declaration under the load key (FAC-SEM-133), the report's schema and
// FAC-SEM-132, each run on the contract's own fixtures, and the sums a host shows.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { LOAD_EXTENSION, loadOf, loadReportProblems, summarizeLoad, type LoadReport } from '../src/load';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/contract');
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8')) as Record<string, unknown>;
const doc = (value: unknown) => ({ extensions: { [LOAD_EXTENSION]: value } });

test('DEC-0104 (FAC-SEM-133): the contract\'s positive declaration reads; its negatives declare nothing and are reported', () => {
  const ok = loadOf(doc(fixture('positive_service-load-extension')));
  assert.deepEqual(ok, { declared: true, reported: false, declaration: { path: '/fabric/v1/load', windowSeconds: 3600, limits: { concurrency: 4, perCaller: 2, queueMax: 50 } }, errors: [] });
  for (const name of ['negative_service-load-extension-absolute-path', 'negative_service-load-extension-network-path', 'negative_service-load-extension-no-concurrency']) {
    const v = loadOf(doc(fixture(name)));
    assert.equal(v.declared, false, name);
    assert.equal(v.reported, true, name);
    assert.ok(v.errors.length > 0, name);
  }
});

test('DEC-0104 (FAC-SEM-133): the semantic well-known fixtures: valid is declared, invalid is reported', () => {
  const good = fixture('semantic_service-well-known-load-ok');
  assert.deepEqual(good.expect, []);
  assert.equal(loadOf(good.input).declared, true);
  const bad = fixture('semantic_service-well-known-load-invalid');
  assert.deepEqual(bad.expect, ['FAC-SEM-133']);
  const v = loadOf(bad.input);
  assert.equal(v.declared, false);
  assert.equal(v.reported, true);
  for (const want of ['/path', '/windowSeconds', '/limits/concurrency']) assert.ok(v.errors.some((e) => e.startsWith(want)), want);
});

test('FD-93: absent is not declared; anything not a document is not declared either', () => {
  assert.deepEqual(loadOf({ extensions: {} }), { declared: false, reported: false, declaration: null, errors: [] });
  assert.deepEqual(loadOf(null).declared, false);
  assert.equal(loadOf({ extensions: { constructor: 1 } }).declared, false);
  assert.ok(loadOf(doc({ path: '/x', windowSeconds: 60, limits: { concurrency: 1, perCaller: 1, queueMax: 0 }, more: 1 })).errors.some((e) => e.includes('additionalProperties: more')));
});

test('DEC-0104: the contract\'s positive report passes; its negatives fail the schema', () => {
  assert.deepEqual(loadReportProblems(fixture('positive_service-load')), []);
  assert.ok(loadReportProblems(fixture('negative_service-load-caller')).some((e) => e.includes('additionalProperties: caller')), 'a caller is never in a report');
  assert.ok(loadReportProblems(fixture('negative_service-load-negative-count')).some((e) => e.includes('a non-negative integer')));
});

test('DEC-0104 (FAC-SEM-132): every semantic report fixture is judged as the contract judges it', () => {
  const names = fs.readdirSync(FIXTURES).filter((f) => f.startsWith('semantic_service-load-')).map((f) => f.slice(0, -5));
  assert.ok(names.length >= 6);
  for (const name of names) {
    const f = fixture(name);
    const problems = loadReportProblems(f.input);
    const expected = f.expect as string[];
    if (expected.length === 0) assert.deepEqual(problems, [], name);
    else assert.ok(problems.length > 0 && problems.every((p) => p.includes('FAC-SEM-132')), `${name}: ${problems.join('; ')}`);
  }
});

test('FD-93: the sums: the queue now from the latest window, what ended in a day, the latest measured times', () => {
  const r = fixture('positive_service-load') as unknown as LoadReport;
  const s = summarizeLoad(r, Date.parse('2026-10-22T11:06:00Z'));
  assert.equal(s.empty, false);
  assert.equal(s.stale, false);
  assert.deepEqual(s.contexts.map((c) => c.context), ['personal', 'org:org_7kq2m4xw']);
  const personal = s.contexts[0]!;
  const last = r.windows[r.windows.length - 1]!;
  const lastPersonal = last.byContext.find((x) => x.context === 'personal')!;
  assert.equal(personal.queued, lastPersonal.queued);
  assert.equal(personal.running, lastPersonal.running);
  assert.equal(personal.completed, r.windows.reduce((n, w) => n + (w.byContext.find((x) => x.context === 'personal')?.completed ?? 0), 0));
  assert.deepEqual(personal.wait && { p50: personal.wait.p50, p95: personal.wait.p95 }, { p50: 40, p95: 900 });
  // A context absent from the latest window has nothing queued or running there.
  const org = s.contexts[1]!;
  assert.equal(org.queued, last.byContext.find((x) => x.context === org.context)?.queued ?? 0);
  assert.equal(s.queued, s.contexts.reduce((n, c) => n + c.queued, 0));
  assert.equal(s.series.length, r.windows.length);
  // Older than two windows: the counts are of then.
  assert.equal(summarizeLoad(r, Date.parse('2026-10-22T14:00:00Z')).stale, true);
});

test('FD-93: a report with no window is empty, not zero work hidden', () => {
  const s = summarizeLoad({ type: 'service-load/1', generatedAt: '2026-10-22T11:00:00Z', windowSeconds: 3600, windows: [] }, Date.parse('2026-10-22T11:00:30Z'));
  assert.equal(s.empty, true);
  assert.deepEqual(s.contexts, []);
  assert.deepEqual(loadReportProblems({ type: 'service-load/1', generatedAt: '2026-10-22T11:00:00Z', windowSeconds: 3600, windows: [] }), []);
});

test('FD-93: a day of windows counts every window any part of which lies in that day; the series keeps the last 24', () => {
  const windows = Array.from({ length: 30 }, (_, i) => ({ start: new Date(Date.parse('2026-10-21T00:00:00Z') + i * 3_600_000).toISOString().replace('.000', ''), byContext: [{ context: 'personal', queued: 0, running: 0, completed: 1, failed: 0 }] }));
  const r: LoadReport = { type: 'service-load/1', generatedAt: windows[29]!.start.replace(':00:00Z', ':30:00Z'), windowSeconds: 3600, windows };
  assert.deepEqual(loadReportProblems(r), []);
  const s = summarizeLoad(r, Date.parse(r.generatedAt));
  assert.equal(s.completed, 25, 'the 25 windows any part of which lies in the day before generatedAt (FD-93 review)');
  assert.equal(s.series.length, 24);
  assert.equal(s.series[0]!.start, windows[6]!.start);
});

test('FD-93 review: the schema reads times and integers as the contract\'s validator does', () => {
  const base = fixture('positive_service-load') as unknown as LoadReport;
  // A space for `T` in generatedAt, an offset without its colon: valid against the schema, and FAC-SEM-132 compares
  // the windows (strict) only with each other and with generatedAt, which a non-strict generatedAt never fails.
  assert.deepEqual(loadReportProblems({ ...base, generatedAt: base.generatedAt.replace('T', ' ') }), []);
  assert.deepEqual(loadReportProblems({ ...base, generatedAt: '2026-10-22T13:05:00+0200' }), []);
  // A JSON integer the schema admits though it is not a safe integer.
  const big = JSON.parse(JSON.stringify(base)) as LoadReport;
  big.windows[0]!.byContext[0]!.completed = 2 ** 60;
  assert.deepEqual(loadReportProblems(big), []);
  // Still refused: a fraction, a date that does not exist.
  const frac = JSON.parse(JSON.stringify(base)) as LoadReport;
  frac.windows[0]!.byContext[0]!.completed = 1.5;
  assert.ok(loadReportProblems(frac).length > 0);
  assert.ok(loadReportProblems({ ...base, generatedAt: '2026-02-30T00:00:00Z' }).length > 0);
});

test('FD-93 review: a window counts in the last day while any of it lies in that day (daily windows included)', () => {
  const r: LoadReport = { type: 'service-load/1', generatedAt: '2026-10-23T00:05:00Z', windowSeconds: 86400, windows: [
    { start: '2026-10-22T00:00:00Z', byContext: [{ context: 'personal', queued: 0, running: 0, completed: 1000, failed: 3 }] },
    { start: '2026-10-23T00:00:00Z', byContext: [{ context: 'personal', queued: 0, running: 0, completed: 0, failed: 0 }] },
  ] };
  assert.deepEqual(loadReportProblems(r), []);
  const s = summarizeLoad(r, Date.parse(r.generatedAt));
  assert.deepEqual([s.completed, s.failed], [1000, 3]);
});
