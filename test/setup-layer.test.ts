import { test } from 'node:test';
import assert from 'node:assert/strict';

// FD-208, FD-209: the reader of fabric-agent-contract's draft `setup-step/1` and `setup-layer/1` (CT-290, design
// `docs/evidence/plans/2026-11-12-ct290-setup-step.md` at `dfaaf542`, rules SS-1 to SS-6).

const layer = (steps: unknown[], extra: Record<string, unknown> = {}) => ({
  type: 'setup-layer/1', layer: 'organization', owner: 'org-product.default', generatedAt: '2026-11-12T13:00:00Z', steps, ...extra,
});
const agent = (id: string, order: number, more: Record<string, unknown> = {}) =>
  ({ id, layer: 'organization', order, title: `Step ${id}`, state: 'next', actor: 'agent', door: { name: 'org.create' }, ...more });
const person = (id: string, order: number, gate: string, more: Record<string, unknown> = {}) =>
  ({ id, layer: 'organization', order, title: `Step ${id}`, state: 'next', actor: 'person', gate, why: 'Only you can sign the statement.', ...more });

test('FD-208 SS-1/SS-2: a well-formed layer answer reads, steps in their order', async () => {
  const { parseSetupLayer } = await import('../src/core/setup-layer');
  const r = parseSetupLayer(layer([
    person('l3.dpia.attest', 2, 'attest', { link: 'https://example.org/sign' }),
    agent('l3.org.create', 1, { state: 'done', evidence: ['receipt:abc'] }),
    { id: 'l3.wait', layer: 'organization', order: 3, title: 'Wait', state: 'waiting', actor: 'machine', waitsOn: ['l3.dpia.attest'] },
    { id: 'l3.date', layer: 'organization', order: 4, title: 'Date', state: 'waiting', actor: 'machine', waitsOn: { until: '2026-11-21T00:00:00Z' } },
  ]));
  assert.ok(r.ok, r.ok ? '' : r.error);
  assert.deepEqual(r.answer.steps.map((s) => s.id), ['l3.org.create', 'l3.dpia.attest', 'l3.wait', 'l3.date']);
  assert.equal(r.answer.owner, 'org-product.default');
});

test('FD-208 SS-1: each rule of a step is held, and a broken answer is refused whole with the reason', async () => {
  const { parseSetupLayer } = await import('../src/core/setup-layer');
  const refused = (steps: unknown[], extra?: Record<string, unknown>) => {
    const r = parseSetupLayer(layer(steps, extra));
    assert.equal(r.ok, false, JSON.stringify(steps));
    return r.ok ? '' : r.error;
  };
  assert.match(refused([person('a', 1, 'attest', { gate: undefined })]), /gate/, 'a person\'s step without a gate');
  assert.match(refused([person('a', 1, 'telepathy')]), /gate/, 'a gate outside the ten');
  assert.match(refused([agent('a', 1, { gate: 'consent' })]), /gate/, 'a gate on an agent\'s step');
  assert.match(refused([agent('a', 1, { door: undefined })]), /door/, 'an agent\'s step without a door');
  assert.match(refused([person('a', 1, 'consent', { door: { name: 'x' } })]), /door/, 'a door on a person\'s step');
  assert.match(refused([agent('a', 1), agent('a', 2)]), /twice/, 'an id twice');
  assert.match(refused([agent('a', 1), agent('b', 1)]), /order/, 'an order twice');
  assert.match(refused([agent('a', 1, { state: 'waiting', waitsOn: ['nope'] })]), /waitsOn/, 'waiting on an unknown step');
  assert.match(refused([agent('a', 1, { state: 'waiting', waitsOn: ['b'] }), agent('b', 2, { state: 'waiting', waitsOn: ['a'] })]), /cycle/, 'a cycle');
  assert.match(refused([agent('a', 1, { waitsOn: ['a'] })]), /waitsOn/, 'waitsOn without waiting');
  assert.match(refused([agent('a', 1, { evidence: ['x'] })]), /evidence/, 'evidence on a step not done');
  assert.match(refused([agent('a', 1, { state: 'blocked' })]), /why/, 'blocked without why');
  assert.match(refused([person('a', 1, 'consent', { why: undefined })]), /why/, 'a person\'s step without why');
  assert.match(refused([agent('a', 1, { door: { argv: ['tool', '--token=sk-live-abcdef0123456789'] } })]), /secret/, 'a secret in a command');
  assert.match(refused([agent('a', 1, { door: { argv: ['~/bin/tool'] } })]), /home/, 'a home folder in a command');
  assert.match(refused([agent('a', 1, { layer: 'people' })]), /layer/, 'a step of another layer');
  assert.match(refused([agent('a', 1, { title: 'two\nlines' })]), /title/, 'a title of two lines');
  assert.match(refused([person('a', 1, 'consent', { link: 'javascript:alert(1)' })]), /link/, 'a link that is not https');
  assert.match(refused([], { layer: 'galaxy' }), /layer/, 'an unknown layer');
  assert.match(refused([], { owner: 'no key' }), /owner/, 'an owner that is not a service key');
  assert.match(refused([], { type: 'setup-layer/2' }), /type/, 'another type');
  assert.equal(parseSetupLayer('not json at all').ok, false);
});

test('FD-208 SS-4: layers in their fixed order, a declared owner that did not answer shown as not read, an undeclared one left out', async () => {
  const { parseSetupLayer, setupView } = await import('../src/core/setup-layer');
  const org = parseSetupLayer(layer([agent('b', 2), agent('a', 1, { state: 'done', evidence: ['r1'] })]));
  assert.ok(org.ok);
  const view = setupView(
    [{ layer: 'people', owner: 'pm-agent.default' }, { layer: 'organization', owner: 'org-product.default' }, { layer: 'computer', owner: 'passioncode.launcher' }],
    [org.answer],
  );
  assert.deepEqual(view.layers.map((l) => [l.layer, l.read]), [['computer', false], ['organization', true], ['people', false]], 'places has no owner here');
  assert.deepEqual(view.layers[1].steps.map((s) => s.id), ['a', 'b']);
  assert.equal(view.layers[0].steps.length, 0, 'a layer not read is never shown as done');
  // An answer from an owner nobody declared for that layer is not read in its place.
  const stray = setupView([{ layer: 'organization', owner: 'someone-else.default' }], [org.answer]);
  assert.equal(stray.layers[0].read, false);
});

test('FD-209 SS-5: the sheet lists the person\'s steps not done, in layer order then order, and the count of what is next', async () => {
  const { parseSetupLayer, setupView } = await import('../src/core/setup-layer');
  const org = parseSetupLayer(layer([
    agent('o1', 1, { state: 'done', evidence: ['r'] }),
    person('o2', 2, 'attest'),
    agent('o3', 3),
    person('o4', 4, 'payment', { state: 'done', evidence: ['paid'] }),
  ]));
  const comp = parseSetupLayer({ type: 'setup-layer/1', layer: 'computer', owner: 'passioncode.launcher', generatedAt: '2026-11-12T13:00:00Z',
    steps: [{ id: 'c1', layer: 'computer', order: 1, title: 'Sign in to Claude', state: 'next', actor: 'person', gate: 'sign-in', why: 'Your own account.' }] });
  assert.ok(org.ok && comp.ok);
  const v = setupView([{ layer: 'organization', owner: 'org-product.default' }, { layer: 'computer', owner: 'passioncode.launcher' }], [org.answer, comp.answer]);
  assert.deepEqual(v.sheet.map((s) => [s.id, s.gate]), [['c1', 'sign-in'], ['o2', 'attest']]);
  assert.deepEqual(v.next, { steps: 3, yours: 2 }, 'c1, o2, o3 are not done; c1 and o2 are the person\'s');
});

test('FD-208: the launcher\'s doctor steps read as the computer layer until it emits records (PC-179)', async () => {
  const { parseDoctor } = await import('../src/core/doctor');
  const { doctorLayer, parseSetupLayer, LAUNCHER_OWNER } = await import('../src/core/setup-layer');
  const report = parseDoctor(JSON.stringify({ version: '0.2.75', at: 't', ok: false, checks: [
    { id: 'node', area: 'prerequisites', state: 'ok', detail: 'Node 22' },
    { id: 'skills.x', area: 'skills', state: 'fail', detail: 'x missing', fix: 'setup' },
    { id: 'apps.claude', area: 'apps', state: 'warn', detail: 'not signed in', fix: 'claude login', gate: 'sign-in' },
    { id: 'mcp.code', area: 'mcp', state: 'fail', detail: 'needs a code', fix: 'enter it', gate: 'code' },
  ] }))!;
  const answer = doctorLayer(report, '2026-11-12T13:00:00Z', (a) => `Area ${a}`);
  assert.equal(answer.owner, LAUNCHER_OWNER);
  // The mapped answer passes the same rules as an owner's own.
  const again = parseSetupLayer(JSON.parse(JSON.stringify(answer)));
  assert.ok(again.ok, again.ok ? '' : again.error);
  const by = Object.fromEntries(answer.steps.map((s) => [s.id, s]));
  assert.equal(by['computer.prerequisites'].state, 'done');
  assert.deepEqual(by['computer.prerequisites'].evidence, ['doctor:node']);
  assert.equal(by['computer.skills'].state, 'blocked');
  assert.equal(by['computer.skills'].actor, 'agent');
  assert.equal(by['computer.skills'].why, 'x missing');
  assert.equal(by['computer.apps'].actor, 'person');
  assert.equal(by['computer.apps'].gate, 'sign-in');
  assert.equal(by['computer.mcp'].gate, 'one-time-code', 'the launcher\'s `code` is the contract\'s one-time-code');
  assert.equal(by['computer.services'].state, 'done', 'an area with nothing failing is done');
  assert.deepEqual(answer.steps.map((s) => s.title).slice(0, 2), ['Area prerequisites', 'Area skills']);
});

test('FD-215 (the launcher\'s message 84198dd6): a line `setup` does not fix is no `setup` step; it shows its own fix', async () => {
  const { parseDoctor, doctorMarkdown } = await import('../src/core/doctor');
  const { doctorLayer, parseSetupLayer } = await import('../src/core/setup-layer');
  const report = parseDoctor(JSON.stringify({ version: '0.2.77', at: 't', ok: false, checks: [
    { id: 'memory.vault', area: 'memory', state: 'fail', detail: 'the vault folder is missing', fix: 'create the vault in Obsidian, then press Check setup', gate: null, manual: true },
    { id: 'skills.x', area: 'skills', state: 'warn', detail: 'old', fix: 'setup', manual: true },
    { id: 'skills.y', area: 'skills', state: 'fail', detail: 'missing', fix: 'setup' },
    { id: 'apps.z', area: 'apps', state: 'warn', detail: 'no fix named' },
  ] }))!;
  assert.equal(report.checks[0]!.manual, true);
  assert.equal(report.checks[2]!.manual, undefined, 'only a true is read');
  const by = Object.fromEntries(doctorLayer(report, '2026-11-13T00:00:00Z', (a) => a).steps.map((s) => [s.id, s]));
  assert.deepEqual(by['computer.memory']!.door, { name: 'console_fix' }, 'not SETUP_DOOR');
  assert.equal(by['computer.memory']!.why, 'create the vault in Obsidian, then press Check setup');
  assert.deepEqual(by['computer.skills']!.door, { argv: ['npx', '--yes', '@passioncode-ai/passioncode@latest', 'setup'] }, 'one line setup fixes: setup first');
  assert.deepEqual(by['computer.apps']!.door, { name: 'console_fix' }, 'a line with no fix is no setup step either');
  assert.equal(by['computer.apps']!.why, 'no fix named');
  assert.ok(parseSetupLayer(doctorLayer(report, '2026-11-13T00:00:00Z', (a) => a)).ok);
  assert.match(doctorMarkdown(report), /memory\.vault.*`setup` does not fix this/);
});
