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

test('FD-348 (SCN-122): the review ask is due after the first agent session ends, shows once and never beside the setup card', async () => {
  const { helpUrl, ratingDueAfter, showRatingAsk } = await import('../src/core/help');
  const { merge, rendererSettingsPatch } = await import('../src/core/settings');
  assert.equal(helpUrl('review', '0.8.216'), 'mailto:support@passioncode.ai?subject=Fabric%20Dashboards%200.8.216%3A%20review');
  const fresh = { ratingDue: false, ratingAsked: false };
  assert.equal(ratingDueAfter('alpha.default', fresh), true, 'an agent session ending');
  assert.equal(ratingDueAfter('fabric-dashboards.setup', fresh), false, 'the Setup console is not the aha moment');
  assert.equal(ratingDueAfter('alpha.default', { ratingDue: true, ratingAsked: false }), false, 'written once');
  assert.equal(ratingDueAfter('alpha.default', { ratingDue: false, ratingAsked: true }), false, 'answered for good');
  const due = { ratingDue: true, ratingAsked: false };
  assert.equal(showRatingAsk(due, 1, false), true);
  assert.equal(showRatingAsk(fresh, 1, false), false, 'not before a session ended');
  assert.equal(showRatingAsk(due, 0, false), false, 'not with no agent listed');
  assert.equal(showRatingAsk(due, 1, true), false, 'not beside the setup card');
  assert.equal(showRatingAsk({ ratingDue: true, ratingAsked: true }, 1, false), false, 'never again once answered');
  // The page answers the ask but never marks it due; an earlier settings file reads as neither.
  assert.deepEqual(rendererSettingsPatch({ ratingDue: true, ratingAsked: true }), { ratingAsked: true });
  const old = merge({});
  assert.equal(old.ratingDue, false);
  assert.equal(old.ratingAsked, false);
  assert.equal(merge({ ratingDue: 'yes' as unknown as boolean }).ratingDue, false);
});
