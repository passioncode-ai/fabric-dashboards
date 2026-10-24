// Confirming round of 0.8.0's Sessions mode, node FIX-4 (fix cycle 4): one test per finding, each seen failing on a9ee1b6
// (the packet's base) before its fix; the failures are in docs/reports/2026-10-24-ui-ux-iteration/fix4-prefix-failures.txt.
// The fake Switchboard keeps one stop the way crates/switchboard-runtime/src/recovery.rs does: a claim needs a waiting stop,
// `finish cancelled` takes a waiting or a claimed one, `finish resumed` only a claimed one.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsoleHost } from '../src/electron/console';
import { resumeOwnKey, type SbStop } from '../src/core/recovery';
import { SettingsStore } from '../src/core/settings';
import { setWording } from '../src/core/i18n';
import { SessionHeader } from '../src/renderer/components/Sessions';
import { LangContext } from '../src/renderer/lib';
import { tmp } from './helpers';

(globalThis as { React?: unknown }).React = React;
setWording('other');

const MIN = 60_000;
const GB = 1024 ** 3;
const SID = '5f151e9c-cc90-4fed-a01b-101c647f52ab';
const EVENT = `cc-${SID}-1`;
const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake switchboard is a shell script' };
const ok = (data: unknown) => ({ code: 0, stdout: JSON.stringify({ ok: true, data }), stderr: '' });
const tick = (ms = 20) => new Promise((res) => setTimeout(res, ms));

type State = 'waiting' | 'claimed' | 'resumed' | 'cancelled';

interface Opt {
  stop?: { ready?: boolean; candidates?: string[] };
  /** How long `recovery claim` takes to answer (Switchboard measured 12 to 15 s; scaled down). */
  claimMs?: number;
  settleMs?: number;
}

function rig(o: Opt = {}) {
  const base = tmp('fd-r3-');
  const bin = path.join(base, 'bin');
  const dir = path.join(base, 'checkout');
  const home = path.join(base, 'home');
  const transcript = path.join(home, '.claude', 'projects', 'p', `${SID}.jsonl`);
  fs.mkdirSync(bin); fs.mkdirSync(dir);
  fs.mkdirSync(path.dirname(transcript), { recursive: true });
  fs.writeFileSync(transcript, '{}\n');
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  const calls: string[][] = [];
  const spawned: { file: string; args: string[]; cwd: string }[] = [];
  const exits = new Map<number, (e: { exitCode: number; signal?: number }) => void>();
  let state: State = 'waiting';
  let pid = 2_100_000_000;
  const stop = o.stop ?? {};
  const options: ConstructorParameters<typeof ConsoleHost>[0] = {
    settings, snapshot: () => null, window: () => null, visible: () => false, log: () => undefined,
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (file, args) => {
      calls.push([path.basename(file), ...args]);
      const line = args.join(' ');
      if (line === '--json handovers') return ok({ enabled: true, handovers: [] });
      if (line === '--json sessions --all') return ok({ sessions: [] });
      if (line === '--json recovery') {
        if (state === 'resumed' || state === 'cancelled') return ok({ sessions: [] });
        return ok({ sessions: [{ candidates: stop.candidates ?? ['acc-2'], ready: stop.ready ?? true, probe_at: null, stop: { account: 'acc-1', attempt: 1, directory: dir, event: EVENT, kind: 'limit', provider: 'claude', session: SID, state, stopped_at: (Date.now() - MIN) / 1000 } }] });
      }
      if (args[1] === 'recovery' && args[2] === 'claim') {
        if (o.claimMs) await tick(o.claimMs);
        if (state !== 'waiting' || stop.ready === false) return { code: 1, stdout: '', stderr: 'This stop is not ready on that account.' };
        state = 'claimed';
        return ok({});
      }
      if (args[1] === 'recovery' && args[2] === 'finish') {
        const target = args[4] === 'resumed' ? 'resumed' : 'cancelled';
        if (state === target) return ok({});
        if ((target === 'resumed' && state !== 'claimed') || state === 'resumed' || state === 'cancelled') return { code: 1, stdout: '', stderr: 'invalid' };
        state = target;
        return ok({});
      }
      if (line.startsWith('--json project show')) return ok({ project: null, rules: [] });
      if (line === '--json accounts list') return ok({ routes: {}, accounts: [{ id: 'acc-1', label: 'Work Max' }, { id: 'acc-2', label: 'Spare' }] });
      if (path.basename(file) === 'lsof') return { code: 1, stdout: '', stderr: '' };
      if (path.basename(file) === 'ps') return { code: 0, stdout: 'zsh\n', stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file, args, opts) => {
      spawned.push({ file, args, cwd: opts.cwd });
      if (args[0] === '--resume') setTimeout(() => { try { fs.appendFileSync(transcript, '{"brief":true}\n'); fs.utimesSync(transcript, new Date(), new Date(Date.now() + 1000)); } catch { /* none */ } }, 20);
      const me = pid++;
      return { pid: me, onData: () => ({ dispose() {} }), onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { exits.set(me, cb); return { dispose() {} }; }, write() {}, resize() {}, kill() {} };
    },
    killGroup: (p) => { setTimeout(() => exits.get(p)?.({ exitCode: 0, signal: 1 }), 1); },
    idleMs: 0,
    machine: async () => ({ freeDisk: 50 * GB, swap: null, running: 0 }),
    keys: () => [],
    home,
    settleMs: o.settleMs ?? 300,
  };
  const host = new ConsoleHost(options);
  const finishes = () => calls.filter((c) => c[2] === 'recovery' && c[3] === 'finish').map((c) => c[5]);
  const claims = () => calls.filter((c) => c[2] === 'recovery' && c[3] === 'claim');
  const accountReads = () => calls.filter((c) => c[1] === '--json' && c[2] === 'accounts' && c[3] === 'list').length;
  return { host, dir, home, transcript, settings, calls, spawned, finishes, claims, accountReads, state: () => state, setState: (s: State) => { state = s; } };
}

/** A waiting stop, declined by the person (Do not continue), with automatic continue off. */
async function declined(r: ReturnType<typeof rig>) {
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  assert.ok((await r.host.dismissSession(row.id)).ok);
  return r.host.sessionsStatus().rows.find((x) => x.id === row.id)!;
}

// ── 1 (BLOCKS) ──

test('FIX-4 1: Continue on a declined stop does not label the running session with the account that hit the limit', POSIX, async () => {
  const r = rig();
  const row = await declined(r);
  assert.equal(row.account, 'Work Max', 'the declined row names the account it stopped on');
  const out = await r.host.continueSession(row.id);
  assert.ok(out.ok, JSON.stringify(out));
  const running = r.host.sessionsStatus().rows.filter((x) => x.group === 'running');
  assert.equal(running.length, 1);
  assert.notEqual(running[0]!.account, 'Work Max', 'the exhausted account is not the running session\'s');
  const html = renderToStaticMarkup(React.createElement(LangContext.Provider, { value: 'en' }, React.createElement(SessionHeader, { row: running[0]!, autoContinue: true, open: () => undefined, askEnd: () => undefined, continued: () => undefined })));
  assert.doesNotMatch(html, /Work Max/, 'the header shows no chip of the stopped account');
});

// ── 2 (F3) ──

test('FIX-4 2: a quit while a claim is still in flight finishes that stop as cancelled before the quit resolves', POSIX, async () => {
  const r = rig({ claimMs: 4000 });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  const fg = r.host.continueSession(row.id, undefined, 'acc-2').catch(() => null);
  await tick(50);
  await r.host.endAllForQuit();
  assert.ok(r.finishes().includes('cancelled'), `finishes before app.exit: ${JSON.stringify(r.finishes())}`);
  await fg;
  assert.notEqual(r.state(), 'claimed', 'no stop is left claimed by an app that is gone');
  assert.equal(r.spawned.length, 0, 'nothing starts once the app quits');
});

// ── 3 (F1) ──

test('FIX-4 3: Continue on a declined stop another host claimed meanwhile never cancels that host\'s claim', POSIX, async () => {
  const r = rig();
  const row = await declined(r);
  r.setState('claimed'); // another Switchboard caller claims it between this app's two reads
  const out = await r.host.continueSession(row.id);
  assert.ok(out.ok, JSON.stringify(out));
  assert.deepEqual(r.finishes(), [], 'no finish is sent for a stop another host holds');
  assert.equal(r.state(), 'claimed');
  assert.ok(r.calls.some((c) => c.slice(1).join(' ') === '--json recovery'), 'the stop is read again before acting');
});

test('FIX-4 3: Continue on a declined stop whose conversation cannot be taken up is finished as cancelled, never resumed', POSIX, async () => {
  const r = rig();
  const row = await declined(r);
  fs.rmSync(r.transcript); // no transcript: the Continue starts a new session in the folder
  const out = await r.host.continueSession(row.id);
  assert.ok(out.ok, JSON.stringify(out));
  assert.ok(!r.spawned.some((s) => s.args[0] === '--resume'), 'a new session, not the stopped conversation');
  assert.deepEqual(r.finishes(), ['cancelled']);
  assert.equal(r.claims().length, 0, 'nothing is claimed for a session that was not taken up');
});

// ── 4 ──

test('FIX-4 4: a claimed stop whose own console already runs is finished, not left claimed', POSIX, async () => {
  const r = rig();
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  const key = resumeOwnKey({ event: EVENT } as SbStop);
  assert.ok(r.host.manager.start(key, { argv: [path.join(r.dir, '..', 'bin', 'claude')], cwd: r.dir, label: 'Claude Code', env: {} }, { cols: 100, rows: 30 }).ok);
  await r.host.continueSession(row.id, undefined, 'acc-2');
  assert.equal(r.claims().length, 1);
  assert.notEqual(r.state(), 'claimed', `the claim is settled (finishes: ${JSON.stringify(r.finishes())})`);
  assert.equal(r.state(), 'cancelled');
});

// ── 5 ──

test('FIX-4 5: a waiting stop reads the account labels at most once per window, not on every pass', POSIX, async () => {
  const r = rig({ stop: { ready: false, candidates: [] } });
  r.settings.update({ resumeAfterLimit: false });
  for (let i = 0; i < 3; i++) await r.host.pollRecovery();
  assert.equal(r.host.sessionsStatus().rows[0]!.account, 'Work Max');
  assert.ok(r.accountReads() <= 1, `accounts list ran ${r.accountReads()} times`);
});

test('FIX-4 5: a stop whose continue failed keeps the account it stopped on', POSIX, async () => {
  const r = rig({ stop: { ready: false, candidates: ['acc-2'] } });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  const out = await r.host.continueSession(row.id, undefined, 'acc-2');
  assert.equal(out.ok, false);
  const after = r.host.sessionsStatus().rows.find((x) => x.id === row.id)!;
  assert.equal(after.account, 'Work Max', JSON.stringify(after));
});
