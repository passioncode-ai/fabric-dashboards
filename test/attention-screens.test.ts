// W2 on the screens (UX-01, UX-03, UX-07, UX-08, UX-12, UX-14, VIS-02, VIS-09, VIS-12, the empty state's one
// Set up button): Overview and the agent page's pieces rendered to markup, as the window draws them.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Overview } from '../src/renderer/components/Overview';
import { CompactActions, UnavailablePane } from '../src/renderer/components/ServiceActions';
import { groupProducts } from '../src/core/products';
import type { AppStatus, ServiceSnapshot } from '../src/core/types';
import { snap } from './snap';

// The renderer is compiled with the classic JSX runtime under tsx.
(globalThis as { React?: unknown }).React = React;
const noop = () => undefined;

function status(services: ServiceSnapshot[], extra: Partial<AppStatus> = {}): AppStatus {
  return { services, servicesDir: '/svc', dirError: null, scanning: false, unread: 0, update: { state: 'idle' }, estate: {} as AppStatus['estate'], version: '0.8.0', ...extra };
}
function overview(services: ServiceSnapshot[], props: Record<string, unknown> = {}, extra: Partial<AppStatus> = {}): string {
  return renderToStaticMarkup(React.createElement(Overview as never, { status: status(services, extra), products: groupProducts(services), open: noop, act: noop, goSpend: noop, agent: noop, ...props }));
}
const at = (html: string, needle: string) => { const i = html.indexOf(needle); assert.notEqual(i, -1, `missing ${needle}`); return i; };

test('VIS-12: Needs attention comes before "Since you were last here"; the strip\'s attention and down cells jump to it', () => {
  const visit = { since: '2026-10-23T08:00:00Z', added: ['bravo.default'], removed: [], alerts: [], continueKeys: [] };
  const html = overview([snap('alpha.default', 'down'), snap('bravo.default', 'ready')], { visit });
  assert.ok(at(html, 'id="attention-title"') < at(html, 'id="visit-title"'));
  assert.match(html, /<button[^>]*class="cell[^"]*bad[^"]*"[^>]*>.*?Not answering or in conflict/, 'the down cell is a button');
  assert.match(html, /<button[^>]*class="cell[^"]*attn[^"]*"[^>]*>.*?Need attention/, 'the attention cell is a button');
});

test('VIS-02: every action of a Needs attention row sits in one cell, so the row stays one line', () => {
  const html = overview([snap('alpha.default', 'down')]);
  const row = /<section class="attention"[\s\S]*?<li>([\s\S]*?)<\/li>/.exec(html)![1]!;
  const children = row.match(/<(span|button)[^>]*class="(state|linkish name|why|row-actions)[^"]*"/g) ?? [];
  assert.deepEqual(children.map((c) => /class="([^ "]+(?: name)?)/.exec(c)![1]), ['state', 'linkish name', 'why', 'row-actions']);
  assert.ok(at(row, '>Restart<') < at(row, '>Fix with coding agent<'), 'Restart before the paid fix');
});

test('UX-07: a folded row of agents down for one reason offers to restart them all', () => {
  const html = overview([snap('alpha.default', 'down'), snap('bravo.default', 'down'), snap('charlie.default', 'down')]);
  assert.match(html, /3 agents:/);
  assert.match(html, />Restart 3</);
});

test('UX-08: the visit section can be dismissed', () => {
  const visit = { since: '2026-10-23T08:00:00Z', added: ['alpha.default'], removed: [], alerts: [], continueKeys: [] };
  assert.match(overview([snap('alpha.default', 'ready')], { visit, onDismissVisit: noop }), />Dismiss</);
});

test('UX-06: a limit that stopped work is a Needs attention row with Open Spend', () => {
  const limits = { 'alpha.default': [{ id: 'daily', scope: 'machine', kind: 'daily', period: 'day', limitUsd: 5, spentUsd: 6, enforced: true, tripped: true, state: 'tripped', share: 1.2 }] };
  const html = overview([snap('alpha.default', 'ready')], {}, { limits } as Partial<AppStatus>);
  assert.match(html, /Its spending limit stopped work \(daily\)\./);
  assert.match(html, />Open Spend</);
});

test('the empty state shows no second Set up button while the setup card above offers Start', () => {
  assert.match(overview([], { onSetup: noop }), />Set up with my coding agent</, 'alone, the empty state offers it');
  assert.doesNotMatch(overview([], { onSetup: noop, setupCard: true }), />Set up with my coding agent</);
});

const compact = (s: ServiceSnapshot, problem = true) => renderToStaticMarkup(React.createElement(CompactActions, { s, problem, act: noop, runUpdate: noop, onAgent: noop, updateFailed: false }));

test('UX-01: the compact bar offers Restart or Start first, and Fix after it', () => {
  const down = compact(snap('alpha.default', 'down'));
  assert.ok(at(down, '>Restart<') < at(down, '>Fix<'));
  assert.match(down, /class="btn btn-sm btn-primary"[^>]*>Restart</);
  assert.match(compact(snap('alpha.default', 'stopped')), />Start</);
  assert.doesNotMatch(compact(snap('alpha.default', 'down', { busy: 'restart' })), />Restart</);
});

test('UX-03: an available update shows in the compact bar even when nothing is wrong', () => {
  assert.match(compact(snap('alpha.default', 'ready', { update: '2.0.0' }), false), />Update to 2\.0\.0</);
  assert.equal(compact(snap('alpha.default', 'ready'), false), '');
});

test('UX-12: the Dashboard tab of an agent that is off, starting or down says so, with its action', () => {
  const pane = (s: ServiceSnapshot) => renderToStaticMarkup(React.createElement(UnavailablePane, { s, act: noop, openLogs: noop }));
  const off = pane(snap('alpha.default', 'stopped'));
  assert.match(off, /Stopped by you/);
  assert.match(off, />Start</);
  assert.match(pane(snap('alpha.default', 'starting')), /Waiting for the first answer/);
  const down = pane(snap('alpha.default', 'down'));
  assert.match(down, /Not answering since/);
  assert.match(down, />Restart</);
  assert.match(down, />Logs</);
  assert.match(pane(snap('alpha.default', 'foreign')), /answers as itself/, 'a wrong program keeps the identity sentence');
});

// ServiceView and App import the brand's SVG files, which only the bundler reads: these two are read as source.
import { readFileSync } from 'node:fs';
const source = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('UX-14: the problem chip opens the card for this visit; only Show/Hide details changes the remembered header', () => {
  const view = source('src/renderer/components/ServiceView.tsx');
  const chip = /<button className="chip chip-problem"[^\n]*onClick=\{([^}]*\})/.exec(view)![1]!;
  assert.doesNotMatch(chip, /onToggleHeader/, 'the chip does not flip the saved preference');
  assert.match(chip, /setPeek\(true\)/);
});

test('VIS-02: the reason column keeps a floor; the row\'s actions share one cell', () => {
  const css = source('src/renderer/styles/app.css');
  assert.match(css, /\.attention li \{[^}]*grid-template-columns: max-content minmax\(120px, max-content\) minmax\(12ch, 1fr\) auto;/);
  assert.match(css, /\.attention li \.row-actions \{[^}]*white-space: nowrap;/);
});

test('UX-04, UX-05: the sidebar counts the attention queue and audits with the limits the main process holds; the rail shows an update', () => {
  const app = source('src/renderer/App.tsx');
  assert.match(app, /attentionQueue\(status\.services, \{[^}]*limits: status\.limits/);
  assert.match(app, /audit\(status\.services, status\.limits/);
  assert.doesNotMatch(app, /const problems = status\.services\.filter\(\(s\) => PROBLEM\.has/, 'no second, narrower count');
  assert.match(app, /className="nav-item nav-update"/, 'a folded rail still offers the app\'s own update');
});
