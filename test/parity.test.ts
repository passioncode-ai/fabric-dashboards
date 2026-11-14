// FD-249: every channel of the window has an agent's route, or says why not (North Star principle 13).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CHANNELS } from '../src/core/api';
import { PARITY } from '../src/core/parity';

test('FD-249: every window channel names its agent route; every tool named is one the MCP server serves', () => {
  assert.deepEqual(Object.keys(PARITY).sort(), Object.keys(CHANNELS).sort(), 'a channel added without a route (or a stale one) fails here');
  const served = new Set([...fs.readFileSync(path.join(__dirname, '..', 'src', 'mcp', 'server.ts'), 'utf8').matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1]));
  for (const [channel, route] of Object.entries(PARITY)) {
    if ('tool' in route) assert.ok(served.has(route.tool), `${channel}: the MCP server serves no ${route.tool}`);
    if ('gap' in route) assert.match(route.gap, /^FD-\d+: /, `${channel}: a gap names its backlog row`);
  }
  const gaps = Object.values(PARITY).filter((r) => 'gap' in r).length;
  assert.ok(gaps <= 2, `the gaps only shrink: ${gaps}`);
});
