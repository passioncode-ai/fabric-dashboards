// FD-144, FD-153: the log digests against the contract's DEC-0153 as released (fabric-agent-contract
// v0.1.0+2026-11-06.1): its vectors for the hour and day folds, and its closed schemas for every line the app writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020';
import { foldDay, foldHour, OpsDigester, type HourCounts, type HourlyDigest } from '../src/core/ops-digest';
import { tmp } from './helpers';

const read = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const V = read('vectors_ops-digest.json') as {
  hour: { name: string; input: { counts: { op: string; ok: number; failed: number; unknown: number }[]; from: string; previous: HourlyDigest | null }; expected: unknown }[];
  day: { name: string; input: { day: string; hourly: HourlyDigest[] }; expected: unknown }[];
};

function schemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const hourly = read('schema_ops-digest-hourly.json');
  ajv.addSchema(hourly);
  return { hour: ajv.compile(hourly), day: ajv.compile(read('schema_ops-digest-daily.json')) };
}

for (const c of V.hour) {
  test(`DEC-0153 hour vector: ${c.name}`, () => {
    const counts: HourCounts = new Map();
    for (const x of c.input.counts) {
      const y = counts.get(x.op) ?? { ok: 0, failed: 0, unknown: 0 };
      y.ok += x.ok; y.failed += x.failed; y.unknown += x.unknown;
      counts.set(x.op, y);
    }
    assert.deepEqual(foldHour(counts, Date.parse(c.input.from), c.input.previous), c.expected);
  });
}

for (const c of V.day) {
  test(`DEC-0153 day vector: ${c.name}`, () => assert.deepEqual(foldDay(c.input.day, c.input.hourly), c.expected));
}

test('DEC-0153: every hourly and daily line the app writes passes the closed schemas', () => {
  const s = schemas();
  const dir = path.join(tmp('fd-digest-schema-'), 'digests');
  let now = Date.parse('2026-11-04T22:10:00Z');
  const d = new OpsDigester(dir, () => now);
  for (const line of ['update_check current', 'update_check check_failed HTTP 502', 'update_restart refused console', 'alerts: sent result x', 'agent_names read=3 failed=1', 'uncaught: TypeError x', '{"event":"analytics.flush","outcome":"kept","status":503}']) d.record(line);
  for (let i = 0; i < 12; i++) d.record('estate_check failed x');
  now = Date.parse('2026-11-04T23:05:00Z'); d.roll();
  now = Date.parse('2026-11-05T01:05:00Z'); d.roll();
  const lines = (kind: string) => fs.readFileSync(path.join(dir, `${kind}-2026-11.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as unknown);
  const hours = lines('hourly');
  const days = lines('daily');
  assert.ok(hours.length >= 2 && days.length === 1, `${hours.length} hours, ${days.length} days`);
  for (const h of hours) assert.ok(s.hour(h), JSON.stringify(s.hour.errors));
  for (const x of days) assert.ok(s.day(x), JSON.stringify(s.day.errors));
});

test("DEC-0153: this Mac's own digests pass the schemas, when there are any", (t) => {
  const dir = path.join(process.env.HOME ?? '', 'Library/Application Support/Fabric Dashboards/digests');
  if (process.platform !== 'darwin' || !fs.existsSync(dir)) return t.skip('no digests on this machine');
  const s = schemas();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
    const check = f.startsWith('hourly') ? s.hour : s.day;
    for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)) assert.ok(check(JSON.parse(l)), `${f}: ${JSON.stringify(check.errors)}`);
  }
});
