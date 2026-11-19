// FD-354 (SCN-080 step 6): the ways to open a session from its page: its conversation read here, a terminal in its folder.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost, loginShellArgv } from '../src/electron/console';
import { SettingsStore } from '../src/core/settings';
import { parseRequest } from '../src/core/console-channel';
import { folderTerminalKey, machineTerminalKey } from '../src/core/sessions';
import { parseTranscript, TRANSCRIPT_MAX_ENTRIES, TRANSCRIPT_MAX_TEXT } from '../src/core/transcript';
import { PARITY } from '../src/core/parity';
import { tmp } from './helpers';

const line = (o: unknown) => JSON.stringify(o);

test('FD-354: a Claude Code transcript reads as the person, the agent and the tools it ran, wrappers and tool output left out', () => {
  const text = [
    line({ type: 'user', timestamp: '2026-11-19T20:00:00Z', message: { role: 'user', content: 'Fix the build' } }),
    line({ type: 'user', isMeta: true, message: { role: 'user', content: 'meta line' } }),
    line({ type: 'user', message: { role: 'user', content: '<command-name>/clear</command-name>' } }),
    line({ type: 'assistant', timestamp: '2026-11-19T20:00:05Z', message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'secret plan' }, { type: 'text', text: 'Looking.' }, { type: 'tool_use', name: 'Read', input: {} }] } }),
    line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: {} }] } }),
    line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'big output' }] } }),
    line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Fixed.' }] } }),
    line({ type: 'summary', summary: 'x' }),
    'not json',
  ].join('\n');
  const r = parseTranscript(text);
  assert.deepEqual(r.entries.map((e) => [e.who, e.text]), [['you', 'Fix the build'], ['agent', 'Looking.'], ['tools', 'Read, Bash'], ['agent', 'Fixed.']]);
  assert.equal(r.entries[0]!.at, Date.parse('2026-11-19T20:00:00Z'));
  assert.equal(r.truncated, false);
  assert.equal(r.unknown, false);
  assert.ok(!JSON.stringify(r).includes('secret plan') && !JSON.stringify(r).includes('big output'), 'thinking and tool output never reach the page');
});

test('FD-354: a Codex rollout reads the same way; a file of another shape says so', () => {
  const codex = [
    line({ timestamp: '2026-11-19T20:00:00Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hi' }] } }),
    line({ type: 'response_item', payload: { type: 'function_call', name: 'shell', arguments: '{}' } }),
    line({ type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Done' }] } }),
  ].join('\n');
  assert.deepEqual(parseTranscript(codex).entries.map((e) => [e.who, e.text]), [['you', 'Hi'], ['tools', 'shell'], ['agent', 'Done']]);
  const other = parseTranscript(line({ hello: 'world' }));
  assert.deepEqual([other.entries.length, other.unknown], [0, true]);
});

test('FD-354: a read that began mid-file drops its first line and says the start is in the file; long texts and lists are cut', () => {
  const many = Array.from({ length: TRANSCRIPT_MAX_ENTRIES + 10 }, (_, i) => line({ type: 'assistant', message: { role: 'assistant', content: `m${i}` } })).join('\n');
  const r = parseTranscript(`{"type":"assi\n${many}`, { partial: true });
  assert.equal(r.entries.length, TRANSCRIPT_MAX_ENTRIES);
  assert.equal(r.entries.at(-1)!.text, `m${TRANSCRIPT_MAX_ENTRIES + 9}`, 'the end is kept');
  assert.equal(r.truncated, true);
  const long = parseTranscript(line({ type: 'user', message: { role: 'user', content: 'x'.repeat(TRANSCRIPT_MAX_TEXT + 50) } }));
  assert.equal(long.entries[0]!.text.length, TRANSCRIPT_MAX_TEXT + 1);
});

test('FD-354: a login shell is the person\'s own on macOS and Linux, PowerShell on Windows', () => {
  assert.deepEqual(loginShellArgv('darwin', '/bin/bash'), ['/bin/bash', '-l']);
  assert.deepEqual(loginShellArgv('darwin', ''), ['/bin/zsh', '-l'], 'no SHELL (an empty one; undefined would read this machine\'s own)');
  assert.deepEqual(loginShellArgv('linux', 'relative'), ['/bin/sh', '-l']);
  assert.deepEqual(loginShellArgv('win32', '/bin/bash'), ['powershell.exe', '-NoLogo']);
  assert.match(folderTerminalKey('', '/w/a'), /^session\.term-[0-9a-f]{12}$/);
  assert.equal(folderTerminalKey('', '/w/a/'), folderTerminalKey('', '/w/a'), 'a trailing slash is the same folder');
  assert.notEqual(folderTerminalKey('studio-2', '/w/a'), folderTerminalKey('', '/w/a'));
  assert.notEqual(folderTerminalKey('', 'studio-2'), machineTerminalKey('studio-2'));
});

function hostWith(base: string, spawned: string[][]) {
  return new ConsoleHost({
    settings: new SettingsStore(path.join(base, 'data')), snapshot: () => null, window: () => null, visible: () => true, log: () => undefined, testDirs: [], scriptsDir: path.join(base, 'scripts'),
    run: async () => ({ code: 1, stdout: '', stderr: '' }),
    spawn: (file: string, args: string[], o?: { cwd?: string }) => { spawned.push([file, ...args, `cwd=${o?.cwd ?? ''}`]); return { pid: 2_100_000_002, onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }; },
    killGroup: () => undefined, idleMs: 0,
    machine: async () => ({ freeDisk: 50 * 1024 ** 3, swap: null, running: 0 }), keys: () => [], home: base,
  } as ConstructorParameters<typeof ConsoleHost>[0]);
}

test('FD-354: Open session terminal starts a login shell in the row\'s folder, one console per folder; an unknown row or a gone folder is refused', { skip: process.platform === 'win32' && 'POSIX shells' }, async () => {
  const base = tmp('fd-session-term-');
  const folder = path.join(base, 'work');
  fs.mkdirSync(folder);
  const spawned: string[][] = [];
  const host = hostWith(base, spawned);
  const h = host as unknown as { rowOf: (id: string) => unknown };
  assert.deepEqual(await host.openSessionTerminal('nope'), { ok: false, reason: 'unknown' });
  h.rowOf = () => ({ id: 'r1', folder: path.join(base, 'gone'), machine: null, actions: [] });
  assert.deepEqual(await host.openSessionTerminal('r1'), { ok: false, reason: 'no-folder' });
  h.rowOf = () => ({ id: 'r1', folder, machine: null, actions: [] });
  const a = await host.openSessionTerminal('r1');
  assert.ok(a.ok && a.key === folderTerminalKey('', folder), JSON.stringify(a));
  assert.equal(spawned.length, 1);
  assert.ok(spawned[0]!.includes('-l') && spawned[0]!.at(-1)!.includes(folder), JSON.stringify(spawned));
  assert.deepEqual(await host.openSessionTerminal('r1'), a, 'a second press finds the same console');
  assert.equal(spawned.length, 1);
});

test('FD-354: on another machine the terminal is ssh into that folder there, quoted; a name ssh could read as an option is refused', { skip: process.platform === 'win32' && 'POSIX shells' }, async () => {
  const base = tmp('fd-session-term-remote-');
  const spawned: string[][] = [];
  const host = hostWith(base, spawned);
  const h = host as unknown as { rowOf: (id: string) => unknown };
  h.rowOf = () => ({ id: 'r2', folder: "/srv/it's here", machine: '-oProxyCommand=x', actions: [] });
  assert.deepEqual(await host.openSessionTerminal('r2'), { ok: false, reason: 'remote', detail: 'unknown-machine' });
  h.rowOf = () => ({ id: 'r2', folder: "/srv/it's here", machine: 'studio-2', actions: [] });
  const a = await host.openSessionTerminal('r2');
  assert.ok(a.ok && a.key === folderTerminalKey('studio-2', "/srv/it's here"));
  const argv = spawned[0]!;
  assert.deepEqual(argv.slice(0, 5), ['/usr/bin/ssh', '-t', '-o', 'ConnectTimeout=5', 'studio-2']);
  assert.equal(argv[5], `cd '/srv/it'\\''s here' && exec "\${SHELL:-/bin/sh}" -l`);
});

test('FD-354: the console channel and MCP session_action take `terminal` with a row; the transcript read is a declared gap', () => {
  assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'sessions.act', session: { act: 'terminal', row: 'c:x:1' } })), { ok: true, request: { key: 'k', op: 'sessions.act', service: '', session: { act: 'terminal', row: 'c:x:1' } } });
  assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'sessions.act', session: { act: 'terminal' } })), { ok: false, code: 'bad-session' });
  assert.deepEqual(PARITY.sessionsTerminal, { tool: 'session_action' });
  assert.ok('gap' in PARITY.sessionsTranscript);
});

test('FD-354: Open session reads the end of the file the launch record names; no transcript, no read', async () => {
  const base = tmp('fd-session-read-');
  const file = path.join(base, 'abc.jsonl');
  fs.writeFileSync(file, `${line({ type: 'user', message: { role: 'user', content: 'Hello' } })}\n`);
  const host = hostWith(base, []);
  const h = host as unknown as { rowOf: (id: string) => unknown };
  h.rowOf = () => ({ id: 'r3', folder: base, machine: null, actions: [], launch: { transcript: file } });
  const r = await host.readSessionTranscript('r3');
  assert.ok(r.ok && r.entries.length === 1 && r.entries[0]!.text === 'Hello' && !r.truncated, JSON.stringify(r));
  h.rowOf = () => ({ id: 'r3', folder: base, machine: null, actions: [], launch: { transcript: path.join(base, 'notes.txt') } });
  assert.deepEqual(await host.readSessionTranscript('r3'), { ok: false, reason: 'no-transcript' });
});
