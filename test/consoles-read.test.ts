// FD-166 (Fabric's CO-457): the console channel's read and the session link it hands out.
import assert from 'node:assert/strict';
import test from 'node:test';
import { openConsolesOf, parseRequest } from '../src/core/console-channel';
import { parseDeepLink, sessionLink } from '../src/core/deeplink';
import type { SessionRow } from '../src/core/sessions';

const ID = '0f3c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6';
const row = (over: Partial<SessionRow>): SessionRow => ({
  id: 'c:alpha.default:1762531200000', key: 'alpha.default', folder: '/w/alpha', project: 'alpha', agent: 'claude-code', account: null,
  context: null, contextName: null, origin: 'here', state: 'running', group: 'running', actions: [], reason: null, openedInTerminal: false,
  startedAt: Date.parse('2026-11-07T16:00:00Z'), endedAt: null, expectedAt: null, candidates: [], waitReason: null, resumable: false,
  consoleEmpty: false, launch: null, paid: null, at: Date.parse('2026-11-07T16:00:00Z'), ...over,
} as SessionRow);

test('FD-166: a list request names no service and no task; anything else is refused', () => {
  assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'console.list' })), { ok: true, request: { key: 'k', op: 'console.list', service: '' } });
  assert.equal((parseRequest(JSON.stringify({ key: 'k', op: 'console.list', service: 'alpha.default' })) as { code: string }).code, 'unknown-field');
  assert.equal((parseRequest(JSON.stringify({ key: 'k', op: 'console.list', task: { kind: 'fix', output: '' } })) as { code: string }).code, 'unknown-field');
  assert.equal((parseRequest(JSON.stringify({ key: 'k', op: 'console.read' })) as { code: string }).code, 'unknown-op');
});

test('FD-166: only running consoles of this app are listed; session ids come from Switchboard, a resume or the transcript, never guessed', () => {
  const launch = { launchId: null, by: { surface: null, by: null, program: null, project: null, parent: null, caller: null }, transcript: null, turns: null, lastTurnAt: null, ended: null, endedAt: null, continuedAs: null };
  const rows = [
    row({}),
    row({ id: 'c:handover.ho-0123456789ab:1', key: 'handover.ho-0123456789ab', agent: 'codex', launch: { ...launch, providerSessionId: ID } }),
    row({ id: 'c:bravo.default:2', key: 'bravo.default', launch: { ...launch, transcript: `/h/.claude/projects/x/${ID}.jsonl` } }),
    row({ id: 'c:charlie.default:3', key: 'charlie.default' }),
    row({ id: 'sb:claude:default:x:/f', key: null }),
    row({ id: 'c:delta.default:4', key: 'delta.default', group: 'ended', state: 'ended' }),
  ];
  const got = openConsolesOf(rows, (k) => (k === 'charlie.default' ? ID.toUpperCase() : k === 'alpha.default' ? 'not-a-session-id' : null));
  assert.deepEqual(got.map((c) => c.consoleKey), ['alpha.default', 'handover.ho-0123456789ab', 'bravo.default', 'charlie.default'], 'a Switchboard-only row and an ended one are not open consoles here');
  assert.deepEqual(got.map((c) => [c.service, c.sessionId, c.runtimeSessionId]), [
    ['alpha.default', null, null],
    [null, ID, ID],
    ['bravo.default', null, ID],
    ['charlie.default', null, ID],
  ]);
  assert.equal(got[0]!.since, '2026-11-07T16:00:00.000Z');
  assert.equal(JSON.stringify(got).includes('output'), false, 'never what a console printed');
});

test('FD-166: a session link opens that session\'s page; a malformed one is refused', () => {
  const id = 'c:alpha.default:1762531200000';
  assert.deepEqual(parseDeepLink(sessionLink(id), []), { ok: true, target: { page: 'sessions', key: id } });
  assert.deepEqual(parseDeepLink('fabric-dashboards://sessions', []), { ok: true, target: { page: 'sessions' } });
  assert.equal(parseDeepLink('fabric-dashboards://sessions?id=%3Cscript%3E', []).ok, false);
  assert.equal(parseDeepLink('fabric-dashboards://sessions?id=c:a&id=c:b', []).ok, false);
  assert.equal(parseDeepLink('fabric-dashboards://sessions?other=1', []).ok, false);
  assert.equal(parseDeepLink('fabric-dashboards://sessions/x', []).ok, false);
});
