// ADR-0025 (FD-120): the console channel. The shared part without a socket, then the listening end on a real Unix socket
// in a temporary folder, then the MCP server's client.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CHANNEL_KEY_FILE, channelAddress, keyMatches, parseRequest, RateLimit, type ChannelRequest } from '../src/core/console-channel';
import { openChannel } from '../src/electron/console-channel';

const POSIX = { skip: process.platform === 'win32' && 'a Unix socket and POSIX modes; the pipe name is unit-tested below' };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fd-chan-'));
const send = (address: string, line: string) => new Promise<Record<string, unknown>>((resolve, reject) => {
  const s = net.connect(address);
  let b = '';
  s.on('connect', () => s.write(line));
  s.on('data', (c) => { b += String(c); });
  s.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
  s.on('error', reject);
});

test('ADR-0025: a request is read strictly, the key in constant time, and at most ten a minute', () => {
  assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'console.new', service: 'example-agent.default' })), { ok: true, request: { key: 'k', op: 'console.new', service: 'example-agent.default' } });
  assert.equal((parseRequest(JSON.stringify({ key: 'k', op: 'console.fix', service: 'a.b', task: { kind: 'audit', output: 'x' } })) as { ok: boolean }).ok, true);
  for (const [line, code] of [
    ['not json', 'not-json'], ['[]', 'not-an-object'], [JSON.stringify({ op: 'shell', service: 'a.b' }), 'unknown-op'],
    [JSON.stringify({ op: 'console.new', service: '../x' }), 'bad-service'], [JSON.stringify({ op: 'console.new', service: 'a.b', more: 1 }), 'unknown-field'],
    [JSON.stringify({ op: 'console.fix', service: 'a.b' }), 'bad-task'], [JSON.stringify({ op: 'console.new', service: 'a.b', task: {} }), 'bad-task'],
    ['x'.repeat(70_000), 'too-large'],
  ] as const) assert.deepEqual(parseRequest(line), { ok: false, code }, line.slice(0, 40));
  assert.equal(keyMatches('a'.repeat(64), 'a'.repeat(64)), true);
  assert.equal(keyMatches('a'.repeat(63), 'a'.repeat(64)), false);
  assert.equal(keyMatches(undefined, 'a'.repeat(64)), false);
  const limit = new RateLimit(10);
  for (let i = 0; i < 10; i++) assert.equal(limit.take(1000 + i), true);
  assert.equal(limit.take(1011), false, 'the eleventh in a minute');
  assert.equal(limit.take(61_011), true, 'a minute later');
  assert.match(channelAddress('C:\\U', 'win32', 'ann', 'C:\\Users\\ann'), /^\\\\\.\\pipe\\fabric-dashboards-console-[0-9a-f]{16}$/);
  assert.notEqual(channelAddress('C:\\U', 'win32', 'ann', 'C:\\Users\\ann'), channelAddress('C:\\U', 'win32', 'bob', 'C:\\Users\\bob'), 'one pipe per account');
  assert.equal(channelAddress('/d', 'darwin'), path.join('/d', 'console.sock'));
});

test('ADR-0025: the channel is private, takes only this run\'s key, and goes with the run', POSIX, async () => {
  const dir = tmp();
  const started: ChannelRequest[] = [];
  const logs: string[] = [];
  const ch = await openChannel({ userData: dir, log: (l) => logs.push(l), start: async (r) => { started.push(r); return { ok: true, consoleKey: r.service }; } });
  assert.ok(ch);
  const key = fs.readFileSync(path.join(dir, CHANNEL_KEY_FILE), 'utf8');
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(dir, CHANNEL_KEY_FILE)).mode & 0o777, 0o600);
  assert.equal(fs.statSync(ch!.address).mode & 0o777, 0o600);
  assert.deepEqual(await send(ch!.address, `${JSON.stringify({ key: 'f'.repeat(64), op: 'console.new', service: 'a.b' })}\n`), { ok: false, code: 'bad-key' });
  assert.deepEqual(started, [], 'a wrong key starts nothing');
  assert.ok(!logs.join('\n').includes(key), 'the key is never logged');
  assert.deepEqual(await send(ch!.address, `${JSON.stringify({ key, op: 'console.fix', service: 'a.b', task: { kind: 'fix', output: 'down' } })}\n`), { ok: true, consoleKey: 'a.b' });
  assert.deepEqual(started, [{ key, op: 'console.fix', service: 'a.b', task: { kind: 'fix', output: 'down' } }]);
  assert.equal(await openChannel({ userData: dir, log: () => undefined, start: async () => ({ ok: false, code: 'x' }) }), null, 'a live channel is never taken over');
  await ch!.close();
  assert.equal(fs.existsSync(ch!.address), false);
  assert.equal(fs.existsSync(path.join(dir, CHANNEL_KEY_FILE)), false);
});

test('ADR-0025: a socket a killed run left is replaced; a new run has a new key; size and rate limits answer', POSIX, async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'console.sock'), ''); // a dead leftover: nobody answers on it
  const ch = await openChannel({ userData: dir, log: () => undefined, start: async (r) => ({ ok: true, consoleKey: r.service }) });
  assert.ok(ch, 'the leftover is removed');
  const first = fs.readFileSync(path.join(dir, CHANNEL_KEY_FILE), 'utf8');
  assert.deepEqual(await send(ch!.address, `${'x'.repeat(70_000)}\n`), { ok: false, code: 'too-large' });
  const ok = `${JSON.stringify({ key: first, op: 'console.new', service: 'a.b' })}\n`;
  for (let i = 0; i < 10; i++) assert.equal((await send(ch!.address, ok)).ok, true);
  assert.deepEqual(await send(ch!.address, ok), { ok: false, code: 'busy' });
  await ch!.close();
  const again = await openChannel({ userData: dir, log: () => undefined, start: async (r) => ({ ok: true, consoleKey: r.service }) });
  const second = fs.readFileSync(path.join(dir, CHANNEL_KEY_FILE), 'utf8');
  assert.notEqual(second, first);
  assert.deepEqual(await send(again!.address, ok), { ok: false, code: 'bad-key' }, 'a key from an earlier run opens nothing');
  await again!.close();
});
