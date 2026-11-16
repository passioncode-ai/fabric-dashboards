// FD-92 (SCN-048): the console drawer's height over the content area; the dashboard is never resized.
import assert from 'node:assert/strict';
import test from 'node:test';
import { addTab, drawerHeightFor, MAX_TABS, moveTab, orderPinned, pinnedOf, pinTab, tabStep, titleBarAction, titleBarDoubleClick } from '../src/core/layout';
import { mergeLayout } from '../src/core/settings';
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

test('FD-228: a full strip makes room by dropping its oldest agent, which is named so its dashboard is released', () => {
  assert.deepEqual(addTab(['a', 'b'], 'c'), { tabs: ['a', 'b', 'c'], dropped: [] });
  assert.deepEqual(addTab(['a', 'b'], 'a'), { tabs: ['a', 'b'], dropped: [] }, 'already open: nothing moves');
  const full = Array.from({ length: MAX_TABS }, (_, i) => `s${i}`);
  assert.deepEqual(addTab(full, 'new'), { tabs: [...full.slice(1), 'new'], dropped: ['s0'] });
  assert.deepEqual(addTab(['a', 'b', 'c'], 'd', 2), { tabs: ['c', 'd'], dropped: ['a', 'b'] }, 'a strip over the cap is cut back to it');
});

test('FD-240: an open agent dragged onto another takes its place; the rest keep their order', () => {
  const tabs = ['a.x', 'b.x', 'c.x', 'd.x'];
  assert.deepEqual(moveTab(tabs, 'a.x', 'c.x'), ['b.x', 'c.x', 'a.x', 'd.x'], 'moving right lands after the target');
  assert.deepEqual(moveTab(tabs, 'd.x', 'b.x'), ['a.x', 'd.x', 'b.x', 'c.x'], 'moving left lands before it');
  assert.deepEqual(moveTab(tabs, 'b.x', 'c.x'), ['a.x', 'c.x', 'b.x', 'd.x'], 'one step right, as the keyboard moves it');
  assert.deepEqual(moveTab(tabs, 'b.x', 'b.x'), tabs, 'onto itself: nothing');
  assert.deepEqual(moveTab(tabs, 'z.x', 'b.x'), tabs, 'an agent not in the strip: nothing');
  assert.notEqual(moveTab(tabs, 'b.x', 'b.x'), tabs, 'always a new list, never the one given');
});

test('FD-280: a pinned tab goes first, keeps its place against a full strip, and unpinning puts it after the pinned', () => {
  const p = pinTab(['a', 'b', 'c'], [], 'c', true);
  assert.deepEqual(p, { tabs: ['c', 'a', 'b'], pinned: ['c'] });
  assert.deepEqual(pinTab(p.tabs, p.pinned, 'a', true), { tabs: ['c', 'a', 'b'], pinned: ['c', 'a'] });
  assert.deepEqual(pinTab(['c', 'a', 'b'], ['c', 'a'], 'c', false), { tabs: ['a', 'c', 'b'], pinned: ['a'] });
  const full = Array.from({ length: MAX_TABS }, (_, i) => `s${i}`);
  const added = addTab(full, 'new', MAX_TABS, ['s0']);
  assert.ok(added.tabs.includes('s0'), 'the pinned oldest stays');
  assert.deepEqual(added.dropped, ['s1']);
  assert.deepEqual(moveTab(['c', 'a', 'b'], 'b', 'c', ['c']), ['c', 'a', 'b'], 'an unpinned tab does not move among the pinned');
  assert.deepEqual(moveTab(['c', 'a', 'b'], 'b', 'a', ['c']), ['c', 'b', 'a']);
  assert.deepEqual(orderPinned(['a', 'b', 'c'], ['c']), ['c', 'a', 'b']);
  assert.deepEqual(pinnedOf(['c', 'a'], ['a', 'gone', 'c']), ['c', 'a'], 'pinned keys in strip order, gone ones dropped');
});

test('FD-280: a saved layout keeps only pinned tabs that are open, first', () => {
  const l = mergeLayout({ tabs: ['a', 'b', 'c'], pinnedTabs: ['c', 'gone'] } as never);
  assert.deepEqual(l.tabs, ['c', 'a', 'b']);
  assert.deepEqual(l.pinnedTabs, ['c']);
  assert.deepEqual(mergeLayout({ tabs: ['a'] } as never).pinnedTabs, [], 'an older layout has none');
});

test('FD-282: a double-click on the sidebar follows the title-bar setting', () => {
  assert.equal(titleBarAction(undefined), 'zoom');
  assert.equal(titleBarAction('Maximize'), 'zoom');
  assert.equal(titleBarAction('Minimize'), 'minimize');
  assert.equal(titleBarAction('None'), 'none');
  const calls: string[] = [];
  let max = false;
  const win = { isMaximized: () => max, maximize: () => { calls.push('max'); max = true; }, unmaximize: () => { calls.push('unmax'); max = false; }, minimize: () => calls.push('min') };
  titleBarDoubleClick(win, undefined); titleBarDoubleClick(win, undefined); titleBarDoubleClick(win, 'Minimize'); titleBarDoubleClick(win, 'None');
  assert.deepEqual(calls, ['max', 'unmax', 'min']);
});
