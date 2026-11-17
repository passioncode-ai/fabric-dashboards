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
  assert.match(text, /Acme yours Agents: 2 · running: 1 · need attention: 1 · Spent today: \$1\.50/);
  assert.match(text, /Globex \(client\)/);
  assert.match(text, /Context not reported Agents: 1/);
  assert.match(text, /No agent reports how many people it serves yet/);
});

test('FD-296: a context whose agents report no usage, or could not be read, is never a measured $0', () => {
  const none = [{ key: 'b.default', kind: 'none' }, { key: 'd.default', kind: 'error', error: 'x' }, ...spend] as unknown as SpendEntry[];
  const v = machineView(services, none);
  const [acme, globex, other] = v.contexts;
  assert.equal(acme!.spendState, 'reported');
  assert.equal(acme!.spendToday?.costUsd, 1.5);
  assert.equal(globex!.spendState, 'reported');
  assert.equal(other!.spendState, 'unknown', 'its one agent did not answer');
  assert.equal(other!.spendToday, null);
  assert.equal(v.totals.spendState, 'reported');
  assert.equal(v.totals.spendToday?.partial, true, 'an unread agent makes the total a lower bound');
  const quiet = machineView(services, [{ key: 'a.default', kind: 'none' }] as SpendEntry[]);
  assert.deepEqual(quiet.contexts.map((c) => [c.spendState, c.spendToday]), [['none', null], ['none', null], ['none', null]]);
  assert.equal(quiet.totals.spendState, 'none');
  assert.equal(machineView(services).totals.spendState, 'unread');
  const status = { services: services.map((s) => ({ ...s, descriptor: { id: s.key.split('.')[0]!, instance: 'default', name: s.key } })), organizations: [] };
  const render = (entries: SpendEntry[], lang: 'en' | 'ru') => renderToStaticMarkup(React.createElement(LangContext.Provider, { value: lang }, React.createElement(MachinePage, { status: status as never, onOpen: () => undefined, spend: entries }))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.doesNotMatch(render([{ key: 'a.default', kind: 'none' }] as SpendEntry[], 'en'), /\$0\.00/);
  assert.match(render([{ key: 'a.default', kind: 'none' }] as SpendEntry[], 'en'), /Spent today not reported/);
  assert.match(render([{ key: 'a.default', kind: 'error', error: 'x' }] as SpendEntry[], 'ru'), /Потрачено сегодня неизвестно/);
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

test('FD-285 wave 2: health rows are worst first, list only checks that are not ok, worst first, and count open episodes', async () => {
  const { healthRows } = await import('../src/core/agent-health');
  const ep = { key: 'k', openedAt: 1, state: 'warn' as const };
  const book = {
    'fabric-switchboard': { readAt: 1_763_000_000_000, read: { state: 'warn' as const }, version: '0.7.111', at: 1, checks: [
      { id: 'owner', area: 'lifecycle', state: 'ok' as const, count: 0 },
      { id: 'errors_today', area: 'errors', state: 'warn' as const, count: 584 },
      { id: 'crashes', area: 'crash', state: 'fail' as const, count: 1, fix: { tool: 'switchboard_bugs' } },
    ], causes: { errors_today: { bad: 2, good: 0, episode: ep }, crashes: { bad: 1, good: 0 }, owner: { bad: 0, good: 3, episode: { ...ep, closedAt: 2 } } } },
    quiet: { readAt: 2, read: { state: 'unknown' as const, reason: 'no-answer' as const }, checks: [{ id: 'x', area: 'errors', state: 'fail' as const, count: 9 }], causes: {} },
    fine: { readAt: 3, read: { state: 'ok' as const }, checks: [], causes: {} },
  };
  const rows = healthRows(book as never, (p) => (p === 'fabric-switchboard' ? 'Switchboard' : p));
  assert.deepEqual(rows.map((r) => [r.name, r.state, r.open]), [['Switchboard', 'warn', 1], ['quiet', 'unknown', 0], ['fine', 'ok', 0]]);
  assert.deepEqual(rows[0]!.checks, [
    { id: 'crashes', area: 'crash', state: 'fail', count: 1, fix: 'tool switchboard_bugs' },
    { id: 'errors_today', area: 'errors', state: 'warn', count: 584 },
  ]);
  assert.deepEqual(rows[1]!.checks, [], 'an unread report shows no stale checks');
  assert.equal(rows[1]!.reason, 'no-answer');
});

test('FD-285 wave 2: the page shows each product\'s report, its checks, fix and why a report was not read, and nothing without reports', () => {
  const base = { services: [], organizations: [] };
  const health = [
    { product: 'fabric-switchboard', name: 'Switchboard', state: 'warn', version: '0.7.111', readAt: Date.UTC(2026, 10, 17, 9, 30), open: 1, checks: [{ id: 'errors_today', area: 'errors', state: 'warn', count: 584, fix: 'tool switchboard_bugs' }] },
    { product: 'other', name: 'Other', state: 'unknown', reason: 'schema', readAt: 1, open: 0, checks: [] },
  ];
  const render = (status: unknown, lang: 'en' | 'ru') => renderToStaticMarkup(React.createElement(LangContext.Provider, { value: lang }, React.createElement(MachinePage, { status: status as never, onOpen: () => undefined, spend: [] }))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const en = render({ ...base, health }, 'en');
  assert.match(en, /Agent health reports/);
  assert.match(en, /Switchboard 0\.7\.111 warning · read at .* · open episodes: 1/);
  assert.match(en, /errors_today warning · area: errors, count: 584 · fix: tool switchboard_bugs/);
  assert.match(en, /Other no report .* Its report could not be read: not in the agent-health\/1 format/);
  assert.match(render({ ...base, health }, 'ru'), /Отчёты агентов о здоровье.*предупреждение.*Отчёт не прочитан: не в формате agent-health\/1/);
  assert.doesNotMatch(render(base, 'en'), /Agent health reports/);
});

test('FD-298: an agent\'s Health tab shows its own report, without its name, and the page hands it the row for its key', async () => {
  const { HealthEntry } = await import('../src/renderer/components/HealthReport');
  const h = { product: 'example-agent.default', name: 'Example', state: 'fail', version: '1.2.0', readAt: Date.UTC(2026, 10, 17, 9, 30), open: 1, checks: [{ id: 'queue', area: 'work', state: 'fail', count: 7 }] };
  const render = (props: unknown, lang: 'en' | 'ru') => renderToStaticMarkup(React.createElement(LangContext.Provider, { value: lang }, React.createElement(HealthEntry, props as never))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const own = render({ h, name: false }, 'en');
  assert.doesNotMatch(own, /Example/, 'the agent\'s own page does not name it again');
  assert.match(own, /1\.2\.0 failing · read at .* · open episodes: 1/);
  assert.match(own, /queue failing · area: work, count: 7/);
  assert.match(render({ h }, 'en'), /Example 1\.2\.0 failing/);
  assert.match(render({ h: { ...h, state: 'unknown', reason: 'FAC-SEM-181', checks: [] }, name: false }, 'ru'), /Отчёт не прочитан/);
  const view = fs.readFileSync(path.join(__dirname, '../src/renderer/components/ServiceView.tsx'), 'utf8');
  assert.match(view, /\{report && \([\s\S]*?t\('health\.report'\)[\s\S]*?<HealthEntry h=\{report\} name=\{false\} \/>/);
  const app = fs.readFileSync(path.join(__dirname, '../src/renderer/App.tsx'), 'utf8');
  assert.match(app, /health=\{status\.health\?\.find\(\(h\) => h\.product === current\.key\)\}/);
});
