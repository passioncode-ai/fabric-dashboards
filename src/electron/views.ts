// One live WebContentsView per service (SCN-015): created on first open, kept
// while the app runs, swapped — never reloaded or duplicated — when the
// operator switches services.
import { BrowserWindow, dialog, session, shell, WebContentsView } from 'electron';
import type { Rect } from '../core/api';
import { t, type Lang } from '../core/i18n';
import { loginUrl, readToken } from '../core/probe';
import type { ServiceSnapshot } from '../core/types';
import { clampRect, navigation, partitionFor, resolveLink, ViewSlot } from './policy';
import { testRemote } from '../core/testhooks';

interface Entry { view: WebContentsView; origin: string; crashes: number; loadedOnce: boolean }

export class ServiceViews {
  private readonly views = new Map<string, Entry>();
  private shown: string | null = null;
  private readonly slot = new ViewSlot();

  constructor(
    private readonly window: BrowserWindow,
    private readonly lang: () => Lang,
    private readonly emit: (event: { key: string; kind: 'restarted' | 'crashed' | 'loaded' | 'error'; error?: string }) => void,
  ) {}

  private create(snap: ServiceSnapshot): Entry {
    const d = snap.descriptor!;
    const partition = partitionFor(snap.key);
    const ses = session.fromPartition(partition);
    // DEC-0019 test hook: trust exactly the test certificate for exactly the test name; every
    // other request keeps Chromium's verification (-3). Never set in a packaged app.
    const remote = testRemote();
    if (remote) {
      ses.setCertificateVerifyProc((request, callback) => {
        if (request.hostname === remote.name && request.certificate.data.trim() === remote.caPem.trim()) callback(0);
        else callback(-3);
      });
    }
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    const view = new WebContentsView({
      webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false },
    });
    view.setBackgroundColor('#0a070d');
    const entry: Entry = { view, origin: d.origin, crashes: 0, loadedOnce: false };
    const wc = view.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      void this.external(url, d.origin);
      return { action: 'deny' };
    });
    wc.on('will-navigate', (event, url) => {
      const verdict = navigation(d.origin, url);
      if (verdict === 'allow') return;
      event.preventDefault();
      if (verdict === 'external') void this.external(url, d.origin);
    });
    wc.on('will-redirect', (event, url) => {
      if (navigation(d.origin, url) !== 'allow') event.preventDefault();
    });
    wc.on('did-finish-load', () => { entry.loadedOnce = true; this.emit({ key: snap.key, kind: 'loaded' }); });
    wc.on('did-fail-load', (_e, code, description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) this.emit({ key: snap.key, kind: 'error', error: description });
    });
    wc.on('render-process-gone', () => {
      entry.crashes += 1;
      if (entry.crashes === 1) void this.load(snap);
      else this.emit({ key: snap.key, kind: 'crashed' });
    });
    this.views.set(snap.key, entry);
    return entry;
  }

  private async external(url: string, origin: string): Promise<void> {
    if (navigation(origin, url) !== 'external') return;
    const lang = this.lang();
    const { response } = await dialog.showMessageBox(this.window, {
      type: 'question', buttons: [t(lang, 'external.open'), t(lang, 'action.cancel')], defaultId: 1, cancelId: 1,
      message: t(lang, 'external.title'), detail: t(lang, 'external.body', { url }),
    });
    if (response === 0) await shell.openExternal(url);
  }

  /** Load the dashboard, signed in through a one-time code when the service asks for one. */
  private async load(snap: ServiceSnapshot, link?: string): Promise<{ ok: boolean; error?: string }> {
    const entry = this.views.get(snap.key) ?? this.create(snap);
    const d = snap.descriptor!;
    const dash = snap.wellKnown?.surfaces.dashboard;
    if (!dash) return { ok: false, error: 'no dashboard' };
    try {
      let url = resolveLink(d.origin, link, dash.path);
      if (dash.login) {
        const token = readToken(d.auth.tokenFile); // main process only
        url = await loginUrl(d, token);
        await entry.view.webContents.loadURL(url);
        if (link) await entry.view.webContents.loadURL(resolveLink(d.origin, link, dash.path));
        return { ok: true };
      }
      await entry.view.webContents.loadURL(url);
      return { ok: true };
    } catch (error) {
      const message = (error as Error).message;
      if (/ERR_ABORTED/.test(message)) return { ok: true };
      return { ok: false, error: message };
    }
  }

  /** Show a service's view for the dashboard host `owner`. A show overtaken while it loaded — by a
   *  newer show or a hide — returns without attaching, so a slow page never covers the current one. */
  async show(snap: ServiceSnapshot, rect: Rect, link: string | undefined, owner: string): Promise<{ ok: boolean; error?: string }> {
    const ticket = this.slot.request(owner, snap.key);
    if (!snap.descriptor || !snap.wellKnown || (snap.state !== 'ready' && snap.state !== 'degraded')) {
      this.slot.release(owner);
      this.hideNow();
      return { ok: false, error: 'unavailable' };
    }
    const existing = this.views.get(snap.key);
    if (existing && existing.origin !== snap.descriptor.origin) this.drop(snap.key);
    let entry = this.views.get(snap.key);
    let result: { ok: boolean; error?: string } = { ok: true };
    if (!entry || !entry.loadedOnce) {
      entry = entry ?? this.create(snap);
      result = await this.load(snap, link);
    } else if (link) {
      await entry.view.webContents.loadURL(resolveLink(snap.descriptor.origin, link, snap.wellKnown.surfaces.dashboard?.path ?? '/'));
    }
    if (!this.slot.current(ticket) || !this.views.has(snap.key)) return result;
    if (this.shown && this.shown !== snap.key) this.detach(this.shown);
    if (this.shown !== snap.key) this.window.contentView.addChildView(entry.view);
    this.shown = snap.key;
    entry.view.setBounds(clampRect(rect));
    return result;
  }

  setBounds(rect: Rect): void {
    if (this.shown) this.views.get(this.shown)?.view.setBounds(clampRect(rect));
  }

  private detach(key: string): void {
    const entry = this.views.get(key);
    if (entry) this.window.contentView.removeChildView(entry.view);
  }

  /** Hide for the host `owner` — only its own view; a stale hide from an unmounted host is ignored.
   *  Without an owner (the app left the service page) whatever is shown is hidden. */
  hide(owner?: string): void {
    if (this.slot.release(owner) || owner === undefined) this.hideNow();
  }

  private hideNow(): void {
    if (this.shown) this.detach(this.shown);
    this.shown = null;
  }

  async reload(snap: ServiceSnapshot): Promise<void> {
    const entry = this.views.get(snap.key);
    if (!entry) return;
    entry.crashes = 0;
    entry.loadedOnce = false;
    await this.load(snap);
  }

  /** The service restarted: its session cookie may be gone; the page offers Reload instead of reloading itself. */
  serviceRestarted(key: string): void {
    if (this.views.has(key)) this.emit({ key, kind: 'restarted' });
  }

  drop(key: string): void {
    const entry = this.views.get(key);
    if (!entry) return;
    if (this.shown === key) this.hideNow();
    entry.view.webContents.close();
    this.views.delete(key);
  }

  keys(): string[] {
    return [...this.views.keys()];
  }
}
