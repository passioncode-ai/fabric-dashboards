// FD-107 (FIX-3 of the 0.8.0 iteration): the seven nuances seen on FIX-2's contact sheet, each pinned by a test that
// failed before its fix: the sidebar keeps the current session's row in view, ended rows show the time they are ordered
// by, the not-answering line says since when, the footnote waits for the list, no session page leaves its body blank,
// Settings → Sessions opens with its page title in view, and a sidebar row's second line never cuts how it came.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionsNav } from '../src/renderer/components/Navigation';
import { AllSessions, SessionBody, hasConsole } from '../src/renderer/components/Sessions';
import { LangContext } from '../src/renderer/lib';
import { clock, navLines, stateWords } from '../src/core/sessions-view';
import { revealScrollTop } from '../src/core/layout';
import { setWording } from '../src/core/i18n';
import type { SessionOrigin, SessionRow, SessionState, SessionsStatus } from '../src/core/sessions';
import { AT, fourGroups, srow } from './session-rows';

(globalThis as { React?: unknown }).React = React;
setWording('other');
const noop = () => undefined;
const status = (rows: SessionRow[], extra: Partial<SessionsStatus> = {}): SessionsStatus => ({ rows, degraded: [], switchboard: true, handovers: { enabled: true }, autoContinue: true, ...extra });
const inLang = (lang: 'en' | 'ru', el: React.ReactElement) => renderToStaticMarkup(React.createElement(LangContext.Provider, { value: lang }, el));
const nav = (rows: SessionRow[], o: { currentId?: string | null; endedOpen?: boolean; lang?: 'en' | 'ru' } = {}) => inLang(o.lang ?? 'en',
  React.createElement(SessionsNav, { sessions: status(rows), currentId: o.currentId ?? null, allCurrent: false, rail: false, endedOpen: o.endedOpen ?? false, onEndedOpen: noop, openAll: noop, openRow: noop }));
const all = (s: SessionsStatus | undefined, lang: 'en' | 'ru' = 'en') => inLang(lang,
  React.createElement(AllSessions, { sessions: s, noteSeen: true, onNoteSeen: noop, onSetUp: noop, endedOpen: true, onEndedOpen: noop, open: noop, askEnd: noop, continued: noop }));
const body = (row: SessionRow, lang: 'en' | 'ru' = 'en', autoContinue = true) => inLang(lang, React.createElement(SessionBody, { row, autoContinue }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

test('FD-107: an element is scrolled only as far as needed to show it whole, never past its top', () => {
  const view = { scrollTop: 0, height: 800 };
  assert.equal(revealScrollTop(view, { top: 450, height: 290 }), 0, 'Settings → Sessions fits under the page title: nothing moves');
  assert.equal(revealScrollTop(view, { top: 700, height: 290 }, 16), 206, 'below the fold: up to its bottom and a margin');
  assert.equal(revealScrollTop(view, { top: 900, height: 1200 }, 16), 884, 'taller than the view: its top stays in view');
  assert.equal(revealScrollTop({ scrollTop: 600, height: 400 }, { top: 300, height: 50 }, 8), 292, 'above the view: its top and a margin');
  assert.equal(revealScrollTop({ scrollTop: 100, height: 400 }, { top: 200, height: 50 }, 8), 100, 'in view: nothing moves');
});

test('FD-107: the current session stays in the sidebar even when the Ended group is folded, marked for scrolling into view', () => {
  const rows = [...fourGroups(), srow({ id: 'c:research.default:4', key: 'research.default', state: 'ended-by-you', folder: '/work/research-notes', endedAt: AT - 600_000 })];
  const folded = nav(rows, { currentId: 'c:research.default:4' });
  assert.match(folded, /research-notes/, 'the open session\'s row shows under its folded group');
  assert.doesNotMatch(folded, /docs-site/, 'the rest of the folded group stays folded');
  assert.match(folded, /aria-current="page"[^>]*data-current=""|data-current=""[^>]*aria-current="page"/);
});

test('FD-107: an ended row shows the time it is ordered by, its end; every ended state says when it ended', () => {
  const idle = srow({ id: 'c:k:3', key: 'k', state: 'idle-closed', startedAt: AT - 120 * 60_000, endedAt: AT - 60 * 60_000, at: AT - 60 * 60_000 });
  const byYou = srow({ id: 'c:k:4', key: 'k4', state: 'ended-by-you', startedAt: AT - 200 * 60_000, endedAt: AT - 150 * 60_000, at: AT - 150 * 60_000 });
  assert.equal(navLines('en', idle).time, clock('en', AT - 60 * 60_000));
  assert.equal(navLines('ru', byYou).time, clock('ru', AT - 150 * 60_000));
  assert.equal(navLines('en', srow({ id: 'r', state: 'running-ours', startedAt: AT - 5 * 60_000 })).time, clock('en', AT - 5 * 60_000), 'a running row keeps its start');
  assert.equal(stateWords('en', idle), `Closed at ${clock('en', AT - 60 * 60_000)} after 30 idle minutes`);
  assert.equal(stateWords('ru', idle), `Закрыта в ${clock('ru', AT - 60 * 60_000)} после 30 минут простоя`);
  assert.equal(stateWords('en', byYou), `Ended by you at ${clock('en', AT - 150 * 60_000)}`);
  assert.equal(stateWords('ru', byYou), `Завершена вами в ${clock('ru', AT - 150 * 60_000)}`);
});

test('FD-107: the not-answering line says since when Switchboard has not answered, never that it was checked then', () => {
  const s = status(fourGroups(), { degraded: [{ source: 'sessions', reason: 'error', detail: 'x', since: AT }] });
  const en = text(all(s));
  assert.match(en, new RegExp(`Switchboard has not answered since ${clock('en', AT)}, so sessions it runs may be missing\\.`));
  assert.doesNotMatch(en, /Checked at/);
  assert.match(text(all(s, 'ru')), new RegExp(`Switchboard не отвечает с ${clock('ru', AT)}, поэтому его сессий здесь может не быть\\.`));
});

test('FD-107: the footnote waits for the list; under the loading line there is none', () => {
  assert.doesNotMatch(all(undefined), /Sessions started in a terminal without Switchboard are not listed\./);
  assert.match(all(status([])), /Sessions started in a terminal without Switchboard are not listed\./);
});

test('FD-107: a waiting session\'s page says what happens next, the folder and when it stopped, in both languages', () => {
  const waiting = srow({ id: 'st:cc-1', state: 'waiting-reset', folder: '/work/fabric-switchboard', origin: 'limit', account: 'claude3', startedAt: AT - 12 * 60_000, expectedAt: AT + 88 * 60_000, candidates: [{ id: 'a', label: 'claude5' }] });
  const en = text(body(waiting));
  assert.match(en, new RegExp(`Switchboard tries this session again at about ${clock('en', AT + 88 * 60_000)} on an account with capacity\\.`));
  assert.match(en, /Continue now on another account, or choose "Do not continue"\./);
  assert.match(en, /\/work\/fabric-switchboard/);
  assert.match(en, new RegExp(`Stopped ${clock('en', AT - 12 * 60_000)}`));
  const ru = text(body(waiting, 'ru'));
  assert.match(ru, new RegExp(`Switchboard попробует продолжить эту сессию около ${clock('ru', AT + 88 * 60_000)} на аккаунте с запасом\\.`));
  assert.match(ru, /Можно продолжить сейчас на другом аккаунте или выбрать «Не продолжать»\./);
  const noTime = text(body({ ...waiting, expectedAt: null, candidates: [], actions: waiting.actions.filter((a) => a !== 'continueNow') }));
  assert.match(noTime, /Switchboard tries this session again when an account has capacity\./);
  assert.match(noTime, /No other account has capacity now; choose "Do not continue" if it should not continue\./);
  assert.match(text(body(waiting, 'en', false)), /Continuing by itself is off in Settings, so Switchboard does not try it again\./);
});

test('FD-107: no session page leaves its body blank: every state without a console of this app says something', () => {
  const states: SessionState[] = ['running-ours', 'running-terminal', 'needs-you-resume-failed', 'needs-you-not-opened', 'waiting-reset', 'ended', 'ended-cannot-continue', 'idle-closed', 'ended-by-you'];
  for (const state of states) {
    for (const r of [srow({ id: `x:${state}`, state }), srow({ id: `y:${state}`, state, openedInTerminal: true, reason: 'busy-disk' })]) {
      if (hasConsole(r)) continue;
      for (const lang of ['en', 'ru'] as const) assert.ok(text(body(r, lang)).length > 20, `${state} (${lang}) has a body`);
    }
  }
  const notOpened = text(body(srow({ id: 'ho:1', state: 'needs-you-not-opened', reason: 'busy-disk', openedInTerminal: true })));
  assert.match(notOpened, /Remove takes it off this list\./);
});

test('FD-107: a sidebar row\'s second line fits its width in both languages and wraps to a second line before it cuts', () => {
  const origins: SessionOrigin[] = ['handover', 'resume', 'limit', 'switchboard', 'here'];
  for (const lang of ['en', 'ru'] as const) {
    for (const origin of origins) {
      const sub = navLines(lang, srow({ id: `o:${origin}`, state: 'running-ours', origin, account: 'claude10' })).sub;
      // Measured on FIX-2's sheet in the 240 px sidebar: "claude2 · после сброса лими…" was cut at 26 characters, and
      // "claude5 · started by Switchbo…" at 29 (Latin letters are narrower).
      assert.ok(sub.length <= (lang === 'ru' ? 24 : 28), `${lang} ${origin}: "${sub}" fits`);
    }
  }
  const css = fs.readFileSync(path.join(import.meta.dirname, '../src/renderer/styles/app.css'), 'utf8');
  assert.match(css, /\.session-item \.session-sub \{[^}]*-webkit-line-clamp: 2/, 'a longer line wraps to two lines, never an ellipsis inside the origin');
});
