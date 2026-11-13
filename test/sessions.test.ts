// FD-103 (dossier 2026-10-24 sessions-and-navigation, node S2): every coding session of this Mac in one list, merged from
// Switchboard's `sessions --all`, its pending hand-overs, its limit stops and this app's own consoles; each row carries
// its state, its group and the actions that state allows; ended entries persist 24 h in the settings.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Runner } from '@passioncode-ai/fabric-service-host';
import { ConsoleHost, transcriptFile } from '../src/electron/console';
import { consoleRowId, mergeSessions, processRowId, pruneRecords, SESSION_KEEP_MS, SourceReader, type MergeInput, type SbMachineProcess, type SbSessionRecord, type SessionNotice, type SessionRecord } from '../src/core/sessions';
import { allSessionsOf, handoversSwitch, isHandoverKey, machineSessionsOf } from '../src/core/switchboard';
import { projectName, stateWords } from '../src/core/sessions-view';
import { SettingsStore } from '../src/core/settings';
import { tmp } from './helpers';

const NOW = 1_792_617_104_000;
const MIN = 60_000;
const HOUR = 60 * MIN;
const GB = 1024 ** 3;
const SID = '5f151e9c-cc90-4fed-a01b-101c647f52ab';
/** FD-108: one Switchboard session is one row, so stops of different sessions carry different ids. */
const SID2 = '5f151e9c-cc90-4fed-a01b-101c647f52ac';
const SID3 = '5f151e9c-cc90-4fed-a01b-101c647f52ad';
const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ok = (data: unknown) => ({ code: 0, stdout: JSON.stringify({ ok: true, data }), stderr: '' });
const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake switchboard is a shell script' };

const sb = (o: Partial<SbSessionRecord> = {}): SbSessionRecord => ({
  home: '/sb/homes/a', folder: '/w/alpha', provider: 'claude', agent: 'claude-code', pool: 'default', mode: 'managed', account: 'Work Max', accountId: 'acc-1',
  context: 'org:acme', contextName: 'Acme', continues: null, inPlace: false, launchedAt: NOW - 10 * MIN, startedAt: NOW - 10 * MIN, state: 'running' as const, launch: null, ...o,
});
const record = (o: Partial<SessionRecord> = {}): SessionRecord => ({
  id: 'c:handover.ho-0123456789ab:1', key: 'handover.ho-0123456789ab', folder: '/w/alpha', agent: 'claude-code', account: null, context: null,
  origin: 'handover', end: 'ended', reason: null, startedAt: NOW - HOUR, endedAt: NOW - 30 * MIN, sessionId: null, provider: 'claude', handoverId: 'ho-0123456789ab', ...o,
});
const input = (o: Partial<MergeInput> = {}): MergeInput => ({ now: NOW, switchboard: [], pending: [], stops: [], consoles: [], records: [], dismissed: [], ...o });

test('FD-103: the merge of the four sources gives one list, deduplicated by folder and start time, newest first', () => {
  const rows = mergeSessions(input({
    switchboard: [
      // Our hand-over console, as Switchboard sees it: the same folder, started within seconds.
      sb({ home: '/sb/runtimes/claude-default', folder: '/w/alpha', inPlace: true, continues: 'wf_0123456789abcdef', launchedAt: NOW - 2 * MIN }),
      sb({ home: '/sb/homes/b', folder: '/w/beta', launchedAt: NOW - 20 * MIN }),
      sb({ home: '/sb/homes/c', folder: '/w/gamma', state: 'ended', launchedAt: NOW - 3 * HOUR }),
      sb({ home: '/sb/homes/d', folder: '/w/old', state: 'ended', launchedAt: NOW - 2 * 24 * HOUR }),
    ],
    pending: [{ id: 'ho-00000000000b', dir: '/w/busy', agent: 'codex', account: 'Spare', workflow: 'w', offeredUntil: NOW + MIN }],
    stops: [
      { event: 'cc-a-1', session: SID, dir: '/w/stopA', provider: 'claude', stoppedAt: NOW - MIN, attempt: 1, verdict: 'waiting', candidates: [], probeAt: NOW + 4 * MIN },
      { event: 'cc-b-1', session: SID2, dir: '/w/stopB', provider: 'claude', stoppedAt: NOW - 5 * MIN, attempt: 2, verdict: 'resume', candidates: [{ id: 'acc-2', label: 'Spare' }, { id: 'acc-3', label: 'acc-3' }] },
      { event: 'cc-c-1', session: SID3, dir: '/w/alpha', provider: 'claude', stoppedAt: NOW - 3 * MIN, attempt: 1, verdict: 'resumed', key: 'handover.ho-0123456789ab' },
    ],
    consoles: [{ key: 'handover.ho-0123456789ab', folder: '/w/alpha', agent: 'claude-code', startedAt: NOW - 2 * MIN + 3000, origin: 'handover', account: null, handoverId: 'ho-0123456789ab' }],
    records: [
      record({ id: 'ho:ho-00000000000b', key: null, folder: '/w/busy', end: 'not-opened', reason: 'busy', startedAt: null, endedAt: NOW - 4 * MIN, handoverId: 'ho-00000000000b' }),
      record({ id: 'ho:ho-00000000000c', key: null, folder: '/w/gone', end: 'not-opened', reason: 'no-folder', startedAt: null, endedAt: NOW - 6 * MIN, handoverId: 'ho-00000000000c' }),
    ],
  }));
  const by = (folder: string) => rows.filter((r) => r.folder === folder);
  assert.equal(by('/w/alpha').length, 1, 'our console and Switchboard\'s record of it are one row; the resumed stop is that row too');
  const alpha = by('/w/alpha')[0]!;
  assert.deepEqual([alpha.state, alpha.group, alpha.origin, alpha.account, alpha.context, alpha.project], ['running-ours', 'running', 'handover', 'Work Max', 'org:acme', 'alpha']);
  assert.deepEqual(alpha.actions, ['end', 'reveal']);
  assert.deepEqual([by('/w/beta')[0]!.state, by('/w/beta')[0]!.origin, by('/w/beta')[0]!.actions], ['running-terminal', 'switchboard', ['reveal']]); // V-6 of FIX-2: Show in Finder for its folder
  assert.deepEqual([by('/w/gamma')[0]!.state, by('/w/gamma')[0]!.group, by('/w/gamma')[0]!.actions], ['ended', 'ended', ['continue', 'dismiss']]);
  assert.equal(by('/w/old').length, 0, 'an ended session launched more than 24 h ago is not listed');
  const busy = by('/w/busy')[0]!;
  assert.deepEqual([busy.state, busy.group, busy.reason, busy.openedInTerminal, busy.actions], ['needs-you-not-opened', 'needs-you', 'busy', false, ['dismiss']]);
  assert.equal(by('/w/gone')[0]!.openedInTerminal, true, 'no longer offered: Switchboard opened it in Terminal');
  const waiting = by('/w/stopA')[0]!;
  assert.deepEqual([waiting.state, waiting.group, waiting.expectedAt, waiting.actions], ['waiting-reset', 'waiting', NOW + 4 * MIN, ['dontContinue']], 'expected at Switchboard\'s probe_at (R1-S3)');
  assert.deepEqual([by('/w/stopB')[0]!.actions, by('/w/stopB')[0]!.candidates.map((c) => c.id)], [['continueNow', 'dontContinue'], ['acc-2', 'acc-3']]);
  const times = rows.map((r) => r.at);
  assert.deepEqual(times, [...times].sort((a, b) => b - a), 'newest first');
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'every row has its own id');
});

test('FD-103 (orchestrator 2026-10-24): a hand-over still on offer is no row and counts nowhere; one whose offer lapsed needs you', () => {
  const offered = { id: 'ho-00000000000d', dir: '/w/offered', agent: 'claude-code', account: 'Spare', workflow: 'w', offeredUntil: NOW + MIN };
  assert.deepEqual(mergeSessions(input({ pending: [offered] })), []);
  const lapsed = mergeSessions(input({ pending: [{ ...offered, offeredUntil: NOW - MIN }] }));
  assert.deepEqual(lapsed.map((r) => [r.state, r.reason, r.actions]), [['needs-you-not-opened', 'expired', ['dismiss']]]);
});

test('FD-103: two hand-overs of one folder give two rows told apart by origin and time', () => {
  const rows = mergeSessions(input({
    consoles: [{ key: 'handover.ho-00000000000a', folder: '/w/alpha', agent: 'claude-code', startedAt: NOW - MIN, origin: 'handover', account: 'Work Max', handoverId: 'ho-00000000000a' }],
    records: [record({ id: consoleRowId('handover.ho-0123456789ab', NOW - 2 * HOUR), startedAt: NOW - 2 * HOUR, endedAt: NOW - HOUR })],
  }));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => [r.project, r.state, r.origin]), [['alpha', 'running-ours', 'handover'], ['alpha', 'ended', 'handover']]);
  assert.notEqual(rows[0]!.startedAt, rows[1]!.startedAt);
  assert.notEqual(rows[0]!.id, rows[1]!.id);
});

test('FD-103: every state carries the actions of the dossier table', () => {
  const rows = mergeSessions(input({
    consoles: [{ key: 'handover.rs-0123456789ab', folder: '/w/r', agent: 'Claude Code', startedAt: NOW - MIN, origin: 'resume', account: null, failedResume: true }],
    stops: [
      { event: 'cc-x-1', session: sid(1), dir: '/w/x', provider: 'claude', stoppedAt: NOW - MIN, attempt: 1, verdict: 'no-transcript' },
      ...(['open', 'billing', 'old', 'no-folder'] as const).map((verdict, n) => ({ event: `cc-v${n}-1`, session: sid(10 + n), dir: `/w/v-${verdict}`, provider: 'claude' as const, stoppedAt: NOW - MIN, attempt: 1, verdict })),
      { event: 'cc-y-1', session: sid(2), dir: '/w/claimed', provider: 'claude', stoppedAt: NOW - MIN, attempt: 1, verdict: 'claimed' },
    ],
    records: [
      record({ id: 'c:a.default:1', key: 'a.default', folder: '/w/a', origin: 'here', end: 'idle' }),
      record({ id: 'c:b.default:1', key: 'b.default', folder: '/w/b', origin: 'here', end: 'you' }),
      record({ id: 'st:cc-d-1', key: null, folder: '/w/d', origin: 'resume', end: 'declined', reason: 'declined' }),
    ],
  }));
  const of = (folder: string) => rows.find((r) => r.folder === folder)!;
  // Decision 1, amended after 0.8.0 (FD-108): only a payment stop needs the person; an open or old one is no row; one
  // whose folder or conversation is not here is Ended with Remove.
  const v = (verdict: string) => rows.find((x) => x.folder === `/w/v-${verdict}`);
  assert.deepEqual([v('billing')!.group, v('billing')!.state, v('billing')!.reason, v('billing')!.actions], ['needs-you', 'needs-you-not-opened', 'billing', ['dismiss']]);
  assert.equal(v('open'), undefined, 'its terminal is still open: not listed');
  assert.equal(v('old'), undefined, 'older than a day: not listed');
  assert.deepEqual([v('no-folder')!.group, v('no-folder')!.state, v('no-folder')!.actions], ['ended', 'ended-cannot-continue', ['dismiss']]);
  assert.ok(!rows.some((x) => x.folder === '/w/claimed'), 'a stop another host took is not listed');
  assert.deepEqual([of('/w/d').state, of('/w/d').reason, of('/w/d').actions], ['ended', 'declined', ['continue', 'dismiss']], 'decision 2: declined is an ended row');
  assert.deepEqual([of('/w/r').state, of('/w/r').group, of('/w/r').actions, of('/w/r').key], ['needs-you-resume-failed', 'needs-you', ['openConsole', 'end'], 'handover.rs-0123456789ab']);
  assert.deepEqual([of('/w/a').state, of('/w/a').actions], ['idle-closed', ['continue', 'dismiss']]);
  assert.deepEqual([of('/w/b').state, of('/w/b').actions], ['ended-by-you', ['continue', 'dismiss']]);
  assert.deepEqual([of('/w/x').state, of('/w/x').reason, of('/w/x').actions], ['ended-cannot-continue', 'no-transcript', ['dismiss']]);
});

test('FD-103: a dismissed row is not listed; ended entries older than 24 h are dropped', () => {
  const kept = record({ id: 'c:k:1', endedAt: NOW - 23 * HOUR });
  const old = record({ id: 'c:o:1', endedAt: NOW - SESSION_KEEP_MS - 1 });
  assert.deepEqual(pruneRecords([kept, old], NOW).map((r) => r.id), ['c:k:1']);
  const rows = mergeSessions(input({ records: [kept, old, record({ id: 'c:d:1' })], dismissed: [{ id: 'c:d:1', at: NOW - MIN }] }));
  assert.deepEqual(rows.map((r) => r.id), ['c:k:1']);
});

test('FD-103: restart keeps the ended entries of the last 24 h and drops the older ones', () => {
  const dir = tmp('fd-ses-settings-');
  const now = Date.now();
  const first = new SettingsStore(dir);
  first.update({ sessions: { records: [record({ id: 'c:k:1', endedAt: now - 2 * HOUR }), record({ id: 'c:o:1', endedAt: now - 25 * HOUR }), { id: 'junk' } as never], dismissed: [{ id: 'sb:x', at: now - MIN }, { id: 'sb:y', at: now - 30 * HOUR }] } });
  const again = new SettingsStore(dir);
  assert.deepEqual(again.get().sessions.records.map((r) => r.id), ['c:k:1']);
  assert.deepEqual(again.get().sessions.dismissed.map((d) => d.id), ['sb:x']);
  assert.deepEqual(new SettingsStore(tmp('fd-ses-empty-')).get().sessions, { records: [], dismissed: [] }, 'a file from an earlier version has none');
});

test('FD-124: a row carries its Switchboard launch facts, from its own session or its console twin', () => {
  const facts = { launchId: '0b8f6c1e-1f2a-4c3d-9e8f-0123456789ab', by: { surface: 'fallback' as const, by: 'voc-learn', program: 'switchboard', project: 'agents', parent: null, caller: null },
    transcript: '/x/t.jsonl', turns: 3, lastTurnAt: NOW - 5 * MIN, ended: 'limit' as const, endedAt: NOW - 4 * MIN, continuedAs: { kind: 'handover' as const, id: 'ho-0123456789ab' } };
  const base = { pending: [], stops: [], records: [], dismissed: [], now: NOW };
  // A session in Terminal, ended: its row says when it ended, from the launch record.
  const [t] = mergeSessions({ ...base, consoles: [], switchboard: [sb({ state: 'ended', launch: facts })] });
  assert.deepEqual(t!.launch, facts);
  assert.equal(t!.endedAt, NOW - 4 * MIN);
  // One of our consoles: its Switchboard twin's facts.
  const [c] = mergeSessions({ ...base, consoles: [{ key: 'svc.a', folder: '/w/alpha', agent: 'claude-code', origin: 'here', startedAt: NOW - 10 * MIN }], switchboard: [sb({ inPlace: true, launch: facts })] });
  assert.equal(c!.key, 'svc.a');
  assert.deepEqual(c!.launch, facts);
  // No record: null, never an empty object.
  const [n] = mergeSessions({ ...base, consoles: [], switchboard: [sb()] });
  assert.equal(n!.launch, null);
});

test('FD-124: a paid hand-over stays marked on its row: running, ended, not opened, lapsed; a tampered record is no mark', () => {
  const base = { switchboard: [], stops: [], dismissed: [], now: NOW };
  const [run] = mergeSessions({ ...base, pending: [], records: [], consoles: [{ key: 'handover.ho-0123456789ab', folder: '/w/alpha', agent: 'claude-code', origin: 'handover', startedAt: NOW - MIN, account: null, handoverId: 'ho-0123456789ab', paid: 'openrouter' }] });
  assert.equal(run!.paid, 'openrouter');
  const [ended] = mergeSessions({ ...base, pending: [], consoles: [], records: [record({ end: 'ended', paid: 'api_key_account' })] });
  assert.equal(ended!.paid, 'api_key_account');
  const [lapsed] = mergeSessions({ ...base, consoles: [], records: [], pending: [{ id: 'ho-0123456789ac', dir: '/w/beta', agent: 'claude-code', account: '', workflow: 'w', offeredUntil: NOW - MIN, paid: 'openrouter' }] });
  assert.equal(lapsed!.paid, 'openrouter');
  const [bad] = mergeSessions({ ...base, pending: [], consoles: [], records: [record({ end: 'ended', paid: 'card' as never })] });
  assert.equal(bad!.paid, null);
});

test('FD-124: a session of Switchboard 0.7.0 says who launched it, how it ended, where its work went and where its transcript is', async () => {
  const base = { account_id: 'acc-1', home: '/sb/runtimes/claude-agents', in_place: false, label: 'Work', launched_at: 1_792_617_000, mode: 'managed', pool: 'agents', provider: 'claude', started_at: 1_792_617_001, state: 'ended', working_directory: '/w/alpha' };
  const run: Runner = async () => ok({ sessions: [
    { ...base, launch_id: '0b8f6c1e-1f2a-4c3d-9e8f-0123456789ab', launched_by: { surface: 'fallback', caller_launch_id: null, caller_project: 'agents', caller_program: 'switchboard', by: 'voc-learn', parent: '1c9e7d2f-2a3b-4d4e-8f9a-123456789abc' },
      provider_session_id: 'f1e2d3c4-b5a6-4789-8abc-def012345678', transcript: '/opt/h/.sb/runtimes/claude-agents/projects/-w-alpha/f1e2.jsonl', turns: 7, last_turn_at: 1_792_617_900, ended: 'limit', ended_at: 1_792_618_000,
      continued_as: { kind: 'handover', id: 'ho-0123456789ab', launch_id: '2d0f8e3a-3b4c-4e5f-9a0b-23456789abcd' } },
    { ...base, working_directory: '/w/beta', launch_id: 'not-a-uuid', launched_by: { surface: 'teleport', by: 'x y', parent: 'nope', caller_program: '/bin/zsh -c secret' }, transcript: 'relative/path.jsonl', ended: 'exploded', continued_as: { kind: 'elsewhere', id: '' } },
  ] });
  const r = await allSessionsOf(run, '/bin/switchboard');
  assert.ok(r.ok);
  assert.deepEqual(r.value[0]!.launch, {
    launchId: '0b8f6c1e-1f2a-4c3d-9e8f-0123456789ab',
    by: { surface: 'fallback', by: 'voc-learn', program: 'switchboard', project: 'agents', parent: '1c9e7d2f-2a3b-4d4e-8f9a-123456789abc', caller: null, dispatch: null },
    transcript: '/opt/h/.sb/runtimes/claude-agents/projects/-w-alpha/f1e2.jsonl', providerSessionId: 'f1e2d3c4-b5a6-4789-8abc-def012345678', turns: 7, lastTurnAt: 1_792_617_900_000,
    ended: 'limit', endedAt: 1_792_618_000_000, continuedAs: { kind: 'handover', id: 'ho-0123456789ab' },
  });
  // Nothing malformed is guessed at: an unknown surface, a name that is not one, a relative transcript, an unknown end.
  assert.deepEqual(r.value[1]!.launch, { launchId: null, by: { surface: null, by: null, program: null, project: null, parent: null, caller: null, dispatch: null }, transcript: null, providerSessionId: null, turns: null, lastTurnAt: null, ended: null, endedAt: null, continuedAs: null });
});

test('FD-103: Switchboard\'s machine-wide list is read strictly; a failure is a degraded source, never an empty list', async () => {
  const run: Runner = async (_f, args) => {
    assert.deepEqual(args, ['--json', 'sessions', '--all']);
    return ok({ sessions: [
      { account_id: 'acc-1', context: 'personal', context_name: null, continues: 'wf_0123456789abcdef', home: '/sb/homes/a', in_place: true, label: 'Work Max', launched_at: 1_792_617_000, mode: 'managed', pool: 'default', provider: 'claude', started_at: 1_792_617_001, state: 'running', working_directory: '/w/alpha' },
      { state: 'running', working_directory: 'relative' },
      'x',
    ] });
  };
  const r = await allSessionsOf(run, '/bin/switchboard');
  assert.ok(r.ok);
  assert.deepEqual(r.value, [{ home: '/sb/homes/a', folder: '/w/alpha', provider: 'claude', agent: 'claude-code', pool: 'default', mode: 'managed', account: 'Work Max', accountId: 'acc-1', context: 'personal', contextName: null, continues: 'wf_0123456789abcdef', inPlace: true, launchedAt: 1_792_617_000_000, startedAt: 1_792_617_001_000, state: 'running', launch: null }]);
  const old = await allSessionsOf(async () => ({ code: 2, stdout: '', stderr: "error: unexpected argument '--all' found" }), 'sb');
  assert.deepEqual(old, { ok: false, reason: 'old', detail: "error: unexpected argument '--all' found" });

  let calls = 0;
  let fail = false;
  let release: () => void = () => undefined;
  const reader = new SourceReader('sessions', async () => {
    calls += 1;
    await new Promise<void>((res) => { release = res; });
    return fail ? { ok: false, reason: 'error', detail: 'killed' } : { ok: true, value: ['a'] };
  }, () => NOW);
  const a = reader.poll();
  const b = reader.poll();
  assert.equal(a, b, 'a poll while one is in flight joins it');
  release();
  await a;
  assert.equal(calls, 1, 'never more than one call in flight');
  assert.deepEqual([reader.value, reader.degraded], [['a'], null]);
  fail = true;
  const c = reader.poll();
  await new Promise((res) => setImmediate(res));
  release();
  await c;
  assert.equal(calls, 2);
  assert.deepEqual(reader.value, ['a'], 'the last good answer is kept');
  assert.deepEqual(reader.degraded, { source: 'sessions', reason: 'error', detail: 'killed', since: NOW });
  const thrown = new SourceReader('handovers', async () => { throw new Error('boom'); }, () => NOW);
  await thrown.poll();
  assert.deepEqual([thrown.value, thrown.degraded?.reason, thrown.degraded?.detail], [null, 'error', 'boom']);
  await thrown.poll();
  assert.ok(true, 'a reader that threw can poll again');
});

test('FD-103: Switchboard\'s hand-over switch is read and written through its CLI only', async () => {
  const calls: string[][] = [];
  const run: Runner = async (_f, args) => { calls.push(args); return args[1] === 'set' ? { code: 0, stdout: '', stderr: '' } : { code: 1, stdout: '', stderr: 'no' }; };
  assert.deepEqual(await handoversSwitch(run, '/bin/switchboard', true), { ok: true });
  assert.deepEqual(await handoversSwitch(run, '/bin/switchboard', false), { ok: true });
  assert.deepEqual(calls, [['handovers', 'set', 'on'], ['handovers', 'set', 'off']]);
  assert.deepEqual(await handoversSwitch(async () => ({ code: 1, stdout: '', stderr: 'locked' }), 'sb', true), { ok: false, detail: 'locked' });
});

// ── ConsoleHost: the main process's side ──

const HO = 'ho-0123456789ab';
function rig(o: { stop?: { silent?: boolean; candidates?: string[] }; sessions?: unknown[]; agentFolder?: boolean; machine?: unknown[] } = {}) {
  const base = tmp('fd-ses-');
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
  const logs: string[] = [];
  const notices: SessionNotice[] = [];
  if (o.agentFolder) settings.update({ consoles: { 'agent.default': { runtime: 'claude-code', folder: dir } } });
  let pid = 1_000_000_000;
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => false, log: (l) => logs.push(l),
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (file, args) => {
      calls.push([path.basename(file), ...args]);
      const line = args.join(' ');
      if (line === '--json handovers') return ok({ enabled: true, handovers: [{ id: HO, workflow: 'nightly', agent: 'claude-code', account_label: 'Work Max', dir, offered_until: new Date(Date.now() + MIN).toISOString() }] });
      if (line === '--json sessions --all') return ok({ sessions: o.sessions ?? [] });
      // FD-231: by default the published Switchboard of 2026-11-13 (0.7.71), which does not know `--machine`.
      if (line === '--json sessions --machine') return o.machine ? ok({ sessions: o.machine }) : { code: 2, stdout: '{"error":"Invalid arguments. Run switchboard --help.","ok":false}', stderr: '' };
      if (line === '--json recovery') return ok({ sessions: o.stop ? [{ candidates: o.stop.candidates ?? ['acc-2'], ready: true, stop: { attempt: 1, directory: dir, event: `cc-${SID}-1`, kind: 'limit', provider: 'claude', session: SID, state: 'waiting', stopped_at: (Date.now() - MIN) / 1000 } }] : [] });
      if (args[1] === 'recovery') return ok({});
      if (line.startsWith('--json project show')) return ok({ project: null, rules: [] });
      if (path.basename(file) === 'lsof') return { code: 1, stdout: '', stderr: '' };
      if (path.basename(file) === 'ps') return { code: 0, stdout: 'zsh\n', stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file, args, opts) => {
      spawned.push({ file, args, cwd: opts.cwd });
      // Like a real `claude --resume <id> <brief>`: it appends the brief to its own transcript at once.
      const own = path.join(home, '.claude', 'projects', 'p', `${args[args.indexOf('--resume') + 1]}.jsonl`); // FD-174: after the bypass flag
      if (args.includes('--resume') && !o.stop?.silent) setTimeout(() => { try { fs.appendFileSync(own, '{"brief":true}\n'); fs.utimesSync(own, new Date(), new Date(Date.now() + 1000)); } catch { /* none */ } }, 20);
      const me = pid++;
      return { pid: me, onData: () => ({ dispose() {} }), onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { exits.set(me, cb); return { dispose() {} }; }, write() {}, resize() {}, kill() {} };
    },
    killGroup: (p) => { setTimeout(() => exits.get(p)?.({ exitCode: 0, signal: 1 }), 1); },
    idleMs: 0,
    machine: async () => ({ freeDisk: 50 * GB, swap: null, running: 0 }),
    keys: () => (o.agentFolder ? ['agent.default'] : []),
    notice: (n) => notices.push(n),
    home,
    settleMs: 300,
  });
  return { host, dir, base, calls, spawned, exits, logs, settings, notices };
}

const tick = () => new Promise((res) => setTimeout(res, 20));

test('FD-103: an idle-closed hand-over offers Continue, and Continue starts a session in its folder', POSIX, async () => {
  const r = rig();
  const [key] = await r.host.pollHandovers();
  assert.equal(key, `handover.${HO}`);
  assert.deepEqual(r.host.sessionsStatus().rows.map((x) => [x.state, x.origin]), [['running-ours', 'handover']]);
  await r.host.closeIdle(0, Date.now() + 1);
  await tick();
  const row = r.host.sessionsStatus().rows[0]!;
  assert.deepEqual([row.state, row.group, row.actions], ['idle-closed', 'ended', ['continue', 'dismiss']]);
  assert.equal(r.settings.get().sessions.records[0]!.end, 'idle', 'it is in the settings, for a restart');
  const started = await r.host.continueSession(row.id);
  assert.deepEqual(started, { ok: true, key: `handover.${HO}` });
  assert.equal(path.basename(r.spawned[1]!.file), 'claude');
  assert.equal(r.spawned[1]!.cwd, r.dir);
  const now = r.host.sessionsStatus().rows;
  assert.deepEqual(now.map((x) => [x.state, x.origin, x.key]), [['running-ours', 'handover', `handover.${HO}`]], 'the continued row is its new session now');
});

test('FD-103 (decision 8): a hand-over gets a console of its own even when an agent\'s console in its folder is free; it sends one notice', POSIX, async () => {
  const r = rig({ agentFolder: true });
  assert.deepEqual(await r.host.pollHandovers(), [`handover.${HO}`]);
  assert.equal((await r.host.info('agent.default')).session.state, 'idle', 'the agent\'s console stays the person\'s');
  assert.deepEqual(r.notices.map((n) => [n.kind, n.key, n.project]), [['handover', `handover.${HO}`, 'checkout']]);
  assert.equal(r.notices[0]!.id, r.host.sessionsStatus().rows[0]!.id, 'the notice names the row it opens');
});

test('FD-103: a failed resume that still runs is in needs-you, and its console is reachable by key', POSIX, async () => {
  const r = rig({ stop: { silent: true } });
  assert.deepEqual(await r.host.pollRecovery(), []);
  const row = r.host.sessionsStatus().rows.find((x) => x.group === 'needs-you')!;
  assert.ok(row, JSON.stringify(r.host.sessionsStatus().rows));
  assert.deepEqual([row.state, row.actions, row.origin], ['needs-you-resume-failed', ['openConsole', 'end'], 'resume']);
  assert.ok(row.key && isHandoverKey(row.key));
  const info = await r.host.info(row.key);
  assert.equal(info.session.state, 'running');
  assert.equal(info.handover?.kind, 'resume');
  await r.host.endSession(row.id);
  await tick();
  assert.equal(r.host.sessionsStatus().rows[0]!.state, 'ended-by-you');
});

test('FD-103: a hand-over that could not open here is a row for 24 h, with its reason', POSIX, async () => {
  const r = rig();
  fs.rmSync(r.dir, { recursive: true });
  assert.deepEqual(await r.host.pollHandovers(), []);
  const row = r.host.sessionsStatus().rows[0]!;
  assert.deepEqual([row.state, row.reason, row.actions], ['needs-you-not-opened', 'no-folder', ['dismiss']]);
  await r.host.dismissSession(row.id);
  assert.deepEqual(r.host.sessionsStatus().rows, []);
});

test('FD-103 (decision 2): Do not continue moves a waiting stop to Ended as declined, untouched in Switchboard, and never continued here', POSIX, async () => {
  const r = rig({ stop: {} });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  assert.deepEqual([row.state, row.actions], ['waiting-reset', ['continueNow', 'dontContinue']]);
  assert.deepEqual(await r.host.dismissSession(row.id), { ok: true, key: null });
  const declined = r.host.sessionsStatus().rows[0]!;
  assert.deepEqual([declined.id, declined.state, declined.reason, declined.group], [row.id, 'ended', 'declined', 'ended']);
  assert.ok(!r.calls.some((c) => c.includes('claim') || c.includes('finish')), 'Switchboard\'s record is not touched');
  r.settings.update({ resumeAfterLimit: true });
  assert.deepEqual(await r.host.pollRecovery(), []);
  assert.equal(r.spawned.length, 0);
  assert.equal(r.host.sessionsStatus().rows.length, 1);
});

test('FD-103 (decision 3): Continue now claims the stop on the account the person chose; an automatic continue sends one notice', POSIX, async () => {
  const r = rig({ stop: { candidates: ['acc-2', 'acc-3'] } });
  r.settings.update({ resumeAfterLimit: false });
  await r.host.pollRecovery();
  const row = r.host.sessionsStatus().rows[0]!;
  assert.deepEqual(row.candidates.map((c) => c.id), ['acc-2', 'acc-3']);
  assert.deepEqual(await r.host.continueSession(row.id, undefined, 'acc-9'), { ok: false, reason: 'account' });
  const done = await r.host.continueSession(row.id, undefined, 'acc-3');
  assert.ok(done.ok && done.key && isHandoverKey(done.key), JSON.stringify(done));
  assert.ok(r.calls.some((c) => c.join(' ') === `switchboard --json recovery claim --account acc-3 cc-${SID}-1`), r.calls.map((c) => c.join(' ')).join('\n'));
  assert.deepEqual(r.notices, [], 'the person\'s own Continue now sends no notice');
  const auto = rig({ stop: {} });
  assert.equal((await auto.host.pollRecovery()).length, 1);
  assert.deepEqual(auto.notices.map((n) => n.kind), ['resume']);
});

test('FD-103: the machine-wide read runs on its own, and Clear removes every ended row', POSIX, async () => {
  const r = rig({ sessions: [{ account_id: 'acc-1', home: '/sb/homes/a', label: 'Spare', launched_at: Date.now() / 1000 - 60, mode: 'managed', pool: 'default', provider: 'claude', state: 'ended', working_directory: '/w/zeta', in_place: false }] });
  await r.host.pollSessions();
  const rows = r.host.sessionsStatus().rows;
  assert.deepEqual(rows.map((x) => [x.project, x.state, x.account]), [['zeta', 'ended', 'Spare']]);
  assert.deepEqual(r.host.sessionsStatus().degraded, []);
  await r.host.clearEnded();
  assert.deepEqual(r.host.sessionsStatus().rows, []);
});

test('FD-137: a session Fabric started for a board request belongs to the agent whose folder it ran in', POSIX, async () => {
  const at = Math.floor(Date.now() / 1000) - 60;
  const board = { account_id: 'acc-1', home: '/sb/homes/a', label: 'Spare', mode: 'managed', pool: 'default', provider: 'claude', state: 'ended', in_place: true,
    launch_id: '0b8f6c1e-1f2a-4c3d-9e8f-0123456789ab', launched_by: { surface: 'fabric', dispatch: { request: '45bf7553-8ae0-4e23-93ef-8c3acefddf91' } }, ended: { kind: 'exited', exit_code: 0, at: at + 30 } };
  const sessions: unknown[] = [];
  const r = rig({ agentFolder: true, sessions });
  // The records are read at each poll, so they can name the rig's own checkout once it exists.
  sessions.push(
    { ...board, launched_at: at, working_directory: r.dir },
    { ...board, launched_at: at - 5, working_directory: r.dir, launched_by: { surface: 'cli' } },
    { ...board, launched_at: at - 10, working_directory: path.join(r.base, 'elsewhere') },
  );
  await r.host.pollSessions();
  const rows = r.host.sessionsStatus().rows;
  assert.equal(rows.length, 3);
  const of = (x: (typeof rows)[number]) => `${x.launch?.by.surface}:${x.folder === r.dir ? 'agent' : 'other'}:${x.agentKey ?? '-'}`;
  assert.deepEqual(rows.map(of).sort(), ['cli:agent:-', 'fabric:agent:agent.default', 'fabric:other:-']);
});

test('FD-118: a waiting row carries Switchboard\'s reason, so the page says why instead of "No other account has capacity"', () => {
  const rows = mergeSessions(input({ stops: [
    { event: 'cc-a-1', session: SID, dir: '/w/a', provider: 'claude', stoppedAt: NOW - MIN, attempt: 1, verdict: 'waiting', candidates: [], probeAt: null, waitReason: 'account_removed' },
    { event: 'cc-b-1', session: SID2, dir: '/w/b', provider: 'claude', stoppedAt: NOW - MIN, attempt: 1, verdict: 'waiting', candidates: [], probeAt: null },
  ] }));
  assert.equal(rows.find((r) => r.folder === '/w/a')!.waitReason, 'account_removed');
  assert.equal(rows.find((r) => r.folder === '/w/b')!.waitReason, null);
});

test('SB-201 (Switchboard 0.7.0): a session row is the agent Switchboard names; a proxy launch on provider claude is not Claude Code and is never resumed as one', async () => {
  const run: Runner = async () => ok({ sessions: [
    { home: '/sb/h/1', working_directory: '/w/goose', provider: 'claude', agent: 'goose', pool: 'default', state: 'ended', launched_at: NOW / 1000 - 60 },
    { home: '/sb/h/2', working_directory: '/w/cc', provider: 'claude', agent: 'claude-code', pool: 'default', state: 'ended', launched_at: NOW / 1000 - 60 },
    { home: '/sb/h/3', working_directory: '/w/old', provider: 'claude', pool: 'default', state: 'ended', launched_at: NOW / 1000 - 60 },
    { home: '/sb/h/4', working_directory: '/w/kimi', provider: 'kimi', pool: 'default', state: 'ended', launched_at: NOW / 1000 - 60 },
    { home: '/sb/h/5', working_directory: '/w/bad', provider: 'claude', agent: 'Not An Id!', pool: 'default', state: 'ended', launched_at: NOW / 1000 - 60 },
  ] });
  const r = await allSessionsOf(run, '/bin/switchboard');
  assert.ok(r.ok);
  assert.deepEqual(r.value.map((s) => s.agent), ['goose', 'claude-code', 'claude-code', 'kimi-code', 'claude-code']);
  const rows = mergeSessions(input({ switchboard: r.value }));
  const by = (f: string) => rows.find((x) => x.folder === f)!;
  assert.equal(by('/w/goose').agent, 'goose');
  assert.equal(by('/w/goose').resumable, false, 'Continue never resumes an unrelated Claude Code conversation for a Goose session');
  assert.equal(by('/w/cc').resumable, true);
  assert.equal(by('/w/kimi').agent, 'kimi-code');
  const twin = mergeSessions(input({ switchboard: [{ ...r.value[0]!, folder: '/w/same' }, { ...r.value[1]!, folder: '/w/same' }] }));
  assert.equal(new Set(twin.map((x) => x.id)).size, twin.length, 'two agents on one route, folder and time are two rows');
});

test('FD-124: Show transcript shows only an absolute .jsonl file that exists, never a folder or a relative path', () => {
  const dir = tmp();
  try {
    const file = path.join(dir, 'f1e2.jsonl');
    fs.writeFileSync(file, '{}\n');
    fs.mkdirSync(path.join(dir, 'd.jsonl'));
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    assert.equal(transcriptFile(file), file);
    assert.equal(transcriptFile(path.join(dir, 'gone.jsonl')), null, 'gone');
    assert.equal(transcriptFile(path.join(dir, 'd.jsonl')), null, 'a folder');
    assert.equal(transcriptFile(path.join(dir, 'notes.txt')), null, 'not a transcript');
    assert.equal(transcriptFile('f1e2.jsonl'), null, 'relative');
    assert.equal(transcriptFile(null), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('FD-207: a board run Fabric started has no window: it is listed as running in the background, not in Terminal', () => {
  const base = { pending: [], stops: [], records: [], dismissed: [], now: NOW, consoles: [] };
  const by = (o: Partial<NonNullable<SbSessionRecord['launch']>['by']>) => ({ launchId: 'l-1', by: { surface: null, by: null, program: null, project: null, parent: null, caller: null, ...o },
    transcript: null, turns: null, lastTurnAt: null, ended: null, endedAt: null, continuedAs: null });
  const dispatch = { id: 'd-1', request: 'r-1', thread: 't-1', project: 'p-1', workflow: 'wf_0123456789abcdef' };
  const [run] = mergeSessions({ ...base, switchboard: [sb({ launch: by({ surface: 'fabric', dispatch }) })] });
  assert.deepEqual([run!.state, run!.group, run!.actions], ['running-background', 'running', ['reveal']]);
  const [fabricNotInPlace] = mergeSessions({ ...base, switchboard: [sb({ launch: by({ surface: 'fabric' }) })] });
  assert.equal(fabricNotInPlace!.state, 'running-background');
  const [terminal] = mergeSessions({ ...base, switchboard: [sb({ launch: by({ surface: 'window' }) })] });
  assert.equal(terminal!.state, 'running-terminal', 'a launch from Switchboard\'s window still runs in Terminal');
  const [unknown] = mergeSessions({ ...base, switchboard: [sb({ launch: null })] });
  assert.equal(unknown!.state, 'running-terminal', 'no launch record: as before');
});

test('FD-211: a session a host holds offers Open here; once it is open here it is one row, without an End that would only close the view', () => {
  const LID = sid(7);
  const launch = { launchId: LID, by: { surface: 'window' as const, by: null, program: null, project: null, parent: null, caller: null },
    transcript: null, turns: null, lastTurnAt: null, ended: null, endedAt: null, continuedAs: null };
  const [hosted] = mergeSessions(input({ switchboard: [sb({ attachable: true, launch })] }));
  assert.deepEqual([hosted!.state, hosted!.actions], ['running-terminal', ['attach', 'reveal']]);
  const [plain] = mergeSessions(input({ switchboard: [sb({ launch })] }));
  assert.deepEqual(plain!.actions, ['reveal'], 'no host: nothing to open here');
  const [ended] = mergeSessions(input({ switchboard: [sb({ attachable: true, launch, state: 'ended' })] }));
  assert.ok(!ended!.actions.includes('attach'), 'an ended session has nothing to show');
  const [noId] = mergeSessions(input({ switchboard: [sb({ attachable: true, launch: { ...launch, launchId: null } })] }));
  assert.ok(!noId!.actions.includes('attach'), 'no launch id: nothing to attach to');
  const open = mergeSessions(input({
    switchboard: [sb({ attachable: true, launch })],
    consoles: [{ key: 'handover.at-0123456789ab', folder: '/w/alpha', agent: 'claude-code', startedAt: NOW - MIN, origin: 'switchboard', account: null, attachedTo: LID }],
  }));
  assert.equal(open.length, 1, 'one session, one row');
  assert.deepEqual([open[0]!.id, open[0]!.state, open[0]!.key, open[0]!.actions], [hosted!.id, 'running-ours', 'handover.at-0123456789ab', ['reveal']]);
});

test('FD-211: Open here runs `switchboard attach` in a console of its own; closing it records no ended session, and the row offers Open here again', POSIX, async () => {
  const LID = sid(8);
  const sessions: unknown[] = [];
  const r2 = rig({ sessions });
  sessions.push({ working_directory: r2.dir, state: 'running', provider: 'claude', agent: 'claude-code', launch_id: LID, launched_by: { surface: 'window' }, attachable: true, in_place: false, launched_at: new Date(Date.now() - MIN).toISOString() });
  await r2.host.pollSessions();
  const row = r2.host.sessionsStatus().rows.find((x) => x.launch?.launchId === LID)!;
  assert.deepEqual(row.actions, ['attach', 'reveal']);
  const done = await r2.host.attachSession(row.id);
  assert.ok(done.ok && done.key && /^handover\.at-[0-9a-f]{12}$/.test(done.key), JSON.stringify(done));
  const view = r2.spawned.at(-1)!;
  assert.deepEqual([path.basename(view.file), ...view.args.slice(-2)], ['switchboard', 'attach', LID]);
  assert.equal(view.cwd, r2.dir);
  assert.ok(r2.host.isView(done.key!));
  assert.equal((await r2.host.info(done.key!)).view, true, 'its console says it only shows the session');
  const rows = r2.host.sessionsStatus().rows;
  assert.deepEqual(rows.map((x) => [x.state, x.key, x.actions]), [['running-ours', done.key, ['reveal']]], 'its row is the open view');
  assert.deepEqual(await r2.host.attachSession(rows[0]!.id), { ok: false, reason: 'not-allowed' }, 'an open view offers no second Open here');
  r2.host.stopByPerson(done.key!);
  await tick();
  assert.equal(r2.settings.get().sessions.records.length, 0, 'closing a view is no ended session');
  assert.ok(!r2.host.isView(done.key!));
  assert.deepEqual(r2.host.sessionsStatus().rows.map((x) => [x.state, x.actions]), [['running-terminal', ['attach', 'reveal']]], 'the session runs on, and opens here again');
});

test('FD-211: Switchboard\'s `attachable` is read; anything but true is not', async () => {
  const run: Runner = async () => ok({ sessions: [
    { working_directory: '/w/a', state: 'running', provider: 'claude', attachable: true },
    { working_directory: '/w/b', state: 'running', provider: 'claude', attachable: 'yes' },
    { working_directory: '/w/c', state: 'running', provider: 'claude' },
  ] });
  const r = await allSessionsOf(run, '/bin/switchboard');
  assert.ok(r.ok);
  assert.deepEqual(r.value.map((s) => s.attachable === true), [true, false, false]);
});

// FD-231 (SL-8, fabric-workspace knowledge/lifecycle.md; Switchboard SB-353): one answer to «what runs now». Every Claude
// Code and Codex process Switchboard finds is listed once: its own launches as before, the others as started by hand.
test('FD-231: a process no owner started is listed as running, started by hand, once, with its folder and quiet time', () => {
  const proc = (o: Partial<SbMachineProcess>): SbMachineProcess => ({ pid: 4242, agent: 'claude-code', folder: '/w/gamma', startedAt: NOW - 40 * MIN, lastWriteAt: NOW - 35 * MIN, quietMinutes: 35, quiet: true, launchId: null, ...o });
  const rows = mergeSessions(input({
    consoles: [{ key: 'demo.default', folder: '/w/ours', agent: 'claude-code', startedAt: NOW - 5 * MIN, origin: 'here', account: null }],
    machine: [
      proc({}),
      // Switchboard's own launch: listed from its record, never twice.
      proc({ pid: 4243, folder: '/w/alpha', launchId: 'a1b2c3d4-0000-4000-8000-000000000001', quiet: false, quietMinutes: 1 }),
      // A runtime this app ran itself (no Switchboard account): the console's row, never twice.
      proc({ pid: 4244, folder: '/w/ours/', startedAt: NOW - 5 * MIN + 900, quiet: false, quietMinutes: 0 }),
      // A process whose folder Switchboard could not read: still listed, with nothing to show.
      proc({ pid: 4245, agent: 'codex', folder: null, quiet: false, quietMinutes: null, lastWriteAt: null }),
    ],
  }));
  const hand = rows.filter((r) => r.origin === 'machine');
  assert.deepEqual(hand.map((r) => r.id).sort(), [processRowId(4242, NOW - 40 * MIN), processRowId(4245, NOW - 40 * MIN)].sort());
  const gamma = hand.find((r) => r.folder === '/w/gamma')!;
  assert.equal(gamma.state, 'running-unmanaged');
  assert.equal(gamma.group, 'running');
  assert.deepEqual(gamma.actions, ['reveal']);
  assert.equal(gamma.quietMinutes, 35);
  assert.equal(gamma.at, NOW - 35 * MIN, 'ordered by its last write');
  assert.equal(stateWords('en', gamma), 'Running, but has written nothing for 35 min');
  const unknown = hand.find((r) => r.agent === 'codex')!;
  assert.deepEqual(unknown.actions, [], 'no folder, nothing to reveal');
  assert.equal(unknown.quietMinutes, undefined);
  assert.equal(stateWords('ru', unknown), 'Идёт, запущена вручную');
  assert.equal(projectName('en', unknown), 'Folder unknown');
  assert.equal(projectName('en', gamma), 'gamma');
  // Absent or unread: nothing extra, as before FD-231.
  assert.equal(mergeSessions(input({ machine: null })).length, 0);
});

test('FD-231: `sessions --machine` is read and checked; a Switchboard without it is unsupported, not a failure', async () => {
  const row = { pid: 7, agent: 'claude-code', folder: '/w/a', started_at: (NOW - HOUR) / 1000, last_write_at: (NOW - 31 * MIN) / 1000, quiet_minutes: 31, quiet: true, launch_id: null, managed: false };
  const good = await machineSessionsOf(async (_c, args) => {
    assert.deepEqual(args, ['--json', 'sessions', '--machine']);
    return ok({ sessions: [row, { ...row, pid: -1 }, { ...row, pid: 8, agent: 'cursor' }, { ...row, pid: 9, folder: 'relative/x' }], total: 4 });
  }, '/bin/switchboard');
  assert.deepEqual(good, { ok: true, value: [
    { pid: 7, agent: 'claude-code', folder: '/w/a', startedAt: NOW - HOUR, lastWriteAt: NOW - 31 * MIN, quietMinutes: 31, quiet: true, launchId: null },
    { pid: 9, agent: 'claude-code', folder: null, startedAt: NOW - HOUR, lastWriteAt: NOW - 31 * MIN, quietMinutes: 31, quiet: true, launchId: null },
  ] });
  // Switchboard 0.7.71 on this Mac, 2026-11-13: `{"error":"Invalid arguments. Run switchboard --help.","ok":false}`.
  const old = await machineSessionsOf(async () => ({ code: 2, stdout: '{"error":"Invalid arguments. Run switchboard --help.","ok":false}', stderr: '' }), '/bin/switchboard');
  assert.deepEqual(old, { ok: false, reason: 'unsupported' });
  const broken = await machineSessionsOf(async () => ({ code: 1, stdout: '', stderr: 'owner not answering' }), '/bin/switchboard');
  assert.equal(broken.ok, false);
  assert.equal((broken as { reason: string }).reason, 'error');
});

test('FD-231: the console host lists a process started by hand, and leaves an older Switchboard unasked for ten minutes', POSIX, async () => {
  const at = Math.floor(Date.now() / 1000) - 120;
  const r = rig({ machine: [{ pid: 5151, agent: 'codex', folder: '/w/eta', started_at: at, last_write_at: at + 60, quiet_minutes: 1, quiet: false, launch_id: null, managed: false }] });
  await r.host.pollSessions();
  const st = r.host.sessionsStatus();
  assert.deepEqual(st.rows.map((x) => [x.project, x.state, x.origin, x.agent]), [['eta', 'running-unmanaged', 'machine', 'codex']]);
  assert.deepEqual(st.degraded, []);
  assert.equal(st.machine, true, 'every process is listed, so the page drops its footnote');

  const old = rig();
  await old.host.pollSessions();
  await old.host.pollSessions();
  assert.equal(old.calls.filter((c) => c.join(' ') === 'switchboard --json sessions --machine').length, 1, 'asked once, then left for MACHINE_RECHECK_MS');
  assert.deepEqual(old.host.sessionsStatus().degraded, [], 'an older Switchboard is not an out-of-date list');
  assert.equal(old.host.sessionsStatus().machine, false, 'the footnote stays');
});
