// FD-247 (step 4): another machine's sessions, read from its Switchboard over ssh (docs/design/2026-11-15-sessions-machines.md).
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_REMOTE_SWITCHBOARD, parseTargets, readRemoteSessions, REMOTE_MAX_ROWS, remoteSessionsArgv } from '../src/core/remote-sessions';

const TARGETS = JSON.stringify({ data: { targets: [
  { machine: 'me@192.0.2.9', aliases: ['studio-2', '-oProxyCommand=x'], program: null, data_dir: null },
  { machine: 'studio-3', aliases: [], program: '/opt/sb/bin/switchboard', data_dir: '/srv/sb data' },
  { machine: '-oProxyCommand=evil', aliases: [], program: null, data_dir: null },
  { machine: 'studio-4', aliases: [], program: '/x;rm -rf ~', data_dir: '/a/../b' },
] } });

test('FD-247 step 4: targets are read strictly; nothing ssh could take as an option, no unsafe path', () => {
  const t = parseTargets(TARGETS);
  assert.deepEqual(t.map((x) => x.machine), ['me@192.0.2.9', 'studio-3', 'studio-4']);
  assert.deepEqual(t[0]!.aliases, ['studio-2'], 'an alias that reads as an option is dropped');
  assert.deepEqual([t[2]!.program, t[2]!.dataDir], [null, null], 'a path with shell characters or .. is not kept');
  assert.deepEqual(parseTargets('not json'), []);
});

test('FD-247 step 4: one fixed argv: BatchMode, a bounded connect, the machine, then the quoted Switchboard there', () => {
  const [a, b] = parseTargets(TARGETS);
  assert.deepEqual(remoteSessionsArgv(a!), ['/usr/bin/ssh', '-T', '-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', 'me@192.0.2.9', `'${DEFAULT_REMOTE_SWITCHBOARD}' --json sessions --all`]);
  assert.equal(remoteSessionsArgv(b!).at(-1), `'/opt/sb/bin/switchboard' --json sessions --all --data-dir '/srv/sb data'`);
});

test('FD-247 step 4: a machine Switchboard does not know is refused before ssh; each failure has its class', async () => {
  const known = parseTargets(TARGETS);
  const calls: string[][] = [];
  const answer = (code: number, stdout = '', stderr = '') => async (file: string, args: string[]) => { calls.push([file, ...args]); return { code, stdout, stderr }; };
  assert.deepEqual(await readRemoteSessions(answer(0) as never, known, 'elsewhere'), { ok: false, why: 'unknown-machine' });
  assert.equal(calls.length, 0);
  assert.equal((await readRemoteSessions(answer(255, '', 'ssh: connect timed out') as never, known, 'studio-2')).ok, false, 'an alias reaches its machine');
  assert.equal(calls[0]![7], 'me@192.0.2.9');
  assert.deepEqual(await readRemoteSessions(answer(127) as never, known, 'studio-3'), { ok: false, why: 'no-switchboard' });
  assert.deepEqual(await readRemoteSessions(answer(2, '', 'error: unrecognized subcommand') as never, known, 'studio-3'), { ok: false, why: 'too-old' });
  assert.equal(((await readRemoteSessions(answer(0, 'garbage') as never, known, 'studio-3')) as { why: string }).why, 'bad-answer');
});

test('FD-247 step 4: the answer is capped: at most REMOTE_MAX_ROWS rows, a row with no absolute folder skipped', async () => {
  const known = parseTargets(TARGETS);
  const sessions = [{ working_directory: 'relative', provider: 'claude', state: 'running' }, ...Array.from({ length: REMOTE_MAX_ROWS + 50 }, (_, i) => ({ working_directory: `/srv/w${i}`, provider: 'claude', state: 'running', label: 'x'.repeat(500) }))];
  const r = await readRemoteSessions((async () => ({ code: 0, stdout: JSON.stringify({ ok: true, data: { sessions } }), stderr: '' })) as never, known, 'studio-3');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.rows.length, REMOTE_MAX_ROWS);
  assert.equal(r.rows[0]!.folder, '/srv/w0');
  assert.ok(r.rows[0]!.account.length <= 200);
});
