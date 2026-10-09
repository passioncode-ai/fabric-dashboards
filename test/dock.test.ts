// FD-05 / FD-35: the Dock icon follows the window, and a hide always wins. Pure, without Electron:
// a fake Dock reproduces what macOS did on 2026-10-08 — a hide asked for while a show is still
// settling is dropped, so one hide() call left the icon in the Dock for good.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DockSync, type DockApi } from '../src/electron/dock';

class FakeDock implements DockApi {
  visible = true;
  hides = 0;
  shows = 0;
  /** hide() calls macOS drops before one takes. */
  dropHides = 0;
  /** show() resolves only when this is called. */
  private settle: (() => void) | null = null;
  show(): Promise<void> {
    this.shows += 1;
    return new Promise((resolve) => { this.settle = () => { this.visible = true; resolve(); }; });
  }
  finishShow(): void { this.settle?.(); this.settle = null; }
  hide(): void {
    this.hides += 1;
    if (this.dropHides > 0) { this.dropHides -= 1; return; }
    this.visible = false;
  }
  isVisible(): boolean { return this.visible; }
}

const noWait = () => Promise.resolve();

test('FD-35: a hide macOS drops while a show settles is asked again until the Dock reports hidden', async () => {
  const dock = new FakeDock();
  dock.dropHides = 2;
  const sync = new DockSync(dock, noWait);
  assert.equal(await sync.want(false), true, 'the icon is gone');
  assert.equal(dock.isVisible(), false);
  assert.equal(dock.hides, 3, 'two dropped hides, then one that took');
});

test('FD-05: a show that finishes after a hide is hidden again', async () => {
  const dock = new FakeDock();
  dock.visible = false;
  const sync = new DockSync(dock, noWait);
  const showing = sync.want(true);
  assert.equal(await sync.want(false), true);
  dock.finishShow(); // macOS puts the icon back late
  await showing;
  assert.equal(dock.isVisible(), false, 'the later hide wins over the earlier show');
});

test('FD-05: a show resolves the icon, and a visible Dock is not asked to show again', async () => {
  const dock = new FakeDock();
  dock.visible = false;
  const sync = new DockSync(dock, noWait);
  const showing = sync.want(true);
  dock.finishShow();
  assert.equal(await showing, true);
  assert.equal(await sync.want(true), true);
  assert.equal(dock.shows, 1, 'already visible: no second show to race a later hide');
});

test('FD-35: a hide that never takes stops after its bounded tries and says so', async () => {
  const dock = new FakeDock();
  dock.dropHides = Number.POSITIVE_INFINITY;
  let waits = 0;
  const sync = new DockSync(dock, () => { waits += 1; return Promise.resolve(); }, { tries: 5, retryMs: 1 });
  assert.equal(await sync.want(false), false, 'reported, never a silent success');
  assert.equal(dock.hides, 5);
  assert.equal(waits, 5, 'every ask is followed by a settle pause before the state is read');
});

test('FD-35: a show asked for while a hide retries ends the retries', async () => {
  const dock = new FakeDock();
  dock.dropHides = Number.POSITIVE_INFINITY;
  let sync!: DockSync;
  let waits = 0;
  sync = new DockSync(dock, () => { waits += 1; if (waits === 2) void sync.want(true); return Promise.resolve(); }, { tries: 25, retryMs: 1 });
  assert.equal(await sync.want(false), false, 'superseded, not hidden');
  assert.ok(dock.hides <= 3, `stopped retrying once the window came back (hides=${dock.hides})`);
});

/**
 * Electron 44's Dock as `shell/browser/browser_mac.mm:441-504` builds it, for an app that is not
 * frontmost: show() transforms at once and records the time; hide() is a no-op within 1 s of a show;
 * isVisible() reads NSRunningApplication's activationPolicy, which macOS updates only after the run
 * loop turns — here, after the next wait.
 */
class ElectronDock implements DockApi {
  clock = 0;
  visible = false;
  reported = false;
  lastShow = Number.NEGATIVE_INFINITY;
  show(): void { this.lastShow = this.clock; this.visible = true; }
  hide(): void { if (this.clock - this.lastShow < 1000) return; this.visible = false; }
  isVisible(): boolean { return this.reported; }
  wait = (ms: number): Promise<void> => { this.clock += ms; this.reported = this.visible; return Promise.resolve(); };
}

test('FD-35: a hide right after a show waits out Electron\'s 1-second guard instead of trusting a stale "hidden"', async () => {
  const dock = new ElectronDock();
  const sync = new DockSync(dock, dock.wait, {}, () => dock.clock);
  assert.equal(await sync.want(true), true);
  assert.equal(dock.visible, true);
  // The window hides at once — inside the guard, while activationPolicy still reads "not regular".
  assert.equal(await sync.want(false), true);
  assert.equal(dock.visible, false, 'the icon is really gone, not only reported gone');
  assert.ok(dock.clock - dock.lastShow >= 1000, 'the hide was asked after the guard');
});

test('no Dock (not macOS): nothing to do, and that is not a failure', async () => {
  const sync = new DockSync(undefined, noWait);
  assert.equal(await sync.want(false), true);
  assert.equal(await sync.want(true), true);
});
