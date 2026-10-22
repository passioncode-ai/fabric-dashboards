// FD-83 (Switchboard SB-115): the console is the host that continues a session stopped on a usage limit. Switchboard's
// answer is parsed strictly; a ready stop is claimed once and continued with `--resume` only when nothing can be
// writing its transcript; everything else is listed for the person with why; the MCP `audit` answers the same.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Runner } from '@passioncode-ai/fabric-service-host';
import { ConsoleHost } from '../src/electron/console';
import { liveAgents, parseRecovery, RESUME_BRIEF, RESUME_MAX_AGE_MS, resumeArgs, resumeOwnKey, sessionOpen, transcriptOf, verdictOf, type SbStop } from '../src/core/recovery';
import { isHandoverKey } from '../src/core/switchboard';
import { limitStops } from '../src/mcp/tools';
import { merge } from '../src/core/settings';
import { tmp } from './helpers';

const GB = 1024 ** 3;
const NOW = 1_792_617_104_000;
const SID = '5f151e9c-cc90-4fed-a01b-101c647f52ab';
const ok = (data: unknown) => ({ code: 0, stdout: JSON.stringify({ ok: true, data }), stderr: '' });
const row = (o: { dir?: string; session?: string; event?: string; ready?: boolean; kind?: string; state?: string; at?: number; provider?: string; candidates?: string[] } = {}) => ({
  candidates: o.candidates ?? ['acc-2', 'acc-3'], mode: 'capacity', probe_at: null, ready: o.ready ?? true,
  stop: { account: 'acc-1', attempt: 2, directory: o.dir ?? '/tmp', event: o.event ?? `cc-${o.session ?? SID}-1792066929`, kind: o.kind ?? 'limit', mode: null, pool: 'default', provider: o.provider ?? 'claude', selected_account: null, session: o.session ?? SID, state: o.state ?? 'waiting', stopped_at: (o.at ?? NOW - 60_000) / 1000 },
});
const stop = (o: Partial<SbStop> = {}): SbStop => ({ event: `cc-${SID}-1`, session: SID, dir: '/tmp', provider: 'claude', candidates: ['acc-2'], ready: true, kind: 'limit', state: 'waiting', stoppedAt: NOW - 60_000, attempt: 1, ...o });
const none = { dirs: [], args: '' };

test('FD-83: the stop list is read strictly — a malformed row is skipped, never guessed at', () => {
  const stops = parseRecovery(JSON.stringify({ ok: true, data: { sessions: [
    row(), row({ session: 'not-a-uuid' }), row({ dir: 'relative/dir', session: '00000000-0000-0000-0000-000000000001' }), row({ provider: 'gemini', session: '00000000-0000-0000-0000-000000000002' }), { stop: null }, 'x',
  ] } }));
  assert.equal(stops?.length, 1);
  assert.deepEqual(stops![0], { event: `cc-${SID}-1792066929`, session: SID, dir: '/tmp', provider: 'claude', candidates: ['acc-2', 'acc-3'], ready: true, kind: 'limit', state: 'waiting', stoppedAt: NOW - 60_000, attempt: 2 });
  assert.equal(parseRecovery('{"ok":false}'), null);
  assert.equal(parseRecovery('not json'), null);
});

test('FD-83: only a ready, fresh limit stop whose transcript nothing can be writing is continued', () => {
  const yes = () => true;
  assert.equal(verdictOf(stop(), none, NOW, yes), 'resume');
  assert.equal(verdictOf(stop(), null, NOW, yes), 'open', 'live processes unknown: never resumed');
  assert.equal(verdictOf(stop(), { dirs: ['/tmp'], args: '' }, NOW, yes), 'open', 'an agent still works in its folder');
  assert.equal(verdictOf(stop(), { dirs: [], args: `claude --resume ${SID}` }, NOW, yes), 'open', 'a process names its session');
  assert.equal(verdictOf(stop({ ready: false }), none, NOW, yes), 'waiting');
  assert.equal(verdictOf(stop({ candidates: [] }), none, NOW, yes), 'waiting');
  assert.equal(verdictOf(stop({ kind: 'billing' }), none, NOW, yes), 'billing');
  assert.equal(verdictOf(stop({ state: 'claimed' }), none, NOW, yes), 'claimed');
  assert.equal(verdictOf(stop(), none, NOW, () => false), 'no-folder');
  assert.equal(verdictOf(stop(), none, NOW, yes, () => null), 'no-transcript', 'FD-84: not in the home a plain CLI reads');
  assert.equal(verdictOf(stop({ stoppedAt: NOW - RESUME_MAX_AGE_MS - 1 }), none, NOW, yes), 'old');
  assert.ok(sessionOpen(stop(), { dirs: ['/tmp/'], args: '' }), 'paths compare resolved');
});

test('FD-83: the session continues through its own CLI with one brief line; its own console key is a hand-over key', () => {
  assert.deepEqual(resumeArgs(stop()), ['--resume', SID, RESUME_BRIEF]);
  assert.deepEqual(resumeArgs(stop({ provider: 'codex' })), ['resume', SID, RESUME_BRIEF]);
  assert.ok(isHandoverKey(resumeOwnKey(stop())));
  assert.equal(resumeOwnKey(stop()), resumeOwnKey(stop()), 'the same stop keeps its key');
  assert.match(RESUME_BRIEF, /^[^—]+$/);
});

test('FD-84: the transcript is looked for in the home a plain claude or codex reads', () => {
  const home = tmp('fd-rs-home-');
  assert.equal(transcriptOf(stop(), home), null);
  fs.mkdirSync(path.join(home, '.claude', 'projects', '-srv-repo'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'projects', '-srv-repo', `${SID}.jsonl`), '{}\n');
  assert.equal(transcriptOf(stop(), home), path.join(home, '.claude', 'projects', '-srv-repo', `${SID}.jsonl`));
  const day = path.join(home, '.codex', 'sessions', '2026', '10', '21');
  fs.mkdirSync(day, { recursive: true });
  assert.equal(transcriptOf(stop({ provider: 'codex' }), home), null);
  fs.writeFileSync(path.join(day, `rollout-2026-10-21T10-00-00-${SID}.jsonl`), '{}\n');
  assert.ok(transcriptOf(stop({ provider: 'codex' }), home)?.endsWith(`${SID}.jsonl`));
});

test('FD-83: live processes are lsof cwd and ps args; lsof exiting 1 is still an answer, a failure is unknown', async () => {
  const run = (lsof: { code: number; stdout: string }, ps = { code: 0, stdout: 'a\nb' }): Runner => async (cmd) => ({ ...(cmd === 'lsof' ? lsof : ps), stderr: '' });
  assert.deepEqual(await liveAgents(run({ code: 0, stdout: 'p1\nfcwd\nn/srv/x/repo\np2\nn/srv/y\n' }), 'darwin'), { dirs: ['/srv/x/repo', '/srv/y'], args: 'a\nb' });
  assert.deepEqual(await liveAgents(run({ code: 1, stdout: '' }), 'darwin'), { dirs: [], args: 'a\nb' });
  assert.deepEqual(await liveAgents(run({ code: 1, stdout: 'p1\nn/srv/x/repo\n' }), 'darwin'), { dirs: ['/srv/x/repo'], args: 'a\nb' }, 'some processes unreadable: the rest is still an answer');
  assert.equal(await liveAgents(run({ code: 2, stdout: '' }), 'darwin'), null);
  assert.equal(await liveAgents(run({ code: 0, stdout: '' }, { code: 1, stdout: '' }), 'darwin'), null);
  assert.equal(await liveAgents(run({ code: 0, stdout: '' }), 'win32'), null);
});

test('FD-83: settings from an earlier version continue sessions by themselves; an explicit off stays off', () => {
  assert.equal(merge({}).resumeAfterLimit, true);
  assert.equal(merge({ resumeAfterLimit: false }).resumeAfterLimit, false);
});

function rig(o: { sessions?: (dir: string) => unknown[]; live?: { inFolder?: boolean; args?: string }; on?: boolean; claim?: number; freeDisk?: number; serviceFolder?: boolean; spawnFails?: boolean; exitsAtOnce?: boolean; noTranscript?: boolean; silent?: boolean } = {}) {
  const base = tmp('fd-rs-');
  const bin = path.join(base, 'bin');
  const dir = path.join(base, 'checkout');
  fs.mkdirSync(bin); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  const home = path.join(base, 'home');
  fs.mkdirSync(path.join(home, '.claude', 'projects', 'p'), { recursive: true });
  if (!o.noTranscript) for (const id of [SID, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']) fs.writeFileSync(path.join(home, '.claude', 'projects', 'p', `${id}.jsonl`), '{}\n');
  let settings = { resumeAfterLimit: o.on ?? true, consoles: o.serviceFolder ? { 'agent.default': { runtime: 'claude-code', folder: dir } } : {} } as Record<string, unknown>;
  const calls: string[][] = [];
  const spawned: { file: string; args: string[]; cwd: string }[] = [];
  const logs: string[] = [];
  const host = new ConsoleHost({
    settings: { get: () => settings, update: (p: Record<string, unknown>) => { settings = { ...settings, ...p }; } } as never,
    snapshot: () => null, window: () => null, visible: () => false, log: (l) => logs.push(l),
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (file, args) => {
      calls.push([path.basename(file), ...args]);
      if (args.join(' ') === '--json recovery') return ok({ sessions: (o.sessions ?? ((d) => [row({ dir: d, at: Date.now() - 60_000 })]))(dir) });
      if (args[1] === 'recovery' && args[2] === 'claim') return o.claim === 1 ? { code: 1, stdout: '', stderr: 'already claimed' } : ok({ claimed: true });
      if (args[1] === 'recovery' && args[2] === 'finish') return ok({});
      if (path.basename(file) === 'lsof') return { code: o.live?.inFolder ? 0 : 1, stdout: o.live?.inFolder ? `p1\nn${dir}\n` : '', stderr: '' };
      if (path.basename(file) === 'ps') return { code: 0, stdout: o.live?.args ?? 'zsh\n', stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file, args, opts) => {
      if (o.spawnFails) throw new Error('posix_spawnp failed');
      spawned.push({ file, args, cwd: opts.cwd });
      // Like a real `claude --resume <id> <brief>`: it appends the brief to its own transcript at once.
      const own = path.join(home, '.claude', 'projects', 'p', `${args[1]}.jsonl`);
      if (!o.silent && !o.exitsAtOnce) setTimeout(() => { try { fs.appendFileSync(own, '{"brief":true}\n'); fs.utimesSync(own, new Date(), new Date(Date.now() + 1000)); } catch { /* none */ } }, 20);
      return { pid: 999_999_999, onData: () => ({ dispose() {} }), onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { if (o.exitsAtOnce) setTimeout(() => cb({ exitCode: 1 }), 10); return { dispose() {} }; }, write() {}, resize() {}, kill() {} };
    },
    killGroup: () => {},
    idleMs: 0,
    machine: async () => ({ freeDisk: o.freeDisk ?? 50 * GB, swap: null, running: 0 }),
    keys: () => (o.serviceFolder ? ['agent.default'] : []),
    home,
    settleMs: 300,
  });
  return { host, dir, calls, spawned, logs, sb: path.join(bin, 'switchboard') };
}

const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake switchboard is a shell script' };
const sbCalls = (calls: string[][]) => calls.filter((c) => c[0] === 'switchboard' && c.includes('recovery')).map((c) => c.slice(1).join(' '));

test('FD-83/FD-84: a ready stop is claimed once, continued by the agent\'s own CLI with --resume, and recorded as resumed once it lives', POSIX, async () => {
  const r = rig();
  const [key] = await r.host.pollRecovery();
  assert.ok(key && isHandoverKey(key));
  assert.equal(r.spawned.length, 1);
  assert.equal(r.spawned[0]!.cwd, r.dir);
  assert.equal(path.basename(r.spawned[0]!.file), 'claude', 'FD-84: the plain CLI, never a Switchboard managed launch');
  assert.deepEqual(r.spawned[0]!.args, ['--resume', SID, RESUME_BRIEF]);
  const event = `cc-${SID}-1792066929`;
  assert.deepEqual(sbCalls(r.calls), ['--json recovery', `--json recovery claim --account acc-2 ${event}`, `--json recovery finish ${event} resumed`]);
  const status = r.host.recoveryStatus();
  assert.equal(status.resumed, 1);
  assert.deepEqual(status.stops.map((s) => [s.verdict, s.key]), [['resumed', key]]);
  assert.deepEqual(r.host.handoverConsoles().map((h) => [h.key, h.kind, h.workflow]), [[key, 'resume', 'checkout']]);
  assert.deepEqual(await r.host.pollRecovery(), [], 'the same stop is never continued twice');
  assert.equal(r.spawned.length, 1);
});

test('FD-83: a stop whose folder has a live agent, or whose session a process names, is left for the person', POSIX, async () => {
  for (const live of [{ inFolder: true }, { args: `node claude --resume ${SID}\n` }]) {
    const r = rig({ live });
    assert.deepEqual(await r.host.pollRecovery(), []);
    assert.equal(r.spawned.length, 0);
    assert.deepEqual(r.host.recoveryStatus().stops.map((s) => s.verdict), ['open']);
    assert.ok(!r.calls.some((c) => c.includes('claim')), 'nothing is claimed for an open session');
  }
});

test('FD-83: at most two start in one pass; the third continues with the next', POSIX, async () => {
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'];
  const dirs: string[] = [];
  const r = rig({ sessions: (d) => ids.map((session, i) => { const sub = path.join(d, `r${i}`); fs.mkdirSync(sub, { recursive: true }); dirs.push(sub); return row({ dir: sub, session, at: Date.now() - 60_000 }); }) });
  assert.equal((await r.host.pollRecovery()).length, 2);
  assert.deepEqual(r.host.recoveryStatus().stops.map((s) => s.verdict).sort(), ['resume', 'resumed', 'resumed']);
  assert.equal((await r.host.pollRecovery()).length, 1);
  assert.equal(r.spawned.length, 3);
});

test('FD-83: off in Settings, stops are read and listed but nothing is claimed or started', POSIX, async () => {
  const r = rig({ on: false });
  assert.deepEqual(await r.host.pollRecovery(), []);
  assert.equal(r.spawned.length, 0);
  const s = r.host.recoveryStatus();
  assert.equal(s.on, false);
  assert.deepEqual(s.stops.map((x) => x.verdict), ['resume']);
  assert.deepEqual(sbCalls(r.calls), ['--json recovery']);
});

test('FD-83: a machine that cannot carry a console now (LC-17) claims nothing; the next pass tries again', POSIX, async () => {
  const r = rig({ freeDisk: 1 * GB });
  assert.deepEqual(await r.host.pollRecovery(), []);
  assert.ok(!r.calls.some((c) => c.includes('claim')));
  assert.deepEqual(r.host.recoveryStatus().stops.map((s) => s.verdict), ['resume']);
});

test('FD-83: a refused claim starts nothing; a claimed stop that cannot start is recorded as cancelled', POSIX, async () => {
  const refused = rig({ claim: 1 });
  assert.deepEqual(await refused.host.pollRecovery(), []);
  assert.equal(refused.spawned.length, 0);
  assert.deepEqual(refused.host.recoveryStatus().stops.map((s) => s.verdict), ['failed']);
  const broken = rig({ spawnFails: true });
  assert.deepEqual(await broken.host.pollRecovery(), []);
  assert.ok(sbCalls(broken.calls).some((c) => c.endsWith(' cancelled')), sbCalls(broken.calls).join('\n'));
  assert.deepEqual(broken.host.recoveryStatus().stops.map((s) => s.verdict), ['failed']);
});

test('FD-84: a session that exits at once, or runs without writing its transcript, is cancelled, never recorded as resumed; one with no transcript here is not claimed', POSIX, async () => {
  const quick = rig({ exitsAtOnce: true });
  assert.deepEqual(await quick.host.pollRecovery(), []);
  assert.ok(sbCalls(quick.calls).some((c) => c.endsWith(' cancelled')), sbCalls(quick.calls).join('\n'));
  assert.ok(!sbCalls(quick.calls).some((c) => c.endsWith(' resumed')));
  assert.deepEqual(quick.host.recoveryStatus().stops.map((s) => s.verdict), ['failed']);
  const silent = rig({ silent: true });
  assert.deepEqual(await silent.host.pollRecovery(), [], 'alive but not on its conversation: not a continuation');
  assert.ok(sbCalls(silent.calls).some((c) => c.endsWith(' cancelled')));
  assert.ok(!sbCalls(silent.calls).some((c) => c.endsWith(' resumed')));
  assert.deepEqual(silent.host.recoveryStatus().stops.map((s) => s.verdict), ['failed']);
  const elsewhere = rig({ noTranscript: true });
  assert.deepEqual(await elsewhere.host.pollRecovery(), []);
  assert.deepEqual(elsewhere.host.recoveryStatus().stops.map((s) => s.verdict), ['no-transcript']);
  assert.ok(!elsewhere.calls.some((c) => c.includes('claim')));
});

test('FD-83: a stop in an agent\'s folder continues in that agent\'s free console', POSIX, async () => {
  const r = rig({ serviceFolder: true });
  assert.deepEqual(await r.host.pollRecovery(), ['agent.default']);
});

test('FD-83: MCP `audit` lists the stops with the same verdicts, read-only', POSIX, async () => {
  const dir = tmp('fd-rs-mcp-');
  const cli: Runner = async (file, args) => {
    if (args.join(' ') === '--json recovery') return ok({ sessions: [row({ dir, at: NOW - 60_000 }), row({ dir, session: '00000000-0000-4000-8000-000000000009', state: 'resumed' }), row({ dir, session: '00000000-0000-4000-8000-00000000000a', kind: 'billing' })] });
    if (file === 'lsof') return { code: 1, stdout: '', stderr: '' };
    if (file === 'ps') return { code: 0, stdout: 'zsh\n', stderr: '' };
    throw new Error(`unexpected ${file} ${args.join(' ')}`);
  };
  const home = tmp('fd-rs-mcp-home-');
  fs.mkdirSync(path.join(home, '.claude', 'projects', 'p'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'projects', 'p', `${SID}.jsonl`), '{}\n');
  const deps = { now: () => NOW, platform: 'darwin', switchboard: () => '/bin/switchboard', cli, home } as never;
  const r = await limitStops(deps);
  assert.equal(r.available, true);
  assert.deepEqual(r.stops.map((s) => s.verdict), ['resume', 'billing']);
  assert.deepEqual(await limitStops({ ...(deps as object), switchboard: () => null } as never), { available: false, why: 'Switchboard is not installed', stops: [] });
});
