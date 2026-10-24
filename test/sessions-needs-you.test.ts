// FD-108 (0.8.1): the Sessions badge counts only what a person can and must act on now. On 2026-10-24 the installed
// 0.8.0 showed "39" on the switch: Switchboard held 84 waiting limit stops, 60 of them older than a day, and decision 1
// put every stop verdict other than waiting into "Needs you". Decision 1, amended 2026-10-24 after 0.8.0
// (docs/reports/2026-10-24-ui-ux-iteration/sessions-and-navigation.md): Needs you holds a failed resume whose process
// still runs, a hand-over that could not open here, and a stop on a payment limit of the last day; a stop older than a
// day, or whose terminal is still open, is not listed; one whose folder or conversation is not here is Ended, "Cannot be
// continued here"; one Switchboard session is one row, its latest stop.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseRecovery, verdictOf, type SbStop } from '../src/core/recovery';
import { mergeSessions, SESSION_KEEP_MS, type MergeInput, type StopInput } from '../src/core/sessions';
import { stateWords, waitingForYou } from '../src/core/sessions-view';
import { setWording } from '../src/core/i18n';

/** When the live answer the fixture is built from was read: 2026-10-24 22:27 UTC. */
const NOW = 1_792_880_820_000;
const MIN = 60_000;
const DAY = SESSION_KEEP_MS;
const SID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'recovery-0.8.0-shape.json');
const input = (o: Partial<MergeInput> = {}): MergeInput => ({ now: NOW, switchboard: [], pending: [], stops: [], consoles: [], records: [], dismissed: [], ...o });

/** The fixture's folders say what this Mac has: `/work/gone-*` is not here, `/work/elsewhere-*` holds no conversation in
 *  the person's home, an agent still works in `/work/open-*`. */
const exists = (dir: string) => !dir.startsWith('/work/gone-');
const transcript = (s: SbStop) => (s.dir.startsWith('/work/elsewhere-') ? null : `transcript-${s.session}.jsonl`);

function liveStops(): { parsed: SbStop[]; views: StopInput[] } {
  const parsed = parseRecovery(fs.readFileSync(FIXTURE, 'utf8'))!;
  const live = { dirs: parsed.filter((s) => s.dir.startsWith('/work/open-')).map((s) => s.dir), args: '' };
  const views = parsed.map((s) => ({
    event: s.event, session: s.session, dir: s.dir, provider: s.provider, stoppedAt: s.stoppedAt, attempt: s.attempt, probeAt: s.probeAt, account: s.account,
    verdict: verdictOf(s, live, NOW, exists, transcript), candidates: s.candidates.map((id) => ({ id, label: id })),
  }));
  return { parsed, views };
}

test('FD-108: the shape of 2026-10-24 (84 waiting stops, 60 older than a day, one session stopped 46 times) gives a badge of only what needs the person', () => {
  const { parsed, views } = liveStops();
  // The fixture is the live shape: 84 open stops, 60 of them older than a day, three of one session.
  assert.equal(parsed.length, 84);
  assert.equal(parsed.filter((s) => NOW - s.stoppedAt > DAY).length, 60);
  assert.equal(new Set(parsed.map((s) => s.session)).size, 82, 'one session holds three of the stops');
  const rows = mergeSessions(input({
    stops: views,
    // The two other things a person must act on: a continue whose process runs without its conversation, and a
    // hand-over whose offer lapsed before it opened here.
    consoles: [{ key: 'handover.rs-0123456789ab', folder: '/work/failed', agent: 'claude-code', startedAt: NOW - MIN, origin: 'resume', account: null, failedResume: true }],
    pending: [{ id: 'ho-00000000000e', dir: '/work/lapsed', agent: 'claude-code', account: 'acc-1', workflow: 'w', offeredUntil: NOW - MIN }],
  }));
  const needsYou = rows.filter((r) => r.group === 'needs-you');
  assert.deepEqual(needsYou.map((r) => r.folder).sort(), ['/work/billing-02', '/work/failed', '/work/lapsed'],
    `only the failed continue, the lapsed hand-over and the payment stop of the last day need you (0.8.0 counted ${needsYou.length})`);
  assert.equal(waitingForYou(rows), 3, 'the badge counts the three');
  // One row per Switchboard session: its latest stop.
  const repeat = rows.filter((r) => r.folder === '/work/repeat');
  assert.equal(repeat.length, 1, 'the session that stopped again and again is one row');
  const latest = parsed.filter((s) => s.dir === '/work/repeat').sort((a, b) => b.stoppedAt - a.stoppedAt)[0]!;
  assert.equal(repeat[0]!.id, `st:${latest.event}`, 'its latest stop');
  // Nothing older than a day, and nothing whose terminal is still open, is listed.
  const listed = new Set(rows.map((r) => r.id));
  for (const s of parsed.filter((x) => NOW - x.stoppedAt > DAY)) assert.ok(!listed.has(`st:${s.event}`), `${s.dir}: older than a day, not listed`);
  assert.ok(!rows.some((r) => r.folder.startsWith('/work/open-')), 'a stop whose terminal is still open is not listed');
  // A stop of the last day whose folder or conversation is not here is Ended, with Remove, and not counted.
  const cannot = rows.filter((r) => r.state === 'ended-cannot-continue');
  assert.deepEqual(cannot.map((r) => r.folder).sort(), ['/work/elsewhere-04', '/work/elsewhere-05', '/work/gone-04', '/work/gone-05']);
  for (const r of cannot) assert.deepEqual([r.group, r.actions], ['ended', ['dismiss']]);
  // The rest of the last day waits: 15 not ready less the payment stop and one repeat, and the 3 ready to continue.
  assert.equal(rows.filter((r) => r.group === 'waiting').length, 16);
  assert.equal(rows.length, 3 + 4 + 16);
});

const stop = (o: Partial<StopInput> & Pick<StopInput, 'verdict'>): StopInput => ({
  event: `cc-${SID(1)}-1`, session: SID(1), dir: '/work/a', provider: 'claude', stoppedAt: NOW - MIN, attempt: 1, ...o,
});
const only = (s: StopInput) => mergeSessions(input({ stops: [s] }));

test('FD-108: waiting and ready stops wait', () => {
  for (const verdict of ['waiting', 'resume'] as const) {
    const rows = only(stop({ verdict }));
    assert.deepEqual(rows.map((r) => [r.group, r.state]), [['waiting', 'waiting-reset']], verdict);
  }
});

test('FD-108: a payment stop of the last day needs you, with Remove; an older one is not listed', () => {
  assert.deepEqual(only(stop({ verdict: 'billing' })).map((r) => [r.group, r.state, r.reason, r.actions]), [['needs-you', 'needs-you-not-opened', 'billing', ['dismiss']]]);
  assert.deepEqual(only(stop({ verdict: 'billing', stoppedAt: NOW - DAY - 1 })), []);
});

test('FD-108: a stop older than a day is not listed, whatever Switchboard still holds it as', () => {
  assert.deepEqual(only(stop({ verdict: 'old', stoppedAt: NOW - DAY - 1 })), []);
  assert.deepEqual(only(stop({ verdict: 'old' })), [], 'the verdict alone is enough');
  for (const verdict of ['waiting', 'resume', 'no-folder', 'no-transcript'] as const) assert.deepEqual(only(stop({ verdict, stoppedAt: NOW - DAY - 1 })), [], verdict);
});

test('FD-108: a stop whose terminal is still open is not listed: the session is alive where it is', () => {
  assert.deepEqual(only(stop({ verdict: 'open' })), []);
});

test('FD-108: a stop whose folder or conversation is not here is Ended, "Cannot be continued here", with Remove, and not counted', () => {
  for (const verdict of ['no-folder', 'no-transcript'] as const) {
    const rows = only(stop({ verdict }));
    assert.deepEqual(rows.map((r) => [r.group, r.state, r.reason, r.actions, r.resumable]), [['ended', 'ended-cannot-continue', verdict, ['dismiss'], false]], verdict);
    assert.equal(waitingForYou(rows), 0, verdict);
  }
  // A continue of this launch that failed and whose console no longer runs is the same: nothing to act on here.
  const failed = only(stop({ verdict: 'failed', key: 'handover.rs-0123456789ab' }));
  assert.deepEqual(failed.map((r) => [r.group, r.state, r.reason, r.actions]), [['ended', 'ended-cannot-continue', 'resume-failed', ['dismiss']]]);
});

test('FD-108: one Switchboard session is one row, its latest stop (by time, then attempt)', () => {
  const rows = mergeSessions(input({ stops: [
    stop({ event: 'cc-s-1', verdict: 'billing', stoppedAt: NOW - 30 * MIN, attempt: 1 }),
    stop({ event: 'cc-s-3', verdict: 'waiting', stoppedAt: NOW - 5 * MIN, attempt: 3 }),
    stop({ event: 'cc-s-2', verdict: 'no-folder', stoppedAt: NOW - 10 * MIN, attempt: 2 }),
    stop({ event: 'cc-t-1', session: SID(2), verdict: 'waiting', stoppedAt: NOW - 5 * MIN, attempt: 1 }),
    stop({ event: 'cc-t-2', session: SID(2), verdict: 'waiting', stoppedAt: NOW - 5 * MIN, attempt: 2 }),
  ] }));
  assert.deepEqual(rows.map((r) => r.id).sort(), ['st:cc-s-3', 'st:cc-t-2']);
  assert.equal(waitingForYou(rows), 0, 'the earlier payment stop of the same session is not counted');
  // The latest stop decides, even when it is one that is not listed: a session resumed since has no row.
  assert.deepEqual(mergeSessions(input({ stops: [stop({ event: 'cc-u-1', verdict: 'billing', stoppedAt: NOW - 9 * MIN }), stop({ event: 'cc-u-2', verdict: 'resumed', stoppedAt: NOW - MIN })] })), []);
});

test('FD-108: an ended stop says why it cannot be continued here, in both languages', () => {
  const [r] = only(stop({ verdict: 'no-folder' }));
  const was = setWording('mac');
  try {
    assert.equal(stateWords('en', r!), 'Cannot be continued here: its folder is not on this Mac.');
    assert.equal(stateWords('ru', r!), 'Здесь не продолжить: её папки нет на этом Mac.');
  } finally { setWording(was); }
  const [x] = only(stop({ verdict: 'no-transcript' }));
  assert.equal(stateWords('en', x!), 'Cannot be continued here: its conversation is not in your Claude Code or Codex home.');
  const [f] = only(stop({ verdict: 'failed' }));
  assert.equal(stateWords('en', f!), 'Cannot be continued here: it did not start; see the log.');
});
