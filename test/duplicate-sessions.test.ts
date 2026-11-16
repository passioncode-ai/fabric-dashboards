// FD-277: one session in two processes, read from Switchboard's `attention`, and its quiet copy closed by `close-copy`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { closeCopyArgv, parseCloseCopy, parseDuplicates, takesCloseCopy } from '../src/core/duplicate-sessions';

const ID = '8fa1b537-4952-4856-a40a-31a2ffed77c3';

test('FD-277: the session_duplicate items of attention are read; other items and bad ids are not', () => {
  // The shape `switchboard --json attention` gave on 0.7.98 (2026-11-16), with an account item beside it.
  const answer = JSON.stringify({ ok: true, data: { count: 2, items: [
    { reason: 'session_duplicate', session_id: ID, label: 'go-to-market-strategy', pids: [38550, 84681], action: { tool: 'switchboard_session_close_copy', window: 'close_copy' } },
    { reason: 'signin_needed', account_id: 'acc-1', label: 'work' },
    { reason: 'session_duplicate', session_id: 'x; rm', label: 'bad', pids: [1, 2] },
  ] } });
  assert.deepEqual(parseDuplicates(answer), [{ sessionId: ID, label: 'go-to-market-strategy', pids: [38550, 84681] }]);
  assert.deepEqual(parseDuplicates(JSON.stringify({ data: { count: 0, items: [] } })), []);
  assert.equal(parseDuplicates('not json'), null);
  assert.equal(parseDuplicates(JSON.stringify({ ok: true })), null);
});

test('FD-277: close-copy runs only for a session id, and its answers read as closed, not two, all working or failed', () => {
  assert.deepEqual(closeCopyArgv('/sb', ID), ['/sb', '--json', 'sessions', 'close-copy', ID]);
  assert.equal(closeCopyArgv('/sb', '--all'), null);
  assert.equal(closeCopyArgv('/sb', 'a b'), null);
  assert.deepEqual(parseCloseCopy(0, JSON.stringify({ ok: true, data: { session_id: ID, closed_pid: 38550, kept_pids: [84681] } }), ''), { ok: true, closedPid: 38550 });
  assert.deepEqual(parseCloseCopy(1, JSON.stringify({ ok: false, code: 'NOT_TWO', error: 'The session no longer runs in two processes.' }), ''), { ok: false, why: 'not-two' });
  assert.deepEqual(parseCloseCopy(1, '', 'ALL_WORKING: both copies are busy'), { ok: false, why: 'all-working' });
  assert.deepEqual(parseCloseCopy(1, JSON.stringify({ ok: false, error: 'No such session.' }), ''), { ok: false, why: 'failed', detail: 'No such session.' });
  assert.deepEqual(parseCloseCopy(2, '', ''), { ok: false, why: 'failed', detail: 'exit 2' });
});

test('FD-277: a Switchboard that lists close-copy in `sessions --help` closes copies; an older one is not asked', () => {
  assert.equal(takesCloseCopy('Commands:\n  end         End a session\n  close-copy  Close the quiet one of two processes\n'), true);
  assert.equal(takesCloseCopy('Commands:\n  end         End a session\n'), false);
});

test('FD-277 (Switchboard 0.7.100): the copy to close is read; an older one goes by its pid, none when both answer', () => {
  const read = parseDuplicates(JSON.stringify({ ok: true, data: { items: [
    { reason: 'session_duplicate', session_id: ID, label: 'a', pids: [1, 2], close: { pid: 2, why: 'older', command_age: 3 } },
    { reason: 'session_duplicate', session_id: '9fa1b537-4952-4856-a40a-31a2ffed77c3', label: 'b', pids: [3, 4], close: null },
    { reason: 'session_duplicate', session_id: 'afa1b537-4952-4856-a40a-31a2ffed77c3', label: 'c', pids: [5, 6], close: { pid: 'x', why: 'older' } },
  ] } }))!;
  assert.deepEqual(read.map((d) => d.close), [{ pid: 2, why: 'older' }, null, undefined]);
  assert.deepEqual(closeCopyArgv('/sb', ID, 2), ['/sb', '--json', 'sessions', 'close-copy', ID, '--pid', '2']);
  assert.deepEqual(parseCloseCopy(1, JSON.stringify({ ok: false, code: 'COPY_BUSY' }), ''), { ok: false, why: 'all-working' });
});
