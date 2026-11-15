// FD-247 (step 6, SCN-109): All sessions searched, filtered and grouped by machine
// (docs/design/2026-11-15-sessions-machines.md §The list).
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AllSessions } from '../src/renderer/components/Sessions';
import { initialMachine } from '../src/renderer/components/NewSessionDialog';
import { SessionsNav } from '../src/renderer/components/Navigation';
import { LangContext } from '../src/renderer/lib';
import { filterActive, filterRows, machineGroups, machineStatusWords, NO_FILTER, originKey, searchRows, type SessionFilter } from '../src/core/sessions-view';
import { setWording } from '../src/core/i18n';
import { merge } from '../src/core/settings';
import { DEFAULT_SETTINGS } from '../src/core/types';
import type { RemoteMachineStatus, SessionRow, SessionsStatus } from '../src/core/sessions';
import { AT, srow } from './session-rows';

(globalThis as { React?: unknown }).React = React;
setWording('other');
const noop = () => undefined;

const rows: SessionRow[] = [
  srow({ id: 'a', state: 'running-ours', folder: '/work/billing-api', account: 'claude4' }),
  srow({ id: 'b', state: 'running-background', folder: '/srv/w/docs-site', machine: 'studio-2', origin: 'switchboard', agent: 'codex', account: 'Team' }),
  srow({ id: 'c', state: 'idle-closed', folder: '/work/fabric-switchboard', origin: 'here', endedAt: AT + 60_000 }),
  srow({ id: 'd', state: 'running-background', folder: '/srv/w/ledger', machine: 'studio-3', origin: 'switchboard' }),
];
const machines: RemoteMachineStatus[] = [
  { machine: 'studio-2', state: 'ok', at: AT, since: null, rows: 1 },
  { machine: 'studio-3', state: 'unreachable', at: AT - 600_000, since: AT - 300_000, rows: 1 },
  { machine: 'studio-4', state: 'ok', at: AT, since: null, rows: 0 },
];

test('FD-247 step 6: filters let through only the chosen values; an empty dimension lets everything through', () => {
  assert.deepEqual(filterRows(rows, NO_FILTER).map((r) => r.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, machines: [''] }).map((r) => r.id), ['a', 'c'], "'' is this Mac");
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, machines: ['studio-2'], groups: ['running'] }).map((r) => r.id), ['b']);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, groups: ['ended'] }).map((r) => r.id), ['c']);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, origins: ['here'] }).map((r) => r.id), ['c']);
  const board = srow({ id: 'e', state: 'running-background', origin: 'switchboard', launch: { by: { surface: 'fabric' } } as SessionRow['launch'] });
  assert.equal(originKey(board), 'dispatch', 'a board request is its own value');
  assert.equal(filterActive(NO_FILTER), false);
  assert.equal(filterActive(NO_FILTER, '  '), false);
  assert.equal(filterActive(NO_FILTER, 'docs'), true);
});

test('FD-247 step 6: every word of a search, in any case, in the project, folder, account, agent or machine', () => {
  assert.deepEqual(searchRows('en', rows, 'DOCS').map((r) => r.id), ['b']);
  assert.deepEqual(searchRows('en', rows, 'codex studio-2').map((r) => r.id), ['b']);
  assert.deepEqual(searchRows('en', rows, 'claude4').map((r) => r.id).includes('a'), true);
  assert.deepEqual(searchRows('en', rows, 'docs ledger'), [], 'all words must match');
  assert.equal(searchRows('en', rows, '').length, 4);
});

test('FD-247 step 6: machines in order: this Mac, those read, then any a row names; one read with no row is kept', () => {
  const g = machineGroups(rows, machines);
  assert.deepEqual(g.map((x) => [x.machine, x.rows.map((r) => r.id)]), [['', ['a', 'c']], ['studio-2', ['b']], ['studio-3', ['d']], ['studio-4', []]]);
  assert.deepEqual(machineGroups([rows[0]!]).map((x) => x.machine), [''], 'one Mac only');
  assert.deepEqual(machineGroups([rows[1]!]).map((x) => x.machine), ['studio-2'], 'this Mac with no row is left out once another machine has rows');
  assert.match(machineStatusWords('en', machines[0]!)!, /^read at /);
  assert.match(machineStatusWords('en', machines[1]!)!, /^studio-3: not reachable over ssh\. Last read /);
  assert.equal(machineStatusWords('en', null), null);
});

const page = (s: SessionsStatus, filter: SessionFilter = NO_FILTER, lang: 'en' | 'ru' = 'en') => renderToStaticMarkup(React.createElement(LangContext.Provider, { value: lang },
  React.createElement(AllSessions, { sessions: s, noteSeen: true, onNoteSeen: noop, onSetUp: noop, endedOpen: false, onEndedOpen: noop, open: noop, askEnd: noop, continued: noop, filter, onFilter: noop, onNewThere: noop })));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const status = (o: Partial<SessionsStatus> = {}): SessionsStatus => ({ rows, degraded: [], switchboard: true, handovers: { enabled: true }, autoContinue: true, machines, ...o });

test('FD-247 step 6: All sessions has a search, filter chips and a heading per machine; one not read is greyed and says why', () => {
  const html = page(status());
  assert.match(html, /type="search"[^>]*aria-label="Search sessions"/);
  assert.match(html, /aria-pressed="false"[^>]*>This computer</);
  assert.match(text(html), /This computer .* studio-2 · read at .* studio-3 New session Open terminal studio-3: not reachable over ssh\. Last read .* studio-4 · read at .* · no sessions/);
  assert.match(html, /session-machine session-machine-stale/);
  assert.match(html, /aria-label="Open a terminal on studio-2">Open terminal</);
  assert.match(html, /aria-label="Start a new session on studio-2">New session</);
  assert.doesNotMatch(html, /aria-label="Open a terminal on "/, 'this computer has no terminal button');
  assert.match(html, /<h2 id="sm-studio-2"/);
  assert.match(html, /<h3 id="sg-studio-2-running"/);
  const ru = page(status(), NO_FILTER, 'ru');
  assert.match(text(ru), /Этот компьютер/);
  assert.match(ru, /aria-label="Поиск по сессиям" placeholder="Проект, папка, аккаунт или агент"/);
});

test('FD-247 step 6: a filter says how many it shows with Clear filters, unfolds Ended, and says when nothing matches', () => {
  const html = text(page(status(), { ...NO_FILTER, groups: ['ended'] }));
  assert.match(html, /1 of 4 shown Clear filters/);
  assert.match(html, /fabric-switchboard/, 'the Ended group unfolds while a filter is on');
  const none = text(page(status(), { ...NO_FILTER, machines: ['studio-4'] }));
  assert.match(none, /No session matches the search and filters/);
});

test('FD-247 step 6: with one Mac the page reads as before: no machine headings, state groups at level 2', () => {
  const html = page(status({ rows: [rows[0]!, rows[2]!], machines: [] }));
  assert.doesNotMatch(html, /session-machine/);
  assert.match(html, /<h2 id="sg-here-running"/);
  assert.doesNotMatch(html, /aria-label="Machine"/, 'no machine chips for one Mac');
});

test('FD-247 step 6: the filters are kept in settings; anything unknown is dropped', () => {
  assert.deepEqual(DEFAULT_SETTINGS.layout.sessionsFilter, { machines: [], groups: [], origins: [] });
  const m = merge({ layout: { ...DEFAULT_SETTINGS.layout, sessionsFilter: { machines: ['', 'studio-2', 7], groups: ['running', 'bogus'], origins: ['here', 'nope'] } as never } });
  assert.deepEqual(m.layout.sessionsFilter, { machines: ['', 'studio-2'], groups: ['running'], origins: ['here'] });
  assert.deepEqual(merge({}).layout.sessionsFilter, { machines: [], groups: [], origins: [] });
});

const nav = (s: SessionsStatus, folded: string[] = [], currentId: string | null = null) => renderToStaticMarkup(React.createElement(LangContext.Provider, { value: 'en' },
  React.createElement(SessionsNav, { sessions: s, currentId, allCurrent: false, rail: false, endedOpen: true, onEndedOpen: noop, openAll: noop, openRow: noop, folded, onFold: noop })));

test('FD-247 step 6b: the sidebar is a tree of machines; a folded one keeps what needs the person and what runs', () => {
  const s = status({ rows: [...rows, srow({ id: 'e', state: 'idle-closed', folder: '/srv/w/old', machine: 'studio-2', endedAt: AT })] });
  const open = text(nav(s));
  assert.match(open, /This computer .* billing-api .* studio-2 .* docs-site .* old .* studio-3 .* ledger .* studio-4/);
  assert.match(nav(s), /aria-expanded="true"[^>]*>.*?studio-2/);
  const folded = nav(s, ['studio-2']);
  assert.match(text(folded), /docs-site/, 'a running row stays when its machine is folded');
  assert.doesNotMatch(text(folded), / old /, 'an ended row folds away');
  assert.match(text(nav(s, ['studio-2'], 'e')), / old /, 'the open session stays in view');
  assert.match(nav(s), /nav-machine nav-machine-stale/);
  assert.match(nav(s), /visually-hidden">: studio-3: not reachable over ssh/);
});

test('FD-247 step 6b: with one Mac the sidebar reads as before, and folded machines are kept in settings', () => {
  const html = nav(status({ rows: [rows[0]!], machines: [] }));
  assert.doesNotMatch(html, /nav-machine/);
  assert.match(html, /id="snav-running"/);
  assert.deepEqual(merge({ layout: { ...DEFAULT_SETTINGS.layout, sessionsFolded: ['', 'studio-2', 3] as never } }).layout.sessionsFolded, ['', 'studio-2']);
});

test('FD-247: New session on a machine heading opens the dialog on that machine; one Switchboard cannot start there falls back', () => {
  const o = { machines: ['studio-2', 'studio-3'], machine: 'studio-3', remoteFolder: '/srv/w/ledger' };
  assert.deepEqual(initialMachine('studio-2', o), { machine: 'studio-2', remoteFolder: '' });
  assert.deepEqual(initialMachine('studio-3', o), { machine: 'studio-3', remoteFolder: '/srv/w/ledger' }, 'the last folder there stays');
  assert.deepEqual(initialMachine('studio-9', o), { machine: 'studio-3', remoteFolder: '/srv/w/ledger' });
  assert.deepEqual(initialMachine(undefined, { machines: [], machine: null, remoteFolder: null }), { machine: '', remoteFolder: '' });
});
