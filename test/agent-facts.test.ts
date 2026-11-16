// FD-273: where an agent runs, its organization and whose it is, read for the sidebar tooltip and the details card.
import assert from 'node:assert/strict';
import test from 'node:test';
import { INSTANCE_FACTS_EXTENSION } from '@passioncode-ai/fabric-service-host/instance-facts';
import { agentFacts, agentHint, cloudProvider, declaredFacts, whereOf, whereWords } from '../src/core/agent-facts';
import { setWording, t } from '../src/core/i18n';
import type { ServiceSnapshot } from '../src/core/types';

function svc(key: string, extra: Partial<ServiceSnapshot> & { placement?: 'local' | 'remote'; origin?: string; repository?: string; installedBy?: unknown; installedAt?: string; version?: string; login?: boolean } = {}): ServiceSnapshot {
  const { placement, origin, repository, installedBy, installedAt, version, login, ...rest } = extra;
  return {
    key, state: 'ready', reasons: [],
    descriptor: { name: key.split('.')[0], placement, origin: origin ?? 'http://127.0.0.1:47000', installedAt: installedAt ?? '', installedBy: installedBy ?? '', ...(repository ? { source: { repository } } : {}) } as unknown as ServiceSnapshot['descriptor'],
    wellKnown: version ? { service: { version }, surfaces: { events: { path: '/e' }, ...(login !== undefined ? { dashboard: { path: '/', login } } : {}) } } as unknown as ServiceSnapshot['wellKnown'] : null,
    ...rest,
  } as ServiceSnapshot;
}
const say = (lang: 'en' | 'ru', w: { code: string; params: Record<string, string> }) => t(lang, w.code, w.params);

test('FD-273: a provider is named by the host its service answers under; a custom domain by its host alone', () => {
  assert.equal(cloudProvider('prowl.acme.workers.dev'), 'Cloudflare');
  assert.equal(cloudProvider('API.herokuapp.com'), 'Heroku');
  assert.equal(cloudProvider('x-123.a.run.app'), 'Google Cloud Run');
  assert.equal(cloudProvider('agents.example.com'), null);
  assert.equal(cloudProvider('workers.dev.example.com'), null);
});

test('FD-273: an agent runs here, on another machine the placement record names, or online', () => {
  const was = setWording('mac');
  try {
    assert.deepEqual(whereOf(svc('a.default')), { kind: 'here' });
    assert.equal(say('en', whereWords(whereOf(svc('a.default')))), 'On this Mac');
    const studio = svc('a.default', { state: 'stopped', reasons: [{ code: 'reason.elsewhere', params: { machine: 'mac-studio' } }] });
    assert.deepEqual(whereOf(studio), { kind: 'machine', machine: 'mac-studio', forward: false });
    assert.equal(say('en', whereWords(whereOf(studio))), 'On mac-studio');
    assert.equal(say('ru', whereWords(whereOf(studio))), 'На mac-studio');
    const reached = svc('a.default', { reasons: [{ code: 'reason.reached.elsewhere', params: { machine: 'mac-studio' } }] });
    assert.equal(say('en', whereWords(whereOf(reached))), 'On mac-studio, reached here through a forwarded port');
    const unknown = svc('a.default', { reasons: [{ code: 'reason.elsewhere', params: { machine: 'unknown' } }] });
    assert.equal(say('en', whereWords(whereOf(unknown))), 'On another machine');
    const cloud = svc('p.cloud', { placement: 'remote', origin: 'https://prowl.acme.workers.dev' });
    assert.deepEqual(whereOf(cloud), { kind: 'cloud', provider: 'Cloudflare', host: 'prowl.acme.workers.dev' });
    assert.equal(say('en', whereWords(whereOf(cloud))), 'Online at Cloudflare (prowl.acme.workers.dev)');
    assert.equal(say('ru', whereWords(whereOf(svc('p.x', { placement: 'remote', origin: 'https://agents.example.com' })))), 'Онлайн по адресу agents.example.com');
  } finally { setWording(was); }
});

test('FD-273: the details card reads where, organization, repository, installer, date and copies, in that order', () => {
  const was = setWording('mac');
  try {
    const s = svc('p.default', {
      organization: { name: 'acme', label: 'Acme' }, repository: 'https://github.com/acme/prowl.git', version: '1.4.0', login: true,
      installedBy: { by: 'person', role: 'operator', tool: 'passioncode' }, installedAt: '2026-11-01T10:00:00Z',
    });
    const copy = svc('p.cloud', { placement: 'remote', origin: 'https://p.acme.workers.dev' });
    const facts = agentFacts(s, [s, copy]);
    // DEC-0173 IF-5 (CT-321): a dashboard's login alone is no fact, so a service that declares none has no sign-in line.
    assert.deepEqual(facts.map((f) => f.label), ['facts.where', 'health.organization', 'facts.repository', 'health.installedBy', 'facts.installedAt', 'facts.copies']);
    assert.deepEqual(facts.map((f) => say('en', f.value)).slice(0, 3), ['On this Mac', 'Acme', 'acme/prowl']);
    assert.equal(facts.some((f) => f.declared), false);
    assert.equal(say('ru', facts.at(-1)!.value), 'Ещё: 1, в других местах');
  } finally { setWording(was); }
});

test('FD-273: what an agent does not declare is left out, never guessed', () => {
  const facts = agentFacts(svc('bare.default'));
  assert.deepEqual(facts.map((f) => f.label), ['facts.where']);
  // No map read: no organization line. A map read with no attribution says so.
  assert.equal(agentFacts(svc('x.default', { organization: null })).find((f) => f.label === 'health.organization')!.value.code, 'orgs.none');
  // A bad install date is left out.
  assert.equal(agentFacts(svc('x.default', { installedAt: 'yesterday' })).some((f) => f.label === 'facts.installedAt'), false);
});

test('FD-273: the tooltip names each place the agent runs once, then its organization; yours says so', () => {
  const was = setWording('mac');
  try {
    const here = svc('p.default', { organization: { name: 'me', label: 'Personal', personal: true } });
    const cloud = svc('p.cloud', { placement: 'remote', origin: 'https://p.fly.dev' });
    const lines = agentHint(here, [here, cloud, here]).map((w) => say('en', w));
    assert.deepEqual(lines, ['On this Mac', 'Online at Fly.io (p.fly.dev)', 'Personal (yours)']);
    assert.deepEqual(agentHint(svc('x.default', { organization: null })).map((w) => say('ru', w)), ['На этом Mac']);
  } finally { setWording(was); }
});

test('FD-273 (DEC-0173, SCR-36): the facts a service declares, in the contract\'s words, each marked as its own word', () => {
  const ext = (value: unknown) => ({ [INSTANCE_FACTS_EXTENSION]: value });
  const declared = (value: unknown, o: { remote?: boolean; peer?: boolean; login?: boolean; organization?: ServiceSnapshot['organization'] } = {}) => {
    const s = svc('p.default', { placement: o.remote ? 'remote' : undefined, version: '1.0.0', login: o.login, organization: o.organization });
    (s.descriptor as unknown as Record<string, unknown>).extensions = ext(value);
    (s.descriptor as unknown as Record<string, unknown>).id = 'p';
    (s.descriptor as unknown as Record<string, unknown>).instance = 'default';
    if (o.peer) (s.descriptor as unknown as Record<string, unknown>).peer = { path: '/peer' };
    (s.wellKnown as unknown as Record<string, unknown>).service = { id: 'p', instance: 'default', version: '1.0.0' };
    return s;
  };
  const words = (s: ServiceSnapshot, lang: 'en' | 'ru' = 'en') => declaredFacts(s).map((f) => `${t(lang, f.label)}: ${say(lang, f.value)}`);
  const acme = { name: 'acme', label: 'Acme' };
  assert.deepEqual(words(declared({ access: { audience: 'operator' }, tenancy: { mode: 'single' }, space: { kind: 'user', account: 'studio-1' } }, { login: true })),
    ['serves: its operator only', 'dashboard: the app signs you in', "data: one tenant: its data is its owner's alone", 'runs as: an account on this computer', 'space label: studio-1']);
  assert.ok(declaredFacts(declared({ access: { audience: 'operator' } })).every((f) => f.declared));
  assert.deepEqual(words(declared({ access: { audience: 'organization' } }, { peer: true, organization: acme })), ['serves: the people of Acme and those granted access']);
  assert.deepEqual(words(declared({ access: { audience: 'organization' } }, { peer: true, organization: { name: 'me', label: 'Me', personal: true } })), ['serves: those granted access']);
  assert.deepEqual(words(declared({ access: { audience: 'organization' }, space: { kind: 'user' } }, { remote: true, organization: acme }), 'ru'),
    ['кому служит: людям Acme, с их собственными ключами', 'запущен как: аккаунт на своей машине']);
  assert.deepEqual(words(declared({ access: { audience: 'public', entry: 'own-signin' }, tenancy: { mode: 'shared' }, space: { kind: 'system' } }, { remote: true })),
    ['serves: anyone who reaches its site with credentials of their own', 'dashboard: its own sign-in', "data: several tenants' data in one instance, kept apart by it", "runs as: a platform's account"]);
  // A refused value is never shown: `public` on a local placement, `shared` and `system` there too.
  assert.deepEqual(declaredFacts(declared({ access: { audience: 'public' }, tenancy: { mode: 'shared' }, space: { kind: 'system' } })), []);
  // A value that fails the schema gives nothing.
  assert.deepEqual(declaredFacts(declared({ access: { audience: 'everyone' } })), []);
  // The details card carries them after the organization line.
  const card = agentFacts(declared({ access: { audience: 'operator' } }, { organization: acme }));
  assert.deepEqual(card.map((f) => f.label).slice(0, 3), ['facts.where', 'health.organization', 'facts.audience']);
});
