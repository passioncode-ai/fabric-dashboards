// FD-156: a service token goes to 127.0.0.1 only when this user's own process listens on the port.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import test from 'node:test';
import { execRunner } from '../src/core/launchd';
import { macLsofServerEnd, LSOF_TRIES, tableRestricted, linuxConnectionCheck, linuxConnectionUids, linuxLoopbackOwnerCheck, listenersOf, macConnectionCheck, macConnectionPids, loopbackOwnerCheck, MISS_REREAD_MS, OWNED_FRESH_MS, portsOf, procNetPorts, socketTableOwner, windowsListenersOf, windowsLoopbackOwnerCheck } from '../src/core/loopback-owner';
import { windowsAclReader } from './win-acl';
import { machineRu } from '../src/core/machine-ru';

test('FD-156: the ports of lsof -F n, IPv4, IPv6 and every interface', () => {
  assert.deepEqual([...portsOf('p123\nf9\nn127.0.0.1:47851\np456\nf5\nn[::1]:47852\nn*:8080\n')], [47851, 47852, 8080]);
  assert.deepEqual([...portsOf('')], []);
});

test('FD-156, FD-159: one lsof for every port asked at once; a miss reads again after a short wait and goes to the socket table', async () => {
  let t = 1_000_000;
  const calls: string[][] = [];
  let out = { code: 0, stdout: 'p1\nn127.0.0.1:47851\n', stderr: '' };
  // FD-176: a full table (other processes' rows) without 47851 and 47852: a port missing from it is nobody's.
  let table = { code: 0, stdout: NETSTAT.split('\n').filter((l) => !l.includes('.47851 ') && !l.includes('.47852 ')).join('\n'), stderr: '' };
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

// FD-159: Windows reads the compiled reader's `--listeners` (GetExtendedTcpTable, then each process's token user).
const ME = 'S-1-5-21-1-2-3-1001';
const WIN = JSON.stringify({ user: ME, listeners: [
  { port: 47851, pid: 10, sid: ME },
  { port: 47852, pid: 11, sid: 'S-1-5-21-1-2-3-1002' },
  { port: 47853, pid: 4, sid: null },
  { port: 47854, pid: 10, sid: ME }, { port: 47854, pid: 12, sid: 'S-1-5-21-1-2-3-1002' },
] });

test("FD-159: the Windows reader's listeners by port, with their owners", () => {
  const w = windowsListenersOf(WIN);
  assert.equal(w.user, ME);
  assert.deepEqual(w.byPort.get(47854), [ME, 'S-1-5-21-1-2-3-1002']);
  assert.deepEqual(w.byPort.get(47853), [null]);
  assert.throws(() => windowsListenersOf('{}'), /no user or listeners/);
});

test("FD-159, DEC-0154 HA-2: on Windows a port is ours only when every listener runs as this user", async () => {
  let t = 1_000_000;
  let out = { code: 0, stdout: WIN, stderr: '' };
  const calls: string[][] = [];
  const failures: string[] = [];
  const check = windowsLoopbackOwnerCheck(async (c, args) => { calls.push([c, ...args]); return out; }, 'C:\\app\\fabric-dashboards-acl.exe', () => t, (why) => failures.push(why));
  assert.deepEqual(await Promise.all([check(47851), check(47852), check(47853), check(47854), check(47855)]), [true, false, 'unknown', false, false],
    "ours; another user's; a process it could not open; two listeners, one not ours; nobody");
  assert.deepEqual(calls, [['C:\\app\\fabric-dashboards-acl.exe', '--listeners']], 'one read for every port asked at once');
  t += MISS_REREAD_MS + 1;
  await check(47851);
  assert.equal(calls.length, 1, 'an answer that the port is ours is trusted OWNED_FRESH_MS');
  await check(47852);
  assert.equal(calls.length, 2, 'anything else reads again after MISS_REREAD_MS');
  t += OWNED_FRESH_MS + 1;
  out = { code: 1, stdout: '', stderr: 'GetExtendedTcpTable failed: 87' };
  assert.equal(await check(47851), 'unknown', 'a reader that fails is an owner it cannot tell');
  assert.deepEqual(failures, ['GetExtendedTcpTable failed: 87']);
});

test("FD-159: on Windows the compiled reader finds this process's own listener", { skip: process.platform !== 'win32' && 'runs build/win/acl.cs' }, async () => {
  const reader = windowsAclReader();
  assert.ok(reader, 'csc.exe builds the reader on every Windows runner');
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as net.AddressInfo).port;
    assert.equal(await windowsLoopbackOwnerCheck(execRunner, reader!)(port), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ── FD-168, the contract's CT-254 (tag `v0.1.0+2026-11-07.3`): the owner of the open connection ─────────────────────

const NS_HEAD = 'Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)      rhiwat  shiwat    process:pid state  options';
const ns = (proto: string, local: string, foreign: string, state: string, proc: string) => `${proto}       0      0  ${local}  ${foreign}  ${state}  131072  131072  ${proc}  00000 00000006 0000000000000001 00000000 00000800      1      0 000001`;

test('FD-168: macOS names the connection by its own row; without one, the listener on 127.0.0.1 before a wildcard', () => {
  // The service's end of our connection 127.0.0.1:53122 -> 127.0.0.1:47851, and our own end, which is never asked.
  const accepted = [NS_HEAD, ns('tcp4', '127.0.0.1.47851', '127.0.0.1.53122', 'ESTABLISHED', 'agent:701'), ns('tcp4', '127.0.0.1.53122', '127.0.0.1.47851', 'ESTABLISHED', 'Fabric Dash:900'), ns('tcp4', '*.47851', '*.*', 'LISTEN', 'other:702')].join('\n');
  assert.deepEqual(macConnectionPids(accepted, 47851, 53122), [701], 'the connection row wins over every listener');
  // The swapped listener: ours on any address, another user's on 127.0.0.1. A connection to 127.0.0.1 lands on theirs.
  const own = ns('tcp4', '127.0.0.1.53122', '127.0.0.1.47851', 'ESTABLISHED', 'Fabric Dash:900'); // this connection's own end
  const swapped = [NS_HEAD, own, ns('tcp46', '*.47851', '*.*', 'LISTEN', 'agent:701'), ns('tcp4', '127.0.0.1.47851', '*.*', 'LISTEN', 'thief:802')].join('\n');
  assert.deepEqual(macConnectionPids(swapped, 47851, 53122), [802]);
  assert.deepEqual(macConnectionPids([NS_HEAD, own, ns('tcp4', '*.47851', '*.*', 'LISTEN', 'agent:701')].join('\n'), 47851, 53122, 900), [701], 'a wildcard counts when nobody listens on 127.0.0.1');
  assert.deepEqual(macConnectionPids([NS_HEAD, own, ns('tcp6', '::1.47851', '*.*', 'LISTEN', 'v6:703')].join('\n'), 47851, 53122, 900), [], 'an IPv6-only listener takes nothing');
  assert.equal(macConnectionPids('', 47851, 53122), 'restricted', 'an empty table (macOS 27.2, a program that may not see other sockets)');
  // FD-176, DEC-0155 RT-1: a header only, only this process's own rows, or no row of this connection: restricted.
  assert.equal(macConnectionPids(NS_HEAD, 47851, 53122, 900), 'restricted', 'a header only');
  assert.equal(macConnectionPids([NS_HEAD, own].join('\n'), 47851, 53122, 900), 'restricted', 'only our own rows: nobody else is visible');
  assert.equal(macConnectionPids([NS_HEAD, ns('tcp4', '127.0.0.1.47851', '*.*', 'LISTEN', 'agent:701')].join('\n'), 47851, 53122, 900), 'restricted', 'other rows but not this connection\'s own end');
});

test('FD-168: the macOS check reads the table once for connections asked at once, and refuses another account or an unreadable one', async () => {
  const runs: string[] = [];
  const ends = [53122, 53123, 53124, 53125].map((c, i) => ns('tcp4', `127.0.0.1.${c}`, `127.0.0.1.${47851 + i}`, 'ESTABLISHED', 'Fabric Dash:900'));
  const table = [NS_HEAD, ...ends, ns('tcp4', '127.0.0.1.47851', '127.0.0.1.53122', 'ESTABLISHED', 'agent:701'), ns('tcp4', '127.0.0.1.47852', '127.0.0.1.53123', 'ESTABLISHED', 'thief:802'),
    ns('tcp4', '127.0.0.1.47853', '*.*', 'LISTEN', 'a:701'), ns('tcp4', '127.0.0.1.47853', '*.*', 'LISTEN', 'b:802')].join('\n');
  const check = macConnectionCheck(async (cmd, args) => {
    runs.push(cmd);
    if (cmd === 'netstat') return { code: 0, stdout: table, stderr: '' };
    return { code: 0, stdout: args.at(-1)!.split(',').map((p) => `${p} ${p === '701' ? 501 : 502}`).join('\n'), stderr: '' };
  }, 501);
  const answers = await Promise.all([check(47851, 53122), check(47852, 53123), check(47853, 53124), check(47854, 53125)]);
  assert.deepEqual(answers, [true, false, 'unknown', false], 'ours; another account; listeners of two accounts; nobody');
  assert.equal(runs.filter((c) => c === 'netstat').length, 1, 'one table for every connection waiting');
  const empty = macConnectionCheck(async () => ({ code: 0, stdout: '', stderr: '' }), 501);
  assert.equal(await empty(47851, 53122), 'unknown');
  const broken = macConnectionCheck(async () => ({ code: 1, stdout: '', stderr: 'netstat: denied' }), 501);
  assert.equal(await broken(47851, 53122), 'unknown');
});

// /proc/net/tcp rows: sl local rem st tx:rx tr:when retrnsmt uid timeout inode
const proc = (local: string, rem: string, st: string, uid: number, inode: number) => `   0: ${local} ${rem} ${st} 00000000:00000000 00:00000000 00000000  ${uid}        0 ${inode} 1 0000000000000000 20 4 30 10 -1`;
const HEAD = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode';
const SERVER = '0100007F:BAEB'; // 127.0.0.1:47851
const CLIENT = '0100007F:CF82'; // 127.0.0.1:53122

test('FD-168: Linux names the connection by its row when accepted (inode not 0), else the listener on 127.0.0.1 before a wildcard', () => {
  const accepted = [HEAD, proc(SERVER, CLIENT, '01', 1001, 4242), proc('00000000:BAEB', '00000000:0000', '0A', 1002, 99)].join('\n');
  assert.deepEqual([...linuxConnectionUids([accepted], 47851, 53122)], [1001]);
  // In the accept queue the row has inode 0: the listener decides. The swapped listener: ours on any address, theirs on 127.0.0.1.
  const queued = [HEAD, proc(SERVER, CLIENT, '01', 0, 0), proc('00000000:BAEB', '00000000:0000', '0A', 1001, 98), proc(SERVER, '00000000:0000', '0A', 1002, 99)].join('\n');
  assert.deepEqual([...linuxConnectionUids([queued], 47851, 53122)], [1002]);
  // Both address orders: the wildcard first or last in the table, the same answer.
  const reversed = [HEAD, proc(SERVER, '00000000:0000', '0A', 1002, 99), proc('00000000:BAEB', '00000000:0000', '0A', 1001, 98)].join('\n');
  assert.deepEqual([...linuxConnectionUids([reversed], 47851, 53122)], [1002]);
  // tcp6: the mapped ::ffff:127.0.0.1 counts as 127.0.0.1; :: as a wildcard; ::1 never.
  const v6 = [HEAD, proc('0000000000000000FFFF00000100007F:BAEB', '00000000000000000000000000000000:0000', '0A', 1003, 97), proc('00000000000000000000000001000000:BAEB', '00000000000000000000000000000000:0000', '0A', 1004, 96)].join('\n');
  assert.deepEqual([...linuxConnectionUids([[HEAD].join('\n'), v6], 47851, 53122)], [1003]);
  assert.deepEqual([...linuxConnectionUids([[HEAD, proc('00000000000000000000000001000000:BAEB', '00000000000000000000000000000000:0000', '0A', 1004, 96)].join('\n')], 47851, 53122)], [], '::1 alone takes nothing');
  // Listeners of two accounts on 127.0.0.1 (SO_REUSEPORT): the owner cannot be told.
  assert.deepEqual([...linuxConnectionUids([[HEAD, proc(SERVER, '00000000:0000', '0A', 1001, 1), proc(SERVER, '00000000:0000', '0A', 1002, 2)].join('\n')], 47851, 53122)].sort(), [1001, 1002]);
});

test('FD-168: the Linux check reads both tables once for connections asked at once', async () => {
  const reads: string[] = [];
  const table = [HEAD, proc(SERVER, CLIENT, '01', 1001, 4242), proc('0100007F:BAEC', '00000000:0000', '0A', 1001, 1), proc('0100007F:BAEC', '00000000:0000', '0A', 1002, 2)].join('\n');
  const check = linuxConnectionCheck(async (p) => { reads.push(p); if (p.endsWith('6')) throw new Error('ENOENT'); return table; }, 1001);
  assert.deepEqual(await Promise.all([check(47851, 53122), check(47852, 53123), check(47853, 53124)]), [true, 'unknown', false]);
  assert.deepEqual(reads, ['/proc/net/tcp', '/proc/net/tcp6'], 'one read of each, a missing tcp6 is IPv6 off');
  const other = linuxConnectionCheck(async () => table, 1002);
  assert.equal(await other(47851, 53122), false, 'the same connection is not another account\'s');
  const broken = linuxConnectionCheck(async () => { throw new Error('EACCES'); }, 1001);
  assert.equal(await broken(47851, 53122), 'unknown');
});

test('FD-168: on this system the check finds this process\'s own connection', { skip: process.platform !== 'darwin' && process.platform !== 'linux' && 'reads netstat or /proc/net/tcp' }, async () => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const socket = net.connect((server.address() as net.AddressInfo).port, '127.0.0.1');
  await new Promise((resolve) => socket.once('connect', resolve));
  try {
    const port = (server.address() as net.AddressInfo).port;
    const make = (uid: number) => (process.platform === 'darwin' ? macConnectionCheck(execRunner, uid) : linuxConnectionCheck((p) => fs.promises.readFile(p, 'utf8'), uid));
    const mine = await make(process.getuid!())(port, socket.localPort!);
    // A program that may not see the whole table (macOS 27.2, some signed builds) reads it as unknown, never as ours.
    assert.ok(mine === true || mine === 'unknown', `ours or unknown, got ${mine}`);
    assert.notEqual(await make(process.getuid!() + 1)(port, socket.localPort!), true, 'never another uid\'s');
  } finally {
    socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('FD-168: the refusals on the open connection read in Russian', () => {
  assert.equal(machineRu('the open connection to 127.0.0.1:47851 reached another user\'s program, so its token was not sent'), 'соединение с 127.0.0.1:47851 попало в программу другого пользователя, поэтому токен не отправлен');
  assert.equal(machineRu('the owner of the program on 127.0.0.1:47851 could not be told on the open connection, so its token was not sent'), 'владельца программы на 127.0.0.1:47851 не удалось определить по открытому соединению, поэтому токен не отправлен');
});

test('FD-176 (DEC-0155 RT-1): a socket table that shows nobody else is not "another user": the listener check reads it as an owner it cannot tell', async () => {
  const head = NETSTAT.split('\n').slice(0, 2).join('\n');
  const failures: string[] = [];
  const restricted = socketTableOwner(async (c) => (c === 'netstat' ? { code: 0, stdout: head, stderr: '' } : { code: 0, stdout: '', stderr: '' }), 502, () => 0, (why) => failures.push(why));
  assert.equal(await restricted(47859), 'unknown', 'a header only: never "nobody", never another account');
  assert.match(failures[0]!, /^table-restricted/);
  const own = socketTableOwner(async (c) => (c === 'netstat' ? { code: 0, stdout: `${head}\ntcp4       0      0  127.0.0.1.47851        *.*                    LISTEN                 0            0  131072  131072       me:${process.pid}  00000 00000006 000000000ce1a4ae 00000000 00000800      1      0 000000`, stderr: '' } : { code: 0, stdout: '', stderr: '' }), 502, () => 0);
  assert.equal(await own(47852), 'unknown', 'only this process\'s rows: another port is not known to be free');
  assert.equal(tableRestricted(NETSTAT, 1), false, 'a full table');
  assert.equal(tableRestricted(''), true);
});

test('FD-190: with a restricted table, this user\'s own server end of the connection, found by lsof, names the owner; nothing else does', async () => {
  const self = process.pid;
  const lsof = (rows: string[]) => rows.join('\n');
  // The live shape (lsof -F pn on this Mac): our client end, the agent's listener and the agent's end of this connection.
  const seen = lsof([`p${self}`, 'f17', 'n127.0.0.1:53122->127.0.0.1:47418', 'p701', 'f4', 'n127.0.0.1:47418', 'f6', 'n127.0.0.1:47418->127.0.0.1:53122']);
  assert.equal(macLsofServerEnd(seen, 47418, 53122), true);
  assert.equal(macLsofServerEnd(seen, 47418, 53999), false, 'another connection\'s end');
  assert.equal(macLsofServerEnd(lsof(['p701', 'f4', 'n127.0.0.1:47418']), 47418, 53122), false, 'a listener alone does not name it');
  assert.equal(macLsofServerEnd(lsof([`p${self}`, 'n127.0.0.1:47418->127.0.0.1:53122']), 47418, 53122), false, 'never this process');
  const restricted = [NS_HEAD, ns('tcp4', '127.0.0.1.53122', '127.0.0.1.47418', 'ESTABLISHED', `Fabric Dash:${self}`)].join('\n');
  const runs: string[][] = [];
  const make = (lsofOut: string[]) => macConnectionCheck(async (cmd, args) => {
    runs.push([cmd, ...args]);
    if (cmd === 'netstat') return { code: 0, stdout: restricted, stderr: '' };
    if (cmd === 'lsof') return { code: lsofOut.length ? 0 : 1, stdout: lsofOut.shift() ?? '', stderr: '' };
    throw new Error(`unexpected ${cmd}`);
  }, 501, () => {}, async () => {});
  assert.equal(await make([seen])(47418, 53122), true, 'ours, found on the first lsof read');
  const lsofArgs = runs.find((r) => r[0] === 'lsof')!;
  assert.deepEqual(lsofArgs, ['lsof', '-nP', '-a', '-u', '501', '-iTCP@127.0.0.1:47418', '-F', 'pn'], 'only this user\'s processes');
  runs.length = 0;
  assert.equal(await make(['', seen])(47418, 53122), true, 'the server accepts a moment later');
  runs.length = 0;
  assert.equal(await make([])(47418, 53122), 'unknown', 'no end of ours: the owner cannot be told, as before');
  assert.equal(runs.filter((r) => r[0] === 'lsof').length, LSOF_TRIES);
});
