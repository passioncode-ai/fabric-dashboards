// One live WebContentsView per service (SCN-015): created on first open, kept
// while the window is in use, swapped — never reloaded or duplicated — when the
// operator switches services. A window hidden past the grace period releases
// every view (releaseAll, lifecycle LC-08); showing it brings back the one that
// was on screen, on the page it was on (resume).
import { BrowserWindow, dialog, session, shell, WebContentsView } from 'electron';
import type { PageState, Rect } from '../core/api';
import { t, type Lang } from '../core/i18n';
import { loginUrl, readToken } from '../core/probe';
import type { ServiceSnapshot } from '../core/types';
import { clampRect, navigation, pageAddress, partitionFor, resolveLink, resumePath, routeLink, ViewSlot } from './policy';
import { testRemote } from '../core/testhooks';

/** A view signs in again after a 401 at most this often (copylot finding 2026-10-05). */
const RESIGN_EVERY_MS = 60_000;

interface Entry { view: WebContentsView; origin: string; crashes: number; loadedOnce: boolean; dashboardPath: string; resignedAt: number; resignTo: string | undefined | null }


export class ServiceViews {
  private readonly views = new Map<string, Entry>();
  private shown: string | null = null;
  private readonly slot = new ViewSlot();
  private bounds: Rect | null = null;
  private released: { key: string; owner: string; rect: Rect; link?: string } | null = null;

  constructor(
    private readonly window: BrowserWindow,
    private readonly lang: () => Lang,
    private readonly emit: (event: { key: string; kind: 'restarted' | 'crashed' | 'loaded' | 'error' | 'navigated'; error?: string; page?: PageState }) => void,
    /** ADR-0016: a link to another service, handed to the app's deep-link check. */
    private readonly appLink: (raw: string) => void = () => undefined,
    /** The origins of every registered service, for routeLink. */
    private readonly serviceOrigins: () => string[] = () => [],
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
    // A dashboard session that ended while the page was open answers 401 on the main frame: sign
    // in again once, on the same page, instead of leaving the operator on the service's 401 text.
    // At most once a minute, so a service that refuses every code cannot loop. Read from the
    // session's own requests: a reload reports no status through the navigation events.
    ses.webRequest.onCompleted({ urls: [`${new URL(d.origin).origin}/*`] }, (details) => {
      if (details.resourceType !== 'mainFrame' || details.statusCode !== 401) return;
      const entry = this.views.get(snap.key);
      if (!entry || !snap.wellKnown?.surfaces.dashboard?.login) return;
      if (Date.now() - entry.resignedAt < RESIGN_EVERY_MS) return;
      entry.resignedAt = Date.now();
      // The 401 page is still committing: a login started now races it and can lose. Sign in once
      // the page has stopped loading (`did-stop-loading` below), or now if it already has.
      entry.resignTo = resumePath(details.url, d.origin);
      if (!entry.view.webContents.isLoading()) this.resign(snap, entry);
    });
    ses.setPermissionCheckHandler(() => false);
    const view = new WebContentsView({
      webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false },
    });
    view.setBackgroundColor('#0a070d');
    const entry: Entry = { view, origin: d.origin, crashes: 0, loadedOnce: false, dashboardPath: snap.wellKnown?.surfaces.dashboard?.path ?? '/', resignedAt: 0, resignTo: null };
    const wc = view.webContents;
    // ADR-0016: a link to another service opens it here, signed in with its own session.
    const follow = (url: string): boolean => {
      const route = routeLink(d.origin, url, this.serviceOrigins());
      if (route.kind === 'allow') return true;
      if (route.kind === 'app') this.appLink(route.link);
      else if (route.kind === 'external') void this.external(url, d.origin);
      return false;
    };
    wc.setWindowOpenHandler(({ url }) => {
      // A new window on the service's own origin opens in place: the view is the service's window.
      if (follow(url)) void wc.loadURL(url);
      return { action: 'deny' };
    });
    wc.on('will-navigate', (event, url) => {
      if (!follow(url)) event.preventDefault();
    });
    wc.on('will-redirect', (event, url) => {
      if (navigation(d.origin, url) !== 'allow') event.preventDefault();
    });
    wc.on('did-finish-load', () => { entry.loadedOnce = true; this.emit({ key: snap.key, kind: 'loaded' }); });
    // ADR-0014: the toolbar follows the page — a full navigation, an in-page route, loading on and off.
    const navigated = () => { const page = this.page(snap.key); if (page) this.emit({ key: snap.key, kind: 'navigated', page }); };
    wc.on('did-navigate', navigated);
    wc.on('did-navigate-in-page', navigated);
    wc.on('did-start-loading', navigated);
    wc.on('did-stop-loading', () => { navigated(); this.resign(snap, entry); });
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

  /** Run a re-sign-in the 401 handler asked for, once. */
  private resign(snap: ServiceSnapshot, entry: Entry): void {
    const to = entry.resignTo;
    if (to === null) return; // nothing asked; undefined asks for the dashboard's own page
    entry.resignTo = null;
    void this.load(snap, to).then((r) => {
      if (!r.ok) this.emit({ key: snap.key, kind: 'error', error: r.error });
    });
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
    this.released = null;
    this.bounds = clampRect(rect);
    entry.view.setBounds(this.bounds);
    return result;
  }

  setBounds(rect: Rect): void {
    this.bounds = clampRect(rect);
    if (this.shown) this.views.get(this.shown)?.view.setBounds(this.bounds);
  }

  /** Close every view and free its renderer. The one on screen is remembered — its host, place
   *  and page — so `resume` can bring it back when the window shows again. */
  releaseAll(): void {
    const key = this.shown;
    const owner = this.slot.owner();
    const entry = key ? this.views.get(key) : undefined;
    this.released = key && owner && entry && this.bounds
      ? { key, owner, rect: this.bounds, link: resumePath(entry.view.webContents.getURL(), entry.origin) }
      : null;
    for (const k of [...this.views.keys()]) this.drop(k);
  }

  /** The window is shown again: re-open the released view for the host that still holds the slot. */
  async resume(snapshotFor: (key: string) => ServiceSnapshot | null): Promise<void> {
    const r = this.released;
    this.released = null;
    if (!r || this.slot.owner() !== r.owner || this.slot.wanted() !== r.key) return;
    const snap = snapshotFor(r.key);
    if (snap) await this.show(snap, r.rect, r.link, r.owner);
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

  /** The toolbar's view of a service's page, or null when it has no view (ADR-0014). */
  page(key: string): PageState | null {
    const entry = this.views.get(key);
    if (!entry || entry.view.webContents.isDestroyed()) return null;
    const wc = entry.view.webContents;
    const { address, link } = pageAddress(wc.getURL(), entry.origin, entry.dashboardPath, key);
    return { key, address, link, canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward(), loading: wc.isLoading() };
  }

  /** Back, forward, the dashboard's own page, or the current page again — never another origin. */
  navigate(key: string, action: 'back' | 'forward' | 'home' | 'refresh'): void {
    const entry = this.views.get(key);
    if (!entry || entry.view.webContents.isDestroyed()) return;
    const wc = entry.view.webContents;
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    if (action === 'refresh') wc.reload();
    if (action === 'home') void wc.loadURL(`${new URL(entry.origin).origin}${entry.dashboardPath}`).catch(() => undefined);
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
