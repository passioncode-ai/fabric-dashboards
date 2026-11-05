// FD-144 (ADR-0188 in Fabric): the app counts its own log by operation and outcome and writes hourly and daily digests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { classify, foldDay, foldHour, KEEP_MONTHS, OpsDigester, type HourCounts, type HourlyDigest } from '../src/core/ops-digest';
import { tmp } from './helpers';

const H = 60 * 60_000;
const T0 = Date.parse('2026-11-04T10:00:00Z');

test('FD-144: the log\'s structured events are counted, prose is not, and nothing that names leaves a line', () => {
  assert.deepEqual(classify('update_check current version=0.8.20 feed=0.8.20'), { op: 'update_check', outcome: 'ok' });
  assert.deepEqual(classify('update_check check_failed the update feed answered HTTP 502'), { op: 'update_check', outcome: 'failed' });
  assert.deepEqual(classify('update_download done version=0.8.20 sha256=995e7096ff37'), { op: 'update_download', outcome: 'ok' });
  assert.deepEqual(classify('dock_hide failed: gave up after 3'), { op: 'dock_hide', outcome: 'failed' });
  assert.deepEqual(classify('estate_check ok skills=3'), { op: 'estate_check', outcome: 'ok' });
  assert.deepEqual(classify('alerts: sent result ask:x.default:46 via channel.default'), { op: 'alerts', outcome: 'ok' });
  assert.deepEqual(classify('alerts: ask:x.default:2230 not delivered via y.default: refused'), { op: 'alerts', outcome: 'failed' });
  assert.deepEqual(classify('agent_names read=1 failed=0'), { op: 'agent_names', outcome: 'ok' });
  assert.deepEqual(classify('agent_names read=3 failed=2'), { op: 'agent_names', outcome: 'failed' });
  assert.deepEqual(classify('{"event":"analytics.flush","outcome":"sent","count":1}'), { op: 'analytics.flush', outcome: 'ok' });
  assert.deepEqual(classify('uncaught: TypeError: x is undefined'), { op: 'crash', outcome: 'failed' });
  for (const prose of ['window shown', 'console: hand-overs 0', 'alerts: outage-alerts.json read', 'started 0.8.20', 'released 2 views', 'some_op ok', '{"event":"/Users/x","outcome":"ok"}', '{not json']) {
    assert.equal(classify(prose), null, prose);
  }
});

test('FD-144: an hour folds with its totals, and a failure count that rose past the rule is named', () => {
  const counts: HourCounts = new Map();
  const add = (op: string, outcome: 'ok' | 'failed', n: number) => { for (let i = 0; i < n; i++) { const c = counts.get(op) ?? { ok: 0, failed: 0, unknown: 0 }; c[outcome]++; counts.set(op, c); } };
  add('update_check', 'failed', 12); add('update_check', 'ok', 1); add('alerts', 'failed', 9);
  const prev: HourlyDigest = { schema: 'ops.digest.hourly@1', from: new Date(T0 - H).toISOString(), to: new Date(T0).toISOString(), ops: [{ op: 'update_check', ok: 0, failed: 5, unknown: 0 }], total: { ok: 0, failed: 5, unknown: 0 }, risen: [] };
  const h = foldHour(counts, T0, prev);
  assert.equal(h.schema, 'ops.digest.hourly@1');
  assert.deepEqual([h.from, h.to], ['2026-11-04T10:00:00.000Z', '2026-11-04T11:00:00.000Z']);
  assert.deepEqual(h.ops.map((c) => c.op), ['alerts', 'update_check']);
  assert.deepEqual(h.total, { ok: 1, failed: 21, unknown: 0 });
  assert.deepEqual(h.risen, [{ op: 'update_check', failed: 12, previous: 5 }], '12 ≥ 10 and ≥ 2 × 5; 9 alerts stay under 10');
  assert.deepEqual(foldHour(counts, T0, { ...prev, ops: [{ op: 'update_check', ok: 0, failed: 7, unknown: 0 }] }).risen, [], '12 < 2 × 7');
  assert.equal(foldHour(counts, T0 + H, prev).risen[0]?.previous, 0, 'a gap compares with nothing');
  const d = foldDay('2026-11-04', [h, { ...h, from: '2026-11-05T00:00:00.000Z' }]);
  assert.deepEqual([d.schema, d.day, d.hours], ['ops.digest.daily@1', '2026-11-04', 1]);
  assert.deepEqual(d.risen, [{ op: 'update_check', hours: 1, failed: 12 }]);
});

test('FD-144: closed hours and days are written once, a restart in the hour keeps its counts, old months go', () => {
  const dir = path.join(tmp('fd-digest-'), 'digests');
  let now = T0 + 5 * 60_000;
  const a = new OpsDigester(dir, () => now);
  a.record('update_check current version=0.8.20 feed=0.8.20');
  a.record('update_check check_failed HTTP 502');
  a.record('window shown');
  now += 10 * 60_000;
  a.save();
  // A restart in the same hour: the open hour carries on, nothing is written yet.
  const b = new OpsDigester(dir, () => now);
  b.record('alerts: sent result');
  assert.ok(!fs.existsSync(path.join(dir, 'hourly-2026-11.jsonl')));
  now = T0 + H + 60_000;
  b.roll();
  const hourly = fs.readFileSync(path.join(dir, 'hourly-2026-11.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as HourlyDigest);
  assert.equal(hourly.length, 1);
  assert.deepEqual(hourly[0]!.ops, [{ op: 'alerts', ok: 1, failed: 0, unknown: 0 }, { op: 'update_check', ok: 1, failed: 1, unknown: 0 }]);
  // A file mode is POSIX's: Windows reports 0o666 whatever was asked (the profile's ACL guards it there).
  if (process.platform !== 'win32') assert.equal((fs.statSync(path.join(dir, 'hourly-2026-11.jsonl')).mode & 0o777), 0o600);
  b.roll();
  assert.equal(fs.readFileSync(path.join(dir, 'hourly-2026-11.jsonl'), 'utf8').trim().split('\n').length, 1, 'an hour is written once');
  // The next UTC day: yesterday's hours fold into one daily digest, once.
  b.record('update_check current');
  now = Date.parse('2026-11-05T00:30:00Z');
  b.roll();
  b.roll();
  const daily = fs.readFileSync(path.join(dir, 'daily-2026-11.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { day: string; hours: number; total: { ok: number } });
  assert.deepEqual(daily.map((d) => [d.day, d.hours, d.total.ok]), [['2026-11-04', 2, 3]]);
  // OD-1: an hour the app ran through with nothing counted is written, empty, and the next hour compares with zero.
  now = Date.parse('2026-11-05T01:30:00Z');
  b.roll();
  const nov5 = fs.readFileSync(path.join(dir, 'hourly-2026-11.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as HourlyDigest).filter((h) => h.from.startsWith('2026-11-05'));
  assert.deepEqual(nov5.map((h) => [h.from, h.ops.length, h.total]), [['2026-11-05T00:00:00.000Z', 0, { ok: 0, failed: 0, unknown: 0 }]]);
  // A new month's first file removes files older than KEEP_MONTHS months.
  fs.writeFileSync(path.join(dir, 'hourly-2026-07.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'hourly-2026-09.jsonl'), '');
  const c = new OpsDigester(dir, () => Date.parse('2026-12-01T00:10:00Z'));
  c.record('update_check current');
  c.roll(Date.parse('2026-12-01T01:10:00Z'));
  assert.equal(KEEP_MONTHS, 3);
  assert.ok(!fs.existsSync(path.join(dir, 'hourly-2026-07.jsonl')), 'older than three months');
  assert.ok(fs.existsSync(path.join(dir, 'hourly-2026-09.jsonl')), 'within three months');
});

test('FD-144: the main process counts every line it logs, rolls on a minute timer, and keeps the open hour at quit', () => {
  const main = fs.readFileSync(path.join(__dirname, '../src/electron/main.ts'), 'utf8');
  assert.match(main, /try \{ digester\.record\(message\); \} catch/);
  assert.match(main, /digestTick = setInterval\(\(\) => \{ try \{ digester\.roll\(\); \} catch \{ \/\* best effort \*\/ \} \}, 60_000\);\n\s+digestTick\.unref\(\);/);
  const quit = main.slice(main.indexOf("app.on('will-quit'"));
  assert.match(quit.slice(0, 3000), /digester\.save\(\)/);
});

test('FD-153: a start folds every closed day that has hours and no daily digest; a day with no hours has none', () => {
  const dir = path.join(tmp('fd-digest-'), 'digests');
  fs.mkdirSync(dir, { recursive: true });
  const hour = (from: string): HourlyDigest => foldHour(new Map([['update_check', { ok: 1, failed: 0, unknown: 0 }]]), Date.parse(from), null);
  // Two days the app ran and closed before midnight, one from the month before; no daily lines were written.
  const lines = ['2026-10-31T22:00:00Z', '2026-11-02T09:00:00Z', '2026-11-02T10:00:00Z'].map((f) => JSON.stringify(hour(f)));
  fs.writeFileSync(path.join(dir, 'hourly-2026-10.jsonl'), `${lines[0]}\n`);
  fs.writeFileSync(path.join(dir, 'hourly-2026-11.jsonl'), `${lines[1]}\n${lines[2]}\n`);
  const d = new OpsDigester(dir, () => Date.parse('2026-11-04T08:00:00Z'));
  d.roll();
  d.roll();
  const read = (f: string) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { day: string; hours: number }) : []);
  assert.deepEqual([...read('daily-2026-10.jsonl'), ...read('daily-2026-11.jsonl')].map((x) => [x.day, x.hours]), [['2026-10-31', 1], ['2026-11-02', 2]], 'once each, none for the days it did not run');
  assert.equal(foldDay('2026-11-03', [hour('2026-11-02T10:00:00Z')]), null);
});

test('FD-153: after a crash the open hour the timer already wrote is not written again', () => {
  const dir = path.join(tmp('fd-digest-'), 'digests');
  let now = T0 + 5 * 60_000;
  const a = new OpsDigester(dir, () => now);
  a.record('update_check current');
  a.save(); // open.json: the 10:00 hour
  now = T0 + H + 60_000;
  a.roll(); // the timer writes 10:00, and the process dies without saving
  const b = new OpsDigester(dir, () => now);
  b.roll(T0 + 2 * H + 60_000);
  const from = fs.readFileSync(path.join(dir, 'hourly-2026-11.jsonl'), 'utf8').trim().split('\n').map((l) => (JSON.parse(l) as HourlyDigest).from);
  assert.deepEqual(from, ['2026-11-04T10:00:00.000Z'], 'the 10:00 hour once; 11:00 was a gap');
});

test('FD-153 (OD-3): the published map: setup and policy answers are unknown, an attempt that could not is failed', () => {
  const out = (line: string) => classify(line)?.outcome;
  for (const ok of ['update_check current', 'update_check ready', 'update_check available', 'update_install installed', 'update_restart requested', 'auto_update off', 'fabric_button opened', 'dock_hide recovered']) assert.equal(out(ok), 'ok', ok);
  for (const failed of ['update_check check_failed x', 'update_check signature_failed x', 'update_install shipit_remove_failed x', 'dock_hide failed: gave up', 'estate_check failed x', '{"event":"analytics.flush","outcome":"kept","status":503}']) assert.equal(out(failed), 'failed', failed);
  for (const unknown of ['update_check unsupported channel=deb', 'update_check needs_migration version=1.0.0', 'update_restart refused console running', 'update_check staging_lost version=0.8.22']) assert.equal(out(unknown), 'unknown', unknown);
});
