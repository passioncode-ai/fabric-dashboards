// FD-351, contract DEC-0187: the host reads every product's `access-grants/1` answer the same way. The contract's own
// fixtures (test/fixtures/contract, byte-identical, SOURCE.txt) are the cases; the hand-made ones below each break one
// rule of FAC-SEM-185.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { checkAccessGrants, grantState, type AccessGrants } from '../src/access-grants';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/contract');
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8')) as Record<string, unknown>;
const good = () => fixture('positive_access-grants') as unknown as AccessGrants & Record<string, unknown>;

test('DEC-0187: the contract\'s positive answer reads whole, and its issuer is checked when the host asked one service', () => {
  assert.equal(checkAccessGrants(good()), null);
  assert.equal(checkAccessGrants(good(), { issuer: 'media-studio.default' }), null);
  assert.match(checkAccessGrants(good(), { issuer: 'other.default' })!, /not the service asked/);
});

test('DEC-0187: each negative fixture of the contract is refused with its own reason', () => {
  const cases: [string, RegExp][] = [
    ['negative_access-grants-free-label-holder', /holder\.agent is not a service key/],
    ['negative_access-grants-key-value', /keyPrefix is not part of access-grants\/1/],
    ['negative_access-grants-person-label', /holder: label is not part/],
    ['negative_access-grants-ref-email', /holder\.ref is not an opaque reference/],
    ['negative_access-grants-unknown-protocol', /not access-grants\/1/],
  ];
  for (const [name, why] of cases) assert.match(checkAccessGrants(fixture(name)) ?? 'accepted', why, name);
});

test('FAC-SEM-185: duplicate ids, a ceiling without its window, an agent act without its agent and times out of order are refused', () => {
  const g = good();
  const twice = { ...g, grants: [g.grants[0], g.grants[0]] };
  assert.match(checkAccessGrants(twice)!, /appears twice/);
  const noWindow = good(); delete (noWindow.grants[0] as Record<string, unknown>).limitPeriod;
  assert.match(checkAccessGrants(noWindow)!, /limitPeriod is present exactly when/);
  const lonelyWindow = good(); (lonelyWindow.grants[1] as Record<string, unknown>).limitPeriod = 'day';
  assert.match(checkAccessGrants(lonelyWindow)!, /limitPeriod is present exactly when/);
  const noCaller = good(); delete (noCaller.grants[0]!.issued as unknown as Record<string, unknown>).agent;
  assert.match(checkAccessGrants(noCaller)!, /names that agent/);
  const agentByConfig = good(); agentByConfig.grants[2]!.issued.by = 'agent';
  assert.match(checkAccessGrants(agentByConfig)!, /came through its call/);
  const future = good(); future.grants[0]!.issued.at = '2026-12-01T00:00:00Z';
  assert.match(checkAccessGrants(future)!, /after generatedAt/);
  const early = good(); early.grants[2]!.revoked!.at = '2026-09-01T00:00:00Z';
  assert.match(checkAccessGrants(early)!, /before issued\.at/);
  const backwards = good(); backwards.grants[0]!.expiresAt = '2026-11-01T00:00:00Z';
  assert.match(checkAccessGrants(backwards)!, /not after issued\.at/);
  // A spend above the ceiling is shown, never refused (AG-4).
  const over = good(); over.grants[0]!.spentDayUsd = 99;
  assert.equal(checkAccessGrants(over), null);
  for (const bad of [null, [], 'x', { protocol: 'access-grants/1' }]) assert.notEqual(checkAccessGrants(bad), null);
});

test('DEC-0187 AG-5: a grant reads revoked before expired, expired at its time, otherwise active', () => {
  const g = good();
  const now = Date.parse('2026-11-19T14:00:00Z');
  assert.equal(grantState(g.grants[0]!, now), 'active');
  assert.equal(grantState(g.grants[0]!, Date.parse('2027-02-12T09:30:00Z')), 'expired');
  assert.equal(grantState(g.grants[2]!, now), 'revoked');
  assert.equal(grantState({ ...g.grants[2]!, expiresAt: '2026-10-01T00:00:00Z' }, now), 'revoked');
});
