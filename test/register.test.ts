// FD-193: an organization's member adds the agents they hold a grant to from one `fabric-dashboards://register` link
// (studio-agent DEC-0075, its showcase.md §4): the invitation is redeemed for a host token, the token is kept in a 0600
// file, and one online descriptor is written for the showcase and for each agent address it names.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readDirectory } from '@passioncode-ai/fabric-service-host';
import { parseDeepLink } from '../src/core/deeplink';
import { connectLinkOf, agentHostAllowed, parseRegisterLink, register, type RegisterDeps } from '../src/core/register';
import { parseRequest } from '../src/core/console-channel';

const INVITE = 'A'.repeat(32);
const TOKEN = 'h0st-T0ken_' + 'x'.repeat(40);
const link = (q: string) => parseDeepLink(`fabric-dashboards://register?${q}`, []);

test('FD-193: a register link takes an https origin with no path and a one-time code, nothing else', () => {
  const ok = link(`origin=${encodeURIComponent('https://agents.example.com')}&invite=${INVITE}`);
  assert.deepEqual(ok, { ok: true, target: { page: 'register', origin: 'https://agents.example.com', invite: INVITE } });
  const refused = (q: string) => { const r = link(q); assert.equal(r.ok, false, q); return (r as { reason: string }).reason; };
  assert.match(refused(`origin=${encodeURIComponent('https://agents.example.com/x')}&invite=${INVITE}`), /no path/);
  assert.match(refused(`origin=${encodeURIComponent('http://agents.example.com')}&invite=${INVITE}`), /https/);
  assert.match(refused(`origin=${encodeURIComponent('https://10.0.0.1')}&invite=${INVITE}`), /IP literal/);
  assert.match(refused(`origin=${encodeURIComponent('https://agents.example.com')}&invite=short`), /invitation code/);
  assert.match(refused(`origin=${encodeURIComponent('https://agents.example.com')}&invite=${INVITE}&token=x`), /unknown parameter "token"/);
  assert.match(refused(`origin=${encodeURIComponent('https://a.example.com')}&origin=${encodeURIComponent('https://b.example.com')}&invite=${INVITE}`), /more than once/);
  assert.match(refused(`invite=${INVITE}`), /both origin= and invite=/);
  assert.equal('reason' in parseRegisterLink(new URL(`fabric-dashboards://register/x?origin=https%3A%2F%2Fa.example.com&invite=${INVITE}`)), true, 'nothing after the verb');
});

test('FD-193: the host token goes only to addresses under the showcase\'s own domain', () => {
  assert.equal(agentHostAllowed('agents.example.com', 'sc-pm.example.com'), true);
  assert.equal(agentHostAllowed('agents.example.com', 'sc-pm.agents.example.com'), true);
  assert.equal(agentHostAllowed('agents.example.com', 'example.com'), false, 'the bare parent is not an agent address');
  assert.equal(agentHostAllowed('agents.example.com', 'sc-pm.evil.com'), false);
  assert.equal(agentHostAllowed('agents.example.com', 'sc-pm.example.com.evil.com'), false);
  assert.equal(agentHostAllowed('example.com', 'sc-pm.com'), false, 'a two-label showcase never widens to its top-level domain');
  assert.equal(agentHostAllowed('example.com', 'sc-pm.example.com'), true);
  assert.equal(agentHostAllowed('agents.example.com', 'bad_host.example.com'), false);
});

type Call = { url: string; init: RequestInit };
function server(routes: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const fetchFake = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const route = routes[String(url)];
    if (!route) throw new Error(`getaddrinfo ENOTFOUND ${new URL(String(url)).hostname}`);
    return route(init);
  }) as typeof fetch;
  return { calls, fetchFake };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const known = (instance: string, name: string, hosts?: Record<string, string>) => ({ protocol: 'fabric-service/0.1', service: { id: 'studio-showcase', instance, name }, ...(hosts ? { extensions: { 'studio-agent:showcase': { hosts } } } : {}) });

function deps(dir: string, fetchFake: typeof fetch, kept: string[] = []): RegisterDeps {
  return { fetch: fetchFake, servicesDir: dir, label: 'ann-mac', installedBy: 'Fabric Dashboards 0.0.0 (registration link from agents.example.com)', now: () => new Date('2026-11-18T10:00:00.123Z'), keepKey: (h, pem) => { kept.push(`${h}:${pem.startsWith('-----BEGIN PRIVATE KEY-----')}`); return true; } };
}

test('FD-193: a link registers the showcase and each agent of the person\'s grant, with one kept token', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-193-'));
  const authed = (init: RequestInit) => (init.headers as Record<string, string>).Authorization === `Bearer ${TOKEN}`;
  const { calls, fetchFake } = server({
    'https://agents.example.com/auth/enroll': () => json(200, { device: 'dev_1234567890', hostToken: TOKEN }),
    'https://agents.example.com/.well-known/fabric-service': (i) => authed(i) ? json(200, known('acme', 'Showcase', { 'pm-agent': 'sc-pm.example.com', evil: 'sc-x.evil.com' })) : json(401, {}),
    'https://sc-pm.example.com/.well-known/fabric-service': (i) => authed(i) ? json(200, known('pm-agent', 'PM agent (showcase)')) : json(401, {}),
  });
  const kept: string[] = [];
  const result = await register({ origin: 'https://agents.example.com', invite: INVITE }, deps(dir, fetchFake, kept));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.ok);
  assert.deepEqual(result.written, ['studio-showcase.acme', 'studio-showcase.pm-agent']);
  assert.deepEqual(result.skipped.map((s) => s.key), ['sc-x.evil.com']);
  assert.deepEqual(kept, ['agents.example.com:true'], 'the device key\'s private half is handed to the app to seal');
  const enroll = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
  assert.equal(enroll.code, INVITE);
  assert.equal(enroll.host, true);
  assert.equal(enroll.label, 'ann-mac');
  assert.deepEqual(Object.keys(enroll.jwk as object).sort(), ['crv', 'kty', 'x', 'y'], 'only the public half leaves the Mac');
  assert.ok(calls.every((c) => c.init.redirect === 'error'), 'no call follows a redirect');
  assert.ok(!calls.some((c) => c.url.includes('evil.com')), 'the token never reaches another domain');
  const tokenFile = path.join(dir, 'showcase-agents.example.com.token');
  assert.equal(fs.readFileSync(tokenFile, 'utf8'), TOKEN);
  if (process.platform !== 'win32') assert.equal(fs.statSync(tokenFile).mode & 0o777, 0o600);
  const entries = readDirectory(dir);
  assert.deepEqual(entries.map((e) => [e.key, e.problems]), [['studio-showcase.acme', []], ['studio-showcase.pm-agent', []]], 'the host reads both as usable descriptors');
  const d = entries.find((e) => e.key === 'studio-showcase.pm-agent')!.descriptor!;
  assert.equal(d.origin, 'https://sc-pm.example.com');
  assert.equal(d.placement, 'remote');
  assert.equal(d.auth.tokenFile, tokenFile);
  assert.equal(d.installedAt, '2026-11-18T10:00:00Z');
  for (const name of fs.readdirSync(dir)) assert.ok(!fs.readFileSync(path.join(dir, name), 'utf8').includes(INVITE), `${name} never keeps the invitation`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FD-193: a spent, browser-only or unreachable invitation says so and writes nothing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-193-'));
  const at = (status: number) => server({ 'https://agents.example.com/auth/enroll': () => json(status, { error: { code: 'x' } }) }).fetchFake;
  const run = (f: typeof fetch) => register({ origin: 'https://agents.example.com', invite: INVITE }, deps(dir, f));
  assert.equal((await run(at(401)) as { code: string }).code, 'invite_refused');
  assert.equal((await run(at(403)) as { code: string }).code, 'not_for_host');
  assert.equal((await run(at(500)) as { code: string }).code, 'bad_answer');
  assert.equal((await run(server({}).fetchFake) as { code: string }).code, 'unreachable');
  assert.equal((await run(server({ 'https://agents.example.com/auth/enroll': () => json(200, { device: 'dev_1234567890' }) }).fetchFake) as { code: string }).code, 'bad_answer', 'no host token');
  assert.equal((await run(server({ 'https://agents.example.com/auth/enroll': () => json(200, { device: 'dev_1234567890', hostToken: 'has space in it, 1234567' }) }).fetchFake) as { code: string }).code, 'bad_answer');
  assert.deepEqual(fs.readdirSync(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FD-193: a token whose well-known fails is kept; a descriptor for another origin is never overwritten', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-193-'));
  const enroll = () => json(200, { device: 'dev_1234567890', hostToken: TOKEN });
  const down = server({ 'https://agents.example.com/auth/enroll': enroll, 'https://agents.example.com/.well-known/fabric-service': () => json(503, {}) });
  const r = await register({ origin: 'https://agents.example.com', invite: INVITE }, deps(dir, down.fetchFake));
  assert.equal(r.ok, false);
  assert.equal((r as { code: string }).code, 'nothing_written');
  assert.match((r as { detail: string }).detail, /the token is kept, but agents\.example\.com answered HTTP 503/);
  assert.deepEqual(fs.readdirSync(dir), ['showcase-agents.example.com.token']);

  fs.writeFileSync(path.join(dir, 'studio-showcase.acme.json'), JSON.stringify({ origin: 'https://other.example.org' }), { mode: 0o600 });
  const up = server({ 'https://agents.example.com/auth/enroll': enroll, 'https://agents.example.com/.well-known/fabric-service': () => json(200, known('acme', 'Showcase')) });
  const again = await register({ origin: 'https://agents.example.com', invite: INVITE }, deps(dir, up.fetchFake));
  assert.equal(again.ok, false, 'the only address is held by another origin');
  assert.match((again as { detail: string }).detail, /already installed for https:\/\/other\.example\.org/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'studio-showcase.acme.json'), 'utf8')).origin, 'https://other.example.org');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FD-331: a pasted invitation is the whole register link; anything else says what to paste', () => {
  const ok = connectLinkOf('  fabric-dashboards://register?origin=https://agents.example.com&invite=' + 'a'.repeat(32) + '  ');
  if ('reason' in ok) assert.fail(ok.reason);
  assert.equal(ok.origin, 'https://agents.example.com');
  assert.match((connectLinkOf('https://agents.example.com/?invite=x') as { reason: string }).reason, /paste the invitation link/);
  assert.match((connectLinkOf('not a link') as { reason: string }).reason, /paste the invitation link/);
  assert.ok('reason' in connectLinkOf('fabric-dashboards://service/x.default'));
  assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'agent.connect', link: 'fabric-dashboards://register?origin=https://a.example.com&invite=x' })).ok, true);
  assert.equal(parseRequest(JSON.stringify({ key: 'k', op: 'agent.connect' })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ key: 'k', op: 'agent.connect', link: 'x', service: 'a.b' })).ok, false);
});
