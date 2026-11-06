// FD-156: a service token goes to 127.0.0.1 only when this user's own process listens on the port.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import test from 'node:test';
import { execRunner } from '../src/core/launchd';
import { linuxLoopbackOwnerCheck, listenersOf, loopbackOwnerCheck, MISS_REREAD_MS, OWNED_FRESH_MS, portsOf, procNetPorts, socketTableOwner } from '../src/core/loopback-owner';
import { machineRu } from '../src/core/machine-ru';

test('FD-156: the ports of lsof -F n, IPv4, IPv6 and every interface', () => {
  assert.deepEqual([...portsOf('p123\nf9\nn127.0.0.1:47851\np456\nf5\nn[::1]:47852\nn*:8080\n')], [47851, 47852, 8080]);
  assert.deepEqual([...portsOf('')], []);
});

test('FD-156, FD-159: one lsof for every port asked at once; a miss reads again after a short wait and goes to the socket table', async () => {
  let t = 1_000_000;
  const calls: string[][] = [];
  let out = { code: 0, stdout: 'p1\nn127.0.0.1:47851\n', stderr: '' };
  let table = { code: 0, stdout: '', stderr: '' };
  const failures: string[] = [];
  const check = loopbackOwnerCheck(async (c, args) => {
    calls.push([c, ...args]);
    if (c === 'lsof') return out;
    if (c === 'netstat') return table;
    return { code: 0, stdout: '', stderr: '' };
  }, 502, () => t, (why) => failures.push(why));
  assert.deepEqual(await Promise.all([check(47851), check(47852)]), [true, false], 'ours, and one held by nobody');
  assert.equal(calls.filter((c) => c[0] === 'lsof').length, 1, 'shared');
  assert.deepEqual(calls[0], ['lsof', '-nP', '-a', '-u', '502', '-iTCP', '-sTCP:LISTEN', '-F', 'n'], "only this user's sockets");
  assert.deepEqual(calls[1], ['netstat', '-anv', '-p', 'tcp'], 'a port lsof does not find goes to the socket table');
  await check(47852);
  assert.equal(calls.filter((c) => c[0] === 'lsof').length, 1, 'a miss reads lsof again only after MISS_REREAD_MS');
  t += MISS_REREAD_MS + 1;
  out = { code: 0, stdout: 'p1\nn127.0.0.1:47851\nn127.0.0.1:47852\n', stderr: '' };
  assert.equal(await check(47852), true, 'an agent that just started is seen');
  t += OWNED_FRESH_MS + 1;
  out = { code: 1, stdout: '', stderr: '' };
  assert.equal(await check(47851), false, 'lsof exits 1 when nothing listens: an empty list, not a failure');
  assert.deepEqual(failures, []);
  t += OWNED_FRESH_MS + 1;
  out = { code: 127, stdout: '', stderr: 'lsof: not found' };
  table = { code: 1, stdout: '', stderr: 'netstat: not found' };
  assert.equal(await check(47851), 'unknown', 'DEC-0154 HA-2: an owner that cannot be told');
  assert.deepEqual(failures, ['lsof: not found', 'netstat: not found']);
});

const NETSTAT = `Active Internet connections (including servers)
Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)          rxbytes      txbytes  rhiwat  shiwat          process:pid    state  options           gencnt    flags   flags1 usecnt rtncnt fltrs
tcp4       0      0  127.0.0.1.47851        *.*                    LISTEN                 0            0  131072  131072       python3.12:63833  00000 00000006 000000000ce1a4ae 00000000 00000800      1      0 000000
tcp4       0      0  127.0.0.1.47852        *.*                    LISTEN                 0            0  131072  131072 Google Chrome fo:70154  00100 00000006 000000000ce1a375 00000000 00000800      1      0 000000
tcp46      0      0  *.47853                *.*                    LISTEN                 0            0  131072  131072             node:49535  00100 00000106 000000000b089654 00000001 00000800      1      0 000000
tcp6       0      0  ::1.47854              *.*                    LISTEN                 0            0  131072  131072           Fabric:37635  00100 00000106 000000000cdfda06 00000001 00000800      1      0 000000
tcp4       0      0  192.168.0.87.47855     *.*                    LISTEN                 0            0  131072  131072             node:49536  00100 00000106 000000000b089655 00000001 00000800      1      0 000000
tcp4       0   1536  192.168.0.87.63030     140.82.121.5.443       ESTABLISHED            0         1536  132352  132352               gh:70249  00102 00000008 000000000ce1a505 00000080 04000900      2      0 000000
tcp4       0      0  127.0.0.1.47856        *.*                    LISTEN                 0            0  131072  131072
`;

test('FD-159: the socket table gives the processes a connection to 127.0.0.1 would reach', () => {
  const l = listenersOf(NETSTAT);
  assert.deepEqual(l.get(47851), [63833]);
  assert.deepEqual(l.get(47852), [70154], 'a process name with spaces');
  assert.deepEqual(l.get(47853), [49535], 'any address, IPv4 and IPv6');
  assert.equal(l.get(47854), undefined, 'IPv6 only: a connection to 127.0.0.1 does not reach it');
  assert.equal(l.get(47855), undefined, 'another interface');
  assert.deepEqual(l.get(47856), [0], 'no process column: an owner that cannot be told');
  assert.equal(l.get(63030), undefined, 'not listening');
});

test("FD-159, DEC-0154 HA-2: the socket table decides: this user's, another user's, nobody's, or unknown", async () => {
  const failures: string[] = [];
  let ps = (pids: string) => ({ code: 0, stdout: pids.split(',').map((p) => `${p} ${p === '49535' ? 501 : 502}`).join('\n'), stderr: '' });
  const owner = socketTableOwner(async (c, args) => (c === 'netstat' ? { code: 0, stdout: NETSTAT, stderr: '' } : ps(args[args.length - 1]!)), 502, () => 0, (why) => failures.push(why));
  assert.equal(await owner(47851), true, "this user's process");
  assert.equal(await owner(47853), false, "another user's process");
  assert.equal(await owner(47857), false, 'nobody listens');
  assert.equal(await owner(47856), 'unknown', 'an owner that cannot be told');
  ps = () => ({ code: 1, stdout: '', stderr: '' });
  assert.equal(await owner(47851), 'unknown', 'the process is gone: its owner cannot be told');
  assert.deepEqual(failures, []);
});

test("FD-159: on macOS this process's own listener is found by lsof and by the socket table", { skip: process.platform !== 'darwin' && 'reads lsof and netstat' }, async () => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as net.AddressInfo).port;
    assert.equal(await loopbackOwnerCheck(execRunner, process.getuid!())(port), true, 'lsof');
    assert.equal(await socketTableOwner(execRunner, process.getuid!())(port), true, 'netstat and ps');
    assert.equal(await socketTableOwner(execRunner, process.getuid!() + 1)(port), false, 'under another uid the same port is not ours');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("FD-156, FD-159: the refusals read in Russian", () => {
  assert.equal(machineRu("the owner of the program on 127.0.0.1:47851 could not be told, so its token was not sent"), 'владельца программы на 127.0.0.1:47851 не удалось определить, поэтому токен не отправлен');
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

test('FD-159: Linux reads both tables once for every port asked at once; a missing tcp6 is IPv6 off; a missing tcp refuses', async () => {
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
  assert.equal(await check(47804), 'unknown', 'DEC-0154 HA-2: an unreadable table is an owner that cannot be told');
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
