// FD-123 (SCN-072): an agent turned off is kept on disk, never probed, never alerting, and greyed in Hidden.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Descriptor, WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { ActivityStore } from '../src/core/activity';
import { Monitor, type Notice } from '../src/core/monitor';
import { setOff, showAgain } from '../src/core/products';
import { merge } from '../src/core/settings';
import { DEFAULT_SETTINGS, type AppStatus, type Settings } from '../src/core/types';
import { AgentsNav } from '../src/renderer/components/Navigation';
import { arrangeProducts, groupProducts } from '../src/core/products';
import { tmp } from './helpers';
import { snap } from './snap';

(globalThis as { React?: unknown }).React = React;

const DESCRIPTOR = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract/positive_service-descriptor.json'), 'utf8')) as Descriptor;
const KEY = 'example-agent.default';

test('FD-123: turning off hides too; turning on keeps it hidden; showing again turns it on; nothing changing is null', () => {
  const none = { hidden: [], off: [] };
  assert.deepEqual(setOff(none, 'a', true), { off: ['a'], hidden: ['a'] });
  assert.deepEqual(setOff({ hidden: ['a'], off: ['a'] }, 'a', false), { off: [], hidden: ['a'] });
  assert.equal(setOff(none, 'a', false), null);
  assert.equal(setOff({ hidden: ['a'], off: ['a'] }, 'a', true), null);
  assert.deepEqual(showAgain({ hidden: ['a', 'b'], off: ['a'] }, 'a'), { hidden: ['b'], off: [] });
});

test('FD-123: a settings file that names an agent off but not hidden reads as hidden too', () => {
  const list = merge({ layout: { list: { off: ['a', 'a', 'BAD id'], hidden: ['b'] } } } as unknown as Partial<Settings>).layout.list;
  assert.deepEqual(list.off, ['a']);
  assert.deepEqual(list.hidden, ['b', 'a']);
  assert.deepEqual(merge({}).layout.list.off, []);
});

test('FD-123: the monitor never probes an agent turned off, never alerts about it, and starts it afresh when turned on', async () => {
  const base = tmp('fd-off-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify({ ...DESCRIPTOR, lifecycle: { manager: 'none' } }));
  let clock = 1_000_000;
  let probes = 0;
  let settings: Settings = DEFAULT_SETTINGS;
  const monitor = new Monitor({
    servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => settings, lang: () => 'en', now: () => clock,
    wellKnown: async (): Promise<WellKnownResult> => { probes += 1; return { kind: 'no-answer', detail: 'closed' }; },
  });
  const notices: Notice[] = [];
  monitor.on('notify', (n: Notice) => notices.push(n));
  await monitor.tick(true);
  assert.equal(probes, 1);
  assert.equal(monitor.snapshots().length, 1);
  settings = { ...DEFAULT_SETTINGS, layout: { ...DEFAULT_SETTINGS.layout, list: { ...DEFAULT_SETTINGS.layout.list, hidden: ['example-agent'], off: ['example-agent'] } } };
  monitor.listChanged();
  for (let i = 0; i < 40; i += 1) { clock += 60_000; await monitor.tick(); }
  await monitor.pollEvents();
  assert.equal(probes, 1, 'forty minutes off: not one probe');
  assert.deepEqual(notices, [], 'down for forty minutes, and no alert');
  assert.deepEqual(monitor.snapshots(), [], 'no count, badge or alert sees it');
  assert.equal(monitor.snapshot(KEY), null);
  assert.deepEqual(monitor.offServices(), [{ key: KEY, product: 'example-agent', name: DESCRIPTOR.name }]);
  settings = { ...settings, layout: { ...settings.layout, list: { ...settings.layout.list, off: [] } } };
  monitor.listChanged();
  await monitor.tick();
  assert.equal(probes, 2, 'probed at once when turned on');
  assert.equal(monitor.snapshot(KEY)?.firstUnansweredAt, new Date(clock).toISOString(), 'its outage starts now, not before it was off');
  assert.deepEqual(notices, []);
  assert.deepEqual(monitor.offServices(), []);
});

test('FD-123: Hidden counts the agents turned off and lists them greyed, with one button that turns each on', () => {
  const services = ['alpha', 'bravo'].map((n) => snap(`${n}.default`, 'ready'));
  const render = (rail: boolean, hiddenOpen = true) => {
    const ps = groupProducts(services);
    const layout = { ...DEFAULT_SETTINGS.layout, list: { ...DEFAULT_SETTINGS.layout.list, hidden: ['bravo', 'gone'], off: ['gone'], hiddenOpen } };
    const status = { services, off: [{ key: 'gone.default', product: 'gone', name: 'Gone Agent' }], unread: 0 } as unknown as AppStatus;
    const noop = () => undefined;
    return renderToStaticMarkup(React.createElement(AgentsNav, {
      page: 'overview', status, arranged: arrangeProducts(ps, layout.list), products: ps, currentProduct: undefined, layout, changeLayout: noop,
      open: noop, go: noop, rail, queue: 0, urgent: false, auditErrors: 0, hiddenProblem: false,
      menu: { pin: noop, hide: noop, setOff: noop, kind: noop, isPinned: () => false, isHidden: () => true, isService: () => false },
    }));
  };
  const html = render(false);
  assert.match(html, /Hidden: 2/);
  assert.match(html, /<div class="nav-item nav-off" title="Gone Agent is off: it is not watched and sends no alerts">/);
  assert.match(html, /<span class="off-word">Off<\/span>/);
  assert.match(html, /aria-label="Turn Gone Agent on"/);
  assert.doesNotMatch(render(true), /turn-on-btn/, 'the rail shows the name only');
  assert.doesNotMatch(render(false, false), /nav-off/, 'a folded Hidden lists nobody');
  assert.match(render(false, false), /Hidden: 2/);
});
