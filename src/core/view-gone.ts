/** Wave 1 (C-07): a closed `WebContentsView` drops its `webContents` (it reads `undefined`), so a timer or an event
 *  that fires after the close must not call `isDestroyed()` on it. True when the view's page is gone either way. */
export function viewGone(view: { webContents?: { isDestroyed(): boolean } | null } | null | undefined): boolean {
  return !view?.webContents || view.webContents.isDestroyed();
}
