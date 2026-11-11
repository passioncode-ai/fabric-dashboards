// Scenario walk 2026-11-11, wave C: the main process's own notifications, the announced version across launches, and a
// tab that cannot draw an answer (SCN-093, SCN-024, SCN-068).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { merge, rendererSettingsPatch, SettingsStore } from '../src/core/settings';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { t } from '../src/core/i18n';
import { LangContext } from '../src/renderer/lib';
import { changed, PaneBoundary } from '../src/renderer/components/PaneBoundary';
import { tmp } from './helpers';

(globalThis as { React?: unknown }).React = React; // the renderer's JSX reads React from the scope

const main = fs.readFileSync(path.join(__dirname, '../src/electron/main.ts'), 'utf8');

test('SCN-093, SCN-024: the update and login-item notifications are kept like notify()\'s, so their click is not lost', () => {
  const keep = main.indexOf('function keepNotice(');
  assert.ok(keep > 0 && keep < main.indexOf('new Updater('), 'kept before the updater can show one');
  const body = main.slice(keep, main.indexOf('\n  }\n', keep));
  assert.match(body, /shownNotices\.add\(n\)/);
  assert.match(body, /n\.on\('click', \(\) => \{ forget\(\); onClick\(\); \}\)/);
  assert.match(body, /n\.on\('close', forget\)/);
  // Every Notification the main process makes passes through keepNotice: none keeps a click handler of its own.
  // (The "installing" notice is shown with no click handler, so it has nothing to lose.)
  const made = main.match(/const n = new Notification\(/g)?.length ?? 0;
  assert.equal(made, 4, 'notify(), restart to finish, version is out, login item');
  assert.equal(main.match(/keepNotice\(n, /g)?.length, made);
  assert.doesNotMatch(main, /\bn\.on\('click', \(\) => (void restartToUpdate|updater\.check|void shell\.openExternal)/);
});

test('SCN-093: the announced version is kept in settings, so the same banner does not return at the next launch', () => {
  assert.equal(DEFAULT_SETTINGS.updateAnnounced, null);
  assert.equal(merge({}).updateAnnounced, null);
  assert.equal(merge({ updateAnnounced: '0.8.52' }).updateAnnounced, '0.8.52');
  for (const bad of [3, '', 'latest', '../x', null]) assert.equal(merge({ updateAnnounced: bad as never }).updateAnnounced, null, String(bad));
  assert.equal('updateAnnounced' in rendererSettingsPatch({ updateAnnounced: '9.9.9', theme: 'light' }), false, 'never the page\'s to set');
  const dir = tmp('fd-announced-');
  new SettingsStore(dir).update({ updateAnnounced: '0.8.52' });
  assert.equal(new SettingsStore(dir).get().updateAnnounced, '0.8.52', 'read back by the next launch');
  assert.match(main, /settings\.get\(\)\.updateAnnounced !== updater\.state\.version/);
  assert.match(main, /settings\.update\(\{ updateAnnounced: updater\.state\.version \}\)/);
  assert.doesNotMatch(main, /availableTold/, 'no per-run memory left');
});

test('SCN-068: a tab that throws shows a message in the person\'s language, and a new answer tries it again', () => {
  assert.deepEqual(PaneBoundary.getDerivedStateFromError(new Error('boom')).error?.message, 'boom');
  assert.equal(PaneBoundary.getDerivedStateFromError('text').error?.message, 'text');
  const b = new PaneBoundary({ name: 'Ads', reset: ['a', 'health', 1], children: null });
  b.state = { error: new Error('slots.includes is not a function') };
  for (const lang of ['en', 'ru'] as const) {
    const html = renderToStaticMarkup(React.createElement(LangContext.Provider, { value: lang }, b.render()));
    assert.ok(html.includes('role="alert"'));
    assert.ok(html.includes(lang === 'en' ? 'This tab of Ads could not be shown' : 'Эта вкладка Ads не показалась'), html);
  }
  assert.equal(changed(['a', 'health', 1], ['a', 'health', 1]), false);
  assert.equal(changed(['a', 'health', 1], ['a', 'health', 2]), true);
  assert.equal(changed(['a'], ['a', 'logs']), true);
  assert.match(t('en', 'view.paneError', { name: 'Ads', error: 'x' }), /This tab of Ads could not be shown: x\./);
  assert.match(t('ru', 'view.paneError', { name: 'Ads', error: 'x' }), /Эта вкладка Ads не показалась: x\./);
  const view = fs.readFileSync(path.join(__dirname, '../src/renderer/components/ServiceView.tsx'), 'utf8');
  assert.match(view, /<PaneBoundary name=\{nameOf\(s\)\} reset=\{\[s\.key, tab, s\.wellKnown\]\}>/);
});
