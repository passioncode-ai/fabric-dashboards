// FD-143 (SCN-093): with automatic updates off the app still reads the feed on its timer and names a newer version,
// once per version; nothing is downloaded or installed until the person presses Update (a manual check).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { mayCheck, mayPeek } from '../src/core/version';
import { t } from '../src/core/i18n';

test('FD-143: off, the timer only peeks; on, or the person\'s own check, runs the whole update', () => {
  assert.equal(mayPeek({ manual: false, enabled: false, state: 'idle' }), true, 'off: the feed is still read');
  assert.equal(mayCheck({ manual: false, enabled: false, state: 'idle' }), false, 'off: nothing is downloaded');
  assert.equal(mayPeek({ manual: false, enabled: false, state: 'available' }), true, 'an announced version keeps being watched');
  assert.equal(mayPeek({ manual: false, enabled: false, state: 'error' }), true);
  assert.equal(mayPeek({ manual: false, enabled: true, state: 'idle' }), false, 'on: the usual check, not a peek');
  assert.equal(mayPeek({ manual: true, enabled: false, state: 'available' }), false, 'Update is a manual check');
  assert.equal(mayCheck({ manual: true, enabled: false, state: 'available' }), true, 'Update downloads and installs');
  assert.equal(mayCheck({ manual: false, enabled: true, state: 'available' }), true, 'turned back on, the timer takes over');
  for (const busy of ['checking', 'downloading', 'ready', 'held', 'unsupported', 'misplaced', 'package', 'notyet']) {
    assert.equal(mayPeek({ manual: false, enabled: false, state: busy }), false, busy);
  }
});

test('FD-143: the updater peeks before it decides a check, the main process tells once per version, and a click updates', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/electron/updater.ts'), 'utf8');
  const check = src.slice(src.indexOf('check(manual = false): void {'));
  assert.ok(check.indexOf('mayPeek(') < check.indexOf('mayCheck('), 'the peek is decided first');
  const peek = src.slice(src.indexOf('private async peek(): Promise<void> {'), src.indexOf('private async readFeed()'));
  assert.doesNotMatch(peek, /verify\(|stage\(|prepareFile\(|autoUpdater\./, 'a peek downloads and stages nothing');
  assert.match(peek, /this\.set\(\{ state: 'available', version \}\)/);
  const main = fs.readFileSync(path.join(__dirname, '../src/electron/main.ts'), 'utf8');
  assert.match(main, /availableTold !== updater\.state\.version/, 'once per version');
  assert.match(main, /n\.on\('click', \(\) => updater\.check\(true\)\);/, 'the click is the person\'s Update');
});

test('FD-143: the words say it is out, and what Update and the switch do, in both languages', () => {
  assert.equal(t('en', 'update.available', { version: '0.8.21' }), 'Version 0.8.21 is out');
  assert.equal(t('ru', 'update.available', { version: '0.8.21' }), 'Вышла версия 0.8.21');
  // The button is the terminology's "Update to {version}" (docs/brand/terminology.md: «Обновить» alone is never a button).
  assert.equal(t('en', 'action.update', { version: '0.8.21' }), 'Update to 0.8.21');
  assert.equal(t('ru', 'action.update', { version: '0.8.21' }), 'Обновить до 0.8.21');
  assert.match(t('en', 'settings.autoUpdate.body'), /installs only when you choose to update/);
  assert.match(t('ru', 'settings.autoUpdate.body'), /только когда вы решите обновить/);
});
