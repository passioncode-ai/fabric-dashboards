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
