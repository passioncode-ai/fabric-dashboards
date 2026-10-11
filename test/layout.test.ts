// DEC-0036 ED-7, the host floor (fabric-agent-contract PR #27, docs/specification/embedded-dashboard.md):
// the dashboard keeps max(480, minWidth) CSS pixels beside the console whenever the window allows.
import assert from 'node:assert/strict';
import test from 'node:test';
import { consoleMaxFor, consoleWidthAfterResize, consoleWidthFor, HOST_FLOOR, hostFloorFor } from '../src/core/layout';
import { CONSOLE_WIDTH } from '../src/core/types';

test('ED-7: hostFloorFor — max(480, a valid declared minWidth), else 480', () => {
  assert.equal(HOST_FLOOR, 480);
  assert.equal(hostFloorFor(), 480);
  assert.equal(hostFloorFor(null), 480);
  assert.equal(hostFloorFor(720), 720);
  assert.equal(hostFloorFor(1280), 1280);
  assert.equal(hostFloorFor(360), 480, 'a page that fits 360 still gets the 480 every dashboard gets');
  for (const bad of [240, 'x', 2000, 720.5, '720', Number.NaN, {}]) assert.equal(hostFloorFor(bad), 480, `minWidth ${String(bad)}`);
});

test('ED-7: a wide window keeps the saved width', () => {
  assert.equal(consoleWidthFor({ saved: 440, splitWidth: 1680, hostFloor: 480 }), 440);
  assert.equal(consoleWidthFor({ saved: 900, splitWidth: 1680, hostFloor: 480 }), 900);
});

test('ED-7: a narrow area caps the console so the dashboard keeps 480', () => {
  const splitWidth = 1100;
  const w = consoleWidthFor({ saved: 900, splitWidth, hostFloor: 480 });
  assert.equal(w, 620);
  assert.ok(splitWidth - w >= 480, `dashboard ${splitWidth - w}`);
  assert.equal(consoleMaxFor(splitWidth, 480), 620, 'the separator stops where the dashboard floor begins');
});

test('ED-7: a declared minWidth of 720 raises the floor', () => {
  const floor = hostFloorFor(720);
  const w = consoleWidthFor({ saved: 900, splitWidth: 1400, hostFloor: floor });
  assert.equal(w, 680);
  assert.equal(1400 - w, 720);
});

test('ED-7: an invalid minWidth (240, "x", 2000) keeps the floor at 480', () => {
  for (const bad of [240, 'x', 2000]) assert.equal(consoleWidthFor({ saved: 900, splitWidth: 1100, hostFloor: hostFloorFor(bad) }), 620);
});

test('ED-7: a split too small for both keeps the console at its 320 minimum', () => {
  assert.equal(consoleWidthFor({ saved: 440, splitWidth: 720, hostFloor: 480 }), 320); // 720 − 480 = 240 < 320
  assert.equal(consoleMaxFor(720, 480), 320);
  assert.equal(consoleWidthFor({ saved: 100, splitWidth: 1680, hostFloor: 480 }), CONSOLE_WIDTH.min);
});

test('ED-7: never over the console maximum; an area not yet measured holds only the console\'s own bounds', () => {
  assert.equal(consoleWidthFor({ saved: 5000, splitWidth: 4000, hostFloor: 480 }), CONSOLE_WIDTH.max);
  assert.equal(consoleWidthFor({ saved: 900, splitWidth: 0, hostFloor: 480 }), 900);
  assert.equal(consoleMaxFor(0, 480), CONSOLE_WIDTH.max);
  assert.equal(consoleWidthFor({ saved: Number.NaN, splitWidth: 1680, hostFloor: 480 }), CONSOLE_WIDTH.default);
});

test('ED-7: the saved width comes back when the window widens again', () => {
  const saved = 900; // never rewritten by the window
  assert.equal(consoleWidthFor({ saved, splitWidth: 1000, hostFloor: 480 }), 520);
  assert.equal(consoleWidthFor({ saved, splitWidth: 1800, hostFloor: 480 }), 900);
});

test('ED-7: a fractional area width never gives the dashboard less than its floor', () => {
  const splitWidth = 1100.6;
  const w = consoleWidthFor({ saved: 900, splitWidth, hostFloor: 480 });
  assert.ok(splitWidth - w >= 480);
});

test('ED-7: a drag stops at the floor, and a push against it keeps the remembered width', () => {
  // A window that holds a remembered 900 at 620: pushing wider moves nothing and saves nothing.
  assert.equal(consoleWidthAfterResize({ requested: 644, shown: 620, saved: 900, splitWidth: 1100, hostFloor: 480 }), null);
  // Dragging narrower is the person's choice: it is saved.
  assert.equal(consoleWidthAfterResize({ requested: 596, shown: 620, saved: 900, splitWidth: 1100, hostFloor: 480 }), 596);
  // A drag past the floor stops at it.
  assert.equal(consoleWidthAfterResize({ requested: 1000, shown: 500, saved: 500, splitWidth: 1100, hostFloor: 480 }), 620);
  // Releasing where the panel already is saves it (the drag's commit).
  assert.equal(consoleWidthAfterResize({ requested: 620, shown: 620, saved: 620, splitWidth: 1100, hostFloor: 480 }), 620);
  // Under the minimum, the minimum.
  assert.equal(consoleWidthAfterResize({ requested: 100, shown: 400, saved: 400, splitWidth: 1100, hostFloor: 480 }), 320);
});
