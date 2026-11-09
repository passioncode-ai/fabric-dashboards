// FD-191 (SCN-101, SCN-102): New session in the Sessions mode and New agent in the agent list: the console keys of their
// own, the projects folder, the permission and isolation choices, the new agent's brief, the dialog's door for agents
// (the console channel's `session.new`) and the main process's start.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost, newSessionChoiceOf } from '../src/electron/console';
import { isNewAgentKey, isNewSessionKey, isOwnConsoleKey, isolatedBlock, newAgentMarkdown, newSessionKey, prepareNewAgent, projectsFolder } from '../src/core/new-session';
import { planStart } from '../src/core/consoles';
import { openConsolesOf, parseRequest } from '../src/core/console-channel';
import { createAnalytics } from '../src/core/analytics';
import { merge, SettingsStore } from '../src/core/settings';
import { isolatedWhy, newSessionFailText } from '../src/renderer/components/NewSessionDialog';
import { mergeSessions, type SessionRow } from '../src/core/sessions';
import { t } from '../src/core/i18n';
import { tmp } from './helpers';

const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake runtimes are shell scripts' };
const GB = 1024 ** 3;

test('FD-191: a session of its own gets a console key of its own that no agent has, and a new agent its own kind', () => {
  const s = newSessionKey('session', 'a');
  const a = newSessionKey('agent', 'a');
  assert.match(s, /^session\.[0-9a-f]{12}$/);
  assert.match(a, /^session\.agent-[0-9a-f]{12}$/);
  assert.notEqual(newSessionKey('session'), newSessionKey('session'), 'two starts never share a key');
  assert.ok(isNewSessionKey(s) && isNewSessionKey(a) && !isNewAgentKey(s) && isNewAgentKey(a));
  assert.ok(isOwnConsoleKey(s) && isOwnConsoleKey('handover.ho-1') && !isOwnConsoleKey('telegram-gateway.default'));
  // The console's IPC takes it: the service-key shape.
  assert.match(a, /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/);
});

test('FD-191: the dialog opens on the projects folder: the last chosen, else the parent of most consoles\' folders, else a usual one, else home', () => {
  const home = path.resolve('/Users/p');
  const at = (...p: string[]) => path.join(home, ...p);
  const dirs = new Set([at('Developer'), at('work'), at('last')]);
  const isDir = (p: string) => dirs.has(p);
  assert.equal(projectsFolder({ last: at('last'), consoleFolders: [], home, isDir }), at('last'));
  assert.equal(projectsFolder({ last: at('gone'), consoleFolders: [at('work', 'a'), at('work', 'b'), at('Developer', 'c')], home, isDir }), at('work'), 'two agents in one folder make it the projects folder');
  assert.equal(projectsFolder({ last: null, consoleFolders: [at('work', 'a')], home, isDir }), at('Developer'), 'one is not a pattern: the usual folder');
  assert.equal(projectsFolder({ last: null, consoleFolders: [at('x'), at('y')], home, isDir }), at('Developer'), 'folders straight in home do not make home the find');
  assert.equal(projectsFolder({ last: null, consoleFolders: [null], home, isDir: () => false }), home);
});

test('FD-191: isolation needs Switchboard that launches in place, and Claude Code or Codex', () => {
  assert.equal(isolatedBlock({ switchboard: false, inPlace: false, provider: 'claude' }), 'no-switchboard');
  assert.equal(isolatedBlock({ switchboard: true, inPlace: false, provider: 'claude' }), 'old-switchboard');
  assert.equal(isolatedBlock({ switchboard: true, inPlace: true, provider: null }), 'provider');
  assert.equal(isolatedBlock({ switchboard: true, inPlace: true, provider: 'codex' }), null);
  assert.equal(isolatedWhy({ switchboard: true, inPlace: true }, 'codex'), null, 'the dialog says the same');
  assert.equal(isolatedWhy({ switchboard: true, inPlace: true }, null), 'provider');
});

test('FD-191: planStart keeps the permission prompts when asked, and runs an isolated session through Switchboard only', () => {
  const runtime = { id: 'claude-code', name: 'Claude Code', path: '/bin/claude', provider: 'claude' as const, continueArgs: ['--continue'] };
  const base = { runtime, mode: 'new' as const, folder: '/w', binding: { kind: 'none' as const }, switchboard: '/bin/sb', inPlace: true };
  const plain = planStart({ ...base });
  assert.ok(plain.kind === 'run' && plain.argv.includes('--dangerously-skip-permissions'), 'absent: without prompts, as FD-174');
  const asks = planStart({ ...base, bypass: false });
  assert.ok(asks.kind === 'run' && !asks.argv.includes('--dangerously-skip-permissions'));
  const iso = planStart({ ...base, isolated: true });
  assert.ok(iso.kind === 'run');
  assert.deepEqual(iso.argv.slice(0, 9), ['/bin/sb', 'launch', '--provider', 'claude', '--mode', 'isolated', '--working-directory', '/w', '--in-place']);
  assert.deepEqual(planStart({ ...base, isolated: true, switchboard: null }), { kind: 'refused', reason: 'isolated', detail: 'no-switchboard' }, 'never quietly an ordinary session');
  assert.deepEqual(planStart({ ...base, isolated: true, runtime: { ...runtime, provider: null } }), { kind: 'refused', reason: 'isolated', detail: 'provider' });
});

test('FD-191 (SCN-102): the new agent\'s brief names the folder, the skills and the proof, and its pack is the person\'s alone', { skip: process.platform === 'win32' && 'POSIX file modes' }, () => {
  const md = newAgentMarkdown({ folder: '/Users/p/Developer' });
  for (const s of ['/Users/p/Developer', 'creating-fabric-agents', 'adapting-projects-to-fabric', 'building-fabric-services', 'list_services', 'one question at a time']) assert.ok(md.includes(s), s);
  assert.ok(!md.includes('\u2014'), 'no em dash');
  const dir = path.join(tmp('fd-na-'), 'session.agent-0123456789ab');
  const server = { command: '/app/mcp', args: [] as string[] };
  const claude = prepareNewAgent({ dir, runtimeId: 'claude-code', folder: '/Users/p/Developer', server });
  assert.equal(fs.statSync(claude.file).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(claude.file, 'utf8'), md);
  assert.ok(claude.handoff.before.includes('--append-system-prompt'));
  assert.match(claude.handoff.after[0]!, /Read .*agent\.md and let's create a new agent together\./);
  const codex = prepareNewAgent({ dir, runtimeId: 'codex', folder: '/Users/p/Developer', server });
  assert.ok(codex.handoff.before.includes('-c') && /agent\.md/.test(codex.handoff.after[0]!));
  assert.deepEqual(prepareNewAgent({ dir, runtimeId: 'goose', folder: '/x', server }).handoff, { before: [], after: [] }, 'another runtime starts with nothing added');
});

test('FD-191: the last choices are kept, a bad one dropped; a session\'s permission and isolation survive a reload', () => {
  const d = merge({});
  assert.deepEqual(d.newSession, { runtime: null, folder: null, bypass: true, isolated: false }, 'without prompts at first (FD-174), not isolated');
  const w = tmp('fd-ns-w-'); // absolute on every system
  const m = merge({ newSession: { runtime: 'Bad Id', folder: 'relative', bypass: false, isolated: true }, consoles: { 'session.0123456789ab': { runtime: 'codex', folder: w, bypass: false, isolated: true }, 'a.b': { runtime: 'codex', folder: w, bypass: 'yes' } } } as never);
  assert.deepEqual(m.newSession, { runtime: null, folder: null, bypass: false, isolated: true });
  assert.deepEqual(m.consoles['session.0123456789ab'], { runtime: 'codex', folder: w, bypass: false, isolated: true });
  assert.ok(!('bypass' in m.consoles['a.b']!), 'not a boolean: dropped');
  const store = new SettingsStore(tmp('fd-ns-set-'));
  store.update({ consoles: { 'session.0123456789ab': { runtime: 'codex', folder: w }, 'a.b': { runtime: null, folder: null } } });
  store.dropConsoles(['session.0123456789ab']);
  assert.deepEqual(Object.keys(store.get().consoles), ['a.b']);
});

test('FD-191: the console channel takes `session.new` with only its own fields, each checked', () => {
  const ok = parseRequest(JSON.stringify({ key: 'k', op: 'session.new', start: { kind: 'agent', runtime: 'codex', folder: '/Users/p/Developer', bypass: false, isolated: true } }));
  assert.deepEqual(ok, { ok: true, request: { key: 'k', op: 'session.new', service: '', start: { kind: 'agent', runtime: 'codex', folder: '/Users/p/Developer', bypass: false, isolated: true } } });
  assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'session.new', start: { kind: 'session' } })), { ok: true, request: { key: 'k', op: 'session.new', service: '', start: { kind: 'session' } } }, 'every choice may be left to the dialog');
  for (const start of [{ kind: 'other' }, { kind: 'session', folder: 'relative' }, { kind: 'session', runtime: 'Bad' }, { kind: 'session', bypass: 'yes' }, { kind: 'session', extra: 1 }]) {
    assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'session.new', start })), { ok: false, code: 'bad-start' }, JSON.stringify(start));
  }
  assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'session.new', service: 'a.b', start: { kind: 'session' } })), { ok: false, code: 'bad-start' }, 'it names no service');
  assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'console.new', service: 'a.b', start: { kind: 'session' } })), { ok: false, code: 'unknown-field' });
  assert.equal(newSessionChoiceOf({ kind: 'session', runtime: 'claude-code', folder: '/w', bypass: true, isolated: false })?.folder, '/w');
  assert.equal(newSessionChoiceOf({ kind: 'session', runtime: 'claude-code', folder: '/w', bypass: 1, isolated: false }), null);
  assert.equal(newSessionChoiceOf({ kind: 'session', runtime: 'claude-code', folder: 'w', bypass: true, isolated: false }), null);
});

test('FD-191: a running session of its own is a console with no agent in the channel\'s list', () => {
  const rows = mergeSessions({ now: Date.now(), switchboard: [], pending: [], stops: [], records: [], dismissed: [],
    consoles: [{ key: 'session.0123456789ab', folder: '/w/p', agent: 'Claude Code', startedAt: Date.now() - 1000, origin: 'here', account: null }] });
  assert.equal(rows[0]?.origin, 'here');
  assert.equal(openConsolesOf(rows as SessionRow[], () => null)[0]?.service, null);
});

test('FD-191: `session_started` carries kinds only: any coding agent but the two reads `other`', () => {
  const sent: Record<string, unknown>[] = [];
  const a = createAnalytics({
    bundle: { appKey: 'A-K', host: 'https://x', debug: false }, enabled: () => true, appVersion: '1.0.0', packaged: true, osName: 'macOS', stateFile: path.join(tmp('fd-an-'), 's.json'), installationFile: path.join(tmp('fd-an-'), 'i.json'),
    fetch: async (_u, init) => { for (const e of JSON.parse(init.body) as { eventName: string; props: Record<string, unknown> }[]) sent.push({ name: e.eventName, ...e.props }); return { status: 200 }; },
  } as never);
  a.sessionStarted({ kind: 'agent', runtime: 'goose', bypass: true, isolated: false });
  a.sessionStarted({ kind: 'session', runtime: 'codex', bypass: false, isolated: true });
  return a.flush().then(() => {
    assert.deepEqual(sent.map(({ name, kind, runtime, bypass, isolated }) => ({ name, kind, runtime, bypass, isolated })), [
      { name: 'session_started', kind: 'agent', runtime: 'other', bypass: true, isolated: false },
      { name: 'session_started', kind: 'session', runtime: 'codex', bypass: false, isolated: true },
    ]);
  });
});

test('FD-191: what a refused start says', () => {
  const tt = (key: string, p?: Record<string, string | number>) => t('en', key, p);
  assert.equal(newSessionFailText(tt, { ok: false, reason: 'no-folder' }), 'This folder no longer exists. Choose another.');
  assert.equal(newSessionFailText(tt, { ok: false, reason: 'isolated', detail: 'provider' }), 'Switchboard isolates only Claude Code and Codex sessions.');
  assert.match(newSessionFailText(tt, { ok: false, reason: 'admission', why: 'cap', cap: 6 }), /6 console sessions/);
});

// ── the main process's start ──

function rig(o: { switchboard?: boolean; inPlace?: boolean } = {}) {
  const base = tmp('fd-ns-');
  const bin = path.join(base, 'bin');
  const folder = path.join(base, 'projects');
  fs.mkdirSync(bin); fs.mkdirSync(folder);
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'goose'), '#!/bin/sh\n', { mode: 0o755 });
  if (o.switchboard) fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  const spawned: { file: string; args: string[]; cwd: string }[] = [];
  const started: unknown[] = [];
  const failed: string[] = [];
  const exits = new Map<number, (e: { exitCode: number; signal?: number }) => void>();
  let pid = 2_000_000_000;
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => false, log: () => {},
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'), packRoot: path.join(base, 'packs'), mcpServer: () => ({ command: '/app/mcp', args: [] }),
    run: async (_file, args) => {
      const line = args.join(' ');
      if (line === 'launch --help' && o.inPlace) return { code: 0, stdout: '--provider --in-place --surface', stderr: '' };
      if (line.startsWith('--json project show')) return { code: 0, stdout: JSON.stringify({ ok: true, data: { project: null, rules: [] } }), stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file, args, opts) => {
      spawned.push({ file, args, cwd: opts.cwd });
      const me = pid++;
      return { pid: me, onData: () => ({ dispose() {} }), onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { exits.set(me, cb); return { dispose() {} }; }, write() {}, resize() {}, kill() {} };
    },
    killGroup: (p) => { setTimeout(() => exits.get(p)?.({ exitCode: 0, signal: 1 }), 1); },
    idleMs: 0,
    machine: async () => ({ freeDisk: 50 * GB, swap: null, running: 0 }),
    started: (p) => started.push(p), failed: (c) => failed.push(c),
    home: base,
  });
  return { host, base, folder, settings, spawned, started, failed };
}

test('FD-191 (SCN-101): New session starts the chosen coding agent in the chosen folder, listed as a session of its own', POSIX, async () => {
  const r = rig();
  const o = await r.host.newSessionOptions();
  assert.deepEqual(o.runtimes.map((x) => [x.id, x.bypass]), [['claude-code', true], ['goose', false]]);
  assert.equal(o.runtime, 'claude-code');
  assert.equal(o.switchboard, false);
  const done = await r.host.startNew({ kind: 'session', runtime: 'claude-code', folder: r.folder, bypass: true, isolated: false }, { cols: 80, rows: 24 });
  assert.ok(done.ok);
  const key = done.ok ? done.key : '';
  assert.ok(isNewSessionKey(key) && !isNewAgentKey(key));
  assert.equal(r.spawned[0]!.cwd, r.folder);
  assert.ok(r.spawned[0]!.args.includes('--dangerously-skip-permissions'));
  assert.deepEqual(r.started, [{ kind: 'session', runtime: 'claude-code', bypass: true, isolated: false }]);
  const row = r.host.sessionsStatus().rows.find((x) => x.key === key);
  assert.equal(row?.state, 'running-ours');
  assert.equal(row?.folder, r.folder);
  assert.deepEqual(r.settings.get().newSession, { runtime: 'claude-code', folder: r.folder, bypass: true, isolated: false }, 'remembered for the next dialog');
  assert.equal((await r.host.newSessionOptions()).folder, r.folder, 'the next dialog opens on it');
});

test('FD-191: with the prompts kept, the start and its Continue both run without the bypass flag', POSIX, async () => {
  const r = rig();
  const done = await r.host.startNew({ kind: 'session', runtime: 'claude-code', folder: r.folder, bypass: false, isolated: false }, { cols: 80, rows: 24 });
  assert.ok(done.ok);
  const key = done.ok ? done.key : '';
  assert.ok(!r.spawned[0]!.args.includes('--dangerously-skip-permissions'));
  r.host.stopByPerson(key);
  await new Promise((res) => setTimeout(res, 30));
  const again = await r.host.start(key, 'continue', { cols: 80, rows: 24 });
  assert.ok(again.ok);
  assert.ok(!r.spawned[1]!.args.includes('--dangerously-skip-permissions'), 'Continue keeps the choice');
  assert.ok(r.spawned[1]!.args.includes('--continue'));
});

test('FD-191 (SCN-102): New agent starts with the brief to create one, in the projects folder', POSIX, async () => {
  const r = rig();
  const done = await r.host.startNew({ kind: 'agent', runtime: 'claude-code', folder: r.folder, bypass: true, isolated: false }, { cols: 80, rows: 24 });
  assert.ok(done.ok);
  const key = done.ok ? done.key : '';
  assert.ok(isNewAgentKey(key));
  const brief = path.join(r.base, 'packs', key, 'agent.md');
  assert.ok(fs.readFileSync(brief, 'utf8').includes(r.folder));
  assert.ok(r.spawned[0]!.args.includes('--append-system-prompt'));
  assert.ok(r.spawned[0]!.args.some((a) => a.includes('agent.md')));
});

test('FD-191: a refused start says why and leaves no console choice behind', POSIX, async () => {
  const r = rig();
  const before = Object.keys(r.settings.get().consoles).length;
  assert.deepEqual(await r.host.startNew({ kind: 'session', runtime: 'codex', folder: r.folder, bypass: true, isolated: false }, { cols: 80, rows: 24 }), { ok: false, reason: 'no-runtime' });
  assert.deepEqual(await r.host.startNew({ kind: 'session', runtime: 'claude-code', folder: path.join(r.base, 'gone'), bypass: true, isolated: false }, { cols: 80, rows: 24 }), { ok: false, reason: 'no-folder' });
  assert.deepEqual(await r.host.startNew({ kind: 'session', runtime: 'claude-code', folder: r.folder, bypass: true, isolated: true }, { cols: 80, rows: 24 }), { ok: false, reason: 'isolated', detail: 'no-switchboard' });
  assert.equal(r.spawned.length, 0);
  assert.equal(Object.keys(r.settings.get().consoles).length, before);
  // A runtime with no verified switch starts with its prompts, whatever the box said.
  const goose = await r.host.startNew({ kind: 'session', runtime: 'goose', folder: r.folder, bypass: true, isolated: false }, { cols: 80, rows: 24 });
  assert.ok(goose.ok);
  assert.deepEqual(r.started, [{ kind: 'session', runtime: 'goose', bypass: false, isolated: false }]);
});

test('FD-191: an isolated session runs through Switchboard in place, on the account\'s own home', POSIX, async () => {
  const r = rig({ switchboard: true, inPlace: true });
  const o = await r.host.newSessionOptions();
  assert.ok(o.switchboard && o.inPlace);
  const done = await r.host.startNew({ kind: 'session', runtime: 'claude-code', folder: r.folder, bypass: true, isolated: true }, { cols: 80, rows: 24 });
  assert.ok(done.ok);
  const argv = [r.spawned[0]!.file, ...r.spawned[0]!.args];
  assert.equal(path.basename(argv[0]!), 'switchboard');
  assert.deepEqual(argv.slice(1, 6), ['launch', '--provider', 'claude', '--mode', 'isolated']);
  assert.ok(argv.includes('--in-place') && argv.includes('--dangerously-skip-permissions'));
});
