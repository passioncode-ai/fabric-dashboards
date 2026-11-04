// FD-137 (SCN-092): a session Fabric started for a board request no live session took, read from Switchboard's launch
// record in the shape SB-247 agreed (board thread a9672312, message fd100f48): ids only, the end as {kind, exit_code, at}.
import assert from 'node:assert/strict';
import test from 'node:test';
import { launchFactsOf } from '../src/core/switchboard';
import { chainFacts, dispatchLines, navLines, originChip, secondLine } from '../src/core/sessions-view';
import type { SessionRow } from '../src/core/sessions';

const REQUEST = '45bf7553-8ae0-4e23-93ef-8c3acefddf91';
const THREAD = 'a9672312-701c-46fe-80ca-4c1384999344';
const PROJECT = '4a313b30-b944-483d-84d7-1b3bdd2967fa';
const RECORD = {
  launch_id: '0b8f6c1e-1f2a-4c3d-9e8f-0123456789ab',
  launched_by: { surface: 'fabric', dispatch: { id: 'dsp_01JC2X', request: REQUEST, thread: THREAD, project: PROJECT, workflow: 'wf_0123456789abcdef' } },
  ended: { kind: 'exited', exit_code: 0, at: 1793790000 },
};
const row = (launch: ReturnType<typeof launchFactsOf>, o: Partial<SessionRow> = {}) =>
  ({ agent: 'claude-code', account: 'claude4', origin: 'switchboard', startedAt: 1793790000_000 - 7 * 60_000, at: null, launch, ...o }) as unknown as SessionRow;

test('FD-137: a dispatch record is read in the agreed shape; ids only, a missing field is null', () => {
  const f = launchFactsOf(RECORD)!;
  assert.equal(f.by.surface, 'fabric');
  assert.deepEqual(f.by.dispatch, { id: 'dsp_01JC2X', request: REQUEST, thread: THREAD, project: PROJECT, workflow: 'wf_0123456789abcdef' });
  assert.equal(f.ended, 'exited');
  assert.equal(f.exitCode, 0);
  assert.equal(f.endedAt, 1793790000_000);
  const thin = launchFactsOf({ launch_id: RECORD.launch_id, launched_by: { surface: 'fabric', dispatch: { id: 'bad id with spaces', request: 'nope', workflow: 'wf_x' } }, ended: { kind: 'timed_out', at: 1793790000 } })!;
  assert.deepEqual(thin.by.dispatch, { id: null, request: null, thread: null, project: null, workflow: null });
  assert.equal(thin.ended, 'timed_out');
  assert.equal(thin.exitCode, undefined);
  assert.equal(launchFactsOf({ launch_id: RECORD.launch_id, ended: { kind: 'vanished' } })!.ended, null, 'an unknown end is not shown');
  assert.equal(launchFactsOf({ launch_id: RECORD.launch_id, ended: 'finished', ended_at: 1793790000 })!.ended, 'finished', 'the older string form still reads');
});

test('FD-137: the launch fold says Fabric started it for a request, which one, how it ended and how long it ran', () => {
  const facts = chainFacts('en', row(launchFactsOf(RECORD)));
  const by = Object.fromEntries(facts.map((f) => [f.label, f.value]));
  assert.equal(by.Started, 'by Fabric, for a board request no session took');
  assert.equal(by.Request, '45bf7553 · thread a9672312');
  assert.match(by.Ended!, /^exited with code 0, /);
  assert.equal(by.Ran, '7 min');
  const ru = Object.fromEntries(chainFacts('ru', row(launchFactsOf({ ...RECORD, ended: { kind: 'stopped', at: 1793790000 } }))).map((f) => [f.label, f.value]));
  assert.equal(ru['Запрос'], '45bf7553 · тред a9672312');
  assert.match(ru['Завершилась']!, /^остановлена Fabric, /);
});

test('FD-137: a session Fabric started reads "on a board request" in the list', () => {
  assert.match(secondLine('en', row(launchFactsOf(RECORD))), /on a board request/);
  assert.match(secondLine('ru', row(launchFactsOf(RECORD))), /по запросу с доски/);
  assert.doesNotMatch(secondLine('en', row(launchFactsOf({ launch_id: RECORD.launch_id, launched_by: { surface: 'cli' } }))), /board request/);
});

test('FD-137: a request the record names without its thread reads as the request alone', () => {
  const l = launchFactsOf({ ...RECORD, launched_by: { surface: 'fabric', dispatch: { request: REQUEST } } });
  const by = Object.fromEntries(chainFacts('en', row(l)).map((f) => [f.label, f.value]));
  assert.equal(by.Request, '45bf7553');
});

test('FD-137: an agent page lists the board-request sessions that ran in its folder, newest first, and nothing else', () => {
  const ours = { ...row(launchFactsOf(RECORD)), id: 'sb:a', agentKey: 'svc.one' } as SessionRow;
  const running = { ...row(launchFactsOf({ launch_id: RECORD.launch_id, launched_by: { surface: 'fabric', dispatch: { request: REQUEST, thread: THREAD } } })), id: 'sb:b', agentKey: 'svc.one', group: 'running', state: 'running' } as unknown as SessionRow;
  const other = { ...row(launchFactsOf(RECORD)), id: 'sb:c', agentKey: 'svc.two' } as SessionRow;
  const notBoard = { ...row(launchFactsOf({ launch_id: RECORD.launch_id, launched_by: { surface: 'cli' } })), id: 'sb:d', agentKey: 'svc.one' } as SessionRow;
  const lines = dispatchLines('en', [running, ours, other, notBoard], 'svc.one');
  assert.deepEqual(lines.map((l) => l.id), ['sb:b', 'sb:a']);
  assert.equal(lines[1]!.request, '45bf7553 · thread a9672312');
  assert.match(lines[1]!.outcome, /^exited with code 0, /);
  assert.equal(lines[1]!.ran, '7 min');
  assert.equal(lines[0]!.ran, null, 'a session still running has not ended');
  assert.ok(lines[0]!.outcome.length > 0);
  const unnamed = { ...row(launchFactsOf({ launch_id: RECORD.launch_id, launched_by: { surface: 'fabric' } })), id: 'sb:e', agentKey: 'svc.one' } as SessionRow;
  assert.equal(dispatchLines('ru', [unnamed], 'svc.one')[0]!.request, 'запрос не назван');
  assert.equal(dispatchLines('en', [ours], 'svc.one', 0).length, 0);
});

test('FD-137: the header chip and the sidebar name Fabric, never Switchboard, for a session Fabric started', () => {
  const r = { ...row(launchFactsOf(RECORD)), origin: 'switchboard', group: 'ended' } as SessionRow;
  assert.match(originChip('en', r), /^Started by Fabric, /);
  assert.match(originChip('ru', r), /^Запущена Fabric, /);
  assert.equal(navLines('en', r).sub, 'claude4 · board request');
  assert.equal(navLines('ru', r).sub, 'claude4 · с доски');
  const plain = { ...row(launchFactsOf({ launch_id: RECORD.launch_id, launched_by: { surface: 'cli' } })), origin: 'switchboard', group: 'ended' } as SessionRow;
  assert.match(originChip('en', plain), /^Started by Switchboard, /);
});

test('FD-137: an exit Switchboard did not wait for itself names no code (SB-247: exit_code only when the owner waited)', () => {
  const l = launchFactsOf({ ...RECORD, ended: { kind: 'exited', at: 1793790000 } });
  const en = Object.fromEntries(chainFacts('en', row(l)).map((f) => [f.label, f.value]));
  assert.match(en.Ended!, /^exited, /);
  assert.doesNotMatch(en.Ended!, /code/);
  assert.match(dispatchLines('ru', [{ ...row(l), agentKey: 'k' } as SessionRow], 'k')[0]!.outcome, /^завершилась, /);
});
