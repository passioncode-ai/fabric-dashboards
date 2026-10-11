// DEC-0036 ED-9: the embedded dashboard profile's declaration in the well-known document
// (fabric-agent-contract PR #27, docs/specification/embedded-dashboard.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fetchWellKnown } from '../src/health';
import { DASHBOARD_EXTENSION, DASHBOARD_MIN_WIDTH, dashboardMinWidth, type WellKnown } from '../src/protocol';

const WELL_KNOWN: WellKnown = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../test/fixtures/contract/positive_service-well-known.json'), 'utf8'));
const declaring = (decl: unknown): WellKnown => ({ ...WELL_KNOWN, extensions: { [DASHBOARD_EXTENSION]: decl } });

test('ED-9: the key and the bounds are the contract\'s', () => {
  assert.equal(DASHBOARD_EXTENSION, 'https://fabric.passioncode.ai/agent-contract/extensions/dashboard/0.1');
  assert.deepEqual(DASHBOARD_MIN_WIDTH, { min: 360, max: 1280 });
});

test('ED-9: a declared minWidth in 360…1280 is the dashboard\'s floor', () => {
  assert.equal(dashboardMinWidth(declaring({ minWidth: 720 })), 720);
  assert.equal(dashboardMinWidth(declaring({ minWidth: 360, appearance: ['scheme'], themes: ['graphite'], kit: 'fabric-dashboard-kit@1.0.0' })), 360);
  assert.equal(dashboardMinWidth(declaring({ minWidth: 1280 })), 1280);
});

test('ED-9: no declaration, or an invalid one, is a legacy dashboard (null)', () => {
  assert.equal(dashboardMinWidth(WELL_KNOWN), null);
  assert.equal(dashboardMinWidth(null), null);
  assert.equal(dashboardMinWidth(undefined), null);
  assert.equal(dashboardMinWidth({ ...WELL_KNOWN, extensions: { 'https://example.com/other/1': { minWidth: 720 } } }), null);
  for (const bad of [240, 359, 1281, 2000, 720.5, '720', 'x', null, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(dashboardMinWidth(declaring({ minWidth: bad })), null, `minWidth ${String(bad)}`);
  }
  for (const bad of [null, 720, 'x', [], [{ minWidth: 720 }], {}]) {
    assert.equal(dashboardMinWidth(declaring(bad)), null, `declaration ${JSON.stringify(bad)}`);
  }
  assert.equal(dashboardMinWidth({ extensions: [] as unknown as Record<string, unknown> }), null);
  assert.equal(dashboardMinWidth({ extensions: 'x' as unknown as Record<string, unknown> }), null);
});

test('ED-9: extensions reach the reader as the service sent them, through the health probe', async () => {
  const doc = declaring({ minWidth: 720, appearance: ['scheme', 'theme'] });
  const s = http.createServer((_req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(doc)); });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  try {
    const answer = await fetchWellKnown(`http://127.0.0.1:${(s.address() as AddressInfo).port}`);
    assert.equal(answer.kind, 'answer');
    assert.equal(answer.kind === 'answer' ? dashboardMinWidth(answer.doc) : 'not an answer', 720);
  } finally {
    await new Promise<void>((r) => s.close(() => r()));
  }
});
