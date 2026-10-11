// #region host-floor — docs: docs/ux/scenarios.md#scn-060-the-dashboard-keeps-its-floor-while-the-console-widens
// Fabric Agent Contract DEC-0036, profile `fabric-dashboard/0.1`, ED-7 (the host floor): a host that
// shows a dashboard beside its own panes gives the page at least max(480, minWidth) CSS pixels
// whenever the window allows; the panes stop growing at that limit. When the window cannot fit both,
// the panes keep their own minimums and the page falls back to its own floor layout (ED-2). The page
// is never zoomed. Normative text: fabric-agent-contract docs/specification/embedded-dashboard.md
// (PR passioncode-ai/fabric-agent-contract#27). No Node imports: the renderer uses it.
import { DASHBOARD_MIN_WIDTH } from '@passioncode-ai/fabric-service-host/protocol';
import { CONSOLE_WIDTH } from './types';

/** ED-7: the width every dashboard gets, declared or not — a page built before the profile was never told it could be narrower. */
export const HOST_FLOOR = 480;

/** The host floor for a dashboard: max(480, its declared minWidth); a missing or invalid declaration is a legacy dashboard (480). */
export function hostFloorFor(minWidth?: unknown): number {
  const valid = typeof minWidth === 'number' && Number.isInteger(minWidth) && minWidth >= DASHBOARD_MIN_WIDTH.min && minWidth <= DASHBOARD_MIN_WIDTH.max;
  return valid ? Math.max(HOST_FLOOR, minWidth) : HOST_FLOOR;
}

/**
 * The console panel's width beside a dashboard: the operator's saved width, held under
 * `splitWidth − hostFloor` so the dashboard keeps its floor, never under the console's own minimum
 * (it wins when the window is too small for both) and never over CONSOLE_WIDTH.max. `splitWidth` is
 * the measured width of the area beside the sidebar; unknown (0, not yet laid out) holds only the
 * console's own bounds. The saved width itself is never changed here: widening the window gives it back.
 */
export function consoleWidthFor({ saved, splitWidth, hostFloor }: { saved: number; splitWidth: number; hostFloor: number }): number {
  return Math.max(CONSOLE_WIDTH.min, Math.min(Math.round(Number.isFinite(saved) ? saved : CONSOLE_WIDTH.default), consoleMaxFor(splitWidth, hostFloor)));
}

/** The widest the console may be now: what the dashboard's floor leaves, within the console's own bounds (the separator's aria-valuemax). */
export function consoleMaxFor(splitWidth: number, hostFloor: number): number {
  if (!(splitWidth > 0)) return CONSOLE_WIDTH.max;
  return Math.max(CONSOLE_WIDTH.min, Math.min(CONSOLE_WIDTH.max, Math.floor(splitWidth - hostFloor)));
}

/**
 * What a drag or an arrow key on the console's edge saves: the requested width held by the same
 * bounds, or null to keep the remembered width — a push against the floor that moves nothing must
 * not overwrite a wider width the window is only holding back (widening the window gives it back).
 */
export function consoleWidthAfterResize({ requested, shown, saved, splitWidth, hostFloor }: { requested: number; shown: number; saved: number; splitWidth: number; hostFloor: number }): number | null {
  const next = consoleWidthFor({ saved: requested, splitWidth, hostFloor });
  return next === shown && saved !== shown ? null : next;
}
// #endregion host-floor
