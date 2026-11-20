// FD-354 step 2 (contract DEC-0189, Fabric 0.3.26): Open in Fabric and New session in Fabric on a session's page.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFabricLink } from '../src/core/fabric-links';
import { FROM, newInFabric, openInFabric, runnerSessionId } from '../src/core/fabric-session-link';
import type { LaunchFacts, SessionRow } from '../src/core/sessions';

const ID = '3F2B8C1E-9A47-4D2E-B5C6-0E1F2A3B4C5D';
const launch = (o: Partial<LaunchFacts>): LaunchFacts => ({ launchId: null, by: { surface: null, by: null, program: null, project: null, parent: null, caller: null }, transcript: null, providerSessionId: null, turns: null, lastTurnAt: null, ended: null, endedAt: null, continuedAs: null, ...o } as LaunchFacts);
const row = (o: Partial<SessionRow>): Pick<SessionRow, 'machine' | 'agent' | 'state' | 'launch' | 'folder'> => ({ machine: null, agent: 'claude-code', state: 'ended', launch: launch({ providerSessionId: ID }), folder: '/w/fabric-dashboards', ...o });

test('FD-354 step 2 SL-2: the runner session id comes from Switchboard\'s record, a resumed id or the transcript\'s name, in lower case', () => {
  assert.equal(runnerSessionId(row({})), ID.toLowerCase());
  assert.equal(runnerSessionId(row({ launch: launch({}) }), ID), ID.toLowerCase(), 'the id a console of this app resumed');
  assert.equal(runnerSessionId(row({ launch: launch({ transcript: `/h/.claude/projects/p/${ID.toLowerCase()}.jsonl` }) })), ID.toLowerCase());
  assert.equal(runnerSessionId(row({ launch: launch({ providerSessionId: 'not-a-uuid', transcript: '/h/agent-1.jsonl' }) })), null, 'nothing else is guessed');
  assert.equal(runnerSessionId(row({ launch: null })), null);
});

test('FD-354 step 2 SL-4, SL-5: a running session opens its view in Fabric, a stopped one the view that continues it there', () => {
  const ended = openInFabric(row({ state: 'ended' }));
  assert.deepEqual(ended, { action: 'session.continue', url: `fabric://session/continue?session=${ID.toLowerCase()}&from=${FROM}` });
  assert.deepEqual(parseFabricLink(ended!.url), { ok: true, link: { action: 'session.continue', session: ID.toLowerCase(), from: 'fabric-dashboards' }, ignored: [] });
  for (const state of ['waiting-reset', 'idle-closed', 'ended-by-you', 'needs-you-not-opened'] as const) assert.equal(openInFabric(row({ state }))?.action, 'session.continue', state);
  for (const state of ['running-ours', 'running-terminal', 'running-background', 'running-unmanaged', 'needs-you-resume-failed', 'waiting-own'] as const) {
    assert.equal(openInFabric(row({ state }))?.action, 'session.open', `${state}: a process runs it, Fabric only shows it`);
  }
  assert.equal(openInFabric(row({ agent: 'codex' }))?.action, 'session.continue');
});

test('FD-354 step 2: no Fabric link where Fabric cannot know the session', () => {
  assert.equal(openInFabric(row({ machine: 'studio' })), null, 'another machine\'s session');
  assert.equal(openInFabric(row({ agent: 'gemini' })), null, 'a runtime Fabric does not continue');
  assert.equal(openInFabric(row({ launch: null })), null, 'no session id');
  assert.equal(newInFabric(row({ machine: 'studio' })), null);
});

test('FD-354 step 2: New session in Fabric names the folder\'s last name as its project and the coding agent as its runner', () => {
  assert.deepEqual(newInFabric(row({})), { action: 'session.new', url: 'fabric://session/new?project=fabric-dashboards&runner=claude-code&from=fabric-dashboards' });
  assert.equal(newInFabric(row({ folder: '/w/fabric-dashboards/' }))?.url, 'fabric://session/new?project=fabric-dashboards&runner=claude-code&from=fabric-dashboards', 'a trailing slash');
  assert.equal(newInFabric(row({ agent: 'codex' }))?.url, 'fabric://session/new?project=fabric-dashboards&runner=codex&from=fabric-dashboards');
  assert.equal(newInFabric(row({ agent: 'gemini' }))?.url, 'fabric://session/new?project=fabric-dashboards&from=fabric-dashboards', 'Fabric chooses the runner');
  assert.equal(newInFabric(row({ folder: '/w/My Project' })), null, 'a name the project grammar refuses');
  assert.equal(newInFabric(row({ folder: '/' })), null);
});
