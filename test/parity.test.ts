// FD-249: every channel of the window has an agent's route, or says why not (North Star principle 13).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CHANNELS } from '../src/core/api';
import { PARITY } from '../src/core/parity';

test('FD-249: every window channel names its agent route; every tool named is one the MCP server serves', () => {
  assert.deepEqual(Object.keys(PARITY).sort(), Object.keys(CHANNELS).sort(), 'a channel added without a route (or a stale one) fails here');
  const served = new Set([...fs.readFileSync(path.join(__dirname, '..', 'src', 'mcp', 'schema.ts'), 'utf8').matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1]));
  for (const [channel, route] of Object.entries(PARITY)) {
    if ('tool' in route) assert.ok(served.has(route.tool), `${channel}: the MCP server serves no ${route.tool}`);
    if ('gap' in route) assert.match(route.gap, /^FD-\d+: /, `${channel}: a gap names its backlog row`);
  }
  const gaps = Object.values(PARITY).filter((r) => 'gap' in r).length;
  assert.ok(gaps <= 2, `the gaps only shrink: ${gaps}`);
});

test('FD-348: Help opens only its two fixed addresses: the support mailbox with the app and version, and the privacy page', async () => {
  const { helpUrl } = await import('../src/core/help');
  assert.equal(helpUrl('support', '0.8.215'), 'mailto:support@passioncode.ai?subject=Fabric%20Dashboards%200.8.215');
  assert.equal(helpUrl('privacy', '0.8.215'), 'https://passioncode.ai/privacy/');
  for (const other of ['terms', 'https://evil.example', '', null, { kind: 'support' }]) assert.equal(helpUrl(other, '1'), null, String(other));
});
