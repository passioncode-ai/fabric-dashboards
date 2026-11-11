// Scenario walk 2026-11-11 (SCN-068): the well-known `configuration` is checked before anything draws it; an invalid
// one reads as absent, so a malformed answer cannot blank the window.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { configurationOf, configurationProblem } from '../src/configuration';
import { fetchWellKnown } from '../src/health';

const WELL_KNOWN = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../test/fixtures/contract/positive_service-well-known.json'), 'utf8'));

test('SCN-068: a valid configuration is kept, with only its known fields', () => {
  const c = { slots: ['runner', 'model'], resolved: { from: 'agent', runnerKind: 'claude-code', route: 'subscription', models: ['m1'], extra: 1 } };
  assert.deepEqual(configurationOf({ configuration: c }), { slots: ['runner', 'model'], resolved: { from: 'agent', runnerKind: 'claude-code', route: 'subscription', models: ['m1'] } });
  assert.deepEqual(configurationOf({ configuration: { slots: [] } }), { slots: [], resolved: {} }, 'resolved may be absent');
  assert.equal(configurationOf({}), undefined);
  assert.equal(configurationOf(null), undefined);
});

test('SCN-068: an invalid configuration is absent, and the reason is named', () => {
  for (const bad of [
    null, 'x', [], { slots: 'runner' }, { slots: ['runner', 'cpu'] }, { slots: ['model'], resolved: [] },
    { slots: ['model'], resolved: { models: 'm1' } }, { slots: ['model'], resolved: { models: [1] } },
    { slots: ['runner'], resolved: { from: 'somewhere' } }, { slots: ['runner'], resolved: { route: 'card' } },
    { slots: ['runner'], resolved: { runnerKind: 3 } },
  ]) {
    assert.equal(configurationOf({ configuration: bad }), undefined, JSON.stringify(bad));
    assert.notEqual(configurationProblem(bad), null, JSON.stringify(bad));
  }
});

test('SCN-068: the probe hands a reader no invalid configuration, and keeps a valid one', async () => {
  let configuration: unknown = { slots: 'runner', resolved: { models: 'one' } };
  const s = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ...WELL_KNOWN, configuration })); });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  try {
    const bad = await fetchWellKnown(origin);
    assert.equal(bad.kind, 'answer', 'a bad configuration does not make the service another program');
    assert.equal(bad.kind === 'answer' && Object.hasOwn(bad.doc, 'configuration'), false);
    configuration = { slots: ['model'], resolved: { models: ['m1'] } };
    const good = await fetchWellKnown(origin);
    assert.deepEqual(good.kind === 'answer' && good.doc.configuration, { slots: ['model'], resolved: { models: ['m1'] } });
  } finally {
    await new Promise<void>((r) => { s.closeAllConnections(); s.close(() => r()); });
  }
});
