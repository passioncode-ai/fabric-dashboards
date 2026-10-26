// FD-121 (SCN-087, SCN-072): the sidebar's width and the person's own order of agents; the eye on a hidden row.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentsNav } from '../src/renderer/components/Navigation';
import { arrangeProducts, groupProducts, moveInSection } from '../src/core/products';
import { merge, sidebarWidth } from '../src/core/settings';
import { DEFAULT_SETTINGS, SIDEBAR_WIDTH, type AppStatus, type ListLayout, type ServiceSnapshot } from '../src/core/types';
import { snap } from './snap';

(globalThis as { React?: unknown }).React = React; // the renderer's JSX reads React from the scope

const noop = () => undefined;
const list = (patch: Partial<ListLayout> = {}): ListLayout => ({ ...DEFAULT_SETTINGS.layout.list, ...patch });
const products = groupProducts(['alpha', 'bravo', 'charlie', 'delta'].map((n) => snap(`${n}.default`, 'ready')));
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

test('FD-121: moving an agent freezes what the person sees into their own order and turns the sort to manual', () => {
  const arranged = arrangeProducts(products, list());
  assert.deepEqual(ids(arranged.local), ['alpha', 'bravo', 'charlie', 'delta']);
  const patch = moveInSection(arranged, 'local', 'delta', 0);
  assert.deepEqual(patch, { sort: 'manual', order: ['delta', 'alpha', 'bravo', 'charlie'] });
  assert.deepEqual(ids(arrangeProducts(products, list(patch!)).local), ['delta', 'alpha', 'bravo', 'charlie']);
});

test('FD-121: no move, an agent of another section, or a place past the end changes nothing or stays in bounds', () => {
  const arranged = arrangeProducts(products, list());
  assert.equal(moveInSection(arranged, 'local', 'bravo', 1), null, 'the same place');
  assert.equal(moveInSection(arranged, 'online', 'bravo', 0), null, 'not in that section');
  assert.equal(moveInSection(arranged, 'local', 'nobody', 0), null);
  assert.deepEqual(moveInSection(arranged, 'local', 'alpha', 99)?.order, ['bravo', 'charlie', 'delta', 'alpha'], 'past the end is the end');
  assert.deepEqual(moveInSection(arranged, 'local', 'delta', -5)?.order?.[0], 'delta', 'before the start is the start');
});

test('FD-121: within Pinned only the pin order changes; the sort of the rest stays', () => {
  const arranged = arrangeProducts(products, list({ pinned: ['alpha', 'bravo'] }));
  assert.deepEqual(moveInSection(arranged, 'pinned', 'bravo', 0), { pinned: ['bravo', 'alpha'] });
});

test('FD-121: a new agent arrives after the ones the person placed, by name; the other sorts ignore the order', () => {
  const withNew = groupProducts(['alpha', 'bravo', 'charlie', 'delta', 'aardvark'].map((n) => snap(`${n}.default`, 'ready')));
  const order = ['delta', 'bravo', 'alpha', 'charlie'];
  assert.deepEqual(ids(arrangeProducts(withNew, list({ sort: 'manual', order })).local), ['delta', 'bravo', 'alpha', 'charlie', 'aardvark']);
  assert.deepEqual(ids(arrangeProducts(withNew, list({ sort: 'name', order })).local), ['aardvark', 'alpha', 'bravo', 'charlie', 'delta'], 'By name again is by name');
});

test('FD-121: settings keep the order and the width; a damaged value reads as usable', () => {
  const s = merge({ layout: { sidebarWidth: 333, list: { sort: 'manual', order: ['delta', 'delta', 'BAD id', 'alpha'] } } });
  assert.equal(s.layout.sidebarWidth, 333);
  assert.equal(s.layout.list.sort, 'manual');
  assert.deepEqual(s.layout.list.order, ['delta', 'alpha'], 'each valid id once');
  for (const [raw, want] of [[undefined, SIDEBAR_WIDTH.default], ['wide', SIDEBAR_WIDTH.default], [Number.NaN, SIDEBAR_WIDTH.default], [10, SIDEBAR_WIDTH.min], [9999, SIDEBAR_WIDTH.max], [301.6, 302]] as const) {
    assert.equal(sidebarWidth(raw), want, String(raw));
  }
  assert.equal(merge({}).layout.sidebarWidth, 240, 'the width it had before it could change');
  assert.deepEqual(merge({ layout: { list: { sort: 'sideways' } } }).layout.list.sort, 'name');
});

function nav(services: ServiceSnapshot[], listPatch: Partial<ListLayout>, rail = false): string {
  const ps = groupProducts(services);
  const layout = { ...DEFAULT_SETTINGS.layout, list: list(listPatch) };
  const status = { services, unread: 0 } as unknown as AppStatus;
  return renderToStaticMarkup(React.createElement(AgentsNav, {
    page: 'overview', status, arranged: arrangeProducts(ps, layout.list), products: ps, currentProduct: undefined, layout, changeLayout: noop,
    open: noop, go: noop, rail, queue: 0, urgent: false, auditErrors: 0, hiddenProblem: false,
    menu: { pin: noop, hide: noop, kind: noop, isPinned: () => false, isHidden: (id: string) => (listPatch.hidden ?? []).includes(id), isService: () => false },
  }));
}

test('FD-121 (SCN-072): an open Hidden fold shows an eye per agent that brings it back; the rail does not', () => {
  const services = ['alpha', 'bravo', 'charlie'].map((n) => snap(`${n}.default`, 'ready'));
  const html = nav(services, { hidden: ['charlie'], hiddenOpen: true });
  assert.match(html, /<button class="pin-btn unhide-btn" title="Show Charlie again" aria-label="Show Charlie again">/);
  assert.equal((html.match(/unhide-btn/g) ?? []).length, 1, 'only the hidden row');
  assert.doesNotMatch(nav(services, { hidden: ['charlie'], hiddenOpen: true }, true), /unhide-btn/, 'the rail has no room for it');
});

test('FD-121 (SCN-087): rows drag within their section, say their keys, and the sort offers Your order', () => {
  const services = ['alpha', 'bravo', 'charlie'].map((n) => snap(`${n}.default`, 'ready'));
  const html = nav(services, {});
  assert.equal((html.match(/<div class="nav-row" draggable="true">/g) ?? []).length, 3);
  assert.equal((html.match(/aria-keyshortcuts="Alt\+ArrowUp Alt\+ArrowDown"/g) ?? []).length, 3);
  assert.match(html, /<option value="manual">Your order<\/option>/);
  assert.match(html, /role="status" aria-live="polite"/, 'a move is announced');
  const one = nav([snap('alpha.default', 'ready')], {});
  assert.doesNotMatch(one, /draggable="true"/, 'one agent has nowhere to go');
  assert.doesNotMatch(nav(services, {}, true), /draggable="true"/, 'the rail does not drag');
});

test('FD-121 (SCN-087): the edge is a named separator; holding it steps the dashboard and the console aside', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/renderer/App.tsx'), 'utf8');
  assert.match(app, /role="separator" aria-orientation="vertical" aria-label=\{t\('sidebar\.width'\)\}/);
  assert.match(app, /aria-valuenow=\{width\} aria-valuemin=\{SIDEBAR_WIDTH\.min\} aria-valuemax=\{SIDEBAR_WIDTH\.max\}/);
  assert.match(app, /overlayOpen=\{stopOpen \|\| resizing\}/, 'the native dashboard view steps aside');
  assert.match(app, /suspended: stopOpen \|\| menuOverPage \|\| resizing/, 'and the console drawer');
  assert.match(app, /onWidth\(last\.current, false\)/, 'moving shows, never writes');
  assert.match(app, /onWidth\(last\.current, true\)/, 'release writes once');
  assert.match(app, /onDoubleClick=\{\(\) => onWidth\(SIDEBAR_WIDTH\.default, true\)\}/);
  assert.match(app, /style=\{rail \? undefined : \{ gridTemplateColumns: `\$\{layout\.sidebarWidth\}px 1fr` \}\}/);
});
