// #region console-drawer — docs: docs/ux/scenarios.md#scn-048-open-an-agents-console-over-its-dashboard
// FD-92: the agent console opens as a drawer from the top of the content area, over the dashboard,
// and never resizes it: the dashboard keeps its whole width and height, so the contract's host floor
// (DEC-0036 ED-7, max(480, minWidth)) holds by construction. The drawer's height is the operator's,
// held so that some of the page always shows under it. No Node imports: the renderer uses it.
import { CONSOLE_HEIGHT } from './types';

/**
 * The drawer's height in the area under the page header (`areaHeight`, measured; 0 while not laid out):
 * the saved height, never under the drawer's own minimum and never so tall that less than
 * CONSOLE_HEIGHT.reveal of the page shows under it. The saved height itself is never changed here:
 * a taller window gives it back.
 */
export function drawerHeightFor({ saved, areaHeight }: { saved: number; areaHeight: number }): number {
  const wanted = Math.round(Number.isFinite(saved) ? saved : CONSOLE_HEIGHT.default);
  const max = areaHeight > 0 ? Math.max(CONSOLE_HEIGHT.min, Math.floor(areaHeight - CONSOLE_HEIGHT.reveal)) : CONSOLE_HEIGHT.max;
  return Math.max(CONSOLE_HEIGHT.min, Math.min(wanted, max, CONSOLE_HEIGHT.max));
}

/** Where the drawer's view goes over `rect` (the area under the page header). An agent's drawer: its height plus the
 *  strip its shadow falls on, or the whole area while its edge is dragged. FD-103 (SCN-080): a session page's console
 *  is the whole area, the full height of the window under the header. */
export function drawerBoundsFor(o: { rect: { x: number; y: number; width: number; height: number }; saved: number; full?: boolean; dragging?: boolean; shadow: number }): { x: number; y: number; width: number; height: number } {
  const { rect } = o;
  if (o.full || o.dragging) return rect;
  return { x: rect.x, y: rect.y, width: rect.width, height: Math.min(rect.height, drawerHeightFor({ saved: o.saved, areaHeight: rect.height }) + o.shadow) };
}
// #endregion console-drawer

/** FD-107: where a scrolled view goes to show an element (both in the view's content coordinates): unchanged while the
 *  element is in view, else only as far as its bottom and `margin`, never so far that its top leaves the view. The
 *  sidebar keeps the current session's row in view with it, and Settings → Sessions keeps the page title in view when
 *  the section fits under it. */
export function revealScrollTop(view: { scrollTop: number; height: number }, el: { top: number; height: number }, margin = 0): number {
  const viewTop = view.scrollTop;
  const viewBottom = view.scrollTop + view.height;
  if (el.top - margin < viewTop) return Math.max(0, el.top - margin);
  if (el.top + el.height + margin <= viewBottom) return viewTop;
  return Math.max(0, Math.min(el.top + el.height + margin - view.height, el.top - margin));
}

// #region open-agents — docs: docs/ux/scenarios.md#scn-105-keep-several-agents-open-and-move-between-them
/** FD-220: at most this many agents stay open in the strip. */
export const MAX_TABS = 12;

/** FD-228: the strip with `key` added at the end, and the agents that leave it to make room (the oldest first), whose
 *  dashboards are released as Close releases one. An agent already in the strip changes nothing. */
export function addTab(tabs: readonly string[], key: string, max = MAX_TABS): { tabs: string[]; dropped: string[] } {
  if (tabs.includes(key)) return { tabs: [...tabs], dropped: [] };
  const all = [...tabs, key];
  const cut = Math.max(0, all.length - max);
  return { tabs: all.slice(cut), dropped: all.slice(0, cut) };
}

/** FD-227: the open agent a step away from the one on show (`step` 1 next, -1 previous), round the strip. With no agent
 *  on show, or one not in the strip, the next step is the first and the previous the last; an empty strip has none. */
export function tabStep(tabs: readonly string[], current: string | null, step: 1 | -1): string | null {
  if (!tabs.length) return null;
  const at = current === null ? -1 : tabs.indexOf(current);
  if (at < 0) return step === 1 ? tabs[0]! : tabs[tabs.length - 1]!;
  return tabs[(at + step + tabs.length) % tabs.length]!;
}
// #endregion open-agents
