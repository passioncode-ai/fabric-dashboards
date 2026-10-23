// #region console-drawer — docs: docs/ux/scenarios.md#scn-048-open-an-agents-console-over-its-dashboard
// FD-92: the agent console as a drawer over the content area. A service's dashboard is a native view
// (WebContentsView) that lies over the window's own page, so a console drawn in that page would sit
// under it; the drawer is therefore a view of its own, added above the dashboard, loading the same
// renderer with `?drawer=1`. It never resizes the dashboard. Its background is transparent: while the
// person drags its bottom edge it covers the whole area to keep the pointer, and shows only the drawer.
import { type BrowserWindow, WebContentsView } from 'electron';
import { CHANNELS, type DrawerPush, type DrawerState, type Rect } from '../core/api';
import { drawerHeightFor } from '../core/layout';

/** FD-92: the strip under the drawer where its shadow falls on the dashboard (part of the drawer's view). */
export const DRAWER_SHADOW = 14;

export interface DrawerOptions {
  preload: string;
  index: string;
  log: (line: string) => void;
}

export class ConsoleDrawer {
  private view: WebContentsView | null = null;
  private attached = false;
  private ready = false;
  private dragging = false;
  private state: DrawerState = { key: null, open: false, rect: null, height: 0, task: null, suspended: false };

  constructor(private readonly window: BrowserWindow, private readonly o: DrawerOptions) {}

  /** What the window's page says to show: which console, open or not, the area under the page header. */
  set(next: DrawerState): void {
    this.state = next;
    this.apply();
  }

  /** The drawer's own page asks to cover the whole area while its edge is dragged, and to shrink back after. */
  setDragging(on: boolean): void {
    this.dragging = on;
    this.apply();
  }

  /** A dashboard shown after the drawer went on top of it: the drawer goes back on top (Electron keeps the last added child topmost). */
  raise(): void {
    if (this.attached && this.view && !this.window.isDestroyed()) this.window.contentView.addChildView(this.view);
  }

  /** The drawer's webContents, to receive the console's events (null while it has none). */
  contents(): Electron.WebContents | null {
    return this.view && !this.view.webContents.isDestroyed() ? this.view.webContents : null;
  }

  destroy(): void {
    if (!this.view) return;
    this.detach();
    if (!this.view.webContents.isDestroyed()) this.view.webContents.close();
    this.view = null;
  }

  private shown(): boolean {
    const s = this.state;
    return Boolean(s.open && s.key && s.rect && s.rect.width > 0 && s.rect.height > 0 && !s.suspended);
  }

  private apply(): void {
    if (this.window.isDestroyed()) return;
    if (!this.shown()) { this.detach(); return; }
    const view = this.ensure();
    const rect = this.state.rect!;
    const height = drawerHeightFor({ saved: this.state.height, areaHeight: rect.height });
    const bounds: Rect = this.dragging ? rect : { x: rect.x, y: rect.y, width: rect.width, height: Math.min(rect.height, height + DRAWER_SHADOW) };
    view.setBounds(round(bounds));
    this.window.contentView.addChildView(view); // added again: on top of any dashboard
    this.attached = true;
    this.push();
  }

  private push(): void {
    if (!this.view || !this.ready || this.view.webContents.isDestroyed()) return;
    const s = this.state;
    const payload: DrawerPush = { key: s.key, height: s.rect ? drawerHeightFor({ saved: s.height, areaHeight: s.rect.height }) : s.height, areaHeight: s.rect?.height ?? 0, task: s.task };
    this.view.webContents.send(CHANNELS.drawerPush, payload);
  }

  private detach(): void {
    if (this.attached && this.view && !this.window.isDestroyed()) this.window.contentView.removeChildView(this.view);
    this.attached = false;
  }

  private ensure(): WebContentsView {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    const view = new WebContentsView({ webPreferences: { preload: this.o.preload, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false } });
    view.setBackgroundColor('#00000000');
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event) => event.preventDefault());
    view.webContents.on('did-finish-load', () => { this.ready = true; this.push(); });
    view.webContents.on('render-process-gone', (_e, d) => {
      this.o.log(`console drawer: its page ended (${d.reason}); it opens again with the next show`);
      this.ready = false;
      this.detach();
      this.view = null;
    });
    this.ready = false;
    void view.webContents.loadFile(this.o.index, { query: { drawer: '1' } });
    this.view = view;
    return view;
  }
}

function round(r: Rect): Rect {
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)) };
}
// #endregion console-drawer
