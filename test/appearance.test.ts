// FD-42, FD-56 (contract DEC-0036 ED-8/ED-10, DEC-0059): the appearance carrier a host writes per service.
import assert from 'node:assert/strict';
import test from 'node:test';
import { appearanceCookie, appearanceValue, REFERENCE_THEMES, viewBackground } from '../src/core/appearance';
import { merge } from '../src/core/settings';

test('FD-42 (ED-8): the value carries v=1, the scheme the operator chose and the theme', () => {
  assert.equal(appearanceValue({ scheme: 'dark', theme: 'ocean' }, null), 'v=1&scheme=dark&theme=ocean');
  assert.equal(appearanceValue({ scheme: 'light', theme: 'graphite' }, null), 'v=1&scheme=light&theme=graphite');
});

test('FD-42: "same as macOS" sends no scheme — the page follows prefers-color-scheme, which the host keeps in agreement', () => {
  assert.equal(appearanceValue({ scheme: 'system', theme: 'paper' }, null), 'v=1&theme=paper');
});

test('FD-56 (ED-10): a theme the page says it does not ship is not sent; an id outside the grammar never is', () => {
  assert.equal(appearanceValue({ scheme: 'dark', theme: 'ocean' }, { themes: ['graphite', 'fabric'] }), 'v=1&scheme=dark');
  assert.equal(appearanceValue({ scheme: 'dark', theme: 'fabric' }, { themes: ['graphite', 'fabric'] }), 'v=1&scheme=dark&theme=fabric');
  assert.equal(appearanceValue({ scheme: 'dark', theme: 'Bad Theme' }, null), 'v=1&scheme=dark');
});

test('FD-42 (ED-8): the cookie is the page host\'s, path /, SameSite=Strict, readable by script, Secure on https', () => {
  assert.deepEqual(appearanceCookie('http://127.0.0.1:8787', 'v=1'), { url: 'http://127.0.0.1:8787', name: 'fabric_appearance', value: 'v=1', path: '/', sameSite: 'strict', httpOnly: false, secure: false });
  assert.equal(appearanceCookie('https://agent.example.com', 'v=1').secure, true);
});

test('FD-42: the view background follows the scheme in force, the system one included', () => {
  assert.equal(viewBackground('dark', false), '#0a070d');
  assert.equal(viewBackground('light', true), '#ffffff');
  assert.equal(viewBackground('system', true), '#0a070d');
  assert.equal(viewBackground('system', false), '#ffffff');
});

test('FD-42: settings keep the scheme (system included) and only a reference theme', () => {
  assert.equal(merge({ theme: 'system' } as never).theme, 'system');
  assert.equal(merge({ pageTheme: 'forest' } as never).pageTheme, 'forest');
  assert.equal(merge({ pageTheme: 'made-up' } as never).pageTheme, 'graphite');
  assert.equal(merge({} as never).pageTheme, 'graphite');
  assert.deepEqual([...REFERENCE_THEMES], ['graphite', 'fabric', 'paper', 'forest', 'ocean', 'ember', 'contrast']);
});
