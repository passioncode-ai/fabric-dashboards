// FD-273 (contract DEC-0173, CT-321): an instance's declared facts, read as the contract's reference reading does, on
// every case of its vectors; the hand-written schema check against the contract's schema's own enums and pattern.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { credentialShaped, INSTANCE_FACTS_EXTENSION, instanceFacts } from '../src/instance-facts';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/contract');
const vectors = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'vectors_instance-facts.json'), 'utf8')) as {
  key: string; cases: { name: string; descriptor: unknown; wellKnown: unknown; read: unknown }[];
};

test('DEC-0173 IF-5, IF-6: every case of the contract\'s vectors reads as the reference reading does', () => {
  assert.equal(vectors.key, INSTANCE_FACTS_EXTENSION);
  assert.ok(vectors.cases.length >= 34);
  for (const c of vectors.cases) assert.deepEqual(instanceFacts(c.descriptor, c.wellKnown), c.read, c.name);
});

test('DEC-0173: the hand-written schema check holds the schema\'s own enums and label pattern', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'schema_service-instance-facts-extension.json'), 'utf8'));
  const p = schema.properties;
  assert.deepEqual(p.access.properties.audience.enum, ['operator', 'organization', 'public']);
  assert.deepEqual(p.access.properties.entry.enum, ['host-signin', 'own-signin', 'none']);
  assert.deepEqual(p.tenancy.properties.mode.enum, ['single', 'per-organization', 'shared']);
  assert.deepEqual(p.space.properties.kind.enum, ['user', 'container', 'vm', 'system']);
  assert.equal(p.space.properties.account.pattern, '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  const d = (value: unknown) => ({ id: 'a', instance: 'default', origin: 'http://127.0.0.1:1', extensions: { [INSTANCE_FACTS_EXTENSION]: value } });
  assert.deepEqual(instanceFacts(d({ space: { kind: 'user', account: 'studio-1' } }), null).facts, { kind: 'user', account: 'studio-1' });
  for (const bad of [{ space: { account: 'x' } }, { tenancy: {} }, { access: { audience: 'everyone' } }, { space: { kind: 'user', account: '-x' } }, { extra: {} }, []]) {
    assert.deepEqual(instanceFacts(d(bad), null).invalid, ['descriptor'], JSON.stringify(bad));
  }
  // Labels: a name of a space reads; a key shape, a JWT and a long mixed run do not (built from pieces, never a key).
  assert.equal(credentialShaped('studio-1'), false);
  assert.equal(credentialShaped(['gh', 'p_', 'A1b2C3d4E5f6G7h8I9j0K1'].join('')), true);
  assert.equal(credentialShaped(['ey', 'Jab', '.cd', '.e'].join('')), true);
  assert.equal(credentialShaped('aB3'.repeat(14)), true);
});
