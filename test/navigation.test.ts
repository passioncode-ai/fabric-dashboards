// FD-103 (dossier 2026-10-24, node S3; SCN-077): the sidebar's two modes. The Agents mode lists agents only, with no
// hand-over section; Connections has no stops list; the mode is remembered; View → Agents and Sessions take ⌘1 / ⌘2.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentsNav, ModeSwitch, SessionsNav } from '../src/renderer/components/Navigation';
import { ConnectionsMap } from '../src/renderer/components/ConnectionsMap';
import { arrangeProducts, groupProducts } from '../src/core/products';
import { modeMenuItems } from '../src/core/platform';
import { merge } from '../src/core/settings';
import { t } from '../src/core/i18n';
import { DEFAULT_SETTINGS, type AppStatus, type ServiceSnapshot } from '../src/core/types';
import { snap } from './snap';
import { fourGroups } from './session-rows';

(globalThis as { React?: unknown }).React = React;
const noop = () => undefined;

function status(services: ServiceSnapshot[], extra: Record<string, unknown> = {}): AppStatus {
  return { services, servicesDir: '/svc', dirError: null, scanning: false, unread: 0, update: { state: 'idle' }, estate: {} as AppStatus['estate'], version: '0.8.0', ...extra } as AppStatus;
}

/** What the window got before 0.8.0 alongside the agents: a hand-over console and a limit stop. */
const OLD_SESSIONS = {
  handovers: [{ key: 'handover.ho-0123456789ab', workflow: 'passioncode-platform', agent: 'claude-code', account: 'claude4', dir: '/work/passioncode-platform', state: 'exited', kind: 'handover' }],
  recovery: { on: true, stops: [{ event: 'cc-1', session: 's', dir: '/work/stopped', provider: 'claude', stoppedAt: Date.now() - 60_000, attempt: 1, verdict: 'billing' }], resumed: 0 },
};

function agentsNav(services: ServiceSnapshot[], extra: Record<string, unknown> = {}): string {
  const products = groupProducts(services);
  const layout = DEFAULT_SETTINGS.layout;
  return renderToStaticMarkup(React.createElement(AgentsNav, {
    page: 'overview', status: status(services, extra), arranged: arrangeProducts(products, layout.list), products, currentProduct: undefined, layout, changeLayout: noop,
    open: noop, go: noop, rail: false, queue: 0, urgent: false, auditErrors: 0, hiddenProblem: false,
    menu: { pin: noop, hide: noop, kind: noop, isPinned: () => false, isHidden: () => false, isService: () => false },
  }));
}

test('SCN-077: the Agents mode lists the agents and never a session or a Hand-overs section (SES-01, SES-02)', () => {
  const html = agentsNav([snap('alpha.default', 'ready'), snap('bravo.default', 'down')], OLD_SESSIONS);
  for (const label of ['Overview', 'Activity', 'Connections', 'Spend', 'Alpha', 'Bravo']) assert.match(html, new RegExp(`>${label}<`), label);
  assert.doesNotMatch(html, /Hand-overs|passioncode-platform|handover/i);
  assert.equal(t('en', 'nav.handovers'), 'nav.handovers', 'the section\'s heading is gone from the dictionary');
});

test('SCN-077: the switch reads Agents and Sessions, the pressed one is the mode, and Sessions counts what needs you', () => {
  const html = renderToStaticMarkup(React.createElement(ModeSwitch, { mode: 'sessions', rows: fourGroups(), rail: false, onMode: noop }));
  assert.match(html, /aria-pressed="false"[^>]*>.*?Agents</);
  assert.match(html, /aria-pressed="true" aria-label="Sessions, need you: 1"/);
  assert.match(html, /class="count alert" aria-hidden="true">1</);
  const none = renderToStaticMarkup(React.createElement(ModeSwitch, { mode: 'agents', rows: [], rail: false, onMode: noop }));
  assert.doesNotMatch(none, /count|need you/, 'no badge with nothing that needs you');
  const rail = renderToStaticMarkup(React.createElement(ModeSwitch, { mode: 'agents', rows: fourGroups(), rail: true, onMode: noop }));
  assert.match(rail, /title="Agents"/);
  assert.match(rail, /title="Sessions, need you: 1"/, 'in the rail each icon is named in a tooltip');
});

test('SCN-077: the Sessions mode lists All sessions, then the sessions by group, and no agent', () => {
  const html = renderToStaticMarkup(React.createElement(SessionsNav, { sessions: { rows: fourGroups(), degraded: [], switchboard: true, handovers: { enabled: true }, autoContinue: true }, currentId: null, allCurrent: true, rail: false, endedOpen: false, onEndedOpen: noop, openAll: noop, openRow: noop }));
  assert.match(html, /aria-current="page"[^>]*>.*?All sessions</);
  assert.doesNotMatch(html, />Overview<|>Alpha</);
});

test('SCN-075 (supersedes SCR-15): Connections has no "Sessions stopped on a limit" list', () => {
  const html = renderToStaticMarkup(React.createElement(ConnectionsMap as never, { status: status([snap('alpha.default', 'ready')], OLD_SESSIONS), open: noop, onAgent: noop, openConsole: noop }));
  assert.doesNotMatch(html, /stopped on a limit|payment limit|cmap-stops/i);
});

test('SCN-077 step 5: the mode, the session page and the Ended fold are remembered; a damaged value reads as Agents', () => {
  const kept = merge({ layout: { ...DEFAULT_SETTINGS.layout, mode: 'sessions', sessionId: 'c:handover.ho-0123456789ab:1', endedOpen: true } });
  assert.deepEqual([kept.layout.mode, kept.layout.sessionId, kept.layout.endedOpen], ['sessions', 'c:handover.ho-0123456789ab:1', true]);
  const damaged = merge({ layout: { mode: 'both', sessionId: 7, endedOpen: 'yes' } } as never);
  assert.deepEqual([damaged.layout.mode, damaged.layout.sessionId, damaged.layout.endedOpen], ['agents', null, false]);
  assert.equal(merge({}).layout.mode, 'agents', 'Agents the first time');
  assert.equal(merge({ sessionsNoteSeen: true } as never).sessionsNoteSeen, true, 'SCN-079: a dismissed note stays dismissed');
});

test('SCN-077: View → Agents is ⌘1 and View → Sessions ⌘2 on macOS, Ctrl+1 and Ctrl+2 elsewhere', () => {
  const label = (key: 'menu.agents' | 'menu.sessions') => t('en', key);
  assert.deepEqual(modeMenuItems('darwin', label).map((m) => [m.label, m.accelerator, m.page]), [['Agents', 'Command+1', 'agents'], ['Sessions', 'Command+2', 'sessions']]);
  for (const p of ['win32', 'linux'] as const) assert.deepEqual(modeMenuItems(p, label).map((m) => m.accelerator), ['Ctrl+1', 'Ctrl+2']);
  assert.deepEqual(modeMenuItems('darwin', (k) => t('ru', k)).map((m) => m.label), ['Агенты', 'Сессии']);
});

test('VIS-07 (FD-113): the map is a labelled group whose agent boxes are named buttons, each with its full name as a title', () => {
  const long = 'an-agent-with-a-very-long-name';
  const html = renderToStaticMarkup(React.createElement(ConnectionsMap as never, {
    status: status([snap(`${long}.default`, 'ready', { wellKnown: { ...snap('x.default', 'ready').wellKnown!, extensions: { 'https://fabric.passioncode.ai/agent-contract/extensions/connections/0.1': { connections: [{ id: 'c', kind: 'service', target: 'beta.default', state: 'ok' }] } } } } as never), snap('beta.default', 'ready')], OLD_SESSIONS),
    open: noop, onAgent: noop, openConsole: noop,
  }));
  assert.doesNotMatch(html, /<svg[^>]*role="img"/, 'children of role=img are presentational: the buttons inside would have no name');
  assert.match(html, /<svg[^>]*role="group"[^>]*aria-label=/);
  assert.match(html, new RegExp(`<g[^>]*role="button"[^>]*>\\s*<title>A${long.slice(1)}</title>`), 'a truncated name keeps its full form as a title');
});
