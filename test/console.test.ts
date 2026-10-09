// ADR-0017: the agent console — which runtimes are offered, which folder a service's code lives in,
// how Switchboard decides the account, and the console sessions themselves on a fake PTY.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { findCheckout, originOf, repoId } from '../src/core/repofind';
import { bindingFor, canLaunchInPlace, findSwitchboard, inPlaceArgv, terminalLaunchArgv } from '../src/core/switchboard';
import { detectRuntimes, KNOWN_RUNTIMES, loginPathFrom, readLoginPath, runtimeArgs, searchDirs, type RuntimeSpec } from '../src/core/runtimes';
import { ConsoleManager, endWorkQuestion, planStart, shellQuote, terminalScript, type PtyLike, type SpawnPty } from '../src/core/consoles';
import { tmp } from './helpers';

function bin(dir: string, name: string, mode = 0o755): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, '#!/bin/sh\n');
  fs.chmodSync(file, mode);
  return file;
}

// ── runtimes ─────────────────────────────────────────────────────────────────────────────

test('REQ-05: only installed, executable runtimes are offered — Claude Code and Codex first, then the rest in catalog order', { skip: process.platform === 'win32' && 'POSIX execute bits; the Windows variant follows' }, () => {
  const base = tmp('fd-rt-');
  const a = path.join(base, 'a');
  const b = path.join(base, 'b');
  bin(a, 'codex');
  bin(b, 'claude');
  bin(b, 'gemini');
  bin(a, 'goose', 0o644); // not executable: not offered
  fs.mkdirSync(path.join(a, 'aider')); // a directory with the name: not offered
  const found = detectRuntimes([a, b, path.join(base, 'absent')], KNOWN_RUNTIMES);
  assert.deepEqual(found.map((r) => r.id), ['claude-code', 'codex', 'gemini-cli']);
  assert.equal(found[0]!.path, path.join(b, 'claude'));
  assert.equal(found[1]!.provider, 'codex');
  assert.equal(found[2]!.provider, null, 'Switchboard binds accounts for Claude Code and Codex only');
});

test('FD-37 REQ-05: on Windows a runtime is found by PATHEXT — claude.exe, codex.cmd — and a bare name or a folder is not', () => {
  const base = tmp('fd-rt-win-');
  const a = path.join(base, 'a');
  const b = path.join(base, 'b');
  fs.mkdirSync(a, { recursive: true });
  fs.mkdirSync(b, { recursive: true });
  fs.writeFileSync(path.join(a, 'codex.cmd'), '@echo off\r\n');
  fs.writeFileSync(path.join(b, 'claude.exe'), 'MZ');
  fs.writeFileSync(path.join(b, 'gemini.CMD'), '@echo off\r\n');
  fs.writeFileSync(path.join(a, 'goose'), 'no extension'); // not runnable on Windows
  fs.mkdirSync(path.join(a, 'aider.exe')); // a folder with the name: not offered
  const exists = (p: string) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  const found = detectRuntimes([a, b], KNOWN_RUNTIMES, 'win32', { PATHEXT: '.COM;.EXE;.BAT;.CMD' }, exists);
  assert.deepEqual(found.map((r) => r.id), ['claude-code', 'codex', 'gemini-cli']);
  assert.equal(found[0]!.path, path.join(b, 'claude.exe'));
  assert.equal(found[1]!.path, path.join(a, 'codex.cmd'));
});

test('FD-37 REQ-05: the install folders searched on Windows and on Linux', () => {
  const win = searchDirs(['C:\\Windows\\system32'], 'C:\\Users\\x', 'win32', { APPDATA: 'C:\\Users\\x\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' });
  assert.equal(win[0], 'C:\\Windows\\system32');
  for (const d of ['C:\\Users\\x\\AppData\\Roaming\\npm', 'C:\\Users\\x\\.cargo\\bin', 'C:\\Users\\x\\.bun\\bin', 'C:\\Users\\x\\scoop\\shims', 'C:\\Users\\x\\AppData\\Local\\Microsoft\\WinGet\\Links']) assert.ok(win.includes(d), d);
  assert.ok(!win.some((d) => d.startsWith('/')), 'no POSIX folder on Windows');
  const linux = searchDirs(['/usr/bin'], '/home/x', 'linux', {});
  for (const d of ['/home/x/.local/bin', '/home/linuxbrew/.linuxbrew/bin', '/snap/bin', '/usr/local/bin']) assert.ok(linux.includes(d), d);
  assert.ok(!linux.includes('/opt/homebrew/bin'), 'Homebrew\'s macOS prefix is not searched on Linux');
});

test('REQ-05: the first PATH entry wins, as in a shell', () => {
  const base = tmp('fd-rt-order-');
  bin(path.join(base, 'first'), 'claude');
  bin(path.join(base, 'second'), 'claude');
  assert.equal(detectRuntimes([path.join(base, 'first'), path.join(base, 'second')], KNOWN_RUNTIMES)[0]!.path, path.join(base, 'first', 'claude'));
});

test('REQ-05: a catalog from Switchboard extends the list; IDE-only entries and duplicates are left out', () => {
  const base = tmp('fd-rt-cat-');
  bin(base, 'claude');
  bin(base, 'hermes');
  bin(base, 'zed');
  const extra: RuntimeSpec[] = [
    { id: 'hermes', name: 'Hermes Agent', binary: 'hermes', provider: null, continueArgs: null },
  ];
  assert.deepEqual(detectRuntimes([base], [...KNOWN_RUNTIMES, ...extra, ...extra]).map((r) => r.id), ['claude-code', 'hermes']);
});

test('REQ-09: New starts fresh; Continue resumes the last conversation where the runtime can, and is refused where it cannot', () => {
  const claude = KNOWN_RUNTIMES.find((r) => r.id === 'claude-code')!;
  const codex = KNOWN_RUNTIMES.find((r) => r.id === 'codex')!;
  const gemini = KNOWN_RUNTIMES.find((r) => r.id === 'gemini-cli')!;
  assert.deepEqual(runtimeArgs(claude, 'new'), []);
  assert.deepEqual(runtimeArgs(claude, 'continue'), ['--continue']);
  assert.deepEqual(runtimeArgs(codex, 'continue'), ['resume', '--last']);
  assert.throws(() => runtimeArgs(gemini, 'continue'), /cannot continue/);
});

test('REQ-05: the login PATH is read from the shell\'s marked line; the known install folders are added once', () => {
  const home = '/Users/x';
  const out = 'motd noise\n__FD_PATH__/opt/homebrew/bin:/usr/bin:/Users/x/.local/bin\nmore noise\n';
  assert.deepEqual(loginPathFrom(out), ['/opt/homebrew/bin', '/usr/bin', '/Users/x/.local/bin']);
  assert.deepEqual(loginPathFrom('no marker here'), []);
  const dirs = searchDirs(['/opt/homebrew/bin', '/usr/bin', '/Users/x/.local/bin'], home, 'darwin', {});
  assert.equal(dirs[0], '/opt/homebrew/bin');
  assert.equal(dirs.filter((d) => d === '/Users/x/.local/bin').length, 1);
  for (const d of ['/Users/x/.cargo/bin', '/Users/x/.bun/bin', '/Users/x/.npm-global/bin', '/usr/local/bin', '/bin']) assert.ok(dirs.includes(d), d);
});

// ── the folder a service's code lives in ─────────────────────────────────────────────────

function repo(dir: string, origin: string): string {
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.git', 'config'), `[core]\n\tbare = false\n[remote "upstream"]\n\turl = https://example.com/other/x.git\n[remote "origin"]\n\turl = ${origin}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`);
  return dir;
}

test('REQ-06: every common form of a repository address names the same repository', () => {
  const id = 'github.com/example/example-agent';
  for (const url of ['https://github.com/example/example-agent', 'https://github.com/Example/example-agent.git', 'https://github.com/example/example-agent/',
    'git@github.com:example/example-agent.git', 'ssh://git@github.com/example/example-agent.git', 'git+https://github.com/example/example-agent.git', 'http://github.com/example/example-agent']) {
    assert.equal(repoId(url), id, url);
  }
  assert.equal(repoId('not a url'), null);
  assert.equal(repoId('https://github.com/only-owner'), null);
});

test('REQ-06: the origin is read from .git/config, also for a worktree whose .git is a file', () => {
  const base = tmp('fd-repo-origin-');
  const main = repo(path.join(base, 'main'), 'git@github.com:example/example-agent.git');
  assert.equal(originOf(main), 'git@github.com:example/example-agent.git');
  const wt = path.join(base, 'wt');
  fs.mkdirSync(wt);
  fs.mkdirSync(path.join(main, '.git', 'worktrees', 'wt'), { recursive: true });
  fs.writeFileSync(path.join(main, '.git', 'worktrees', 'wt', 'commondir'), '../..\n');
  fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${path.join(main, '.git', 'worktrees', 'wt')}\n`);
  assert.equal(originOf(wt), 'git@github.com:example/example-agent.git');
  assert.equal(originOf(path.join(base, 'nothing')), null);
});

test('REQ-06: the checkout is found under the roots at depth 1 or 2; a main checkout beats a worktree; the command path is tried first', () => {
  const home = tmp('fd-repo-home-');
  const url = 'https://github.com/example/example-agent';
  repo(path.join(home, 'DATA', 'zz-other'), 'https://github.com/example/other.git');
  const deep = repo(path.join(home, 'Code', 'org', 'example-agent'), `${url}.git`);
  assert.equal(findCheckout({ repository: url, home }), deep);
  // A worktree with the same origin, found earlier in the walk, loses to the main checkout.
  const wt = path.join(home, 'DATA', 'aa-wt');
  fs.mkdirSync(wt, { recursive: true });
  fs.mkdirSync(path.join(deep, '.git', 'worktrees', 'aa'), { recursive: true });
  fs.writeFileSync(path.join(deep, '.git', 'worktrees', 'aa', 'commondir'), '../..\n');
  fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${path.join(deep, '.git', 'worktrees', 'aa')}\n`);
  assert.equal(findCheckout({ repository: url, home }), deep);
  // The descriptor's own command lives inside a checkout of the repository: that one, first.
  const viaCommand = repo(path.join(home, 'elsewhere', 'example-agent'), url);
  assert.equal(findCheckout({ repository: url, home, commandPaths: [path.join(viaCommand, '.venv', 'bin', 'agent')] }), viaCommand);
  assert.equal(findCheckout({ repository: 'https://github.com/nobody/nothing', home }), null);
  assert.equal(findCheckout({ repository: undefined, home }), null);
  // No repository named: the checkout the descriptor's own command runs from.
  assert.equal(findCheckout({ repository: undefined, home, commandPaths: [path.join(viaCommand, 'bin', 'x')] }), viaCommand);
  assert.equal(findCheckout({ repository: undefined, home, commandPaths: ['/usr/bin/true'] }), null, 'nothing outside home');
});

// ── Switchboard decides the account ──────────────────────────────────────────────────────

function fakeSwitchboard(answers: Record<string, { code?: number; stdout?: string; stderr?: string }>) {
  const calls: string[][] = [];
  const run = async (_cmd: string, args: string[]) => {
    calls.push(args);
    const key = args.filter((a) => !a.startsWith('/')).join(' ');
    const a = answers[key] ?? { code: 2, stderr: `unexpected ${key}` };
    return { code: a.code ?? 0, stdout: a.stdout ?? '', stderr: a.stderr ?? '' };
  };
  return { calls, run };
}
const ok = (data: unknown) => ({ stdout: JSON.stringify({ ok: true, data }) });

test('REQ-07: a folder in a Switchboard project is bound; one in none is not; a runtime with no Switchboard provider never is', async () => {
  const sb = fakeSwitchboard({
    '--json project show --path': ok({ path: '/x', project: { name: 'Growth', pool: 'growth', folders: ['/x'] }, rules: [] }),
  });
  assert.deepEqual(await bindingFor(sb.run, '/sb', '/x', 'claude'), { kind: 'project', name: 'Growth', pool: 'growth' });
  assert.deepEqual(await bindingFor(sb.run, '/sb', '/x', null), { kind: 'none' });
  assert.equal(sb.calls.length, 1, 'no query for a runtime Switchboard holds no account for');
  const none = fakeSwitchboard({ '--json project show --path': ok({ path: '/y', project: null, rules: [{ provider: 'claude', effective: null }] }) });
  assert.deepEqual(await bindingFor(none.run, '/sb', '/y', 'claude'), { kind: 'none' });
  const rule = fakeSwitchboard({ '--json project show --path': ok({ path: '/z', project: null, rules: [{ provider: 'codex', effective: { target: 'managed', enabled: true, account: { id: 'a1', pool: 'work' } } }] }) });
  assert.deepEqual(await bindingFor(rule.run, '/sb', '/z/repo', 'codex'), { kind: 'project', name: 'repo', pool: 'work' }, 'review R-2: the rule\'s account\'s pool, not default');
  const blind = fakeSwitchboard({ '--json project show --path': ok({ path: '/z', project: null, rules: [{ provider: 'codex', effective: { target: 'managed', enabled: true, account: null } }] }) });
  assert.equal((await bindingFor(blind.run, '/sb', '/z/repo', 'codex')).kind, 'error', 'a managed rule with no account is not guessed at');
});

test('REQ-07: an unreadable Switchboard answer is an error, never a silent fallback to the ordinary sign-in', async () => {
  const bad = fakeSwitchboard({ '--json project show --path': { code: 1, stderr: 'Start the desktop app or switchboard serve' } });
  assert.deepEqual(await bindingFor(bad.run, '/sb', '/x', 'claude'), { kind: 'error', detail: 'Start the desktop app or switchboard serve' });
  const garbage = fakeSwitchboard({ '--json project show --path': { stdout: 'not json' } });
  assert.equal((await bindingFor(garbage.run, '/sb', '/x', 'claude')).kind, 'error');
});

test('REQ-07: in-place launch is used only when this Switchboard has it (SB-75); otherwise Terminal with the pool\'s selected account', async () => {
  const old = fakeSwitchboard({ 'launch --help': { stdout: 'Usage: switchboard launch [OPTIONS] --working-directory <W> <ID>' } });
  assert.equal(await canLaunchInPlace(old.run, '/sb'), false);
  const next = fakeSwitchboard({ 'launch --help': { stdout: '--provider <P>\n--in-place  run here' } });
  assert.equal(await canLaunchInPlace(next.run, '/sb'), true);
  assert.deepEqual(inPlaceArgv('/sb', 'claude', '/x', ['--continue']), ['/sb', 'launch', '--provider', 'claude', '--mode', 'managed', '--working-directory', '/x', '--in-place', '--', '--continue']);
  assert.deepEqual(inPlaceArgv('/sb', 'codex', '/x', []), ['/sb', 'launch', '--provider', 'codex', '--mode', 'managed', '--working-directory', '/x', '--in-place']);
  const accounts = fakeSwitchboard({ '--json accounts list': ok({ accounts: [], routes: { 'claude:growth': '78fdfc1f-1aa6-4614-a021-66bce93b0582' } }) });
  assert.deepEqual(await terminalLaunchArgv(accounts.run, '/sb', 'claude', 'growth', '/x'), { argv: ['/sb', 'launch', '78fdfc1f-1aa6-4614-a021-66bce93b0582', '--mode', 'managed', '--working-directory', '/x'] });
  assert.deepEqual(await terminalLaunchArgv(accounts.run, '/sb', 'codex', 'growth', '/x'), { error: 'Switchboard selects no codex account in pool growth' });
});

test('REQ-07: Switchboard is found only as an executable on the search path', () => {
  const base = tmp('fd-sb-');
  assert.equal(findSwitchboard([base]), null);
  bin(base, 'switchboard');
  assert.equal(findSwitchboard([path.join(base, 'none'), base]), path.join(base, 'switchboard'));
});

// ── console sessions on a fake PTY ───────────────────────────────────────────────────────


function fakePty() {
  const spawned: { file: string; args: string[]; cwd: string; env: Record<string, string>; pty: PtyLike & { emit: (d: string) => void; exit: (code: number) => void; written: string[]; killed: string[]; size: number[] } }[] = [];
  const spawn: SpawnPty = (file, args, opts) => {
    let onData: (d: string) => void = () => undefined;
    let onExit: (e: { exitCode: number; signal?: number }) => void = () => undefined;
    const pty = {
      pid: 4242 + spawned.length, written: [] as string[], killed: [] as string[], size: [opts.cols, opts.rows],
      onData: (cb: (d: string) => void) => { onData = cb; return { dispose: () => undefined }; },
      onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { onExit = cb; return { dispose: () => undefined }; },
      write: (d: string) => { pty.written.push(d); },
      resize: (c: number, r: number) => { pty.size = [c, r]; },
      kill: (s?: string) => { pty.killed.push(s ?? 'SIGHUP'); },
      emit: (d: string) => onData(d),
      exit: (code: number) => onExit({ exitCode: code }),
      exitWith: (code: number, signal: number) => onExit({ exitCode: code, signal }),
    };
    spawned.push({ file, args, cwd: opts.cwd, env: opts.env, pty });
    return pty;
  };
  return { spawn, spawned };
}

const CLAUDE = { id: 'claude-code', name: 'Claude Code', binary: 'claude', provider: 'claude' as const, continueArgs: ['--continue'], path: '/bin/claude' };

test('REQ-08: one session per service, its output kept and replayed, input and size passed through, exit reported', () => {
  const f = fakePty();
  const m = new ConsoleManager({ spawn: f.spawn, env: () => ({ PATH: '/bin', ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '--inspect', HOME: '/h' }), ringChars: 10, killGroup: () => { throw new Error('fake'); } });
  const events: string[] = [];
  m.on('data', (e: { key: string; data: string }) => events.push(`${e.key}:${e.data}`));
  m.on('exit', (e: { key: string; code: number | null }) => events.push(`${e.key}:exit ${e.code}`));
  assert.deepEqual(m.start('a.default', { argv: ['/bin/claude', '--continue'], cwd: '/repo', label: 'Claude Code', env: { PATH: '/login/path:/bin' } }, { cols: 100, rows: 30 }), { ok: true });
  assert.deepEqual(m.start('a.default', { argv: ['/bin/claude'], cwd: '/repo', label: 'Claude Code' }, { cols: 80, rows: 24 }), { ok: false, error: 'running' }, 'a second start while one runs is refused');
  const s = f.spawned[0]!;
  assert.equal(s.file, '/bin/claude');
  assert.deepEqual(s.args, ['--continue']);
  assert.equal(s.cwd, '/repo');
  assert.equal(s.env.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(s.env.NODE_OPTIONS, undefined);
  assert.equal(s.env.TERM, 'xterm-256color');
  assert.equal(s.env.FABRIC_DASHBOARDS_SERVICE, 'a.default');
  assert.equal(s.env.PATH, '/login/path:/bin', 'review R-1: the session gets the login shell\'s PATH, not the app\'s');
  s.pty.emit('hello ');
  s.pty.emit('world!!');
  assert.equal(m.snapshot('a.default').output, 'lo world!!', 'the ring keeps the last N characters');
  assert.equal(m.snapshot('a.default').end, 13, 'the end counts everything printed, beyond the ring');
  m.input('a.default', 'ls\r');
  m.resize('a.default', 120, 40);
  assert.deepEqual(s.pty.written, ['ls\r']);
  assert.deepEqual(s.pty.size, [120, 40]);
  assert.equal(m.runningCount(), 1);
  s.pty.exit(3);
  const snap = m.snapshot('a.default');
  assert.equal(snap.state, 'exited');
  assert.equal(snap.exitCode, 3);
  assert.equal(m.runningCount(), 0);
  assert.deepEqual(events, ['a.default:hello ', 'a.default:world!!', 'a.default:exit 3']);
  assert.equal(m.snapshot('b.default').end, 0);
  assert.deepEqual(m.start('a.default', { argv: ['/bin/claude'], cwd: '/repo', label: 'Claude Code' }, { cols: 80, rows: 24 }), { ok: true }, 'exited: a new session may start');
  assert.equal(m.snapshot('a.default').output, '', 'a new session starts with a clean screen');
  assert.equal(m.snapshot('b.default').state, 'idle');
});

test('REQ-08, LC-02: stop and quit end every session; a removed service takes its session with it', async () => {
  const f = fakePty();
  const noGroup = () => { throw new Error('no such process group'); };
  const m = new ConsoleManager({ spawn: f.spawn, env: () => ({ PATH: '/bin' }), killGraceMs: 20, killGroup: noGroup });
  m.start('a.default', { argv: ['/bin/claude'], cwd: '/r', label: 'x' }, { cols: 80, rows: 24 });
  m.start('b.default', { argv: ['/bin/codex'], cwd: '/r', label: 'y' }, { cols: 80, rows: 24 });
  m.stop('a.default');
  assert.deepEqual(f.spawned[0]!.pty.killed, ['SIGHUP']);
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(f.spawned[0]!.pty.killed, ['SIGHUP', 'SIGKILL'], 'a runtime that ignores the hangup is killed after the grace');
  f.spawned[0]!.pty.exit(129);
  m.forget('b.default');
  assert.deepEqual(f.spawned[1]!.pty.killed, ['SIGHUP']);
  assert.equal(m.snapshot('b.default').state, 'idle');
  const g = fakePty();
  const q = new ConsoleManager({ spawn: g.spawn, env: () => ({}), killGraceMs: 10, killGroup: noGroup });
  q.start('a.default', { argv: ['/bin/claude'], cwd: '/r', label: 'x' }, { cols: 80, rows: 24 });
  const done = q.stopAll();
  g.spawned[0]!.pty.exit(0);
  await done;
  assert.equal(q.runningCount(), 0);
});

test('REQ-08: a runtime that cannot start is an error result, never a throw', () => {
  const m = new ConsoleManager({ spawn: () => { throw new Error('posix_spawnp failed'); }, env: () => ({}) });
  assert.deepEqual(m.start('a.default', { argv: ['/no/such'], cwd: '/r', label: 'x' }, { cols: 80, rows: 24 }), { ok: false, error: 'posix_spawnp failed' });
  assert.equal(m.snapshot('a.default').state, 'idle');
});

test('REQ-07, REQ-09: the start plan — plain runtime, Switchboard in place, Terminal only, or a refusal', () => {
  assert.deepEqual(planStart({ runtime: CLAUDE, mode: 'continue', folder: '/r', binding: { kind: 'none' }, switchboard: null, inPlace: false }),
    { kind: 'run', argv: ['/bin/claude', '--continue'], cwd: '/r' });
  assert.deepEqual(planStart({ runtime: CLAUDE, mode: 'new', folder: '/r', binding: { kind: 'project', name: 'Growth', pool: 'growth' }, switchboard: '/sb', inPlace: true }),
    { kind: 'run', argv: ['/sb', 'launch', '--provider', 'claude', '--mode', 'managed', '--working-directory', '/r', '--in-place'], cwd: '/r' });
  assert.deepEqual(planStart({ runtime: CLAUDE, mode: 'new', folder: '/r', binding: { kind: 'project', name: 'Growth', pool: 'growth' }, switchboard: '/sb', inPlace: false }),
    { kind: 'terminal-only', project: 'Growth', pool: 'growth' });
  assert.deepEqual(planStart({ runtime: CLAUDE, mode: 'new', folder: '/r', binding: { kind: 'error', detail: 'down' }, switchboard: '/sb', inPlace: true }),
    { kind: 'refused', reason: 'switchboard', detail: 'down' });
  const gemini = { id: 'gemini-cli', name: 'Gemini CLI', binary: 'gemini', provider: null, continueArgs: null, path: '/bin/gemini' };
  assert.deepEqual(planStart({ runtime: gemini, mode: 'continue', folder: '/r', binding: { kind: 'none' }, switchboard: null, inPlace: false }),
    { kind: 'refused', reason: 'no-continue', detail: 'Gemini CLI cannot continue a previous conversation' });
});

test('REQ-10: Open in Terminal builds a quoted script — no string from a folder name runs as code', () => {
  assert.equal(shellQuote("it's here"), `'it'\\''s here'`);
  assert.equal(terminalScript(['/bin/claude', '--continue'], "/Users/me/my 'repo'"), `cd '/Users/me/my '\\''repo'\\''' && exec '/bin/claude' '--continue'`);
});

test('review R-6, R-7: Stop signals the whole process group; a removed service\'s dying session still holds quit', async () => {
  const f = fakePty();
  const groups: string[] = [];
  const m = new ConsoleManager({ spawn: f.spawn, env: () => ({}), killGraceMs: 20, killGroup: (pid, sig) => { groups.push(`${pid}:${sig}`); } });
  m.start('a.default', { argv: ['/bin/claude'], cwd: '/r', label: 'x' }, { cols: 80, rows: 24 });
  m.stop('a.default');
  assert.deepEqual(groups, ['4242:SIGHUP']);
  assert.deepEqual(f.spawned[0]!.pty.killed, [], 'the group got it, not only the top process');
  f.spawned[0]!.pty.exit(0);
  m.start('b.default', { argv: ['/bin/codex'], cwd: '/r', label: 'y' }, { cols: 80, rows: 24 });
  m.forget('b.default');
  assert.equal(m.snapshot('b.default').state, 'idle', 'nothing of it is shown again');
  assert.equal(m.runningCount(), 1, 'but it still counts until it exits');
  const done = m.stopAll();
  f.spawned[1]!.pty.exit(0);
  await done;
  assert.equal(m.runningCount(), 0);
});

test('review R-10: a session ended by a signal says so', () => {
  const f = fakePty();
  const m = new ConsoleManager({ spawn: f.spawn, env: () => ({}), killGroup: () => undefined });
  const exits: unknown[] = [];
  m.on('exit', (e) => exits.push(e));
  m.start('a.default', { argv: ['/bin/claude'], cwd: '/r', label: 'x' }, { cols: 80, rows: 24 });
  (f.spawned[0]!.pty as unknown as { exitWith: (c: number, s: number) => void }).exitWith(0, 1);
  assert.deepEqual(exits, [{ key: 'a.default', code: 0, signal: 1 }]);
  assert.equal(m.snapshot('a.default').signal, 1);
});

test('audit 2026-10-07: a login shell that hangs is cut at the deadline with everything its rc files started', { skip: process.platform === 'win32' && 'Windows reads PATH from the environment, with no login shell' }, async () => {
  const dir = tmp('fd-shell-');
  const pidFile = path.join(dir, 'child.pid');
  const shell = path.join(dir, 'fake-shell');
  // Prints first, then hangs with a background child: the deadline (2 s, roomy under a loaded suite) cuts both.
  fs.writeFileSync(shell, `#!/bin/sh\nprintf '\\n__FD_PATH__/opt/a:/opt/b\\n'\nsleep 30 &\necho $! > ${JSON.stringify(pidFile)}\nwait\n`, { mode: 0o755 });
  const started = Date.now();
  const dirs = await readLoginPath(2000, shell);
  assert.deepEqual(dirs, ['/opt/a', '/opt/b'], 'what was printed before the deadline is kept');
  assert.ok(Date.now() - started < 5000, `ended after ${Date.now() - started} ms`);
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  await new Promise((r) => setTimeout(r, 200));
  assert.throws(() => process.kill(pid, 0), /ESRCH/, 'the shell\'s background child is gone too');
});

test('audit HIGH-2: a restart or a quit asks before ending consoles or commands, and names them', () => {
  assert.equal(endWorkQuestion('en', { kind: 'restart', consoles: [], commands: 0 }), null, 'nothing running: no question');
  const q = endWorkQuestion('en', { kind: 'restart', consoles: ['Growth · projection'], commands: 2 })!;
  assert.match(q.message, /Restart to update/);
  assert.match(q.detail, /The console of Growth · projection is running/);
  assert.match(q.detail, /Commands still running: 2/);
  assert.equal(q.confirm, 'Restart to Update');
  const ru = endWorkQuestion('ru', { kind: 'quit', consoles: ['Research'], commands: 0 })!;
  assert.match(ru.message, /^Завершить Fabric Dashboards/);
  assert.match(ru.detail, /Работает консоль агента Research/);
  assert.equal(ru.confirm, 'Завершить');
});
