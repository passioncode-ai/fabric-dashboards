// FD-52 (SCN-116): This computer, what it gives each context (docs/design/2026-11-15-organizations-and-this-machine.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { machineView } from '../src/core/machine-view';
import { MachinePage } from '../src/renderer/components/MachinePage';
import { LangContext } from '../src/renderer/lib';
import { setWording } from '../src/core/i18n';
import type { SpendEntry } from '../src/core/spend';

(globalThis as { React?: unknown }).React = React;
setWording('other');
const acme = { name: 'acme', label: 'Acme', personal: true };
const globex = { name: 'globex', label: 'Globex' };
const services = [
  { key: 'a.default', state: 'ready' as const, organization: acme },
  { key: 'b.default', state: 'down' as const, organization: acme },
  { key: 'c.default', state: 'degraded' as const, organization: globex },
  { key: 'd.default', state: 'stopped' as const, organization: null },
];
const day = { calls: 3, inputTokens: 1, outputTokens: 1, costUsd: 1.5, estimateUsd: 0, estimatePartial: false, subscriptionCalls: 0, partial: false, tokensPartial: false };
const spend = [
  { key: 'a.default', kind: 'report', summary: { today: day, week: day, month: day } },
  { key: 'c.default', kind: 'report', summary: { today: { ...day, costUsd: 0.25 }, week: day, month: day } },
] as unknown as SpendEntry[];

test('FD-52: the view sums per context: personal first, then by label, then no context; running, attention and spend today', () => {
  const v = machineView(services, spend);
  assert.deepEqual(v.contexts.map((c) => [c.name, c.agents, c.running, c.attention, c.stopped, c.confirmed]), [['acme', 2, 1, 1, 0, false], ['globex', 1, 1, 1, 0, false], ['', 1, 0, 0, 1, false]]);
  assert.deepEqual([v.totals.agents, v.totals.running, v.totals.attention, v.totals.stopped], [4, 2, 2, 1]);
  assert.equal(v.contexts[0]!.spendToday?.costUsd, 1.5);
  assert.equal(v.totals.spendToday?.costUsd, 1.75);
  assert.equal(machineView(services).totals.spendToday, null, 'before the reports are read');
  assert.equal(machineView([{ key: 'x', state: 'ready', organization: { name: 'globex' } }], null, 'globex').contexts[0]!.personal, true, 'the personal one by the map\'s name too');
});

test('FD-52: the page shows the totals, a section per context with its counts and agents, and the person\'s own labels', () => {
  const status = { services: services.map((s) => ({ ...s, descriptor: { id: s.key.split('.')[0]!, instance: 'default', name: s.key.split('.')[0]!.toUpperCase() } })), organizations: [acme, globex] };
  const html = renderToStaticMarkup(React.createElement(LangContext.Provider, { value: 'en' }, React.createElement(MachinePage, { status: status as never, onOpen: () => undefined, spend, labels: { globex: 'Globex (client)' } })));
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /Agents 4 Running 2 Need attention 2 Spent today \$1\.75/);
  assert.match(text, /Acme your own Agents: 2 · running: 1 · need attention: 1 · Spent today: \$1\.50/);
  assert.match(text, /Globex \(client\)/);
  assert.match(text, /Context not reported Agents: 1/);
  assert.match(text, /No agent reports how many people it serves yet/);
});

test('FD-52: This computer is a page Restart to update can reopen', async () => {
  const policy = await import('../src/electron/policy');
  const parse = (policy as unknown as Record<string, (x: unknown) => unknown>);
  const fn = Object.values(parse).find((f) => typeof f === 'function' && /machine/.test(f.toString()) && /sessions/.test(f.toString())) as ((x: unknown) => unknown) | undefined;
  assert.ok(fn, 'the resume route reader knows the page');
  const src = fs.readFileSync(path.join(import.meta.dirname, '..', 'src/electron/policy.ts'), 'utf8');
  assert.match(src, /page === 'machine'/);
});

test('FD-52: MCP this_machine sums the installed agents per context, unconfirmed, with no people', async () => {
  const tools = await import('../src/mcp/tools');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-machine-'));
  const dirServices = path.join(dir, 'services');
  fs.mkdirSync(dirServices);
  fs.writeFileSync(path.join(dir, 'organizations.json'), JSON.stringify({ readAt: '2026-11-15T10:00:00Z', byRepository: {}, organizations: { acme: 'Acme' }, personal: 'acme' }));
  const out = await tools.thisMachine({ servicesDir: () => dirServices, settingsFile: () => path.join(dir, 'settings.json'), wellKnown: async () => ({ ok: false }), launchd: async () => ({ code: 0, stdout: '', stderr: '' }), now: () => 0 } as never);
  assert.deepEqual(out.totals, { agents: 0, running: 0, attention: 0, stopped: 0 });
  assert.deepEqual(out.contexts, []);
  assert.equal(out.people, null);
});
