// FD-351 (contract DEC-0187): the host reads each product's `access.grants.list` through its declared capability or its
// compact execute door, pages it, refuses a broken answer whole, and joins the answers by service key.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccessGrants, Grant } from '@passioncode-ai/fabric-service-host';
import { accessOf, GRANT_PAGES, grantsDoorOf, readGrants, type GrantsRead } from '../src/core/access-read';

const ORIGIN = 'http://127.0.0.1:47123';
const AT = '2026-11-19T10:00:00Z';

const look = (mcp: Record<string, unknown> | null, origin = ORIGIN) => ({
  descriptor: { origin },
  wellKnown: mcp ? { surfaces: { mcp: { transport: 'streamable-http', path: '/mcp', ...mcp } } } : null,
});

const grant = (id: string, over: Partial<Grant> = {}): Grant => ({
  id, holder: { kind: 'agent', agent: 'media.default' }, scopes: ['order'],
  issued: { at: AT, by: 'operator', via: 'dashboard' }, ...over,
});

const answer = (grants: Grant[], over: Partial<AccessGrants> = {}): AccessGrants => ({
  protocol: 'access-grants/1', issuer: 'writer.cloud', generatedAt: '2026-11-19T12:00:00Z', grants, ...over,
});

/** A stub of callCapability that answers pages in order and records each call. */
function pages(...bodies: unknown[]) {
  const calls: { capability: string; args: Record<string, unknown>; opts: unknown }[] = [];
  const call = (async (_t: unknown, capability: string, args: Record<string, unknown>, _v: string, _ms: number, opts: unknown) => {
    calls.push({ capability, args, opts });
    const body = bodies[Math.min(calls.length - 1, bodies.length - 1)];
    if (body instanceof Error) throw body;
    return { structuredContent: body };
  }) as never;
  return { call, calls };
}

test('FD-351: a door is a declared capability or a compact execute door on a loopback streamable surface', () => {
  assert.deepEqual(grantsDoorOf(look({ capabilities: ['access.grants.list'] })), { origin: ORIGIN, path: '/mcp', declared: true });
  assert.deepEqual(grantsDoorOf(look({ capabilities: ['access_grants_list'] }))?.declared, true, 'the underscore form of the name');
  assert.deepEqual(grantsDoorOf(look({ compact: { execute: 'writer.execute' } })), { origin: ORIGIN, path: '/mcp', declared: false, execute: 'writer.execute' });
  assert.equal(grantsDoorOf(look({ capabilities: ['writer.check'] })), null, 'neither: not declared');
  assert.equal(grantsDoorOf(look(null)), null, 'no MCP surface');
  assert.equal(grantsDoorOf(look({ capabilities: ['access.grants.list'] }, 'https://writer.example')), null, 'only a loopback origin');
  assert.equal(grantsDoorOf({ descriptor: { origin: ORIGIN }, wellKnown: { surfaces: { mcp: { transport: 'stdio', path: '/mcp', capabilities: ['access.grants.list'] } } } }), null);
});

test('FD-351: a product without a door reads as not declared and is never called', async () => {
  const { call, calls } = pages(answer([]));
  const r = await readGrants({ key: 'writer.cloud', look: look({ capabilities: [] }), readToken: () => 't', version: '0.0.0', call });
  assert.deepEqual(r, { key: 'writer.cloud', state: 'not-declared' });
  assert.equal(calls.length, 0);
});

test('FD-351: every page is read and joined; revoked grants are asked for; the cursor travels', async () => {
  const { call, calls } = pages(answer([grant('g1')], { nextCursor: 'cursor-0001' }), answer([grant('g2')]));
  const r = await readGrants({ key: 'writer.cloud', look: look({ capabilities: ['access.grants.list'] }), readToken: () => 't', version: '0.0.0', call });
  assert.equal(r.state, 'read');
  assert.deepEqual((r as Extract<GrantsRead, { state: 'read' }>).answer.grants.map((g) => g.id), ['g1', 'g2']);
  assert.equal((r as Extract<GrantsRead, { state: 'read' }>).answer.nextCursor, undefined);
  assert.deepEqual(calls.map((c) => c.args), [{ includeRevoked: true }, { includeRevoked: true, cursor: 'cursor-0001' }]);
  assert.ok(calls.every((c) => c.capability === 'access.grants.list'));
});

test('FD-351: a compact door is called through execute', async () => {
  const { call, calls } = pages(answer([]));
  const r = await readGrants({ key: 'writer.cloud', look: look({ compact: { execute: 'writer.execute' } }), readToken: () => 't', version: '0.0.0', call });
  assert.equal(r.state, 'read');
  assert.deepEqual(calls[0].opts, { execute: 'writer.execute' });
});

test('FD-351: an answer for another issuer, or one that breaks the shape, is refused whole', async () => {
  const other = await readGrants({ key: 'writer.cloud', look: look({ capabilities: ['access.grants.list'] }), readToken: () => 't', version: '0.0.0', call: pages(answer([], { issuer: 'media.default' })).call });
  assert.equal(other.state, 'refused');
  assert.match((other as { why: string }).why, /not the service asked/);
  const broken = await readGrants({ key: 'writer.cloud', look: look({ capabilities: ['access.grants.list'] }), readToken: () => 't', version: '0.0.0', call: pages(answer([grant('g1', { issued: { at: AT, by: 'agent', via: 'dashboard' } })])).call });
  assert.equal(broken.state, 'refused', 'FAC-SEM-185: an agent decision comes through its call');
  const second = await readGrants({ key: 'writer.cloud', look: look({ capabilities: ['access.grants.list'] }), readToken: () => 't', version: '0.0.0', call: pages(answer([grant('g1')], { nextCursor: 'cursor-0001' }), { protocol: 'other' }).call });
  assert.equal(second.state, 'refused', 'a broken second page refuses the whole read');
});

test('FD-351: an unknown operation behind a compact door is not declared; a declared one that fails is unreadable', async () => {
  const compact = await readGrants({ key: 'writer.cloud', look: look({ compact: { execute: 'writer.execute' } }), readToken: () => 't', version: '0.0.0', call: pages(new Error('unknown operation access.grants.list')).call });
  assert.deepEqual(compact, { key: 'writer.cloud', state: 'not-declared' });
  const declared = await readGrants({ key: 'writer.cloud', look: look({ capabilities: ['access.grants.list'] }), readToken: () => 't', version: '0.0.0', call: pages(new Error('unknown operation access.grants.list')).call });
  assert.equal(declared.state, 'unreadable');
  const down = await readGrants({ key: 'writer.cloud', look: look({ compact: { execute: 'writer.execute' } }), readToken: () => 't', version: '0.0.0', call: pages(new Error('connect ECONNREFUSED 127.0.0.1:47123')).call });
  assert.equal(down.state, 'unreadable', 'a refused connection is not "not declared"');
});

test('FD-351: a token that cannot be read is said, and nothing is called', async () => {
  const { call, calls } = pages(answer([]));
  const r = await readGrants({ key: 'writer.cloud', look: { descriptor: { origin: ORIGIN, auth: { tokenFile: '/nope' } }, wellKnown: look({ capabilities: ['access.grants.list'] }).wellKnown }, readToken: () => { throw new Error('ENOENT'); }, version: '0.0.0', call });
  assert.equal(r.state, 'unreadable');
  assert.match((r as { why: string }).why, /token could not be read/);
  assert.equal(calls.length, 0);
});

test('FD-351: past the page limit the read stops and says what it left', async () => {
  const many = Array.from({ length: GRANT_PAGES + 2 }, (_, i) => answer([grant(`g${i}`)], { nextCursor: `cursor-${String(i).padStart(4, '0')}` }));
  const { call, calls } = pages(...many);
  const r = await readGrants({ key: 'writer.cloud', look: look({ capabilities: ['access.grants.list'] }), readToken: () => 't', version: '0.0.0', call });
  assert.equal(calls.length, GRANT_PAGES);
  const read = (r as Extract<GrantsRead, { state: 'read' }>).answer;
  assert.equal(read.grants.length, GRANT_PAGES);
  assert.ok(read.degraded?.some((d) => /not read/.test(d)));
});

test('FD-351: an agent holds what names it as holder; it is opened by what names it as subject or by its own grants', () => {
  const reads: GrantsRead[] = [
    { key: 'writer.cloud', state: 'read', answer: answer([
      grant('k1'),
      grant('k2', { holder: { kind: 'unresolved', label: 'media service' } }),
    ]) },
    { key: 'fabric.default', state: 'read', answer: answer([
      grant('a1', { holder: { kind: 'agent', agent: 'media.default' }, subject: { kind: 'agent', agent: 'writer.cloud' } }),
      grant('a2', { holder: { kind: 'agent', agent: 'writer.cloud' }, subject: { kind: 'account', provider: 'openrouter', ref: 'acct-1' } }),
    ], { issuer: 'fabric.default' }) },
    { key: 'stores.default', state: 'not-declared' },
  ];
  const media = accessOf('media.default', reads);
  assert.deepEqual(media.holds.map((h) => `${h.issuer}/${h.grant.id}`), ['writer.cloud/k1', 'fabric.default/a1']);
  assert.deepEqual(media.grantedTo, [], 'an unresolved label is never matched to an agent');
  const writer = accessOf('writer.cloud', reads);
  assert.deepEqual(writer.holds.map((h) => h.grant.id), ['a2']);
  assert.deepEqual(writer.grantedTo.map((h) => `${h.issuer}/${h.grant.id}`), ['writer.cloud/k1', 'writer.cloud/k2', 'fabric.default/a1']);
});
