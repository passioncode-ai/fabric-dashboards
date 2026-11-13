// FD-92 (SCN-048): the console drawer's height over the content area; the dashboard is never resized.
import assert from 'node:assert/strict';
import test from 'node:test';
import { drawerHeightFor, tabStep } from '../src/core/layout';
import { CONSOLE_HEIGHT } from '../src/core/types';

test('FD-92: the drawer keeps its saved height, its minimum, and always leaves some of the page showing', () => {
  assert.equal(drawerHeightFor({ saved: 360, areaHeight: 900 }), 360);
  assert.equal(drawerHeightFor({ saved: 2000, areaHeight: 900 }), 900 - CONSOLE_HEIGHT.reveal, 'a tall drawer leaves the page its strip');
  assert.equal(drawerHeightFor({ saved: 40, areaHeight: 900 }), CONSOLE_HEIGHT.min);
  assert.equal(drawerHeightFor({ saved: 360, areaHeight: 200 }), CONSOLE_HEIGHT.min, 'a tiny window still gets a usable drawer');
  assert.equal(drawerHeightFor({ saved: Number.NaN, areaHeight: 900 }), CONSOLE_HEIGHT.default);
  assert.equal(drawerHeightFor({ saved: 500, areaHeight: 0 }), 500, 'not laid out yet: only the drawer\'s own bounds');
  assert.equal(drawerHeightFor({ saved: 5000, areaHeight: 0 }), CONSOLE_HEIGHT.max);
});

test('FD-227: the next and previous open agent go round the strip; none on show starts at an end', () => {
  const tabs = ['a.x', 'b.x', 'c.x'];
  assert.equal(tabStep(tabs, 'a.x', 1), 'b.x');
  assert.equal(tabStep(tabs, 'c.x', 1), 'a.x', 'after the last comes the first');
  assert.equal(tabStep(tabs, 'a.x', -1), 'c.x', 'before the first comes the last');
  assert.equal(tabStep(tabs, null, 1), 'a.x');
  assert.equal(tabStep(tabs, null, -1), 'c.x');
  assert.equal(tabStep(tabs, 'gone.x', 1), 'a.x', 'an agent not in the strip counts as none');
  assert.equal(tabStep(['a.x'], 'a.x', 1), 'a.x');
  assert.equal(tabStep([], 'a.x', 1), null);
});
