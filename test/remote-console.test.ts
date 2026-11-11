// FD-199 (SCN-103): an agent the placement record puts on another machine opens its console there, over the ssh route
// of the port forward that brings it here. The route parsing is pure; the start path runs ConsoleHost with stubs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost } from '../src/electron/console';
import { remoteRefusal } from '../src/core/remote-words';
import { accessOf, accessProbeArgv, folderOf, folderProbeArgv, forwardOf, remoteFolderCandidates, launchJobOf, placeCommand, remoteCommandArgv, readLaunchJobs, remoteArgv, remoteRuntimeArgv, remoteScript, routeTo, type LaunchJob } from '../src/core/remote-console';
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

function rig(o: { placed: { placedOn: string; forward?: string } | null; jobs: LaunchJob[]; folderHere: boolean; access?: { code: number | null; stdout: string; stderr: string }; there?: (candidates: string) => { code: number | null; stdout: string; stderr: string }; repository?: string }) {
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
    snapshot: () => ({ descriptor: { origin: 'http://127.0.0.1:47861', source: { repository: o.repository } } }) as never, window: () => null, visible: () => false, log: () => {},
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'), home,
    run: async (_cmd: string, args: string[]) => (args.at(-1) === 'echo fabric-edit-ok' ? o.access ?? { code: 0, stdout: 'fabric-edit-ok\n', stderr: '' }
      // FD-203: the other machine answers which folder it has; by default the first one asked about.
      : args.at(-1)!.startsWith('/bin/sh -c ') ? (o.there ?? (() => ({ code: 0, stdout: `fabric-dir:${remoteHome}/DATA/agent\n`, stderr: '' })))(args.at(-1)!)
      : { code: 1, stdout: '', stderr: '' }),
    spawn: (file, args, opts) => { spawned.push({ file, args, cwd: opts.cwd }); return { pid: 999_999_999, onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }; },
    killGroup: () => {},
    machine: async (f) => { machineAsked.push(f); return { freeDisk: 50 * 1024 ** 3, swap: null, running: 0 }; },
    placedElsewhere: () => o.placed,
    launchJobs: () => o.jobs,
  });
  return { host, spawned, machineAsked, folder, home };
}

const remoteHome = '/srv/them';

const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake runtime is a shell script' };

test('FD-199: an agent placed on another machine starts its coding agent there, in the same folder, over the forward route', POSIX, async () => {
  const r = rig({ placed: { placedOn: 'm-studio' }, jobs: [TUNNEL], folderHere: false });
  assert.deepEqual(await r.host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: true });
  assert.equal(r.spawned.length, 1);
  const s = r.spawned[0]!;
  assert.equal(s.file, '/usr/bin/ssh');
  assert.equal(s.cwd, r.home);
  assert.equal(s.args.at(-2), 'me@192.0.2.9');
  assert.match(s.args.at(-1)!, /^cd '\/srv\/them\/DATA\/agent' && /);
  assert.match(s.args.at(-1)!, /'\\''claude'\\''/);
  // The admission asks about this machine (its home), not a folder that is only on the other one.
  assert.deepEqual(r.machineAsked, [r.home]);
  const info = await r.host.info('example-agent.default');
  assert.deepEqual(info.remote, { machine: 'm-studio', destination: 'me@192.0.2.9', access: 'edit' });
  assert.match(info.session.label, /· me@192\.0\.2\.9$/);
});

test('FD-199: with no forward that reaches the machine, nothing starts and the reason is remote', POSIX, async () => {
  const r = rig({ placed: { placedOn: 'm-studio' }, jobs: [], folderHere: true });
  assert.deepEqual(await r.host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: false, reason: 'remote', detail: 'no-route' });
  assert.deepEqual(r.spawned, []);
  assert.deepEqual((await r.host.info('example-agent.default')).remote, { machine: 'm-studio', destination: null, access: null });
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

test('FD-200: the probe answer tells edit, view, denied and unreachable apart', () => {
  assert.equal(accessOf({ code: 0, stdout: 'fabric-edit-ok\n', stderr: '' }), 'edit');
  assert.equal(accessOf({ code: 255, stdout: '', stderr: 'me@192.0.2.9: Permission denied (publickey).' }), 'denied');
  assert.equal(accessOf({ code: 1, stdout: '', stderr: '' }), 'view', 'a forced command ran instead of the echo');
  assert.equal(accessOf({ code: 0, stdout: 'forwarding only\n', stderr: '' }), 'view', 'connected, and something else answered');
  assert.equal(accessOf({ code: 255, stdout: '', stderr: 'PTY allocation request failed\nshell request failed on channel 0' }), 'view');
  assert.equal(accessOf({ code: 255, stdout: '', stderr: 'ssh: connect to host 192.0.2.9 port 22: Operation timed out' }), 'unreachable');
  assert.deepEqual(accessProbeArgv(forwardOf(TUNNEL)!.route).slice(-2), ['me@192.0.2.9', 'echo fabric-edit-ok']);
});

test('FD-200: a descriptor command runs on the other machine with its paths under that home', () => {
  const argv = remoteCommandArgv({ route: forwardOf(TUNNEL)!.route, home: '/srv/me', argv: ['/srv/me/DATA/agent/bin/agent', 'doctor', '--json'] });
  assert.deepEqual(argv.slice(0, 3), ['/usr/bin/ssh', '-T', '-n']);
  assert.equal(argv.at(-2), 'me@192.0.2.9');
  assert.equal(argv.at(-1), `exec "\${SHELL:-/bin/zsh}" -lc 'exec "$HOME"/'\\''DATA/agent/bin/agent'\\'' '\\''doctor'\\'' '\\''--json'\\'''`);
});

test('FD-200: where doctor and update run: here, there by a key that edits, refused for a view-only key or no route', async () => {
  const base = { origin: 'http://127.0.0.1:47861', argv: ['/srv/me/DATA/agent/bin/agent', 'update'], home: '/srv/me', jobs: () => [TUNNEL] };
  const edit = async () => ({ code: 0, stdout: 'fabric-edit-ok\n', stderr: '' });
  const view = async () => ({ code: 1, stdout: '', stderr: '' });
  const denied = async () => ({ code: 255, stdout: '', stderr: 'Permission denied (publickey).' });
  assert.deepEqual(await placeCommand({ ...base, elsewhere: null, probe: edit }), { kind: 'here' });
  const there = await placeCommand({ ...base, elsewhere: { placedOn: 'm-studio' }, probe: edit });
  assert.equal(there.kind, 'there');
  assert.equal(there.kind === 'there' && there.destination, 'me@192.0.2.9');
  assert.deepEqual(await placeCommand({ ...base, elsewhere: { placedOn: 'm-studio' }, probe: view }), { kind: 'refused', code: 'result.remote.view', machine: 'me@192.0.2.9' });
  assert.deepEqual(await placeCommand({ ...base, elsewhere: { placedOn: 'm-studio' }, probe: denied }), { kind: 'refused', code: 'result.remote.view', machine: 'me@192.0.2.9' });
  assert.deepEqual(await placeCommand({ ...base, jobs: () => [], elsewhere: { placedOn: 'm-studio' }, probe: edit }), { kind: 'refused', code: 'result.remote.noRoute', machine: 'm-studio' });
  assert.match(t('en', 'result.remote.view', { name: 'Agent', machine: 'me@192.0.2.9', command: 'Update' }), /your key opens no shell there/);
});

test('FD-200: a key that only reaches the port gives view only: nothing starts, and the console says so', POSIX, async () => {
  const r = rig({ placed: { placedOn: 'm-studio' }, jobs: [TUNNEL], folderHere: true, access: { code: 1, stdout: '', stderr: '' } });
  assert.deepEqual(await r.host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: false, reason: 'remote', detail: 'view' });
  assert.deepEqual(r.spawned, []);
  assert.equal((await r.host.info('example-agent.default')).remote?.access, 'view');
  assert.equal(remoteRefusal('view'), 'console.remote.view');
  assert.equal(remoteRefusal('denied'), 'console.remote.denied');
  assert.equal(remoteRefusal('unreachable'), 'console.remote.unreachable');
  assert.equal(remoteRefusal('no-route'), 'console.remote.noRoute');
});

test('FD-200: with the agent key, the other machine runs the command its own descriptor declares, else this one', () => {
  const argv = remoteCommandArgv({ route: forwardOf(TUNNEL)!.route, home: '/srv/me', argv: ['/srv/me/old/bin/agent', 'doctor'], key: 'example-agent.default', which: 'doctor' });
  const line = argv.at(-1)!;
  assert.match(line, /ai\.passioncode\.fabric\/services\/example-agent\.default\.json/);
  assert.match(line, /k=commands\.doctor/);
  assert.match(line, /exec "\$HOME"\/'\\''old\/bin\/agent'\\''/, 'this machine’s command is the fallback');
  // A key that is not a service key never reaches the remote line.
  assert.doesNotMatch(remoteCommandArgv({ route: forwardOf(TUNNEL)!.route, home: '/srv/me', argv: ['x'], key: 'bad;key', which: 'doctor' }).at(-1)!, /services\//);
});

// FD-203: the folder this Mac knows (here a worktree of its own) is not on the machine the agent is placed on; the session
// opens in the folder that machine has, and a machine that has none says so before anything starts.
test('FD-203: the candidates are the chosen folder, then the repository checkout under DATA, each once', () => {
  assert.deepEqual(remoteFolderCandidates({ folder: '/srv/me/DATA/_worktrees/tool-copy', home: '/srv/me', repository: 'https://github.com/example/tool-agent' }),
    ['/srv/me/DATA/_worktrees/tool-copy', '/srv/me/DATA/tool-agent']);
  assert.deepEqual(remoteFolderCandidates({ folder: '/srv/me/DATA/agent', home: '/srv/me', repository: 'git@github.com:example/agent.git' }), ['/srv/me/DATA/agent']);
  assert.deepEqual(remoteFolderCandidates({ folder: null, home: '/srv/me' }), []);
});

test('FD-203: the folder probe asks a plain sh for each candidate under the remote home and reads its answer', () => {
  const argv = folderProbeArgv(forwardOf(TUNNEL)!.route, ['/srv/me/DATA/_worktrees/tool-copy', '/srv/me/DATA/tool-agent'], '/srv/me');
  assert.deepEqual(argv.slice(0, 7), ['/usr/bin/ssh', '-T', '-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']);
  assert.equal(argv.at(-2), 'me@192.0.2.9');
  assert.match(argv.at(-1)!, /^\/bin\/sh -c '/);
  assert.match(argv.at(-1)!, /"\$HOME"\/'\\''DATA\/_worktrees\/tool-copy'\\'' "\$HOME"\/'\\''DATA\/tool-agent'\\''/);
  assert.equal(folderOf({ code: 0, stdout: 'fabric-dir:/srv/them/DATA/tool-agent\n' }), '/srv/them/DATA/tool-agent');
  assert.equal(folderOf({ code: 0, stdout: 'fabric-dir-none\n' }), 'none');
  assert.equal(folderOf({ code: 255, stdout: '' }), null);
});

test('FD-203: a worktree of this Mac absent there: the session opens in the repository checkout the other machine has', POSIX, async () => {
  const asked: string[] = [];
  const r = rig({ placed: { placedOn: 'm-studio' }, jobs: [TUNNEL], folderHere: true, repository: 'https://github.com/example/tool-agent',
    there: (line) => { asked.push(line); return { code: 0, stdout: `fabric-dir:${remoteHome}/DATA/tool-agent\n`, stderr: '' }; } });
  assert.deepEqual(await r.host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: true });
  assert.match(asked[0]!, /DATA\/agent.*DATA\/tool-agent/);
  assert.match(r.spawned[0]!.args.at(-1)!, /^cd '\/srv\/them\/DATA\/tool-agent' && /);
});

test('FD-203: a machine with neither folder refuses before anything starts, and the console names why', POSIX, async () => {
  const r = rig({ placed: { placedOn: 'm-studio' }, jobs: [TUNNEL], folderHere: true, there: () => ({ code: 0, stdout: 'fabric-dir-none\n', stderr: '' }) });
  assert.deepEqual(await r.host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: false, reason: 'remote', detail: 'no-folder' });
  assert.deepEqual(r.spawned, []);
  assert.equal(remoteRefusal('no-folder'), 'console.remote.noFolder');
  const silent = rig({ placed: { placedOn: 'm-studio' }, jobs: [TUNNEL], folderHere: true, there: () => ({ code: 255, stdout: '', stderr: 'timeout' }) });
  assert.deepEqual(await silent.host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: false, reason: 'remote', detail: 'unreachable' });
});
