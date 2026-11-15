// FD-263: the app's own bug journal.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprint, issueOf, MAX_BUGS, ownFrames, record, scrub, type Bug } from '../src/core/bugs';

const O = { now: '2026-11-15T02:00:00.000Z', version: '0.8.101', home: '/Users/ann', user: 'ann' };
const STACK = `TypeError: Cannot read properties of undefined (reading 'trim')
    at read (/Applications/Fabric Dashboards.app/Contents/Resources/app.asar/out/main/core/estate-update.js:621:114)
    at Monitor.tick (/Applications/Fabric Dashboards.app/Contents/Resources/app.asar/out/main/core/monitor.js:300:9)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at Object.<anonymous> (/Users/ann/DATA/x/node_modules/foo/index.js:1:1)`;

test('FD-263: a message loses the home folder, the user name, URL credentials and tokens', () => {
  const s = scrub('open /Users/ann/DATA/secret.txt as ann: https://u:pw@host/x token=abcdef123456 ghp_ABCDEFGHIJKLMNOPQRST and 0123456789abcdef0123456789abcdef', O.home, O.user);
  assert.ok(!/ann|pw@|abcdef123456|ghp_|0123456789abcdef0123/.test(s), s);
  assert.match(s, /~\/DATA\/secret\.txt/);
  assert.match(s, /<credentials>@host/);
  assert.ok(scrub('x'.repeat(900), '', '').length <= 501, 'capped');
});

test('FD-263: only our own frames are kept, as a relative file, a line and the function', () => {
  assert.deepEqual(ownFrames(STACK), ['core/estate-update.js:621 read', 'core/monitor.js:300 Monitor.tick']);
  assert.deepEqual(ownFrames(undefined), []);
});

test('FD-263: one row per fingerprint; the same failure in another version or on another line counts on the same row', () => {
  let bugs: Bug[] = [];
  const first = record(bugs, { where: 'main', kind: 'exception', name: 'TypeError', message: 'at /Users/ann/x', stack: STACK }, O);
  assert.equal(first.isNew, true);
  bugs = first.bugs;
  const moved = STACK.replace(':621:114', ':640:2');
  const again = record(bugs, { where: 'main', kind: 'exception', name: 'TypeError', message: 'again', stack: moved }, { ...O, version: '0.8.102', now: '2026-11-15T03:00:00.000Z' });
  assert.equal(again.isNew, false);
  assert.deepEqual([again.bug.count, again.bug.versions, again.bug.lastSeen], [2, ['0.8.101', '0.8.102'], '2026-11-15T03:00:00.000Z']);
  assert.equal(again.bugs.length, 1);
  const other = record(again.bugs, { where: 'renderer', kind: 'exception', name: 'TypeError', stack: STACK }, O);
  assert.equal(other.isNew, true, 'another place is another bug');
  assert.match(first.bug.fp, /^[0-9a-f]{12}$/);
  assert.equal(fingerprint({ where: 'main', kind: 'exception', name: 'TypeError' }, ['a.js:1 f']), fingerprint({ where: 'main', kind: 'exception', name: 'TypeError' }, ['a.js:9 f']), 'line numbers do not change it');
});

test('FD-263: the journal keeps the most recently seen rows when full', () => {
  let bugs: Bug[] = [];
  for (let i = 0; i < MAX_BUGS + 5; i += 1) bugs = record(bugs, { where: 'action', kind: 'failed', name: `code${i}`, action: 'start' }, { ...O, now: new Date(Date.UTC(2026, 10, 15, 0, 0, i)).toISOString() }).bugs;
  assert.equal(bugs.length, MAX_BUGS);
  assert.ok(!bugs.some((b) => b.name === 'code0'), 'the oldest went first');
});

test('FD-263: an issue names the fingerprint, counts and versions, and nothing the scrub took out', () => {
  const { bug } = record([], { where: 'main', kind: 'exception', name: 'TypeError', message: 'failed for /Users/ann/DATA', stack: STACK }, O);
  const i = issueOf(bug);
  assert.match(i.title, new RegExp(bug.fp));
  assert.equal(i.label, `bug:${bug.fp}`);
  assert.ok(!/\/Users\/ann/.test(i.body));
  assert.match(i.body, /core\/monitor\.js:300 Monitor\.tick/);
});

test('FD-263: MCP `bugs` reads the journal; `bug_report` answers the issue it would file and files it once only with publish', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const tools = await import('../src/mcp/tools');
  const { writeBugs } = await import('../src/core/bugs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-263-'));
  const { bug } = record([], { where: 'main', kind: 'rejection', name: 'Error', message: 'boom', stack: STACK }, O);
  writeBugs(dir, [bug]);
  const calls: string[][] = [];
  const deps = { settingsFile: () => path.join(dir, 'settings.json'), gh: async () => '/usr/bin/gh', ghRun: async (_f: string, args: string[]) => { calls.push(args); return args[1] === 'list' ? { code: 0, stdout: '\n', stderr: '' } : { code: 0, stdout: 'https://github.com/passioncode-ai/fabric-dashboards/issues/999\n', stderr: '' }; } } as never;
  const listed = tools.bugsList(deps);
  assert.deepEqual([listed.total, listed.bugs[0]!.fp], [1, bug.fp]);
  const dry = await tools.bugReport(deps, bug.fp, false);
  assert.deepEqual([dry.filed, dry.issue, calls.length], [false, null, 0], 'nothing is published without publish');
  const filed = await tools.bugReport(deps, bug.fp, true);
  assert.deepEqual([filed.filed, filed.issue], [true, 'https://github.com/passioncode-ai/fabric-dashboards/issues/999']);
  assert.equal(tools.bugsList(deps).bugs[0]!.issue, filed.issue, 'the journal records the issue');
  const again = await tools.bugReport(deps, bug.fp, true);
  assert.deepEqual([again.filed, calls.length], [false, 2], 'filed once: a recorded issue is answered, gh is not asked again');
  await assert.rejects(tools.bugReport(deps, '000000000000', true), /no bug/);
});
