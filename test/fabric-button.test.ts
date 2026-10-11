// FD-45 (contract DEC-0040, ADR-0021): Fabric's button in the host — the links it builds, what a press
// does, how Fabric's presence is read, and the `fabric_button` cookie the host sets on the page.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildFabricLink, parseFabricLink } from '../src/core/fabric-links';
import { FABRIC_GET_URL, fabricButtonCookie, fabricPress, fabricPresentFrom } from '../src/core/fabric-button';

const fixtures = path.join(__dirname, 'fixtures', 'contract');
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8')) as Record<string, string>;
/** A fixture is the link's fields; the URL is its action plus every other field as a parameter. */
const urlOf = (f: Record<string, string>) => {
  const { action, ...params } = f;
  return `fabric://${action === 'chat' ? 'chat' : 'session/new'}?${new URLSearchParams(params).toString()}`;
};

test('FD-45 FL-6: the copied link code accepts the contract\'s positive fabric-link fixtures and refuses its negative ones', () => {
  for (const name of ['positive_fabric-link-chat.json', 'positive_fabric-link-session.json']) {
    const parsed = parseFabricLink(urlOf(fixture(name)));
    assert.equal(parsed.ok, true, `${name}: ${JSON.stringify(parsed)}`);
  }
  const token = parseFabricLink(urlOf(fixture('negative_fabric-link-chat-with-token.json')));
  assert.equal(token.ok, false);
  assert.match(JSON.stringify(token), /could carry a credential/, 'a link carrying a token is refused whole, not trimmed (FL-4)');
  const session = parseFabricLink(urlOf(fixture('negative_fabric-link-session-without-project.json')));
  assert.deepEqual(session, { ok: false, problems: ['a session link names its project'] });
  assert.throws(() => buildFabricLink({ action: 'chat', service: 'Not An Id' }), TypeError, 'the builder never emits a link the grammar refuses');
});

test('FD-45 ADR-0021 decision 3: with Fabric installed the button opens the chat about the service at once, with no project', () => {
  const press = fabricPress('example-agent.default', true);
  assert.deepEqual(press, { kind: 'direct', url: 'fabric://chat?service=example-agent.default' });
  if (press.kind !== 'direct') return;
  assert.deepEqual(parseFabricLink(press.url), { ok: true, link: { action: 'chat', service: 'example-agent.default' }, ignored: [] });
  assert.doesNotMatch(press.url, /project=|session/, 'Fabric finds the project itself; this host offers no session item');
});

test('FD-45 FB-5: without Fabric a press says so, and the only page offered is passioncode.ai/fabric', () => {
  assert.deepEqual(fabricPress('example-agent.default', false), { kind: 'absent' });
  assert.equal(FABRIC_GET_URL, 'https://passioncode.ai/fabric');
});

test('FD-45: a service id outside the hub\'s agent-id grammar gets no button, whatever is installed', () => {
  for (const key of ['Example.default', 'a', 'under_score.default', 'x.y.z', '']) {
    assert.deepEqual(fabricPress(key, true), { kind: 'none' }, key);
    assert.deepEqual(fabricPress(key, false), { kind: 'none' }, key);
  }
});

test('FD-45 ADR-0021 decision 4: Fabric is present when the OS names a handler for fabric://', () => {
  assert.equal(fabricPresentFrom('Fabric'), true);
  assert.equal(fabricPresentFrom('fabric.desktop'), true, 'Linux names the .desktop file');
  assert.equal(fabricPresentFrom(''), false);
  assert.equal(fabricPresentFrom('  '), false);
});

test('FD-45 FB-6: the host cookie says who draws the button and whether Fabric is here, with the ED-8 attributes and nothing secret', () => {
  const local = fabricButtonCookie('http://127.0.0.1:47195/dashboard', { hostDraws: true, fabricPresent: true });
  assert.deepEqual(local, { url: 'http://127.0.0.1:47195', name: 'fabric_button', value: 'v=1&owner=host&fabric=present', path: '/', sameSite: 'strict', httpOnly: false, secure: false });
  const online = fabricButtonCookie('https://agent.example.com', { hostDraws: false, fabricPresent: false });
  assert.equal(online.secure, true, 'Secure on https');
  assert.equal(online.value, 'v=1&owner=page&fabric=absent');
  assert.deepEqual([...new URLSearchParams(online.value).keys()], ['v', 'owner', 'fabric'], 'three fields, no identity, no token');
});

test('FD-45 DEC-0041: a credential word must be a whole word of a name — harmless names pass, credential ones still refuse the link', () => {
  for (const url of ['fabric://chat?service=example-agent.default&themeCode=ocean', 'fabric://chat?service=example-agent.default&sortKey=name', 'fabric://chat?service=example-agent.default#auth-settings']) {
    assert.equal(parseFabricLink(url).ok, true, url);
  }
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln';
  for (const url of ['fabric://chat?service=example-agent.default&authToken=x', 'fabric://chat?service=example-agent.default&clientSecret=x', `fabric://chat?service=example-agent.default&ref=${jwt}`, `fabric://chat?service=example-agent.default#${jwt}`]) {
    assert.equal(parseFabricLink(url).ok, false, url);
  }
});
