// FD-124: what an ended console session printed outlives an app restart while its row is listed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleManager } from '../src/core/consoles';
import { dropKept, keptFile, loadKept, saveKept, type KeptOutput } from '../src/core/kept-output';
import { consoleRowId, SESSION_KEEP_MS, type SessionRecord } from '../src/core/sessions';
import { SettingsStore } from '../src/core/settings';
import { ConsoleHost } from '../src/electron/console';
import { tmp } from './helpers';

const NOW = Date.parse('2026-10-28T12:00:00Z');
const kept = (o: Partial<KeptOutput> = {}): KeptOutput => {
  const key = o.key ?? 'agent.alpha';
  const startedAt = o.startedAt ?? NOW - 3_600_000;
  return { id: consoleRowId(key, startedAt), key, label: 'Claude Code', cwd: '/w/alpha', startedAt, endedAt: NOW - 600_000, exitCode: 0, signal: null, output: 'hello\r\n', ...o };
};
const POSIX = { skip: process.platform === 'win32' && 'POSIX file modes' };

test('FD-124: a kept output is written whole, readable only by the person, and named by no key or folder', POSIX, () => {
  const dir = path.join(tmp('fd-kept-'), 'console-output');
  const k = kept();
  saveKept(dir, k);
  const file = keptFile(dir, k.id);
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.ok(!path.basename(file).includes('alpha'));
  assert.deepEqual(fs.readdirSync(dir), [path.basename(file)], 'no temporary file is left');
  assert.deepEqual(loadKept(dir, new Set([k.id]), NOW), [k]);
});

test('FD-124: reading back keeps only listed rows of the last day, the latest per console, and removes the rest', () => {
  const dir = path.join(tmp('fd-kept-'), 'console-output');
  const listed = kept();
  const older = kept({ startedAt: NOW - 7_200_000 });
  const removed = kept({ key: 'agent.beta' });
  const stale = kept({ key: 'agent.gamma', endedAt: NOW - SESSION_KEEP_MS - 1 });
  for (const k of [listed, older, removed, stale]) saveKept(dir, k);
  fs.writeFileSync(path.join(dir, 'garbage.json'), '{');
  fs.writeFileSync(path.join(dir, 'x.json.123.tmp'), '{}');
  const moved = kept({ key: 'agent.delta' });
  fs.writeFileSync(path.join(dir, 'renamed.json'), JSON.stringify(moved)); // a file not under its own name is not trusted
  const back = loadKept(dir, new Set([listed.id, older.id, stale.id, moved.id]), NOW);
  assert.deepEqual(back, [listed], 'the latest of agent.alpha only');
  assert.deepEqual(fs.readdirSync(dir).sort(), [path.basename(keptFile(dir, listed.id)), path.basename(keptFile(dir, older.id))].sort());
  dropKept(dir, listed.id);
  assert.ok(!fs.existsSync(keptFile(dir, listed.id)));
  assert.deepEqual(loadKept(path.join(dir, 'none'), new Set(), NOW), [], 'no folder yet');
});

test('FD-124: a restored session reads as ended with its output, and never covers a session this launch started', () => {
  const m = new ConsoleManager({ spawn: () => { throw new Error('no spawn'); }, env: () => ({}), ringChars: 4 });
  assert.equal(m.restore('agent.alpha', { label: 'Claude Code', cwd: '/w', output: 'abcdef', startedAt: 5, exitCode: 0, signal: null }), true);
  const s = m.snapshot('agent.alpha');
  assert.deepEqual([s.state, s.output, s.end, s.startedAt], ['exited', 'cdef', 4, 5]);
  assert.equal(m.restore('agent.alpha', { label: 'x', cwd: '/x', output: 'new', startedAt: 6, exitCode: 0, signal: null }), false);
  assert.deepEqual(m.runningKeys(), []);
});

test('FD-124: after a restart the ended session\'s page shows what it printed; Remove deletes the kept file', async () => {
  const base = tmp('fd-kept-host-');
  const keptDir = path.join(base, 'data', 'console-output');
  const settings = new SettingsStore(path.join(base, 'data'));
  const now = Date.now();
  const k = kept({ startedAt: now - 3_600_000, endedAt: now - 600_000, cwd: base });
  const record: SessionRecord = { id: k.id, key: k.key, folder: base, agent: 'claude-code', account: null, context: null, origin: 'here', end: 'ended', reason: null,
    startedAt: k.startedAt, endedAt: k.endedAt, sessionId: null, provider: 'claude', handoverId: null };
  settings.update({ sessions: { records: [record], dismissed: [] } });
  saveKept(keptDir, k);
  const logs: string[] = [];
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => false, log: (l) => logs.push(l), testDirs: [], scriptsDir: path.join(base, 'scripts'),
    keptDir, run: async () => ({ code: 1, stdout: '', stderr: '' }), idleMs: 0, keys: () => [k.key],
  });
  assert.equal(host.manager.snapshot(k.key).output, k.output);
  const row = host.sessionsStatus().rows.find((r) => r.id === k.id);
  assert.ok(row, 'the ended row is listed');
  assert.equal(row.consoleEmpty, false, 'its page shows the console, not "not kept"');
  await host.dismissSession(k.id);
  assert.ok(!fs.existsSync(keptFile(keptDir, k.id)), 'Remove deletes what was kept');
});

test('FD-124: a console session that ends is recorded and its output kept under its row', () => {
  const base = tmp('fd-kept-end-');
  const keptDir = path.join(base, 'data', 'console-output');
  const settings = new SettingsStore(path.join(base, 'data'));
  let data: (d: string) => void = () => undefined;
  let exit: (e: { exitCode: number; signal?: number }) => void = () => undefined;
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => false, log: () => undefined, testDirs: [], scriptsDir: path.join(base, 'scripts'),
    keptDir, run: async () => ({ code: 1, stdout: '', stderr: '' }), idleMs: 0, keys: () => ['agent.alpha'],
    spawn: () => ({ pid: 1, onData: (cb) => { data = cb; return { dispose() {} }; }, onExit: (cb) => { exit = cb; return { dispose() {} }; }, write() {}, resize() {}, kill() {} }),
  });
  assert.deepEqual(host.manager.start('agent.alpha', { argv: ['/bin/agent'], cwd: base, label: 'Claude Code' }, { cols: 80, rows: 24 }), { ok: true });
  data('working\r\n');
  exit({ exitCode: 0 });
  const startedAt = host.manager.snapshot('agent.alpha').startedAt!;
  const id = consoleRowId('agent.alpha', startedAt);
  assert.ok(settings.get().sessions?.records.some((r) => r.id === id), 'the ended session is a row');
  const back = loadKept(keptDir, new Set([id]), Date.now());
  assert.deepEqual(back.map((k) => [k.id, k.output, k.exitCode]), [[id, 'working\r\n', 0]]);
});
