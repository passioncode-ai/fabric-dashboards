// FD-110: a service's declared actions (contract DEC-0121, extensions/actions/0.1): the declaration's schema and
// FAC-SEM-142, each run on the contract's own fixtures and vectors.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ACTIONS_EXTENSION, actionsOf } from '../src/actions';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/contract');
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8')) as Record<string, unknown>;
const doc = (value: unknown, surfaces: unknown = {}) => ({ surfaces, extensions: { [ACTIONS_EXTENSION]: value } });

test('DEC-0121 (FAC-SEM-142): the contract\'s positive declaration reads; each negative declares nothing and is reported', () => {
  const ok = actionsOf(doc(fixture('positive_service-actions-extension')));
  assert.equal(ok.declared, true);
  assert.equal(ok.reported, false);
  assert.ok(ok.actions.length > 0);
  assert.deepEqual(ok.findings, []);
  for (const name of ['empty', 'extra-member', 'page-only', 'unknown-gate', 'unknown-step']) {
    const v = actionsOf(doc(fixture(`negative_service-actions-extension-${name}`)));
    assert.equal(v.declared, false, name);
    assert.equal(v.reported, true, name);
    assert.deepEqual(v.actions, [], name);
    assert.equal(v.findings.length, 1, name);
    assert.ok(v.errors.length > 0, name);
  }
});

test('DEC-0121 (FAC-SEM-142): every vector of the contract\'s declarations finds exactly its instance paths', () => {
  const vectors = fixture('vectors_actions') as { declarations: { name: string; input: unknown; findings: string[] }[] };
  assert.ok(vectors.declarations.length >= 11);
  for (const v of vectors.declarations) {
    assert.deepEqual(actionsOf(v.input).findings.map((f) => f.instancePath), v.findings, v.name);
  }
});

test('DEC-0121 (FAC-SEM-142): the semantic well-known fixtures expect a finding exactly when the reader finds one', () => {
  const names = fs.readdirSync(FIXTURES).filter((f) => f.startsWith('semantic_service-well-known-actions-')).map((f) => f.slice(0, -5));
  assert.equal(names.length, 7);
  for (const name of names) {
    const f = fixture(name) as { expect: string[]; input: unknown };
    const found = actionsOf(f.input).findings;
    assert.equal(found.length > 0, f.expect.includes('FAC-SEM-142'), name);
    for (const one of found) assert.equal(one.code, 'FAC-SEM-142', name);
  }
  const ok = actionsOf((fixture('semantic_service-well-known-actions-ok') as { input: unknown }).input);
  assert.equal(ok.declared, true);
  assert.ok(ok.actions.every((a) => ['none', 'relayed', 'human'].includes(a.gate)));
});

test('FD-110: absent is not declared and not reported; anything not a document declares nothing', () => {
  assert.deepEqual(actionsOf({ extensions: {} }), { declared: false, reported: false, actions: [], errors: [], findings: [] });
  assert.equal(actionsOf(null).declared, false);
  assert.equal(actionsOf({ extensions: { constructor: 1 } }).declared, false);
  const tooLong = actionsOf(doc({ actions: [{ id: 'a', title: 'x'.repeat(81), tool: 'jobs.retry', gate: 'none' }] }));
  assert.equal(tooLong.reported, true);
  assert.ok(tooLong.errors.some((e) => e.startsWith('/actions/0/title')));
});

test('DEC-0142 (contract v0.1.0+2026-10-27.3): a human step of kind comparison reads; an unknown step is still refused', () => {
  const base = fixture('positive_service-well-known-actions');
  const ext = (base.extensions as Record<string, { actions: Record<string, unknown>[] }>)[ACTIONS_EXTENSION]!;
  const human = ext.actions.find((a) => a.gate === 'human');
  assert.ok(human, 'the positive fixture declares a human action');
  const withStep = (step: string) => ({ ...base, extensions: { [ACTIONS_EXTENSION]: { ...ext, actions: ext.actions.map((a) => (a === human ? { ...a, humanStep: step } : a)) } } });
  const read = actionsOf(withStep('comparison'));
  assert.deepEqual(read.findings, []);
  assert.equal(read.actions.find((a) => a.id === human.id)?.humanStep, 'comparison');
  assert.equal(actionsOf(withStep('telepathy')).declared, false);
});
