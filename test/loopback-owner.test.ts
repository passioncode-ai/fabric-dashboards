// FD-156: a service token goes to 127.0.0.1 only when this user's own process listens on the port.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loopbackOwnerCheck, MISS_REREAD_MS, OWNED_FRESH_MS, portsOf } from '../src/core/loopback-owner';
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
