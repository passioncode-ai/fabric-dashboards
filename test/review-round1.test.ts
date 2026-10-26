// Review round 1 of 0.8.0 (docs/reports/2026-10-24-ui-ux-iteration/review-round1.md), node FIX-1: one test per row of
// the "Code" table, each failing on 48a1313 (the packet's base) and passing with its fix. New functions are reached
// through their module's namespace, so a row whose function did not exist yet fails alone, not the whole file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Runner } from '@passioncode-ai/fabric-service-host';
import { ConsoleHost } from '../src/electron/console';
import * as sessions from '../src/core/sessions';
import { mergeSessions, type MergeInput, type SbSessionRecord, type SessionNotice } from '../src/core/sessions';
import * as recovery from '../src/core/recovery';
import * as sessionsView from '../src/core/sessions-view';
import { clock, stateWords } from '../src/core/sessions-view';
import * as settingsMod from '../src/core/settings';
import { SettingsStore } from '../src/core/settings';
import { handoverOwnKey } from '../src/core/switchboard';
import { limitStops } from '../src/mcp/tools';
import { trayLevel } from '../src/electron/tray';
import { trayIcon } from '../src/core/platform';
import { SessionsNav } from '../src/renderer/components/Navigation';
import { AllSessions, failText, SessionBody } from '../src/renderer/components/Sessions';
import { LangContext } from '../src/renderer/lib';
import { allKeys, setWording, t as translate, type Lang } from '../src/core/i18n';
import type { ServiceSnapshot } from '../src/core/types';
import { AT, fourGroups, srow } from './session-rows';
import { tmp } from './helpers';

(globalThis as { React?: unknown }).React = React;
setWording('other');

const ROOT = path.join(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const NOW = 1_792_617_104_000;
const MIN = 60_000;
const HOUR = 60 * MIN;
const GB = 1024 ** 3;
const SID = '5f151e9c-cc90-4fed-a01b-101c647f52ab';
const HO = 'ho-0123456789ab';
const ok = (data: unknown) => ({ code: 0, stdout: JSON.stringify({ ok: true, data }), stderr: '' });
const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake switchboard is a shell script' };
const tick = () => new Promise((res) => setTimeout(res, 20));
const input = (o: Partial<MergeInput> = {}): MergeInput => ({ now: NOW, switchboard: [], pending: [], stops: [], consoles: [], records: [], dismissed: [], ...o });
const sb = (o: Partial<SbSessionRecord> = {}): SbSessionRecord => {
  const r = {
  home: '/sb/homes/a', folder: '/w/alpha', provider: 'claude', pool: 'default', mode: 'managed', account: 'Work Max', accountId: 'acc-1',
  context: null, contextName: null, continues: null, inPlace: true, launchedAt: NOW, startedAt: NOW, state: 'running' as const, ...o,
  };
  // SB-201: the agent Switchboard fills from the provider when a record names none.
  return { ...r, agent: o.agent ?? (r.provider === 'claude' ? 'claude-code' : r.provider === 'kimi' ? 'kimi-code' : r.provider) } as SbSessionRecord;
};

interface RigOptions {
  stop?: { silent?: boolean; candidates?: string[]; state?: string; ready?: boolean; probeAt?: number | null };
  /** Switchboard's `sessions --all`, built at each read (the checkout folder is passed in). */
  sessions?: (dir: string) => unknown[];
  /** `lsof` answers that a claude works in the checkout folder. */
  liveInFolder?: boolean;
  recoveryFails?: boolean;
  /** The machine the console admits sessions on (LC-17); 50 GB free and no swap pressure by default. */
  machine?: { freeDisk?: number; swap?: { total: number; free: number; growable?: boolean } | null };
  /** An agent's own console, `agent.default`, saved on the checkout folder with Claude Code. */
  agentFolder?: boolean;
}

function rig(o: RigOptions = {}) {
  const base = tmp('fd-r1-');
  const bin = path.join(base, 'bin');
  const dir = path.join(base, 'checkout');
  const home = path.join(base, 'home');
  fs.mkdirSync(bin); fs.mkdirSync(dir);
  fs.mkdirSync(path.join(home, '.claude', 'projects', 'p'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'projects', 'p', `${SID}.jsonl`), '{}\n');
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  if (o.agentFolder) settings.update({ consoles: { 'agent.default': { runtime: 'claude-code', folder: dir } } });
  const calls: string[][] = [];
  const spawned: { file: string; args: string[]; cwd: string }[] = [];
  const exits = new Map<number, (e: { exitCode: number; signal?: number }) => void>();
  const notices: SessionNotice[] = [];
  let changed = 0;
  let pid = 1_000_000_000;
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => false, log: () => undefined,
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (file, args) => {
      calls.push([path.basename(file), ...args]);
      const line = args.join(' ');
      if (line === '--json handovers') return ok({ enabled: true, handovers: [{ id: HO, workflow: 'nightly', agent: 'claude-code', account_label: 'Work Max', dir, offered_until: new Date(Date.now() + MIN).toISOString() }] });
      if (line === '--json sessions --all') return ok({ sessions: o.sessions?.(dir) ?? [] });
      if (line === '--json recovery') {
        if (o.recoveryFails) return { code: 1, stdout: '', stderr: 'no answer within 30 s' };
        const s = o.stop;
        return ok({ sessions: s ? [{ candidates: s.candidates ?? ['acc-2'], ready: s.ready ?? true, probe_at: s.probeAt ?? null, stop: { attempt: 1, directory: dir, event: `cc-${SID}-1`, kind: 'limit', provider: 'claude', session: SID, state: s.state ?? 'waiting', stopped_at: (Date.now() - MIN) / 1000 } }] : [] });
      }
      if (args[1] === 'recovery') return ok({});
      if (line.startsWith('--json project show')) return ok({ project: null, rules: [] });
      if (path.basename(file) === 'lsof') return o.liveInFolder ? { code: 0, stdout: `p1\nn${dir}\n`, stderr: '' } : { code: 1, stdout: '', stderr: '' };
      if (path.basename(file) === 'ps') return { code: 0, stdout: 'zsh\n', stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file, args, opts) => {
      spawned.push({ file, args, cwd: opts.cwd });
      const own = path.join(home, '.claude', 'projects', 'p', `${args[1]}.jsonl`);
      if (args[0] === '--resume' && !o.stop?.silent) setTimeout(() => { try { fs.appendFileSync(own, '{"brief":true}\n'); fs.utimesSync(own, new Date(), new Date(Date.now() + 1000)); } catch { /* none */ } }, 20);
      const me = pid++;
      return { pid: me, onData: () => ({ dispose() {} }), onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { exits.set(me, cb); return { dispose() {} }; }, write() {}, resize() {}, kill() {} };
    },
    killGroup: (p) => { setTimeout(() => exits.get(p)?.({ exitCode: 0, signal: 1 }), 1); },
    idleMs: 0,
    machine: async () => ({ freeDisk: o.machine?.freeDisk ?? 50 * GB, swap: o.machine?.swap ?? null, running: 0 }),
    keys: () => (o.agentFolder ? ['agent.default'] : []),
    notice: (n) => notices.push(n),
    changed: () => { changed += 1; },
    home,
    settleMs: 300,
  });
  return { host, dir, home, base, calls, spawned, settings, notices, changes: () => changed };
}

const claims = (calls: string[][]) => calls.filter((c) => c[0] === 'switchboard' && c[2] === 'recovery' && c[3] === 'claim');

// ── R1-U1 ──

test('R1-U1: Remove and Clear on an ended hand-over do not bring its in-place Switchboard record back as a row', POSIX, async () => {
  for (const how of ['remove', 'clear'] as const) {
    let state = 'running';
    let launched = 0;
    const r = rig({ sessions: (dir) => [{ account_id: 'acc-1', home: '/sb/runtimes/claude-default', label: 'Work Max', launched_at: launched / 1000, mode: 'managed', pool: 'default', provider: 'claude', state, working_directory: dir, in_place: true, continues: 'wf_0123456789abcdef' }] });
    const [key] = await r.host.pollHandovers();
    assert.equal(key, handoverOwnKey(HO));
    launched = Date.now() + 2000; // Switchboard records the launch a couple of seconds after the console started it
    await r.host.pollSessions();
    assert.equal(r.host.sessionsStatus().rows.length, 1, 'our console and Switchboard\'s record of it are one row');
    await r.host.endSession(r.host.sessionsStatus().rows[0]!.id);
    await tick();
    state = 'ended';
    await r.host.pollSessions();
    const ended = r.host.sessionsStatus().rows;
    assert.deepEqual(ended.map((x) => x.state), ['ended-by-you']);
    if (how === 'remove') await r.host.dismissSession(ended[0]!.id);
    else await r.host.clearEnded();
    assert.deepEqual(r.host.sessionsStatus().rows.map((x) => `${x.id} ${x.state}`), [], `${how}: nothing comes back`);
  }
});

// ── R1-U2 ──

test('R1-U2: a declined stop stays declined after Remove and Clear; automatic continue never claims it', POSIX, async () => {
  for (const how of ['remove', 'clear'] as const) {
    const r = rig({ stop: {} });
    r.settings.update({ resumeAfterLimit: false });
    await r.host.pollRecovery();
    const row = r.host.sessionsStatus().rows[0]!;
    assert.equal(row.state, 'waiting-reset');
    await r.host.dismissSession(row.id); // Do not continue
    assert.equal(r.host.sessionsStatus().rows[0]!.reason, 'declined');
    if (how === 'remove') await r.host.dismissSession(row.id);
    await r.host.clearEnded();
    assert.deepEqual(r.host.sessionsStatus().rows, [], 'the declined row is gone from the list');
    r.settings.update({ resumeAfterLimit: true });
    assert.deepEqual(await r.host.pollRecovery(), []);
    assert.deepEqual(claims(r.calls), [], `${how}: no recovery claim`);
    assert.equal(r.spawned.length, 0);
  }
});

// ── R1-S1 ──

test('R1-S1: the window\'s generic settings change cannot write sessions or consoles', () => {
  const strip = (settingsMod as unknown as { rendererSettingsPatch?: (raw: unknown) => Record<string, unknown> }).rendererSettingsPatch;
  assert.equal(typeof strip, 'function', 'rendererSettingsPatch is the handler\'s filter');
  const record = { id: 'c:x.default:1', key: 'x.default', folder: '/', agent: 'claude-code', origin: 'here', end: 'ended', endedAt: Date.now() };
  assert.deepEqual(strip!({ theme: 'dark', consoles: { 'x.default': { runtime: 'claude-code', folder: '/' } }, sessions: { records: [record], dismissed: [] } }), { theme: 'dark' });
  assert.deepEqual(strip!(null), {});
  assert.deepEqual(strip!('x'), {});
  const handler = /ipcMain\.handle\(CHANNELS\.settingsUpdate,[\s\S]*?\n {4}\}\);/.exec(read('src/electron/main.ts'))?.[0] ?? '';
  assert.match(handler, /rendererSettingsPatch\(raw\)/, 'the settingsUpdate handler filters through it');
});

// ── R1-S2 ──

const recoveryRow = (state: string, session: string, o: { probeAt?: number | null; ready?: boolean } = {}) => ({
  candidates: [], mode: null, probe_at: o.probeAt ?? null, ready: o.ready ?? false,
  stop: { account: 'acc-1', attempt: 1, directory: '/tmp', event: `cc-${session}-1`, kind: 'limit', mode: null, pool: 'default', provider: 'claude', selected_account: null, session, state, stopped_at: (NOW - 3 * 24 * HOUR) / 1000 },
});

test('R1-S2: a cancelled or resumed stop is no row, in Sessions and in MCP audit; waiting and claimed are kept', POSIX, async () => {
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004'];
  const out = JSON.stringify({ ok: true, data: { sessions: [recoveryRow('cancelled', ids[0]!), recoveryRow('resumed', ids[1]!), recoveryRow('waiting', ids[2]!), recoveryRow('claimed', ids[3]!)] } });
  assert.deepEqual(recovery.parseRecovery(out)?.map((s) => s.state), ['waiting', 'claimed']);
  const cli: Runner = async (file, args) => {
    if (args.join(' ') === '--json recovery') return { code: 0, stdout: JSON.stringify({ ok: true, data: { sessions: [recoveryRow('cancelled', ids[0]!)] } }), stderr: '' };
    return { code: 1, stdout: '', stderr: `unexpected ${file}` };
  };
  const audit = await limitStops({ now: () => NOW, platform: 'darwin', switchboard: () => '/bin/switchboard', cli, home: tmp('fd-r1-home-') } as never);
  assert.deepEqual(audit, { available: true, stops: [] }, 'no limitStops entry for a cancelled stop');
  const r = rig({ stop: { state: 'cancelled', ready: false, candidates: [] } });
  await r.host.pollRecovery();
  assert.deepEqual(r.host.sessionsStatus().rows, [], 'no waiting row with a time days in the past');
});

// ── R1-S3 ──

test('R1-S3: a waiting stop is expected at Switchboard\'s probe_at, and at no time when Switchboard gives none', () => {
  assert.equal((sessions as Record<string, unknown>).PROBE_DELAY_S, undefined, 'the copied backoff table is gone');
  const probe = NOW + 7 * MIN;
  const parsed = recovery.parseRecovery(JSON.stringify({ ok: true, data: { sessions: [recoveryRow('waiting', SID, { probeAt: probe / 1000 }), recoveryRow('waiting', '00000000-0000-4000-8000-000000000005')] } }))!;
  assert.deepEqual(parsed.map((s) => (s as { probeAt?: unknown }).probeAt), [probe, null]);
  const stop = { event: 'cc-a-1', session: SID, dir: '/w/a', provider: 'claude' as const, stoppedAt: NOW - MIN, attempt: 1, verdict: 'waiting' as const };
  const rows = mergeSessions(input({ stops: [{ ...stop, probeAt: probe } as never, { ...stop, event: 'cc-b-1', session: '00000000-0000-4000-8000-000000000005', dir: '/w/b', probeAt: null } as never] }));
  assert.equal(rows.find((x) => x.folder === '/w/a')!.expectedAt, probe);
  assert.equal(rows.find((x) => x.folder === '/w/b')!.expectedAt, null, 'a stop Switchboard will never probe shows no time');
});

// ── R1-U3 ──

test('R1-U3: a hand-over a record or a console names is never listed again, compared by its own key', () => {
  const pending = { id: HO, dir: '/w/alpha', agent: 'claude-code', account: 'Work Max', workflow: 'w', offeredUntil: NOW - MIN };
  const ended = { id: `c:${handoverOwnKey(HO)}:${NOW - HOUR}`, key: handoverOwnKey(HO), folder: '/w/alpha', agent: 'claude-code', account: null, context: null, origin: 'handover' as const, end: 'ended' as const, reason: null, startedAt: NOW - HOUR, endedAt: NOW - 30 * MIN, sessionId: null, provider: 'claude' as const, handoverId: HO };
  const fromRecord = mergeSessions(input({ pending: [pending], records: [ended] }));
  assert.deepEqual(fromRecord.map((x) => x.id), [ended.id], 'the taken hand-over is its ended row, not also an expired one');
  const running = mergeSessions(input({ pending: [pending], consoles: [{ key: handoverOwnKey(HO), folder: '/w/alpha', agent: 'claude-code', startedAt: NOW - MIN, origin: 'handover', account: null, handoverId: HO }] }));
  assert.deepEqual(running.map((x) => x.state), ['running-ours']);
});

// ── R1-U4 ──

test('R1-U4: Continue on a Switchboard row never takes up a conversation that may still be live', POSIX, async () => {
  const mangled = (dir: string) => dir.replace(/[^A-Za-z0-9]/g, '-');
  const setup = (o: { writtenAgo: number; live?: boolean }) => {
    const r = rig({ liveInFolder: o.live, sessions: (dir) => [{ account_id: 'acc-1', home: '/sb/homes/a', label: 'Spare', launched_at: (Date.now() - 10 * MIN) / 1000, mode: 'managed', pool: 'default', provider: 'claude', state: 'ended', working_directory: dir, in_place: false }] });
    const t = path.join(r.home, '.claude', 'projects', mangled(r.dir));
    fs.mkdirSync(t, { recursive: true });
    fs.writeFileSync(path.join(t, `${SID}.jsonl`), '{}\n');
    const at = new Date(Date.now() - o.writtenAgo);
    fs.utimesSync(path.join(t, `${SID}.jsonl`), at, at);
    return r;
  };
  const resumeArgs = async (r: ReturnType<typeof rig>) => {
    await r.host.pollSessions();
    const row = r.host.sessionsStatus().rows.find((x) => x.id.startsWith('sb:'))!;
    assert.ok(row, JSON.stringify(r.host.sessionsStatus().rows));
    const done = await r.host.continueSession(row.id);
    assert.ok(done.ok, JSON.stringify(done));
    return r.spawned.at(-1)!.args;
  };
  assert.ok(!(await resumeArgs(setup({ writtenAgo: 5_000 }))).includes('--resume'), 'written in the last minute: a new session');
  assert.ok(!(await resumeArgs(setup({ writtenAgo: 5 * MIN, live: true }))).includes('--resume'), 'a live agent in its folder: a new session');
  assert.deepEqual(await resumeArgs(setup({ writtenAgo: 5 * MIN })), ['--resume', SID], 'quiet and held by nobody: its conversation');
});

// ── R1-U5 ──

test('R1-U5: a new session on a key that once resumed a conversation does not inherit its session id', POSIX, async () => {
  const r = rig({ stop: { silent: true } });
  await r.host.pollRecovery();
  const failed = r.host.sessionsStatus().rows.find((x) => x.state === 'needs-you-resume-failed')!;
  await r.host.endSession(failed.id);
  await tick();
  const record = r.settings.get().sessions.records.find((x) => x.id === failed.id)!;
  assert.equal(record.sessionId, SID, 'the resumed session\'s own id is kept for Continue');
  fs.rmSync(path.join(r.home, '.claude', 'projects', 'p', `${SID}.jsonl`)); // its conversation is gone: Continue starts a new one
  const next = await r.host.continueSession(failed.id);
  assert.deepEqual(next, { ok: true, key: failed.key });
  const running = r.host.sessionsStatus().rows.find((x) => x.state === 'running-ours')!;
  await r.host.endSession(running.id);
  await tick();
  assert.equal(r.settings.get().sessions.records.find((x) => x.id === running.id)!.sessionId, null);
});

// ── R1-U6 ──

test('R1-U6: an unreadable recovery keeps the time it first failed, and pushes no status on every tick', POSIX, async () => {
  const r = rig({ recoveryFails: true });
  await r.host.pollRecovery();
  const first = r.host.sessionsStatus(NOW).degraded.find((d) => d.source === 'recovery');
  const later = r.host.sessionsStatus(NOW + 5 * MIN).degraded.find((d) => d.source === 'recovery');
  assert.ok(first);
  assert.deepEqual(later, first);
  await r.host.pollSessions();
  const before = r.changes();
  await r.host.pollRecovery();
  await r.host.pollSessions();
  assert.equal(r.changes(), before, 'nothing changed, nothing pushed');
});

// ── R1-U7 ──

test('R1-U7: our console claims the nearest in-place Switchboard record, never a Terminal one', () => {
  const rows = mergeSessions(input({
    switchboard: [
      sb({ home: '/sb/homes/t', account: 'Terminal one', inPlace: false, launchedAt: NOW + 5_000 }),
      sb({ home: '/sb/homes/far', account: 'Far one', launchedAt: NOW + 90_000 }),
      sb({ home: '/sb/homes/near', account: 'Near one', launchedAt: NOW + 10_000 }),
    ],
    consoles: [{ key: 'handover.ho-00000000000a', folder: '/w/alpha', agent: 'claude-code', startedAt: NOW, origin: 'handover', account: null, handoverId: 'ho-00000000000a' }],
  }));
  const ours = rows.find((x) => x.state === 'running-ours')!;
  assert.equal(ours.account, 'Near one');
  assert.deepEqual(rows.filter((x) => x.state === 'running-terminal').map((x) => x.account).sort(), ['Far one', 'Terminal one']);
});

// ── R1-U8, R1-P1 ──

const snap = (o: Partial<ServiceSnapshot>): ServiceSnapshot => ({ key: 'a.default', state: 'ready', wellKnown: null, busy: false, lastAction: null, ...o } as ServiceSnapshot);

test('R1-U8: a failed action turns the tray icon to problem, as it turns the sidebar badge red', () => {
  const now = Date.now();
  const failed = snap({ lastAction: { kind: 'restart', ok: false, at: new Date(now - MIN).toISOString() } as never });
  assert.equal(trayLevel([failed], {}, [], now), 'problem');
  assert.equal(trayLevel([snap({ busy: true } as never)], {}, [], now), 'ok', 'a running action is not a problem');
  assert.equal(trayLevel([snap({ state: 'down' })], {}, [], now), 'problem');
});

test('R1-P1: a session that needs the person turns the tray icon to attention, drawn as its own shape', () => {
  const now = Date.now();
  const needs = fourGroups().filter((x) => x.group === 'needs-you');
  assert.equal(trayLevel([snap({})], {}, needs, now), 'attention');
  assert.equal(trayLevel([snap({ state: 'down' })], {}, needs, now), 'problem', 'a problem still wins');
  assert.equal(trayLevel([snap({})], {}, fourGroups().filter((x) => x.group === 'running'), now), 'ok');
  const mac = trayIcon('darwin', 'attention' as never);
  const other = trayIcon('linux', 'attention' as never);
  assert.deepEqual([mac.file, other.file], ['trayAttentionTemplate.png', 'tray-attention.png']);
  for (const f of [mac.file, mac.file.replace('.png', '@2x.png'), other.file, other.file.replace('.png', '@2x.png')]) assert.ok(fs.existsSync(path.join(ROOT, 'build/assets', f)), f);
});

// ── R1-S4 ──

test('R1-S4: quitting records each running console as closed when the app quit, not as ended by itself', POSIX, async () => {
  const r = rig();
  await r.host.pollHandovers();
  const quit = (r.host as unknown as { endAllForQuit?: () => Promise<void> }).endAllForQuit;
  assert.equal(typeof quit, 'function');
  await quit!.call(r.host);
  await tick();
  const row = r.host.sessionsStatus().rows[0]!;
  assert.deepEqual([row.state, row.reason, row.actions], ['ended', 'quit', ['continue', 'dismiss']]);
  assert.equal(stateWords('en', row), 'Closed when the app quit');
  assert.equal(stateWords('ru', row), 'Закрыта при выходе из приложения');
  const willQuit = /app\.on\('will-quit'[\s\S]*?\n {2}\}\);/.exec(read('src/electron/main.ts'))?.[0] ?? '';
  assert.match(willQuit, /consoles\.endAllForQuit\(\)/, 'will-quit ends the consoles with the quit reason');
});

// ── R1-V1 to R1-V4 ──

const nav = (rows: Parameters<typeof srow>[0][] | ReturnType<typeof srow>[], lang: Lang = 'en', endedOpen = true) => renderToStaticMarkup(React.createElement(LangContext.Provider, { value: lang },
  React.createElement(SessionsNav, { sessions: { rows: rows as never, degraded: [], switchboard: true, handovers: { enabled: true }, autoContinue: true }, currentId: null, allCurrent: false, rail: false, endedOpen, onEndedOpen: () => undefined, openAll: () => undefined, openRow: () => undefined })));

test('R1-V1: a sidebar row keeps its time on the first line and says account and origin below; the agent only when not Claude Code', () => {
  const html = nav([srow({ id: 'c:a:1', state: 'running-ours', folder: '/work/passioncode-platform' }), srow({ id: 'c:b:2', state: 'running-ours', folder: '/work/passioncode-platform', agent: 'codex', account: 'spare', origin: 'resume', startedAt: AT + HOUR })]);
  const lines = [...html.matchAll(/class="session-line1">([\s\S]*?)<\/span><\/span><span class="session-sub">([^<]*)</g)].map((m) => [m[1], m[2]]);
  assert.equal(lines.length, 2, html);
  assert.match(lines[0]![0]!, new RegExp(`class="session-time">${clock('en', AT)}`));
  assert.equal(lines[0]![1], 'claude4 · handed over');
  assert.match(lines[1]![0]!, new RegExp(`class="session-time">${clock('en', AT + HOUR)}`));
  assert.equal(lines[1]![1], 'Codex · spare · after a reset', 'the sidebar\'s shorter words (FD-107)');
  assert.match(read('src/renderer/styles/app.css'), /\.session-time \{[^}]*flex: none/, 'the time is never cut');
});

/** WCAG 2.x relative luminance contrast of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

test('R1-V2: the waiting-for-reset mark is a clock in the info colour, at least 3:1 on the sidebar in both themes', () => {
  const html = nav([srow({ id: 'st:cc-1', state: 'waiting-reset', expectedAt: AT + HOUR })]);
  assert.match(html, /class="state state-waiting"[^>]*><span class="glyph session-mark"[^>]*><svg[^>]*class="mark-clock"/);
  assert.doesNotMatch(html, /◌/, 'not the dotted ring of a starting agent');
  const all = renderToStaticMarkup(React.createElement(AllSessions, { sessions: { rows: [srow({ id: 'st:cc-1', state: 'waiting-reset' })], degraded: [], switchboard: true, handovers: { enabled: true }, autoContinue: true }, noteSeen: true, onNoteSeen: () => undefined, onSetUp: () => undefined, endedOpen: true, onEndedOpen: () => undefined, open: () => undefined, askEnd: () => undefined, continued: () => undefined }));
  assert.match(all, /state-waiting[\s\S]*?class="mark-clock"/, 'the same mark on the card');
  assert.match(read('src/renderer/styles/app.css'), /\.state-waiting \{ color: var\(--pc-info\); \}/);
  const tokens = read('src/renderer/brand/fabric-tokens.css');
  const [dark, light] = [tokens.slice(0, tokens.indexOf('[data-theme="light"]')), tokens.slice(tokens.indexOf('[data-theme="light"]'))];
  const val = (block: string, name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)![1]!;
  for (const [theme, block] of [['dark', dark], ['light', light]] as const) {
    for (const bg of ['--pc-panel', '--pc-accent-soft', '--pc-bg']) {
      const c = contrast(val(block, '--pc-info'), val(block, bg));
      assert.ok(c >= 3, `${theme}: --pc-info on ${bg} is ${c.toFixed(2)}:1`);
    }
  }
});

test('R1-V3: the sidebar heads the ended group "Ended: N"; the page keeps the long heading', () => {
  assert.match(nav(fourGroups()), />Ended: 1</);
  assert.doesNotMatch(nav(fourGroups()), /Ended in the last 24 hours/);
  assert.match(nav(fourGroups(), 'ru'), />Завершены: 1</);
  const page = renderToStaticMarkup(React.createElement(AllSessions, { sessions: { rows: fourGroups(), degraded: [], switchboard: true, handovers: { enabled: true }, autoContinue: true }, noteSeen: true, onNoteSeen: () => undefined, onSetUp: () => undefined, endedOpen: true, onEndedOpen: () => undefined, open: () => undefined, askEnd: () => undefined, continued: () => undefined }));
  assert.match(page, /Ended in the last 24 hours: 1/);
});

test('R1-V4: a session page draws no exit strip for an idle close or a person\'s End; an unclean exit still says its code', () => {
  const line = (sessionsView as unknown as { pageExitLine?: (lang: Lang, s: { state: string; exitCode: number | null; signal: number | null }, idle: boolean) => string | null }).pageExitLine;
  assert.equal(typeof line, 'function');
  assert.equal(line!('en', { state: 'exited', exitCode: 0, signal: null }, true), null, 'idle-closed: the header says it');
  assert.equal(line!('en', { state: 'exited', exitCode: null, signal: 1 }, false), null, 'ended by you, or when the app quit');
  assert.equal(line!('en', { state: 'exited', exitCode: 0, signal: null }, false), null, 'a clean end: the header says when');
  assert.equal(line!('en', { state: 'running', exitCode: null, signal: null }, false), null);
  assert.equal(line!('en', { state: 'exited', exitCode: 2, signal: null }, false), 'The session exited with code 2.');
  assert.match(read('src/renderer/components/ConsolePanel.tsx'), /pageExitLine\(lang, info\.session, Boolean\(info\.idle\)\)/, 'the session page draws its strip through it');
});

// ── Added by the coordinator during FIX-1, found by DOCS-1 (R1-A, R1-B, R1-C) ──

test('R1-A: a session in a window Switchboard opened is named by the window each system really opens', () => {
  const row = srow({ id: 'sb:h:1', state: 'running-terminal' });
  const opened = srow({ id: 'ho:ho-1', state: 'needs-you-not-opened', reason: 'expired', openedInTerminal: true });
  const words = (w: 'mac' | 'windows' | 'other', lang: Lang) => {
    const was = setWording(w as never);
    try {
      return [stateWords(lang, row), stateWords(lang, opened), renderToStaticMarkup(React.createElement(LangContext.Provider, { value: lang }, React.createElement(SessionBody, { row })))];
    } finally { setWording(was); }
  };
  const [macState, macOpened, macBody] = words('mac', 'en');
  assert.equal(macState, 'Running in Terminal');
  assert.match(macOpened, /Switchboard opened it in Terminal\.$/);
  assert.match(macBody, /runs in a Terminal window that Switchboard opened/);
  const [winState, winOpened, winBody] = words('windows', 'en');
  assert.equal(winState, 'Running in a PowerShell window', 'Switchboard starts powershell.exe in a new console (launch.rs start_terminal)');
  assert.match(winOpened, /Switchboard opened it in a PowerShell window\.$/);
  assert.match(winBody, /runs in a PowerShell window that Switchboard opened/);
  const [linState, linOpened, linBody] = words('other', 'en');
  assert.equal(linState, 'Running in a terminal window', 'Linux: the desktop\'s own terminal ($TERMINAL, x-terminal-emulator, …)');
  assert.match(linOpened, /Switchboard opened it in a terminal window\.$/);
  assert.match(linBody, /runs in a terminal window that Switchboard opened/);
  assert.deepEqual(words('windows', 'ru').slice(0, 2), ['Идёт в окне PowerShell', 'Передача истекла раньше, чем сессия открылась здесь. Switchboard открыл её в окне PowerShell.']);
  assert.equal(words('other', 'ru')[0], 'Идёт в окне терминала');
  const handovers = (w: 'mac' | 'windows' | 'other') => { const was = setWording(w as never); try { return translate('en', 'settings.handovers.body'); } finally { setWording(was); } };
  assert.deepEqual([/new Terminal window/, /new PowerShell window/, /new terminal window/].map((re, i) => re.test(handovers((['mac', 'windows', 'other'] as const)[i]!))), [true, true, true], 'Settings → Sessions says the same window');
  const keys = allKeys();
  for (const key of keys.filter((k) => k.endsWith('.windows'))) assert.ok(keys.includes(key.slice(0, -'.windows'.length) as never), `${key} varies a key that exists`);
});

test('R1-B: a hand-over this computer could not carry names the cause it found: disk, six sessions or swap', POSIX, async () => {
  const cases = [
    { machine: { freeDisk: 2 * GB }, reason: 'busy-disk', en: /less than 5 GB is free on its disk\.$/ },
    { machine: { swap: { total: 4 * GB, free: 0.01 * GB } }, reason: 'busy-swap', en: /the system has run out of swap\.$/ },
  ];
  for (const c of cases) {
    const r = rig({ machine: c.machine });
    assert.deepEqual(await r.host.pollHandovers(), []);
    const row = r.host.sessionsStatus().rows[0]!;
    assert.equal(row.reason, c.reason);
    assert.match(stateWords('en', row), c.en);
    assert.doesNotMatch(stateWords('en', row), / or /, 'one cause, not a list of maybes');
  }
  assert.match(stateWords('en', srow({ id: 'ho:ho-2', state: 'needs-you-not-opened', reason: 'busy-cap' as never })), /six console sessions already run\.$/);
  assert.match(stateWords('ru', srow({ id: 'ho:ho-2', state: 'needs-you-not-opened', reason: 'busy-swap' as never })), /кончилась память подкачки\.$/);
  // Continue refused by the same check says the same cause.
  const t = (key: string, params?: Record<string, string | number>) => translate('en', key, params);
  assert.match(failText(t, { ok: false, reason: 'admission', detail: 'swap' }, { action: 'continue', folder: '/w' }), /run out of swap/);
  assert.match(failText(t, { ok: false, reason: 'admission', detail: 'disk' }, { action: 'continue', folder: '/w' }), /free on its disk/);
});

test('R1-C: continuing an idle-closed agent console from the console itself takes its ended row off the Sessions list', POSIX, async () => {
  const r = rig({ agentFolder: true });
  assert.deepEqual(await r.host.start('agent.default', 'new', { cols: 80, rows: 24 }), { ok: true });
  await r.host.closeIdle(0, Date.now() + 1);
  await tick();
  assert.deepEqual(r.host.sessionsStatus().rows.map((x) => x.state), ['idle-closed']);
  assert.deepEqual(await r.host.start('agent.default', 'continue', { cols: 80, rows: 24 }), { ok: true });
  assert.deepEqual(r.host.sessionsStatus().rows.map((x) => x.state), ['running-ours'], 'the continued session is the one row');
  assert.equal(r.settings.get().consoles['agent.default']?.idle ?? null, null, 'and the console\'s own mark is cleared, as before');
});
