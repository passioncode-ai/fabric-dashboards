// FD-199 (SCN-103): an agent the placement record puts on another machine opens its console there, over the ssh route
// of the port forward that brings it here. The route parsing is pure; the start path runs ConsoleHost with stubs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost } from '../src/electron/console';
import { forwardOf, launchJobOf, readLaunchJobs, remoteArgv, remoteRuntimeArgv, remoteScript, routeTo, type LaunchJob } from '../src/core/remote-console';
import { failText } from '../src/renderer/components/Sessions';
import { t } from '../src/core/i18n';
import { tmp } from './helpers';

const TUNNEL: LaunchJob = {
  label: 'com.example.agent-tunnel',
  argv: ['/usr/bin/ssh', '-N', '-o', 'IdentityAgent=none', '-o', 'IdentitiesOnly=yes', '-i', '/srv/me/.ssh/id_ed25519', '-o', 'BatchMode=yes',
    '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-L', '127.0.0.1:47861:127.0.0.1:47861', 'me@192.0.2.9'],
};

test('FD-199: a launchd ssh forward gives the destination, its key options and the ports it brings here', () => {
  const f = forwardOf(TUNNEL);
  assert.deepEqual(f, { route: { destination: 'me@192.0.2.9', options: ['-o', 'IdentityAgent=none', '-o', 'IdentitiesOnly=yes', '-i', '/srv/me/.ssh/id_ed25519'], via: 'com.example.agent-tunnel' }, ports: [47861] });
  assert.deepEqual(forwardOf({ label: 'x', argv: ['/usr/bin/ssh', '-N', '-L', '8787:localhost:8787', 'host'] })?.ports, [8787]);
});

test('FD-199: a job that is not a plain ssh forward gives no route', () => {
  assert.equal(forwardOf({ label: 'node', argv: ['/usr/local/bin/node', 'server.js'] }), null);
  assert.equal(forwardOf({ label: 'no-forward', argv: ['/usr/bin/ssh', 'me@host'] }), null);
  assert.equal(forwardOf({ label: 'command', argv: ['/usr/bin/ssh', '-L', '1:a:1', 'me@host', 'uptime'] }), null);
  assert.equal(forwardOf({ label: 'socket', argv: ['/usr/bin/ssh', '-L', '/tmp/s:/tmp/r', 'me@host'] }), null);
  assert.equal(forwardOf({ label: 'odd', argv: ['/usr/bin/ssh', '-L', '1:a:1', 'me@host;rm'] }), null);
});

test('FD-199: the forward the record names wins; else the one that brings the agent port here', () => {
  const other: LaunchJob = { label: 'com.example.other-tunnel', argv: ['/usr/bin/ssh', '-N', '-L', '127.0.0.1:9000:127.0.0.1:9000', 'other@192.0.2.10'] };
  assert.equal(routeTo({ forward: 'com.example.other-tunnel', port: 47861, jobs: [TUNNEL, other] })?.destination, 'other@192.0.2.10');
  assert.equal(routeTo({ port: 47861, jobs: [other, TUNNEL] })?.destination, 'me@192.0.2.9');
  assert.equal(routeTo({ forward: 'gone', port: 47861, jobs: [TUNNEL] })?.destination, 'me@192.0.2.9');
  assert.equal(routeTo({ port: 1234, jobs: [TUNNEL, other] }), null);
});

test('FD-199: the remote line enters the same folder under the remote home and runs the coding agent through a login shell', () => {
  assert.equal(remoteScript({ folder: '/srv/me/DATA/agent', home: '/srv/me', argv: ['claude', '--dangerously-skip-permissions'] }),
    `cd "$HOME"/'DATA/agent' && exec "\${SHELL:-/bin/zsh}" -lc 'exec '\\''claude'\\'' '\\''--dangerously-skip-permissions'\\'''`);
  assert.match(remoteScript({ folder: '/opt/agent', home: '/srv/me', argv: ['codex'] }), /^cd '\/opt\/agent' && /);
  assert.match(remoteScript({ folder: '/srv/me', home: '/srv/me', argv: ['claude'] }), /^cd "\$HOME" && /);
  // A folder name with a quote stays one word on the remote shell.
  assert.match(remoteScript({ folder: "/srv/me/it's", home: '/srv/me', argv: ['claude'] }), /^cd "\$HOME"\/'it'\\''s' && /);
});

test('FD-199: ssh runs with a terminal, no prompt, a bounded connect and the forward key options', () => {
  const route = forwardOf(TUNNEL)!.route;
  const argv = remoteArgv({ route, folder: '/srv/me/DATA/agent', home: '/srv/me', argv: remoteRuntimeArgv(['/opt/homebrew/bin/claude', '--continue']) });
  assert.deepEqual(argv.slice(0, 8), ['/usr/bin/ssh', '-t', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=30']);
  assert.deepEqual(argv.slice(8, -2), route.options);
  assert.equal(argv.at(-2), 'me@192.0.2.9');
  assert.match(argv.at(-1)!, /exec '\\''claude'\\'' '\\''--continue'\\''/);
  assert.ok(!argv.includes('-N') && !argv.includes('-L') && !argv.includes('ExitOnForwardFailure=yes'));
});

test('FD-199: launchd jobs are read from XML property lists; a binary one is skipped', () => {
  const dir = tmp('fd-199-agents-');
  const xml = (label: string, args: string[]) => `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map((a) => `<string>${a}</string>`).join('')}</array></dict></plist>`;
  fs.writeFileSync(path.join(dir, 'a.plist'), xml('com.example.agent-tunnel', TUNNEL.argv.map((a) => a.replace('&', '&amp;'))));
  fs.writeFileSync(path.join(dir, 'b.plist'), xml('com.example.web', ['/usr/local/bin/node', 'web.js']));
  fs.writeFileSync(path.join(dir, 'c.plist'), Buffer.from('bplist00ssh'));
  const jobs = readLaunchJobs(dir);
  assert.deepEqual(jobs.map((j) => j.label), ['com.example.agent-tunnel']);
  assert.deepEqual(jobs[0]!.argv, TUNNEL.argv);
  assert.equal(launchJobOf('<plist><dict><key>Label</key><string>x</string></dict></plist>'), null);
  assert.deepEqual(readLaunchJobs(path.join(dir, 'absent')), []);
});

function rig(o: { placed: { placedOn: string; forward?: string } | null; jobs: LaunchJob[]; folderHere: boolean }) {
  const base = tmp('fd-199-');
  const bin = path.join(base, 'bin');
  const home = path.join(base, 'home');
  const folder = path.join(home, 'DATA', 'agent');
  fs.mkdirSync(bin); fs.mkdirSync(home);
  if (o.folderHere) fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  let settings = { consoles: { 'example-agent.default': { runtime: 'claude-code', folder } } } as Record<string, unknown>;
  const spawned: { file: string; args: string[]; cwd: string }[] = [];
  const machineAsked: string[] = [];
  const host = new ConsoleHost({
    settings: { get: () => settings, update: (p: Record<string, unknown>) => { settings = { ...settings, ...p }; } } as never,
    snapshot: () => ({ descriptor: { origin: 'http://127.0.0.1:47861' } }) as never, window: () => null, visible: () => false, log: () => {},
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'), home,
    run: async () => ({ code: 1, stdout: '', stderr: '' }),
    spawn: (file, args, opts) => { spawned.push({ file, args, cwd: opts.cwd }); return { pid: 999_999_999, onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }; },
    killGroup: () => {},
    machine: async (f) => { machineAsked.push(f); return { freeDisk: 50 * 1024 ** 3, swap: null, running: 0 }; },
    placedElsewhere: () => o.placed,
    launchJobs: () => o.jobs,
  });
  return { host, spawned, machineAsked, folder, home };
}

const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake runtime is a shell script' };

test('FD-199: an agent placed on another machine starts its coding agent there, in the same folder, over the forward route', POSIX, async () => {
  const r = rig({ placed: { placedOn: 'm-studio' }, jobs: [TUNNEL], folderHere: false });
  assert.deepEqual(await r.host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: true });
  assert.equal(r.spawned.length, 1);
  const s = r.spawned[0]!;
  assert.equal(s.file, '/usr/bin/ssh');
  assert.equal(s.cwd, r.home);
  assert.equal(s.args.at(-2), 'me@192.0.2.9');
  assert.match(s.args.at(-1)!, /^cd "\$HOME"\/'DATA\/agent' && /);
  assert.match(s.args.at(-1)!, /'\\''claude'\\''/);
  // The admission asks about this machine (its home), not a folder that is only on the other one.
  assert.deepEqual(r.machineAsked, [r.home]);
  const info = await r.host.info('example-agent.default');
  assert.deepEqual(info.remote, { machine: 'm-studio', destination: 'me@192.0.2.9' });
  assert.match(info.session.label, /· me@192\.0\.2\.9$/);
});

test('FD-199: with no forward that reaches the machine, nothing starts and the reason is remote', POSIX, async () => {
  const r = rig({ placed: { placedOn: 'm-studio' }, jobs: [], folderHere: true });
  assert.deepEqual(await r.host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: false, reason: 'remote', detail: 'm-studio' });
  assert.deepEqual(r.spawned, []);
  assert.deepEqual((await r.host.info('example-agent.default')).remote, { machine: 'm-studio', destination: null });
});

test('FD-199: an agent placed here starts on this machine as before', POSIX, async () => {
  const r = rig({ placed: null, jobs: [TUNNEL], folderHere: true });
  assert.deepEqual(await r.host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: true });
  assert.equal(path.basename(r.spawned[0]!.file), 'claude');
  assert.equal(r.spawned[0]!.cwd, r.folder);
  assert.equal((await r.host.info('example-agent.default')).remote, null);
});

test('FD-199: a refused continue on another machine reads the remote sentence', () => {
  const tr = (key: string, params?: Record<string, string | number>) => t('en', key, params);
  assert.equal(failText(tr as never, { ok: false, reason: 'remote' }, { action: 'continue', folder: '/x' }), t('en', 'console.remote.noRoute'));
});
