// FD-156: a service token goes to 127.0.0.1 only when this user's own process listens on the port.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import test from 'node:test';
import { linuxLoopbackOwnerCheck, loopbackOwnerCheck, MISS_REREAD_MS, OWNED_FRESH_MS, portsOf, procNetPorts } from '../src/core/loopback-owner';
import { machineRu } from '../src/core/machine-ru';

test('FD-156: the ports of lsof -F n, IPv4, IPv6 and every interface', () => {
  assert.deepEqual([...portsOf('p123\nf9\nn127.0.0.1:47851\np456\nf5\nn[::1]:47852\nn*:8080\n')], [47851, 47852, 8080]);
  assert.deepEqual([...portsOf('')], []);
});

test('FD-156: one lsof for every port asked at once; a missing port reads again after a short wait; a failure says yes', async () => {
  let t = 1_000_000;
  const calls: string[][] = [];
  let out = { code: 0, stdout: 'p1\nn127.0.0.1:47851\n', stderr: '' };
  const failures: string[] = [];
  const check = loopbackOwnerCheck(async (_c, args) => { calls.push(args); return out; }, 502, () => t, (why) => failures.push(why));
  assert.deepEqual(await Promise.all([check(47851), check(47852)]), [true, false], 'ours, and one held by someone else or nobody');
  assert.equal(calls.length, 1, 'shared');
  assert.deepEqual(calls[0], ['-nP', '-a', '-u', '502', '-iTCP', '-sTCP:LISTEN', '-F', 'n'], "only this user's sockets");
  await check(47852);
  assert.equal(calls.length, 1, 'a miss reads again only after MISS_REREAD_MS');
  t += MISS_REREAD_MS + 1;
  out = { code: 0, stdout: 'p1\nn127.0.0.1:47851\nn127.0.0.1:47852\n', stderr: '' };
  assert.equal(await check(47852), true, 'an agent that just started is seen');
  assert.equal(calls.length, 2);
  t += OWNED_FRESH_MS + 1;
  out = { code: 1, stdout: '', stderr: '' };
  assert.equal(await check(47851), false, 'lsof exits 1 when nothing listens: an empty list, not a failure');
  t += OWNED_FRESH_MS + 1;
  out = { code: 127, stdout: '', stderr: 'lsof: not found' };
  assert.equal(await check(47851), true, 'an unreadable list is no evidence of another user');
  assert.deepEqual(failures, ['lsof: not found']);
});

test("FD-156: the refusal reads in Russian", () => {
  assert.equal(machineRu("127.0.0.1:47851 is not listened on by this user's process, so its token was not sent"), 'на 127.0.0.1:47851 слушает не процесс этого пользователя, поэтому токен не отправлен');
});

// FD-159: Linux reads the kernel's socket tables, which name each socket's owner.
const TCP = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:BABB 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41001 1 0000000000000000 100 0 0 10 0
   1: 0100007F:BABC 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1001        0 41002 1 0000000000000000 100 0 0 10 0
   2: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41003 1 0000000000000000 100 0 0 10 0
   3: 0100007F:BABD 0100007F:D431 01 00000000:00000000 00:00000000 00000000  1000        0 41004 1 0000000000000000 20 4 30 10 -1
`;
const TCP6 = `  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000001000000:BABE 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41005 1 0000000000000000 100 0 0 10 0
`;

test("FD-159: a /proc/net/tcp table gives this user's listening ports, on every address, and nothing else", () => {
  assert.deepEqual([...procNetPorts(TCP, 1000)].sort((a, b) => a - b), [8080, 47803], 'LISTEN on 127.0.0.1 and on 0.0.0.0; not the established row');
  assert.deepEqual([...procNetPorts(TCP, 1001)], [47804], "another user's listener is theirs");
  assert.deepEqual([...procNetPorts(TCP6, 1000)], [47806], 'IPv6 [::1]');
  assert.deepEqual([...procNetPorts('', 1000)], []);
});

test('FD-159: Linux reads both tables once for every port asked at once; a missing tcp6 is IPv6 off; a missing tcp says yes', async () => {
  let t = 1_000_000;
  const reads: string[] = [];
  let tables: Record<string, string> = { '/proc/net/tcp': TCP, '/proc/net/tcp6': TCP6 };
  const failures: string[] = [];
  const check = linuxLoopbackOwnerCheck(async (p) => { reads.push(p); if (!(p in tables)) throw new Error(`ENOENT: ${p}`); return tables[p]; }, 1000, () => t, (why) => failures.push(why));
  assert.deepEqual(await Promise.all([check(47803), check(47806), check(47804)]), [true, true, false]);
  assert.deepEqual(reads, ['/proc/net/tcp', '/proc/net/tcp6'], 'one read for the three');
  t += OWNED_FRESH_MS + 1;
  tables = { '/proc/net/tcp': TCP };
  assert.equal(await check(47803), true, 'no tcp6 table: IPv4 alone');
  assert.equal(await check(47806), false);
  assert.deepEqual(failures, []);
  t += OWNED_FRESH_MS + 1;
  tables = {};
  assert.equal(await check(47804), true, 'an unreadable table is no evidence of another user');
  assert.deepEqual(failures, ['ENOENT: /proc/net/tcp']);
});

test("FD-159: on Linux this process's own listener is found in the kernel's table", { skip: process.platform !== 'linux' && 'reads /proc/net/tcp' }, async () => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as net.AddressInfo).port;
    const check = linuxLoopbackOwnerCheck((p) => fs.promises.readFile(p, 'utf8'), process.getuid!());
    assert.equal(await check(port), true);
    const other = linuxLoopbackOwnerCheck((p) => fs.promises.readFile(p, 'utf8'), process.getuid!() + 1);
    assert.equal(await other(port), false, 'under another uid the same port is not ours');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
