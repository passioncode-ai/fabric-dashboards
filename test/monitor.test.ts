import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ActivityStore } from '../src/core/activity';
import { Launchd } from '../src/core/launchd';
import { Monitor, type Notice } from '../src/core/monitor';
import { request, readToken } from '../src/core/probe';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { freePort, register, SAMPLE, serve, stopProcess, tmp, waitAnswering, waitFor } from './helpers';

const FAST = { rescan: 200, visible: 200, background: 200, events: 100_000, maxBackoff: 400 };

function setup(offset = { ms: 0 }) {
  const base = tmp('fd-mon-');
  const services = path.join(base, 'services');
  const activity = new ActivityStore(path.join(base, 'app'));
  const monitor = new Monitor({ servicesDir: services, activity, settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => Date.now() + offset.ms, intervals: FAST });
  const notices: Notice[] = [];
  monitor.on('notify', (n: Notice) => notices.push(n));
  return { base, services, activity, monitor, notices, offset };
}

test('discovers a service, reads its events and notifies only on new ones', async () => {
  const { base, services, activity, monitor, notices } = setup();
  const port = await freePort();
  const data = path.join(base, 'svc');
  const proc = serve(port, data);
  try {
    await waitAnswering(port);
    register(port, data, services);
    monitor.start();
    const snap = await waitFor('ready', () => monitor.snapshots().find((s) => s.state === 'ready'));
    assert.equal(snap.key, 'sample.default');
    assert.equal(snap.wellKnown?.service.build.commit, '0000000');
    await monitor.pollEvents();
    assert.ok(activity.list({ serviceKey: 'sample.default' }).some((e) => e.kind === 'service.started'));
    assert.equal(notices.length, 0, 'history on first read is not news');
    const token = readToken(path.join(data, 'service.token'));
    const body = JSON.stringify({ kind: 'job.awaiting_choice', level: 'notice', text: 'The Q3 report waits for your approval.', notify: true, link: '/#approvals/7' });
    const emit = (payload: string) => new Promise<number>((resolve, reject) => {
      const http = require('node:http') as typeof import('node:http');
      const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/api/emit', headers: { Host: `127.0.0.1:${port}`, Authorization: `Bearer ${token}`, 'X-Fabric-Request': '1', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (x) => { x.resume(); resolve(x.statusCode ?? 0); });
      r.on('error', reject); r.end(payload);
    });
    assert.equal(await emit(body), 200);
    await monitor.pollEvents();
    assert.deepEqual(notices.map((n) => [n.title, n.body, n.link]), [['Sample Service', 'The Q3 report waits for your approval.', '/#approvals/7']]);
    assert.equal(notices[0]!.subtitle, 'Needs your decision', 'the banner says what the agent wants');
    await monitor.pollEvents();
    assert.equal(notices.length, 1, 'an event is never notified twice');
    // ADR-0010: the same question asked again, and a delivery, ask to notify but are not news.
    assert.equal(await emit(body), 200);
    assert.equal(await emit(JSON.stringify({ kind: 'job.delivered', level: 'notice', text: 'The Q3 report is ready.', notify: true })), 200);
    await monitor.pollEvents();
    assert.equal(notices.length, 1, 'a repeated question and a delivery go to Activity only');
    assert.ok(activity.list({ serviceKey: 'sample.default' }).some((e) => e.kind === 'job.delivered'), 'Activity still has them');
  } finally {
    monitor.stop();
    await stopProcess(proc);
  }
});

test('a service that stops answering becomes down, notifies once, and is back', async () => {
  const offset = { ms: 0 };
  const { base, services, activity, monitor, notices } = setup(offset);
  const port = await freePort();
  const data = path.join(base, 'svc');
  let proc = serve(port, data);
  try {
    await waitAnswering(port);
    register(port, data, services);
    monitor.start();
    await waitFor('ready', () => monitor.snapshot('sample.default')?.state === 'ready');
    await stopProcess(proc);
    await waitFor('starting (grace)', () => monitor.snapshot('sample.default')?.state === 'starting');
    offset.ms += 16_000;
    await waitFor('down', () => monitor.snapshot('sample.default')?.state === 'down');
    assert.equal(notices.length, 0, 'no notification before 60 s');
    offset.ms += 45_000; // 61 s since the first miss: the next failed probe confirms the outage
    await waitFor('down notice', () => notices.find((n) => n.title === 'Sample Service is not answering'));
    proc = serve(port, data);
    await waitFor('back', () => monitor.snapshot('sample.default')?.state === 'ready');
    await waitFor('back notice', () => notices.find((n) => n.title === 'Sample Service is back'));
    assert.equal(notices.filter((n) => n.title.includes('not answering')).length, 1);
    const kinds = activity.list({ serviceKey: 'sample.default' }).map((e) => e.kind);
    assert.ok(kinds.includes('service.down') && kinds.includes('service.back'), kinds.join());
  } finally {
    monitor.stop();
    await stopProcess(proc);
  }
});

test('another program on the port is foreign and gets no token; a shared port is a conflict', async () => {
  const { base, services, monitor } = setup();
  const port = await freePort();
  const data = path.join(base, 'svc');
  const proc = serve(port, data);
  try {
    await waitAnswering(port);
    register(port, data, services, ['--id', 'runner']);
    monitor.start();
    const foreign = await waitFor('foreign', () => monitor.snapshot('runner.default')?.state === 'foreign' && monitor.snapshot('runner.default'));
    assert.equal(foreign.reasons[0]?.code, 'reason.foreign.other');
    assert.equal(foreign.reasons[0]?.params?.answer, 'sample.default');
    await monitor.pollEvents();
    assert.equal(foreign.feedError, null);
    fs.writeFileSync(path.join(services, 'writer.default.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(services, 'runner.default.json'), 'utf8')), id: 'writer' }));
    await monitor.tick(true);
    await waitFor('conflict', () => monitor.snapshot('writer.default')?.state === 'conflict' && monitor.snapshot('runner.default')?.state === 'conflict');
  } finally {
    monitor.stop();
    await stopProcess(proc);
  }
});

test('descriptors added and removed while running are picked up; invalid ones are shown', async () => {
  const { services, activity, monitor } = setup();
  fs.mkdirSync(services, { recursive: true });
  monitor.start();
  await waitFor('first scan', () => !monitor.meta().scanning);
  fs.writeFileSync(path.join(services, 'stray.default.json'), JSON.stringify({ protocol: 'fabric-service/0.1', id: 'stray', instance: 'default', name: 'Stray', origin: 'http://0.0.0.0:47166', auth: { tokenFile: '/t' }, lifecycle: { manager: 'none' }, paths: { data: '/d', logs: [] }, installedAt: 'x', installedBy: 'x' }));
  const invalid = await waitFor('invalid', () => monitor.snapshot('stray.default'));
  assert.equal(invalid.state, 'invalid');
  assert.match(invalid.reasons[0]?.params?.problem as string, /origin/);
  fs.unlinkSync(path.join(services, 'stray.default.json'));
  await waitFor('removed', () => monitor.snapshot('stray.default') === null);
  assert.deepEqual(activity.list().map((e) => e.kind).slice(0, 2), ['service.removed', 'service.installed']);
  monitor.stop();
});

test('launchd control: start, restart with a new pid, stop that stays off', { skip: process.platform !== 'darwin' || Boolean(process.env.FD_SKIP_LAUNCHD) }, async () => {
  const { base, services, monitor } = setup();
  const port = await freePort();
  const data = path.join(base, 'svc');
  // One fixed label: launchd keeps an enable/disable override per label forever and
  // offers no command to delete one, so a unique label per run would leave one per run.
  const label = 'ai.passioncode.fabric-dashboards.test.sample';
  const plist = path.join(base, `${label}.plist`);
  const plistBody = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>/usr/bin/python3</string><string>${SAMPLE}</string><string>serve</string><string>--port</string><string>${port}</string><string>--data-dir</string><string>${data}</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${base}/svc.log</string><key>StandardErrorPath</key><string>${base}/svc.log</string>
</dict></plist>`;
  fs.writeFileSync(plist, plistBody);
  register(port, data, services, ['--label', label, '--plist', plist]);
  const launchd = new Launchd();
  try {
    monitor.start();
    await waitFor('not loaded → stopped', () => monitor.snapshot('sample.default')?.state === 'stopped');
    const started = await monitor.control('sample.default', 'start');
    assert.equal(started.ok, true, JSON.stringify(started));
    const first = monitor.snapshot('sample.default')!.wellKnown!.process.pid;
    const status = await launchd.status(label);
    assert.equal(status.pid, first, 'the answering process is the one launchd started');
    const restarted = await monitor.control('sample.default', 'restart');
    assert.equal(restarted.ok, true, JSON.stringify(restarted));
    assert.notEqual(monitor.snapshot('sample.default')!.wellKnown!.process.pid, first);
    const stopped = await monitor.control('sample.default', 'stop');
    assert.equal(stopped.ok, true, JSON.stringify(stopped));
    const after = await launchd.status(label);
    assert.equal(after.loaded, false);
    assert.equal(after.disabled, true, 'Stop persists: the job is disabled, so a login does not start it');
    await waitFor('stopped', () => monitor.snapshot('sample.default')?.state === 'stopped');
  } finally {
    monitor.stop();
    spawnSync('launchctl', ['bootout', `gui/${os.userInfo().uid}/${label}`]);
    spawnSync('launchctl', ['enable', `gui/${os.userInfo().uid}/${label}`]); // leave no disabled entry behind
  }
});

test('an unmanaged service cannot be controlled, and says why', async () => {
  const { base, services, monitor } = setup();
  const port = await freePort();
  register(port, path.join(base, 'svc'), services);
  await monitor.tick(true);
  const r = await monitor.control('sample.default', 'restart');
  assert.equal(r.ok, false);
  assert.equal(r.reason.code, 'result.unmanaged');
});

test('request refuses a non-loopback origin', async () => {
  await assert.rejects(request('http://0.0.0.0:47166', 'GET', '/'), /127\.0\.0\.1/);
});
