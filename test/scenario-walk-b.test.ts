// Scenario walk 2026-11-11, wave B: defects the walk found in health, Overview and the list, each held by a case here
// (SCN-006, SCN-056, SCN-059, SCN-072, SCN-089, SCN-095, SCN-099, SCN-100).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { mock } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Descriptor, Placement, RunResult, WellKnown, WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { attentionRank } from '@passioncode-ai/fabric-service-host/state';
import { ActivityStore } from '../src/core/activity';
import { attentionQueue } from '../src/core/attention';
import { allKeys, t } from '../src/core/i18n';
import { Launchd } from '../src/core/launchd';
import { Monitor, type Notice } from '../src/core/monitor';
import { arrangeProducts, groupProducts, moveInSection, offProducts } from '../src/core/products';
import { shownState, waitsForSetup } from '../src/core/setup-wait';
import { DEFAULT_SETTINGS, type AppStatus, type ServiceSnapshot } from '../src/core/types';
import { Overview, recheckEvery, SETUP_RECHECK_MS } from '../src/renderer/components/Overview';
import { tmp } from './helpers';
import { snap } from './snap';

(globalThis as { React?: unknown }).React = React;
const noop = () => undefined;

function status(services: ServiceSnapshot[], extra: Partial<AppStatus> = {}): AppStatus {
  return { services, servicesDir: '/svc', dirError: null, scanning: false, unread: 0, update: { state: 'idle' }, estate: {} as AppStatus['estate'], version: '0.8.0', ...extra };
}
const overview = (services: ServiceSnapshot[], props: Record<string, unknown> = {}, extra: Partial<AppStatus> = {}) =>
  renderToStaticMarkup(React.createElement(Overview as never, { status: status(services, extra), products: groupProducts(services), open: noop, act: noop, goSpend: noop, agent: noop, ...props }));

// --- 1. SCN-089, SCN-099, SCN-006: Restart on Overview only where the agent page offers it --------------------------
const elsewhere = (key: string) => snap(key, 'duplicate', { reasons: [{ code: 'reason.duplicate.elsewhere', params: { machine: 'studio-2' } }] });
const daemon = (key: string) => { const s = snap(key, 'down'); return { ...s, launchd: { ...s.launchd, domain: 'system' as const } }; };

test('SCN-089: a copy here of an agent placed on another machine is not offered Restart on Overview', () => {
  assert.doesNotMatch(overview([elsewhere('alpha.default')]), />Restart</);
});

test('SCN-099: a system daemon of the space that is down is not offered Restart on Overview', () => {
  assert.doesNotMatch(overview([daemon('alpha.default')]), />Restart</);
});

test('SCN-006: a down agent launchd does not manage is not offered Restart; an ordinary one still is', () => {
  assert.doesNotMatch(overview([snap('alpha.default', 'down', { managed: false })]), />Restart</);
  assert.match(overview([snap('alpha.default', 'down')]), />Restart</);
});

test('SCN-006: a folded row offers Restart N only when the agent page would restart every member', () => {
  assert.doesNotMatch(overview([daemon('alpha.default'), daemon('bravo.default')]), />Restart 2</);
  assert.doesNotMatch(overview([elsewhere('alpha.default'), elsewhere('bravo.default')]), />Restart 2</);
  assert.match(overview([snap('alpha.default', 'down'), snap('bravo.default', 'down')]), />Restart 2</);
});

// --- 2. SCN-095: an update or a log line beside setup entries keeps "Waits for setup" ----------------------------
const setupReason = { code: 'reason.setup', params: { source: 'openrouter', reason: 'no key yet' } };

test('SCN-095: an update waiting or a log line beside setup entries still waits for setup', () => {
  const withUpdate = snap('alpha.default', 'degraded', { reasons: [setupReason, { code: 'reason.update', params: { version: '2.0.0' } }] });
  assert.equal(waitsForSetup(withUpdate), true);
  assert.equal(shownState(withUpdate), 'setup');
  assert.equal(waitsForSetup(snap('alpha.default', 'degraded', { reasons: [setupReason, { code: 'reason.log', params: { line: 'x' } }] })), true);
  assert.equal(waitsForSetup(snap('alpha.default', 'degraded', { reasons: [{ code: 'reason.update', params: { version: '2.0.0' } }] })), false, 'at least one setup entry');
  assert.equal(waitsForSetup(snap('alpha.default', 'degraded', { reasons: [setupReason, { code: 'reason.degraded', params: { source: 'disk', reason: 'full' } }] })), false, 'a mixed list stays degraded');
});

// --- 3. SCN-089 step 3: the notice of a copy here of an agent placed elsewhere ------------------------------------
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const DESCRIPTOR = fixture('positive_service-descriptor.json') as Descriptor;
const READY: WellKnown = { ...(fixture('positive_service-well-known.json') as WellKnown), status: 'ready', degraded: [] };
const KEY = `${DESCRIPTOR.id}.${DESCRIPTOR.instance}`;

test('SCN-089: running here while placed elsewhere is announced with the machine and without empty placeholders', async () => {
  const base = tmp('fd-walk-b-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(DESCRIPTOR));
  const runner = async (_c: string, args: string[]): Promise<RunResult> => (args[0] === 'print' ? { code: 0, stdout: `pid = ${READY.process.pid}\n`, stderr: '' } : { code: 0, stdout: '', stderr: '' });
  const clock = { ms: Date.parse('2026-11-11T12:00:00Z') };
  let placement: Placement | null = null;
  const answer: WellKnownResult = { kind: 'answer', doc: READY, ms: 3 };
  const activity = new ActivityStore(path.join(base, 'app'));
  const monitor = new Monitor({ platform: 'darwin', servicesDir: services, activity, settings: () => DEFAULT_SETTINGS,
    lang: () => 'en', now: () => clock.ms, launchd: new Launchd(runner, 501), wellKnown: async () => answer, placement: { get: () => placement, error: null } });
  const notices: Notice[] = [];
  monitor.on('notify', (n: Notice) => notices.push(n));
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.state, 'ready');
  placement = { machine: 'studio-1', updatedAt: null, elsewhere: [{ label: DESCRIPTOR.lifecycle.label!, placedOn: 'studio-2' }] };
  const said = () => activity.list({ serviceKey: KEY }).some((x) => x.kind === 'service.duplicate');
  for (let i = 1; i <= 12 && !said(); i++) { clock.ms += 10_000; await monitor.tick(); } // the next probe observes it
  assert.equal(monitor.snapshot(KEY)!.state, 'duplicate');
  const event = activity.list({ serviceKey: KEY }).find((x) => x.kind === 'service.duplicate');
  assert.ok(event, 'the activity says so');
  assert.match(event!.text, /runs here too while it is placed on studio-2\./);
  assert.doesNotMatch(event!.text, /\{|pid/);
  const notice = notices.find((n) => n.serviceKey === KEY);
  assert.ok(notice, 'a notification');
  assert.match(notice!.body, /Placed on studio-2/);
  assert.doesNotMatch(notice!.body, /\{|Restart/);
  assert.ok(allKeys().includes('app.event.duplicate.elsewhere'));
  assert.equal(t('ru', 'app.event.duplicate.elsewhere', { name: 'A', machine: 'm' }), 'A работает и здесь, хотя размещён на машине m.');
});

// --- 4. SCN-006: a tile before an update ----------------------------------------------------------------------------
test('SCN-006: an agent with a tile asking for attention and an update waiting sorts as the tile (7), before an update alone', () => {
  const both = snap('alpha.default', 'ready', { tile: true, update: '2.0.0' });
  assert.equal(attentionRank(both.state, both.wellKnown), 7);
  const q = attentionQueue([snap('bravo.default', 'ready', { update: '2.0.0' }), both], { now: Date.parse('2026-11-11T12:00:00Z') });
  assert.deepEqual(q.map((x) => x.s.key), ['alpha.default', 'bravo.default']);
});

// --- 5. SCN-059: the visit reads every agent, never the organization filter's part ----------------------------------
test('SCN-059: the visit section and its baseline are built from every agent, not the filtered list', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'App.tsx'), 'utf8');
  const body = /const startVisit = \(s: AppSettings\) => \{([\s\S]*?)\n {2}\};/.exec(app)?.[1] ?? '';
  assert.match(body, /sinceLastVisit\(\{ services: everyAgent\.services,/);
  assert.match(body, /knownServices: everyAgent\.services\.map/);
  assert.doesNotMatch(body, /status\.services/);
});

// --- 6. SCN-056, SCN-072 step 3: a move among pinned agents keeps the pins not shown --------------------------------
test('SCN-056: moving a pinned agent keeps the pins of agents not shown, in their places', () => {
  const products = groupProducts([snap('alpha.default', 'ready'), snap('bravo.default', 'ready'), snap('charlie.default', 'ready')]);
  const list = { sort: 'name' as const, pinned: ['alpha', 'ghost', 'bravo', 'hiddenone', 'charlie'], hidden: ['hiddenone'] };
  const arranged = arrangeProducts(products, list);
  assert.deepEqual(arranged.pinned.map((p) => p.id), ['alpha', 'bravo', 'charlie']);
  assert.deepEqual(moveInSection(arranged, 'pinned', 'charlie', 0, list.pinned), { pinned: ['charlie', 'ghost', 'alpha', 'hiddenone', 'bravo'] });
  assert.equal(moveInSection(arranged, 'pinned', 'charlie', 2, list.pinned), null, 'no move');
});

// --- 7. SCN-072 step 4: an agent turned off with two instances is listed once ---------------------------------------
test('SCN-072: an agent turned off with two instances is one entry, on Overview too', () => {
  const off = [{ key: 'alpha.default', product: 'alpha', name: 'Alpha' }, { key: 'alpha.second', product: 'alpha', name: 'Alpha' }, { key: 'bravo.default', product: 'bravo', name: 'Bravo' }];
  assert.deepEqual(offProducts(off).map((o) => o.key), ['alpha.default', 'bravo.default']);
  const html = overview([snap('charlie.default', 'ready')], { list: { hidden: [], hiddenOpen: true, kinds: {} } }, { off } as Partial<AppStatus>);
  assert.match(html, /Hidden: 2|Hidden \(2\)|>2</);
  assert.match(html, /Turned off: Alpha, Bravo</);
});

// --- 8. SCN-100 step 3: the steps are checked again while the agent works --------------------------------------------
test('SCN-100: while the agent works the setup check runs again every minute, never two at once, and stops', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    let runs = 0;
    let finish: () => void = noop;
    const stop = recheckEvery(() => { runs++; return new Promise<void>((resolve) => { finish = resolve; }); });
    assert.equal(SETUP_RECHECK_MS, 60_000);
    mock.timers.tick(SETUP_RECHECK_MS - 1);
    assert.equal(runs, 0);
    mock.timers.tick(1);
    assert.equal(runs, 1);
    mock.timers.tick(SETUP_RECHECK_MS);
    assert.equal(runs, 1, 'one still running skips the beat');
    finish();
    await new Promise((r) => setImmediate(r));
    mock.timers.tick(SETUP_RECHECK_MS);
    assert.equal(runs, 2);
    finish();
    await new Promise((r) => setImmediate(r));
    stop();
    mock.timers.tick(SETUP_RECHECK_MS * 3);
    assert.equal(runs, 2, 'stopped when the agent stops');
  } finally {
    mock.timers.reset();
  }
});

test('SCN-100: the setup check component starts the timer while its agent works', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'components', 'Overview.tsx'), 'utf8');
  assert.match(src, /useEffect\(\(\) => \(agentWorking \? recheckEvery\(/);
});
