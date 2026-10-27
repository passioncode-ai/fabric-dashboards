// #region window-occlusion — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#decision
/** FD-80: whether a window the system counts as shown is in fact in sight, from macOS's own list of on-screen windows
 *  (`CGWindowListCopyWindowInfo` with OnScreenOnly, front to back). Electron reports neither: measured 2026-10-27, a
 *  window under a screen-saver-level window of the same app read `visibilityState: visible` for 15 s. */
export interface OnScreenWindow { id: number; layer: number; alpha: number; x: number; y: number; w: number; h: number }
export type Sight = 'visible' | 'covered' | 'off-screen';

/** Not in the list: on another Space (or minimized). Covered: every point of a 9 by 9 grid inside it lies under some
 *  window above it, so a strip left uncovered keeps it in sight. A window list that cannot be read decides nothing. */
export function sightOf(windows: readonly OnScreenWindow[] | null, ownId: number | null): Sight | null {
  if (!windows || ownId === null) return null;
  const at = windows.findIndex((w) => w.id === ownId);
  if (at < 0) return 'off-screen';
  const own = windows[at]!;
  if (own.w <= 0 || own.h <= 0) return null;
  // Only ordinary application windows (layer 0) hide another: the system keeps full-screen windows of its own above
  // them (layer 20, the Dock's, measured 2026-10-27 at 1728 by 1117 with alpha 1) that cover nothing a person sees.
  const above = windows.slice(0, at).filter((w) => w.layer === 0 && w.alpha > 0 && w.w > 0 && w.h > 0);
  const inside = (px: number, py: number) => above.some((w) => px >= w.x && px < w.x + w.w && py >= w.y && py < w.y + w.h);
  for (let i = 0; i < 9; i += 1) {
    for (let j = 0; j < 9; j += 1) {
      if (!inside(own.x + (own.w * (i + 0.5)) / 9, own.y + (own.h * (j + 0.5)) / 9)) return 'visible';
    }
  }
  return 'covered';
}

/** The window number macOS gives an Electron window, from `getMediaSourceId()` ("window:<id>:0"). */
export function windowNumberOf(mediaSourceId: string): number | null {
  const m = /^window:(\d+):/.exec(mediaSourceId);
  return m ? Number(m[1]) : null;
}

/** Parses the probe's JSON; anything else reads as unknown. */
export function parseWindows(stdout: string): OnScreenWindow[] | null {
  try {
    const v = JSON.parse(stdout) as unknown;
    if (!Array.isArray(v)) return null;
    const out: OnScreenWindow[] = [];
    for (const w of v as Record<string, unknown>[]) {
      const n = (k: string) => (typeof w[k] === 'number' && Number.isFinite(w[k]) ? (w[k] as number) : null);
      const f = { id: n('id'), layer: n('layer'), alpha: n('alpha'), x: n('x'), y: n('y'), w: n('w'), h: n('h') };
      if (Object.values(f).some((x) => x === null)) return null;
      out.push(f as OnScreenWindow);
    }
    return out;
  } catch {
    return null;
  }
}
/** The JXA that prints macOS's on-screen windows, front to back, as JSON (`osascript -l JavaScript -e`). Window
 *  bounds and numbers need no Screen Recording permission; titles are never read. */
export const WINDOW_LIST_JXA = [
  "ObjC.import('CoreGraphics');",
  'const l = ObjC.castRefToObject($.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements, 0));',
  'const o = [];',
  "for (let i = 0; i < l.count; i++) { const w = l.objectAtIndex(i); const b = w.objectForKey('kCGWindowBounds');",
  "  o.push({ id: w.objectForKey('kCGWindowNumber').js, layer: w.objectForKey('kCGWindowLayer').js, alpha: w.objectForKey('kCGWindowAlpha').js,",
  "    x: b.objectForKey('X').js, y: b.objectForKey('Y').js, w: b.objectForKey('Width').js, h: b.objectForKey('Height').js }); }",
  'JSON.stringify(o);',
].join('\n');
// #endregion window-occlusion
