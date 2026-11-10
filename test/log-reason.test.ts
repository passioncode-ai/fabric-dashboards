// FD-198 (telegram-gateway TG-260): a local service that cannot answer as itself shows the last line its own log wrote
// during this episode as one more reason, and its notification on this Mac ends with it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Descriptor, RunResult, WellKnown, WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { ActivityStore } from '../src/core/activity';
import { Launchd } from '../src/core/launchd';
import { lastLogLine, LOG_FRESH_MS, Monitor, type Notice } from '../src/core/monitor';
import { t } from '../src/core/i18n';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { tmp } from './helpers';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const BASE = fixture('positive_service-descriptor.json') as Descriptor;
const WK = fixture('positive_service-well-known.json') as WellKnown;
const KEY = `${BASE.id}.${BASE.instance}`;
const LINE = 'Port 47851 is in use on this Mac; give this installation its own --port, or stop what uses it.';

function rig(first: WellKnownResult, log: string | null, mtimeMs?: number) {
  const probe = { answer: first };
  const base = tmp('fd-logreason-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const logFile = path.join(base, 'service.log');
  if (log !== null) {
    fs.writeFileSync(logFile, log);
    if (mtimeMs !== undefined) fs.utimesSync(logFile, mtimeMs / 1000, mtimeMs / 1000);
  }
  const descriptor = { ...BASE, paths: { ...BASE.paths, logs: [logFile] } };
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(descriptor));
  const runner = async (_c: string, args: string[]): Promise<RunResult> => (args[0] === 'print' ? { code: 0, stdout: `pid = ${WK.process.pid}\n`, stderr: '' } : { code: 0, stdout: '', stderr: '' });
  const clock = { ms: Date.now() };
  const monitor = new Monitor({ platform: 'darwin', servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS,
    lang: () => 'en', now: () => clock.ms, launchd: new Launchd(runner, 501), wellKnown: async () => probe.answer });
  const notices: Notice[] = [];
  monitor.on('notify', (n: Notice) => notices.push(n));
  return { monitor, notices, clock, probe };
}

const READY: WellKnownResult = { kind: 'answer', doc: { ...WK, status: 'ready', degraded: [] }, ms: 3 };
const STRANGER: WellKnownResult = { kind: 'answer', doc: { ...WK, service: { ...WK.service, id: 'maker', instance: 'default' } }, ms: 3 };

test("FD-198: a stranger on the port, and the service's log says why: one more reason, and the notification ends with it", async () => {
  const r = rig(READY, `starting\n\u001b[31m${LINE}\u001b[0m\n\n`);
  await r.monitor.tick();
  r.probe.answer = STRANGER;
  r.clock.ms += 30_000;
  await r.monitor.tick();
  const snap = r.monitor.snapshot(KEY)!;
  assert.equal(snap.state, 'foreign');
  assert.equal(snap.reasons[0]?.code, 'reason.foreign.other', 'the state keeps its own reason first: the operator channel sends only that one');
  assert.deepEqual(snap.reasons.at(-1), { code: 'reason.log', params: { line: LINE } });
  assert.equal(r.notices.length, 1);
  assert.ok(r.notices[0]!.body.endsWith(`Its log says: ${LINE}`), r.notices[0]!.body);
});

test('FD-198: a log not written during this episode, an empty one or none at all adds nothing', async () => {
  const old = rig(STRANGER, `${LINE}\n`, Date.now() - LOG_FRESH_MS - 5 * 60_000);
  await old.monitor.tick();
  assert.equal(old.monitor.snapshot(KEY)!.reasons.some((x) => x.code === 'reason.log'), false, 'a stale line is not this episode');
  const empty = rig(STRANGER, '\n  \n');
  await empty.monitor.tick();
  assert.equal(empty.monitor.snapshot(KEY)!.reasons.some((x) => x.code === 'reason.log'), false);
  const none = rig(STRANGER, null);
  await none.monitor.tick();
  assert.equal(none.monitor.snapshot(KEY)!.reasons.some((x) => x.code === 'reason.log'), false);
});

test('FD-198: a ready service never shows its log as a reason', async () => {
  const r = rig(READY, `${LINE}\n`);
  await r.monitor.tick();
  assert.equal(r.monitor.snapshot(KEY)!.reasons.some((x) => x.code === 'reason.log'), false);
});

test('FD-198: the line is the last non-empty one, without colours or control characters, at most 240 characters, in both languages', () => {
  assert.equal(lastLogLine('a\nb\n\n'), 'b');
  assert.equal(lastLogLine('\u001b[1;33mwarn\u001b[0m\tthing\r\n'), 'warn thing');
  assert.equal(lastLogLine('\n \n'), null);
  const long = lastLogLine('x'.repeat(500))!;
  assert.equal(long.length, 240);
  assert.ok(long.endsWith('…'));
  assert.equal(t('en', 'reason.log', { line: LINE }), `Its log says: ${LINE}`);
  assert.equal(t('ru', 'reason.log', { line: LINE }), `В его логах: ${LINE}`);
});
