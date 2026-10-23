// FD-92 (SCN-048): the console drawer's height over the content area; the dashboard is never resized.
import assert from 'node:assert/strict';
import test from 'node:test';
import { drawerHeightFor } from '../src/core/layout';
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
