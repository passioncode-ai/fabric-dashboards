// FD-103 (dossier 2026-10-24, node S3; SCN-078 to SCN-085): the Sessions mode's screens rendered to markup as the
// window draws them, and the pure rules under them (the words of a row, Esc then Tab, the tray's line, the
// notification, the session page's console placement).
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionsNav } from '../src/renderer/components/Navigation';
import { AllSessions, SessionBody, SessionHeader } from '../src/renderer/components/Sessions';
import { clock, resolveSessionRoute, secondLine, stateWords, terminalKey, traySessionsLine } from '../src/core/sessions-view';
import { sessionNotification } from '../src/core/sessions-notice';
import { drawerBoundsFor } from '../src/core/layout';
import { setWording, t } from '../src/core/i18n';
import { DEFAULT_SETTINGS } from '../src/core/types';
import type { SessionRow, SessionsStatus } from '../src/core/sessions';
import { AT, fourGroups, srow } from './session-rows';

(globalThis as { React?: unknown }).React = React;
setWording('other'); // the words of Windows and Linux unless a test names macOS
const noop = () => undefined;
const at = (html: string, needle: string) => { const i = html.indexOf(needle); assert.notEqual(i, -1, `missing ${needle}`); return i; };
const status = (rows: SessionRow[], extra: Partial<SessionsStatus> = {}): SessionsStatus => ({ rows, degraded: [], switchboard: true, handovers: { enabled: true }, autoContinue: true, ...extra });
const nav = (rows: SessionRow[], endedOpen = false) => renderToStaticMarkup(React.createElement(SessionsNav, { sessions: status(rows), currentId: null, allCurrent: false, rail: false, endedOpen, onEndedOpen: noop, openAll: noop, openRow: noop }));
const all = (s: SessionsStatus | undefined, o: Record<string, unknown> = {}) => renderToStaticMarkup(React.createElement(AllSessions, { sessions: s, noteSeen: true, onNoteSeen: noop, onSetUp: noop, endedOpen: true, onEndedOpen: noop, open: noop, askEnd: noop, continued: noop, ...o }));
const header = (row: SessionRow) => renderToStaticMarkup(React.createElement(SessionHeader, { row, autoContinue: true, open: noop, askEnd: noop, continued: noop }));

test('SCN-078: the sidebar groups sessions in order, each heading with its count, Ended folded by default with Clear', () => {
  const html = nav(fourGroups());
  assert.ok(at(html, '>Needs you: 1<') < at(html, '>Running: 1<'));
  assert.ok(at(html, '>Running: 1<') < at(html, '>Waiting for a limit reset: 1<'));
  assert.ok(at(html, '>Waiting for a limit reset: 1<') < at(html, '>Ended: 1<'), 'the sidebar\'s short ended heading (R1-V3)');
  assert.match(html, /aria-expanded="false"/, 'Ended is folded');
  assert.doesNotMatch(html, /docs-site/, 'a folded group shows no rows');
  assert.match(html, />Clear</);
  assert.match(nav(fourGroups(), true), /docs-site/, 'unfolded, its rows show');
  assert.doesNotMatch(nav(fourGroups().slice(1, 2)), /Needs you|Waiting|Ended/, 'an empty group is not drawn');
});

test('SCN-078 step 2 (SES-02): a row is the project over "coding agent · account · how it came · time"; two rows of one folder differ', () => {
  const a = srow({ id: 'c:handover.ho-000000000001:1', state: 'running-ours', folder: '/work/passioncode-platform' });
  const b = srow({ id: 'c:handover.rs-000000000002:2', state: 'running-ours', folder: '/work/passioncode-platform', origin: 'resume', account: 'claude5', startedAt: AT + 3600_000 });
  assert.equal(secondLine('en', a), `Claude Code · claude4 · handed over · ${clock('en', AT)}`);
  assert.notEqual(secondLine('en', a), secondLine('en', b));
  assert.equal(secondLine('ru', b), `Claude Code · claude5 · после сброса лимита · ${clock('ru', AT + 3600_000)}`);
  const html = nav([a, b]);
  assert.equal(html.match(/class="session-project">passioncode-platform</g)?.length, 2);
  assert.match(html, /class="visually-hidden">Running</, 'the state is said in words, not by the glyph alone');
});

test('SCN-079: All sessions explains itself once, with Choose where sessions continue and Got it', () => {
  setWording('mac');
  try {
    const html = all(status([]), { noteSeen: false });
    assert.match(html, /Here are the coding agents&#x27; sessions on this Mac\. When a session hits a limit, Switchboard passes the work to another account or coding agent/);
    assert.match(html, />Choose where sessions continue</);
    assert.match(html, /aria-label="Hide this explanation"[^>]*>Got it</);
    assert.match(all(status([], { switchboard: false }), { noteSeen: false }), /Install Fabric Switchboard so that a session that hits a limit continues here\./);
    assert.doesNotMatch(all(status([])), /Choose where sessions continue/, 'gone once dismissed');
  } finally { setWording('other'); }
});

test('SCN-078: loading, empty, not installed and not answering read as sentences; the footnote is always there', () => {
  assert.match(all(undefined), /Reading sessions…/);
  assert.match(all(status([])), /No coding sessions yet\./);
  assert.match(all(status([], { switchboard: false })), /Switchboard is not installed, so only sessions started in this app&#x27;s consoles are listed\./);
  assert.match(all(status(fourGroups(), { degraded: [{ source: 'sessions', reason: 'error', detail: 'x', since: AT }] })), new RegExp(`Switchboard did not answer just now, so sessions it runs may be missing\\. Checked at ${clock('en', AT)}\\.`));
  assert.match(all(status([])), /Sessions started in a terminal without Switchboard are not listed\./);
});

test('SCN-081 to SCN-084: every card offers its state\'s actions, in words', () => {
  const html = all(status(fourGroups()));
  const card = (project: string) => { const i = at(html, `>${project}<`); return html.slice(i, html.indexOf('</li>', i)); };
  assert.match(card('billing-api'), /Did not continue; its process is still running/);
  assert.match(card('billing-api'), />Open console</);
  assert.match(card('billing-api'), />End</);
  assert.match(card('passioncode-platform'), /Running/);
  assert.match(card('passioncode-platform'), />End</);
  assert.match(card('passioncode-platform'), />Show folder</);
  assert.match(card('fabric-switchboard'), new RegExp(`Continues at about ${clock('en', AT + 3600_000)}`));
  assert.match(card('fabric-switchboard'), />Continue now on another account</);
  assert.match(card('fabric-switchboard'), />Do not continue</);
  assert.match(card('docs-site'), /Closed after 30 idle minutes/, 'SES-04: an idle-closed hand-over is not a dead end');
  assert.match(card('docs-site'), />Continue</);
  assert.match(card('docs-site'), />Remove</);
  assert.match(html, /aria-label="Clear the ended sessions"[^>]*>Clear</);
});

test('SCN-083, SCN-084: no other account, a declined stop, an unknown conversation and a hand-over that did not open', () => {
  const lone = srow({ id: 'st:cc-2', state: 'waiting-reset', expectedAt: null });
  const html = all(status([lone]));
  assert.match(html, /<button class="btn btn-sm" disabled="" aria-describedby="nocand-st:cc-2">Continue now on another account</);
  assert.match(html, /No other account has capacity now\./);
  assert.match(html, /Waits for an account with capacity\./);
  assert.match(all(status([lone], { autoContinue: false })), /Continuing by itself is off in Settings, so continue it yourself\./);
  assert.equal(stateWords('en', srow({ id: 'x', state: 'ended', reason: 'declined' })), 'Not continued: you declined');
  assert.match(all(status([srow({ id: 'c:k:1', state: 'ended', resumable: false })])), />New session here</, 'decision 6');
  const expired = srow({ id: 'ho:ho-1', state: 'needs-you-not-opened', reason: 'expired', openedInTerminal: true });
  assert.equal(stateWords('en', expired), 'The hand-over expired before the session could open here. Switchboard opened it in Terminal.');
  assert.match(all(status([expired])), />Remove</);
});

test('SCN-080: a session\'s page header names it, says where it came from, and holds its actions; no fold, no collapse', () => {
  const row = srow({ id: 'c:handover.ho-000000000002:2', key: 'handover.ho-000000000002', state: 'running-ours', context: 'org:acme', contextName: 'Acme' });
  const html = header(row);
  assert.match(html, /<h1 id="session-title" tabindex="-1">checkout</);
  assert.match(html, new RegExp(`Handed over by Switchboard, ${clock('en', AT)}`));
  assert.match(html, />Account: claude4</);
  assert.match(html, />Context: Acme</);
  assert.match(html, />Claude Code</);
  assert.match(html, />End</);
  assert.match(html, /data-drawer-top=""/, 'the console starts under the header');
  assert.doesNotMatch(html, /Collapse|Hide console|chevron|console-edge/i);
  const resumed = header(srow({ id: 'c:handover.rs-000000000001:1', state: 'running-ours', origin: 'resume' }));
  assert.match(resumed, /Stopped on a usage limit and continued here by Claude Code once Switchboard had capacity again\./, 'SCN-075 step 3');
  assert.match(renderToStaticMarkup(React.createElement(SessionBody, { row: srow({ id: 'sb:h:1', state: 'running-terminal' }) })), /This session runs in a Terminal window that Switchboard opened\. Type to it there\./);
});

test('SCN-080 (SES-06): a session page\'s console fills the area under its header; an agent\'s drawer stays a drawer', () => {
  const rect = { x: 240, y: 120, width: 1040, height: 680 };
  assert.deepEqual(drawerBoundsFor({ rect, saved: 380, full: true, shadow: 14 }), rect);
  assert.deepEqual(drawerBoundsFor({ rect, saved: 380, shadow: 14 }), { ...rect, height: 394 });
});

test('VIS-05 (SCN-080 step 4): Esc reaches the coding agent; a Tab within a second after it leaves the terminal', () => {
  assert.equal(terminalKey({ key: 'Escape', type: 'keydown' }, null, 1000), 'pass');
  assert.equal(terminalKey({ key: 'Tab', type: 'keydown' }, 1000, 1500), 'leave');
  assert.equal(terminalKey({ key: 'Tab', type: 'keydown', shiftKey: true }, 1000, 1900), 'leave-back');
  assert.equal(terminalKey({ key: 'Tab', type: 'keydown' }, 1000, 2100), 'pass', 'a Tab later than a second is the agent\'s');
  assert.equal(terminalKey({ key: 'Tab', type: 'keydown' }, null, 2100), 'pass');
  assert.equal(terminalKey({ key: 'Tab', type: 'keypress' }, 1000, 1500), 'pass');
});

test('UX-18: a session that left the list returns its page to All sessions; a Continue is followed; a coming row is waited for', () => {
  const rows = fourGroups();
  assert.equal(resolveSessionRoute(rows, 'gone').gone, true);
  assert.equal(resolveSessionRoute(null, 'gone').gone, false, 'never bounce before the first read');
  assert.equal(resolveSessionRoute(rows, 'gone', { wait: true }).gone, false);
  assert.equal(resolveSessionRoute(rows, 'old-id', { follow: 'handover.ho-000000000002' }).found?.id, rows[1]!.id);
  // The row a Continue came from stays on show until the new session is listed; then the page follows it.
  const pending = resolveSessionRoute(rows, rows[3]!.id, { follow: 'handover.cs-00000000000f' });
  assert.deepEqual([pending.found?.id, pending.settled, pending.gone], [rows[3]!.id, false, false]);
});

test('SCN-085: the tray\'s Sessions line leaves out a part at zero, and says nothing when nothing runs or waits', () => {
  const rows = fourGroups();
  assert.equal(traySessionsLine('en', rows), 'Sessions: running 1, need you 1');
  assert.equal(traySessionsLine('ru', rows), 'Сессии: идут 1, нужно ваше решение 1');
  assert.equal(traySessionsLine('en', rows.filter((r) => r.group === 'running')), 'Sessions: running 1');
  assert.equal(traySessionsLine('en', rows.filter((r) => r.group === 'needs-you')), 'Sessions: need you 1');
  assert.equal(traySessionsLine('en', rows.filter((r) => r.group === 'ended')), null);
});

test('SCN-085, decision 9: a taken hand-over and an automatic continue are one notification each; a pause silences them', () => {
  const n = { kind: 'handover' as const, id: 'c:handover.ho-1:1', key: 'handover.ho-1', project: 'passioncode-platform', agent: 'claude-code', at: AT };
  assert.deepEqual(sessionNotification('en', n, DEFAULT_SETTINGS, new Date(AT)), { title: 'Sessions', body: 'Switchboard handed over a session: passioncode-platform continues on Claude Code' });
  assert.equal(sessionNotification('en', { ...n, kind: 'resume' }, DEFAULT_SETTINGS, new Date(AT))?.body, 'passioncode-platform continues after a limit reset on Claude Code');
  assert.equal(sessionNotification('ru', { ...n, kind: 'resume' }, DEFAULT_SETTINGS, new Date(AT))?.body, 'passioncode-platform продолжается после сброса лимита на Claude Code');
  const paused = { ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications, pausedUntil: new Date(AT + 3600_000).toISOString() } };
  assert.equal(sessionNotification('en', n, paused, new Date(AT)), null);
  assert.equal(t('en', 'tray.sessions.both', { running: 2, waiting: 1 }), 'Sessions: running 2, need you 1');
});
