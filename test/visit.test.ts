// FD-39 SCN-059: a later session opens on what changed since the last one.
import assert from 'node:assert/strict';
import test from 'node:test';
import { sinceLastVisit } from '../src/core/visit';

const ev = (at: string, level: 'info' | 'warning' | 'error', text = 'x') => ({ id: at, at, kind: 'k', level, text });
const services = [
  { key: 'alpha.default', latestEvent: ev('2026-10-11T08:00:00Z', 'error', 'database locked') },
  { key: 'bravo.default', latestEvent: ev('2026-10-09T08:00:00Z', 'warning', 'old warning') },
  { key: 'charlie.default', latestEvent: ev('2026-10-11T09:00:00Z', 'info', 'fine') },
  { key: 'delta.default', latestEvent: null },
];

test('FD-39 SCN-059: what came, what went, and the warnings and errors reported since the last visit, newest first', () => {
  const r = sinceLastVisit({ services, lastVisitAt: '2026-10-10T00:00:00Z', known: ['alpha.default', 'bravo.default', 'gone.default'], consoles: {}, lastService: null });
  assert.deepEqual(r.added, ['charlie.default', 'delta.default']);
  assert.deepEqual(r.removed, ['gone.default']);
  assert.deepEqual(r.alerts.map((a) => a.text), ['database locked'], 'an older warning and an info row are not news');
});

test('FD-39 SCN-059: Continue lists the agents the person worked with, the last selected first; a first visit shows no changes', () => {
  const consoles = { 'bravo.default': { runtime: 'codex' }, 'delta.default': { runtime: 'claude-code' }, 'gone.default': { runtime: 'claude-code' }, 'alpha.default': { runtime: null } };
  const r = sinceLastVisit({ services, lastVisitAt: '2026-10-10T00:00:00Z', known: [], consoles, lastService: 'delta.default' });
  assert.deepEqual(r.continueKeys, ['delta.default', 'bravo.default'], 'only installed agents with a chosen runtime');
  const first = sinceLastVisit({ services, lastVisitAt: null, known: [], consoles: {}, lastService: null });
  assert.deepEqual([first.added, first.removed, first.alerts], [[], [], []]);
});
