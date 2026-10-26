// Adversarial round of 0.8.0's Sessions mode and the visual round that followed it, node FIX-2 (fix cycle 2): one test
// per finding, each seen failing on a5e3e36 (the packet's base) before its fix; the failures are in
// docs/reports/2026-10-24-ui-ux-iteration/fix2-prefix-failures.txt. The F-rows came from the adversarial probes, the D-rows
// close gaps a planted defect slipped through (each caught by its plant before the plant was reverted), the V-rows are
// the visual reviewer's. New functions are reached through their module's namespace, so one missing function fails one
// test, not the file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsoleHost } from '../src/electron/console';
import * as sessions from '../src/core/sessions';
import { mergeSessions, pruneDismissed, pruneRecords, type MergeInput, type SbSessionRecord, type SessionRecord } from '../src/core/sessions';
import * as sessionsView from '../src/core/sessions-view';
import { continueLabel, navLines, originChip, secondLine } from '../src/core/sessions-view';
import { allSessionsOf } from '../src/core/switchboard';
import { SettingsStore } from '../src/core/settings';
import { setWording } from '../src/core/i18n';
import { AllSessions, hasConsole, SessionBody } from '../src/renderer/components/Sessions';
import { SessionsNav } from '../src/renderer/components/Navigation';
import { LangContext } from '../src/renderer/lib';
import { srow } from './session-rows';
import { tmp } from './helpers';

(globalThis as { React?: unknown }).React = React;
setWording('other');

const ROOT = path.join(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MIN = 60_000;
const HOUR = 60 * MIN;
const GB = 1024 ** 3;
const SID = '5f151e9c-cc90-4fed-a01b-101c647f52ab';
const HO = 'ho-0123456789ab';
const NOW = 1_792_617_104_000;
const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake switchboard is a shell script' };
const ok = (data: unknown) => ({ code: 0, stdout: JSON.stringify({ ok: true, data }), stderr: '' });
const tick = (ms = 20) => new Promise((res) => setTimeout(res, ms));
const input = (o: Partial<MergeInput> = {}): MergeInput => ({ now: NOW, switchboard: [], pending: [], stops: [], consoles: [], records: [], dismissed: [], ...o });
const sbRec = (o: Partial<SbSessionRecord> = {}): SbSessionRecord => {
  const r = {
  home: '/sb/runtimes/claude-default', folder: '/w/a', provider: 'claude', pool: 'default', mode: 'managed', account: 'A', accountId: 'a',
  context: null, contextName: null, continues: null, inPlace: false, launchedAt: NOW - HOUR, startedAt: null, state: 'running', ...o,
  };
  // SB-201: the agent Switchboard fills from the provider when a record names none.
  return { ...r, agent: o.agent ?? (r.provider === 'claude' ? 'claude-code' : r.provider === 'kimi' ? 'kimi-code' : r.provider) } as SbSessionRecord;
};

interface Opt {
  stop?: { ready?: boolean; candidates?: string[] } | null;
  handover?: boolean;
  sessions?: (dir: string) => unknown;
  /** How long `recovery claim` takes to answer (Switchboard measured 12 to 15 s; scaled down). */
  claimMs?: number;
  /** Switchboard refuses a claim on a stop already claimed (recovery.rs: a claim needs a waiting stop); with this set the
   *  fake grants it anyway, to prove that this app alone keeps a second claim of one stop from happening. */
  regrant?: boolean;
  settleMs?: number;
}

/** A host over a fake Switchboard that keeps one stop the way recovery.rs does: waiting → claimed → resumed or cancelled
 *  (waiting → cancelled too); a finished stop is no longer listed. */
function rig(o: Opt = {}) {
  const base = tmp('fd-r2-');
  const bin = path.join(base, 'bin');
  const dir = path.join(base, 'checkout');
  const home = path.join(base, 'home');
  fs.mkdirSync(bin); fs.mkdirSync(dir);
  fs.mkdirSync(path.join(home, '.claude', 'projects', 'p'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'projects', 'p', `${SID}.jsonl`), '{}\n');
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  const calls: string[][] = [];
  const spawned: { file: string; args: string[]; cwd: string }[] = [];
  const exits = new Map<number, (e: { exitCode: number; signal?: number }) => void>();
  let state: 'waiting' | 'claimed' | 'resumed' | 'cancelled' = 'waiting';
  let pid = 2_000_000_000;
  const options: ConstructorParameters<typeof ConsoleHost>[0] = {
    settings, snapshot: () => null, window: () => null, visible: () => false, log: () => undefined,
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (file, args) => {
      calls.push([path.basename(file), ...args]);
      const line = args.join(' ');
      if (line === '--json handovers') return ok({ enabled: true, handovers: o.handover ? [{ id: HO, workflow: 'nightly', agent: 'claude-code', account_label: 'Work Max', dir, offered_until: new Date(Date.now() + MIN).toISOString() }] : [] });
      if (line === '--json sessions --all') return ok({ sessions: o.sessions?.(dir) ?? [] });
      if (line === '--json recovery') {
        const s = o.stop;
        if (!s || state === 'resumed' || state === 'cancelled') return ok({ sessions: [] });
        return ok({ sessions: [{ candidates: s.candidates ?? ['acc-2'], ready: s.ready ?? true, probe_at: null, stop: { account: 'acc-1', attempt: 1, directory: dir, event: `cc-${SID}-1`, kind: 'limit', provider: 'claude', session: SID, state, stopped_at: (Date.now() - MIN) / 1000 } }] });
      }
      if (args[1] === 'recovery' && args[2] === 'claim') {
        if (o.claimMs) await tick(o.claimMs);
        if (state === 'resumed' || state === 'cancelled' || (state === 'claimed' && !o.regrant) || o.stop?.ready === false) return { code: 1, stdout: '', stderr: 'This stop is not ready on that account.' };
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
      const own = path.join(home, '.claude', 'projects', 'p', `${args[1]}.jsonl`);
      if (args[0] === '--resume') setTimeout(() => { try { fs.appendFileSync(own, '{"brief":true}\n'); fs.utimesSync(own, new Date(), new Date(Date.now() + 1000)); } catch { /* none */ } }, 20);
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
  return { host, options, dir, home, settings, calls, spawned, finishes, claims, state: () => state };
}

// ── F1 ──

test('F1: Continue on a declined stop settles it in Switchboard, so a restart never continues it a second time', POSIX, async () => {
  const r = rig({ stop: {} });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  assert.ok((await r.host.dismissSession(row.id)).ok); // Do not continue
  const declined = r.host.sessionsStatus().rows[0]!;
  assert.equal(declined.reason, 'declined');
  const out = await r.host.continueSession(declined.id);
  assert.ok(out.ok, JSON.stringify(out));
  assert.equal(r.spawned.length, 1);
  assert.notEqual(r.state(), 'waiting', 'the stop is settled in Switchboard, not left waiting');
  // A restart: a new host over the same settings, automatic continue on.
  r.settings.update({ resumeAfterLimit: true });
  const again = new ConsoleHost(r.options);
  await again.pollRecovery();
  assert.equal(r.spawned.length, 1, 'the session the person already continued is not resumed again');
});

test('F1: a declined stop continued while Switchboard cannot be told is still held for a day by this app', POSIX, async () => {
  const r = rig({ stop: { ready: false } });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  await r.host.dismissSession(row.id);
  assert.ok((await r.host.continueSession(row.id)).ok);
  // Whatever Switchboard keeps, this app holds the stop: a restart never claims it.
  assert.ok(r.settings.get().sessions.dismissed.some((d) => d.id === row.id), 'a hold on the stop is kept');
  r.settings.update({ resumeAfterLimit: true });
  const again = new ConsoleHost(r.options);
  await again.pollRecovery();
  assert.equal(r.claims().length, 0);
});

// ── F2 ──

test('F2: two Continue now at once start one session and never record the running one as cancelled', POSIX, async () => {
  const r = rig({ stop: {}, claimMs: 50, regrant: true });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  assert.equal(row.state, 'waiting-reset');
  const answers = await Promise.all([r.host.continueSession(row.id, undefined, 'acc-2'), r.host.continueSession(row.id, undefined, 'acc-2')]);
  assert.equal(r.spawned.length, 1);
  assert.equal(r.claims().length, 1, 'the second press claims nothing');
  assert.deepEqual(r.finishes(), ['resumed']);
  assert.equal(answers.filter((a) => a.ok).length, 1);
});

test('F2: Continue now while the automatic continue of the same stop is in flight starts one session, never cancelled', POSIX, async () => {
  const r = rig({ stop: {}, claimMs: 80, regrant: true });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  r.settings.update({ resumeAfterLimit: true });
  const bg = r.host.pollRecovery();
  await tick(10);
  const fg = r.host.continueSession(row.id, undefined, 'acc-2');
  await Promise.all([bg, fg]);
  assert.equal(r.spawned.length, 1);
  assert.ok(!r.finishes().includes('cancelled'), `finishes: ${r.finishes()}`);
  assert.equal(r.state(), 'resumed');
});

// ── F3 ──

test('F3: a quit during a continue settles the claimed stop in Switchboard before the app exits', POSIX, async () => {
  const r = rig({ stop: {}, settleMs: 5000 });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  // The continued session never writes its transcript, so the settle wait would run its full five seconds.
  fs.rmSync(path.join(r.home, '.claude', 'projects', 'p', `${SID}.jsonl`));
  fs.writeFileSync(path.join(r.home, '.claude', 'projects', 'p', `${SID}.jsonl`), '{}\n');
  const fg = r.host.continueSession(row.id, undefined, 'acc-2').catch(() => null);
  while (r.spawned.length === 0) await tick(5);
  assert.ok(sessionsHost(r.host).quitWork() > 0, 'main.ts waits for a continue in flight');
  const t0 = Date.now();
  await r.host.endAllForQuit();
  assert.ok(Date.now() - t0 < 4000, 'the quit waits a few seconds at most');
  assert.ok(r.finishes().length > 0, 'the claim is settled in Switchboard before app.exit');
  assert.notEqual(r.state(), 'claimed');
  await fg;
});

const sessionsHost = (h: ConsoleHost) => h as unknown as { quitWork: () => number };

// ── F4 ──

test('F4: a hand-over and a ready stop in one folder on one tick never run two agents in that folder', POSIX, async () => {
  const r = rig({ handover: true, stop: {} });
  await r.host.pollHandovers();
  await r.host.pollRecovery();
  assert.equal(r.spawned.length, 1, 'the stop waits while this app\'s console works in its folder');
  assert.equal(r.claims().length, 0);
});

// ── F5 ──

test('F5: two Terminal sessions of one pool launched in the same second in two folders are both listed', () => {
  const at = Math.floor(NOW / 1000) * 1000;
  const rows = mergeSessions(input({ switchboard: [sbRec({ folder: '/w/a', launchedAt: at }), sbRec({ folder: '/w/b', launchedAt: at })] }));
  assert.equal(rows.length, 2, rows.map((x) => x.id).join(','));
});

test('F5: two Switchboard sessions with an empty home and no launch time are both listed; a long folder keeps the id short', () => {
  const rows = mergeSessions(input({ switchboard: [sbRec({ home: '', folder: '/w/a', launchedAt: null }), sbRec({ home: '', folder: '/w/b', launchedAt: null })] }));
  assert.equal(rows.length, 2, rows.map((r) => r.id).join(','));
  const codex = mergeSessions(input({ switchboard: [sbRec({ provider: 'codex' }), sbRec({ provider: 'claude' })] }));
  assert.equal(codex.length, 2, 'two providers in one folder at one time are two sessions');
  const long = mergeSessions(input({ switchboard: [sbRec({ folder: `/${'x'.repeat(900)}` })] }));
  assert.ok(long[0]!.id.length <= 400, `a dismissal of it can be kept (id ${long[0]!.id.length} long)`);
  assert.match(read('src/core/sessions.ts'), /`sb:<provider>:<pool>:<launch>:<folder>`/, 'the id is documented as it is built');
});

// ── F6 ──

test('F6: a Switchboard record launched in the far future is not listed as ended for ever; its time is bounded when read', async () => {
  const rows = mergeSessions(input({ switchboard: [sbRec({ launchedAt: NOW + 365 * 24 * HOUR, state: 'ended' })] }));
  assert.deepEqual(rows.map((x) => x.state), [], 'an ended record launched a year ahead is not fresh');
  const raw = JSON.stringify({ ok: true, data: { sessions: [{ working_directory: '/a', launched_at: 1e300, started_at: 9e15, state: 'ended' }] } });
  const out = await allSessionsOf(async () => ({ code: 0, stdout: raw, stderr: '' }), '/x/switchboard');
  assert.ok(out.ok);
  assert.equal(out.value[0]!.launchedAt, null, 'an absurd time is no time');
  assert.equal(out.value[0]!.startedAt, null);
});

test('F6: a dismissal or a record stamped ahead of the clock is kept at now, not dropped and not held for ever', () => {
  assert.deepEqual(pruneDismissed([{ id: 'st:x', at: NOW + 365 * 24 * HOUR }], NOW), [{ id: 'st:x', at: NOW }]);
  assert.deepEqual(pruneDismissed(pruneDismissed([{ id: 'st:x', at: NOW + 365 * 24 * HOUR }], NOW), NOW + 24 * HOUR + 1), [], 'gone a day later');
  const rec: SessionRecord = { id: 'st:x', key: null, folder: '/w', agent: 'claude-code', account: null, context: null, origin: 'limit' as never, end: 'declined', reason: 'declined', startedAt: NOW + 20 * MIN, endedAt: NOW + 10 * MIN, sessionId: null, provider: 'claude', handoverId: null };
  const kept = pruneRecords([{ ...rec, origin: 'resume' }], NOW);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.endedAt, NOW);
  assert.ok((kept[0]!.startedAt ?? 0) <= NOW);
});

test('F6: a decline recorded while the clock ran ahead still holds after the clock is set back', POSIX, async () => {
  const r = rig({ stop: {} });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  const realNow = Date.now;
  Date.now = () => realNow() + 10 * MIN; // the clock runs ahead when the person declines
  try { await r.host.dismissSession(row.id); } finally { Date.now = realNow; } // then the time service sets it back
  r.settings.update({ resumeAfterLimit: true });
  await r.host.pollRecovery();
  assert.equal(r.claims().length, 0, 'a declined stop is never claimed (decision 2)');
});

// ── F7 ──

test('F7: 600 later records do not push out a decline or a stop\'s dismissal', POSIX, async () => {
  const r = rig({ stop: {} });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  await r.host.dismissSession(row.id);
  const now = Date.now();
  const many: SessionRecord[] = Array.from({ length: 600 }, (_, i) => ({ id: `c:agent.default:${now - i}`, key: 'agent.default', folder: '/w/a', agent: 'claude-code', account: null, context: null, origin: 'here', end: 'ended', reason: null, startedAt: now - i - 1, endedAt: now - i, sessionId: null, provider: 'claude', handoverId: null }));
  const dismissals = Array.from({ length: 600 }, (_, i) => ({ id: `sb:x:${i}`, at: now - i }));
  const m = r.settings.get().sessions;
  r.settings.update({ sessions: { records: [...m.records, ...many], dismissed: [{ id: 'st:cc-other-1', at: now - HOUR }, ...m.dismissed, ...dismissals] } });
  const after = r.settings.get().sessions;
  assert.ok(after.records.length <= 500 && after.dismissed.length <= 500);
  assert.ok(after.records.some((x) => x.id === row.id && x.end === 'declined'), 'the decline is kept');
  assert.ok(after.dismissed.some((x) => x.id === 'st:cc-other-1'), 'a stop\'s dismissal is kept');
  r.settings.update({ resumeAfterLimit: true });
  await r.host.pollRecovery();
  assert.equal(r.claims().length, 0, 'the decline survived the cap');
});

// ── D: gaps a planted defect slipped through ──

test('D6: our console does not claim an in-place Switchboard record of the same folder from hours ago', () => {
  const rows = mergeSessions(input({
    consoles: [{ key: `handover.${HO}`, folder: '/w/a', agent: 'claude-code', startedAt: NOW, origin: 'handover', account: null, handoverId: HO }],
    switchboard: [sbRec({ inPlace: true, launchedAt: NOW - 3 * HOUR })],
  }));
  assert.equal(rows.length, 2, rows.map((x) => x.id).join(','));
});

test('D10 and D19: End, Continue and Remove on a row whose state does not offer them are refused and start nothing', POSIX, async () => {
  const r = rig({ handover: true, sessions: (dir) => [{ account_id: 'acc-1', home: '/sb/h', label: 'Spare', launched_at: (Date.now() - 10 * MIN) / 1000, mode: 'managed', pool: 'default', provider: 'claude', state: 'running', working_directory: dir, in_place: false }] });
  await r.host.pollHandovers();
  await r.host.pollSessions();
  const rows = r.host.sessionsStatus().rows;
  assert.deepEqual(rows.map((x) => x.state).sort(), ['running-ours', 'running-terminal']);
  const n = r.spawned.length;
  for (const row of rows) assert.deepEqual(await r.host.continueSession(row.id), { ok: false, reason: 'not-allowed' }); // D19
  assert.equal(r.spawned.length, n);
  const ours = rows.find((x) => x.state === 'running-ours')!;
  assert.ok((await r.host.endSession(ours.id)).ok);
  await tick();
  const ended = r.host.sessionsStatus().rows.find((x) => x.group === 'ended')!;
  assert.deepEqual(await r.host.endSession(ended.id), { ok: false, reason: 'not-allowed' }); // D10
});

test('D17: a stop the person removed while it could not continue is not continued once it can', POSIX, async () => {
  const r = rig({ stop: {} });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  const m = r.settings.get().sessions;
  r.settings.update({ sessions: { records: m.records, dismissed: [...m.dismissed, { id: row.id, at: Date.now() }] } });
  r.settings.update({ resumeAfterLimit: true });
  await r.host.pollRecovery();
  assert.equal(r.claims().length, 0);
});

test('D12: Continue on a declined stop leaves no "declined" row while its session runs', POSIX, async () => {
  const r = rig({ stop: {} });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  await r.host.dismissSession(row.id);
  assert.ok((await r.host.continueSession(row.id)).ok);
  const rows = r.host.sessionsStatus().rows;
  assert.ok(!rows.some((x) => x.reason === 'declined'), rows.map((x) => `${x.id} ${x.reason}`).join(', '));
  assert.ok(!r.settings.get().sessions.records.some((x) => x.id === row.id && x.end === 'declined'), 'the decline is undone, not only hidden');
  assert.equal(rows.filter((x) => x.group === 'running').length, 1);
});

test('D23 (decision 6): an ended row without a known conversation reads "New session here"', () => {
  const rows = mergeSessions(input({ switchboard: [sbRec({ home: '/h/c', provider: 'codex', state: 'ended', folder: '/w/c' }), sbRec({ home: '/h/d', provider: 'claude', state: 'ended', folder: '/w/d' })], records: [{ id: 'c:handover.ho-1:1', key: 'handover.ho-1', folder: '/w/e', agent: 'goose', account: null, context: null, origin: 'handover', end: 'ended', reason: null, startedAt: NOW - HOUR, endedAt: NOW - MIN, sessionId: null, provider: null, handoverId: 'ho-1' }] }));
  const label = (folder: string) => continueLabel('en', rows.find((x) => x.folder === folder)!);
  assert.equal(label('/w/c'), 'New session here');
  assert.equal(label('/w/e'), 'New session here');
  assert.equal(label('/w/d'), 'Continue');
});

// ── V: the visual round ──

test('V-1: a limit stop is "stopped by a limit on" its account, never "continued after a limit reset"', POSIX, async () => {
  const r = rig({ stop: {} });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  assert.equal(row.state, 'waiting-reset');
  assert.equal(row.origin, 'limit');
  assert.equal(row.account, 'Work Max', 'the account it stopped on, by its label');
  assert.match(originChip('en', row), /^Stopped by a limit on Work Max, \d/);
  assert.match(originChip('ru', row), /^Остановлена лимитом на Work Max, \d/);
  assert.match(secondLine('en', row), /^Claude Code · Work Max · stopped by a limit · \d/);
  assert.equal(navLines('en', row).sub, 'Work Max · hit a limit', 'the sidebar\'s shorter words (FD-107)');
  const noAccount = { ...row, account: null };
  assert.match(originChip('en', noAccount), /^Stopped by a limit, \d/);
  // A declined stop keeps its origin and account in Ended.
  await r.host.dismissSession(row.id);
  const declined = r.host.sessionsStatus().rows[0]!;
  assert.equal(declined.origin, 'limit');
  assert.equal(declined.account, 'Work Max');
});

test('V-3: a continue that did not take up its conversation says it was tried, not that it continued', () => {
  const row = srow({ state: 'needs-you-resume-failed', origin: 'resume' });
  assert.match(originChip('en', row), /^Continue tried after a limit reset, /);
  assert.match(originChip('ru', row), /^Попытка продолжить после сброса лимита, /);
  assert.match(originChip('en', srow({ state: 'running-ours', origin: 'resume' })), /^Continued after a limit reset, /);
  // The contact sheet showed the longer Russian chip running past its border at 740 px: a header chip wraps.
  const chip = read('src/renderer/styles/app.css').match(/\.session-meta \.chip\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(chip, /white-space:\s*normal/, 'a session header chip wraps inside its border');
});

test('V-4: the session cards fill the row for one or two cards, and a card never cuts its time', () => {
  const css = read('src/renderer/styles/app.css');
  const grid = css.match(/\.session-cards\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(grid, /auto-fit/, grid);
  const sub = css.match(/\.session-card \.session-sub\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(sub, /white-space:\s*normal/, sub);
  assert.match(sub, /text-overflow:\s*clip/, sub);
});

test('V-4: two rail entries of one folder differ by their title', () => {
  const rows = [srow({ id: 'c:a:1', state: 'running-ours', folder: '/w/passioncode-platform', startedAt: NOW - HOUR }), srow({ id: 'c:b:2', state: 'running-ours', folder: '/w/passioncode-platform', startedAt: NOW - 2 * HOUR, account: 'claude5' })];
  const html = renderToStaticMarkup(React.createElement(LangContext.Provider, { value: 'en' }, React.createElement(SessionsNav, { sessions: { rows, degraded: [], switchboard: true, handovers: { enabled: true }, autoContinue: true }, currentId: null, allCurrent: false, rail: true, endedOpen: false, onEndedOpen: () => undefined, openAll: () => undefined, openRow: () => undefined } as never)));
  const titles = [...html.matchAll(/class="nav-item session-item"[^>]*title="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(titles.length, 2, html);
  assert.notEqual(titles[0], titles[1]);
});

test('V-5: an ended row whose console holds nothing after a restart says that output is not kept, never a blank page', POSIX, () => {
  const settings = new SettingsStore(tmp('fd-r2-v5-'));
  const now = Date.now();
  settings.update({ sessions: { records: [{ id: `c:handover.${HO}:${now - HOUR}`, key: `handover.${HO}`, folder: '/w/a', agent: 'claude-code', account: null, context: null, origin: 'handover', end: 'ended', reason: null, startedAt: now - HOUR, endedAt: now - MIN, sessionId: null, provider: 'claude', handoverId: HO }], dismissed: [] } });
  const host = new ConsoleHost({ settings, snapshot: () => null, window: () => null, visible: () => false, log: () => undefined, testDirs: [], scriptsDir: tmp('fd-r2-v5s-'), idleMs: 0, run: async () => ({ code: 1, stdout: '', stderr: '' }) });
  const row = host.sessionsStatus().rows[0]!;
  assert.equal(row.consoleEmpty, true);
  assert.equal(hasConsole(row), false, 'no empty console under the header');
  const html = renderToStaticMarkup(React.createElement(LangContext.Provider, { value: 'en' }, React.createElement(SessionBody, { row })));
  assert.match(html, /What this session printed is not kept after the app restarts\./);
});

test('V-6: a session running in Terminal offers Show in Finder for its folder', () => {
  assert.ok(sessions.actionsFor('running-terminal').includes('reveal'));
});

test('V-7: English times read 1:37 PM, Russian 13:37', () => {
  const at = new Date(2026, 9, 24, 13, 37).getTime();
  assert.equal(sessionsView.clock('en', at).replace(/ /g, ' '), '1:37 PM');
  assert.equal(sessionsView.clock('ru', at), '13:37');
});

test('V-7: the sidebar focus ring is drawn inside the scrolled list', () => {
  const css = read('src/renderer/styles/app.css');
  assert.match(css, /\.nav-scroll[^{]*:focus-visible[^{]*\{[^}]*outline-offset:\s*-\d/, 'an inset outline inside .nav-scroll');
});

test('V-7: without Switchboard the Sessions page says once how to get it, with no button to a Switchboard setting', () => {
  const html = renderToStaticMarkup(React.createElement(LangContext.Provider, { value: 'en' }, React.createElement(AllSessions, { sessions: { rows: [], degraded: [], switchboard: false, handovers: { enabled: null }, autoContinue: true }, noteSeen: false, onNoteSeen: () => undefined, onSetUp: () => undefined, endedOpen: false, onEndedOpen: () => undefined, open: () => undefined, askEnd: () => undefined, continued: () => undefined })));
  assert.equal((html.match(/class="notice[^"]*"/g) ?? []).length, 1, html);
  assert.match(html, /Install Fabric Switchboard/);
  assert.doesNotMatch(html, /Choose where sessions continue/, 'no button to a setting of a Switchboard that is not here');
});
