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
import { afterCrash, clampRect, dashboardPathOf, loadErrorText, navigation, pageAddress, partitionFor, resolveLink, resumePath, routeLink, ViewSlot } from './policy';
import { testRemote } from '../core/testhooks';

/** A view signs in again after a 401 at most this often (copylot finding 2026-10-05). */
const RESIGN_EVERY_MS = 60_000;


/** What showing a dashboard came to; `stage` tells a sign-in that failed from a page that would not load. */
export interface ShowResult { ok: boolean; error?: string; stage?: 'sign-in' | 'page' }

interface Entry { view: WebContentsView; origin: string; crashes: number; loadedOnce: boolean; loadedAt: number; dashboardPath: string; resignedAt: number; resignTo: string | undefined | null }


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
    /** The monitor's snapshot now. A sign-in or a recreate reads it, never the one the view was made
     *  from: whatever answers on the port now may not be the service any more (T-3). */
    private readonly snapshotFor: (key: string) => ServiceSnapshot | null = () => null,
  ) {}

  /** The service as it is now, when it may get a token: answering as itself, with its well-known. */
  private live(key: string): ServiceSnapshot | null {
    const snap = this.snapshotFor(key);
    return snap?.descriptor && snap.wellKnown && (snap.state === 'ready' || snap.state === 'degraded') ? snap : null;
  }

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
      if (!entry || !this.live(snap.key)?.wellKnown?.surfaces.dashboard?.login) return;
      if (Date.now() - entry.resignedAt < RESIGN_EVERY_MS) return;
      entry.resignedAt = Date.now();
      // The 401 page is still committing: a login started now races it and can lose. Sign in once
      // the page has stopped loading (`did-stop-loading` below), or now if it already has.
      entry.resignTo = resumePath(details.url, d.origin);
      if (!entry.view.webContents.isLoading()) this.resign(snap.key, entry);
    });
    ses.setPermissionCheckHandler(() => false);
    const view = new WebContentsView({
      webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false },
    });
    view.setBackgroundColor('#0a070d');
    const entry: Entry = { view, origin: d.origin, crashes: 0, loadedOnce: false, loadedAt: 0, dashboardPath: dashboardPathOf(snap.wellKnown?.surfaces.dashboard?.path), resignedAt: 0, resignTo: null };
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
    wc.on('did-finish-load', () => { entry.loadedOnce = true; entry.loadedAt = Date.now(); this.emit({ key: snap.key, kind: 'loaded' }); });
    // ADR-0014: the toolbar follows the page — a full navigation, an in-page route, loading on and off.
    const navigated = () => { const page = this.page(snap.key); if (page) this.emit({ key: snap.key, kind: 'navigated', page }); };
    wc.on('did-navigate', navigated);
    wc.on('did-navigate-in-page', navigated);
    wc.on('did-start-loading', navigated);
    wc.on('did-stop-loading', () => { navigated(); this.resign(snap.key, entry); });
    wc.on('did-fail-load', (_e, code, description, _url, isMainFrame) => {
      if (!isMainFrame || code === -3) return;
      entry.loadedOnce = false; // T-17: showing it again loads it again, never attaches Chromium's error page
      this.emit({ key: snap.key, kind: 'error', error: description });
    });
    wc.on('render-process-gone', () => {
      const next = afterCrash(entry.crashes, entry.loadedAt, Date.now());
      entry.crashes = next.crashes;
      entry.loadedOnce = false;
      entry.loadedAt = 0;
      const now = next.recreate ? this.live(snap.key) : null;
      if (now) void this.load(now);
      else this.emit({ key: snap.key, kind: 'crashed' });
    });
    this.views.set(snap.key, entry);
    return entry;
  }

  /** Run a re-sign-in the 401 handler asked for, once. */
  private resign(key: string, entry: Entry): void {
    const to = entry.resignTo;
    if (to === null) return; // nothing asked; undefined asks for the dashboard's own page
    entry.resignTo = null;
    const snap = this.live(key);
    if (!snap) return; // T-3: no token for whatever answers there now; the monitor's state says why
    void this.load(snap, to).then((r) => {
      if (!r.ok) this.emit({ key, kind: 'error', error: r.error });
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
  private async load(snap: ServiceSnapshot, link?: string): Promise<ShowResult> {
    const entry = this.views.get(snap.key) ?? this.create(snap);
    const d = snap.descriptor!;
    const dash = snap.wellKnown?.surfaces.dashboard;
    if (!dash) return { ok: false, error: 'no dashboard', stage: 'page' };
    let stage: ShowResult['stage'] = dash.login ? 'sign-in' : 'page';
    try {
      let url = resolveLink(d.origin, link, dash.path);
      if (dash.login) {
        const token = readToken(d.auth.tokenFile); // main process only
        url = await loginUrl(d, token);
        await entry.view.webContents.loadURL(url);
        stage = 'page';
        if (link) await entry.view.webContents.loadURL(resolveLink(d.origin, link, dash.path));
        return { ok: true };
      }
      await entry.view.webContents.loadURL(url);
      return { ok: true };
    } catch (error) {
      const text = loadErrorText(error);
      if (/ERR_ABORTED/.test(text)) return { ok: true };
      return { ok: false, error: text, stage }; // S-3: never the URL — a sign-in URL is the login code
    }
  }

  /** Open a path on an already loaded view; a failed navigation is a result, never a rejection (R-5). */
  private async go(entry: Entry, url: string): Promise<ShowResult> {
    try {
      await entry.view.webContents.loadURL(url);
      return { ok: true };
    } catch (error) {
      const text = loadErrorText(error);
      return /ERR_ABORTED/.test(text) ? { ok: true } : { ok: false, error: text, stage: 'page' };
    }
  }

  /** Show a service's view for the dashboard host `owner`. A show overtaken while it loaded — by a
   *  newer show or a hide — returns without attaching, so a slow page never covers the current one. */
  async show(snap: ServiceSnapshot, rect: Rect, link: string | undefined, owner: string, fresh = false): Promise<ShowResult> {
    const ticket = this.slot.request(owner, snap.key);
    if (!snap.descriptor || !snap.wellKnown || (snap.state !== 'ready' && snap.state !== 'degraded')) {
      this.slot.release(owner);
      this.hideNow();
      return { ok: false, error: 'unavailable', stage: 'page' }; // P-5: not a sign-in failure
    }
    const existing = this.views.get(snap.key);
    if (existing && existing.origin !== snap.descriptor.origin) this.drop(snap.key);
    let entry = this.views.get(snap.key);
    let result: ShowResult = { ok: true };
    // Retry and Reload ask for a fresh load: the sign-in runs again and the view is attached again (R-6).
    if (entry && fresh) {
      entry.crashes = 0;
      entry.loadedOnce = false;
      if (link === undefined) link = resumePath(entry.view.webContents.getURL(), entry.origin);
    }
    if (!entry || !entry.loadedOnce) {
      entry = entry ?? this.create(snap);
      result = await this.load(snap, link);
    } else if (link) {
      result = await this.go(entry, resolveLink(snap.descriptor.origin, link, entry.dashboardPath));
    }
    if (!this.slot.current(ticket) || !this.views.has(snap.key)) return result;
    if (!result.ok) {
      // A failed load leaves Chromium's error page in the view: the app's own message shows instead.
      if (this.shown === snap.key) this.hideNow();
      return result;
    }
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
    if (!snap) return;
    // T-11: a show that fails here has no caller waiting; the page host hears it as an error.
    const result = await this.show(snap, r.rect, r.link, r.owner);
    if (!result.ok && result.error !== 'unavailable') this.emit({ key: r.key, kind: 'error', error: result.error });
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

  /** Tell the page host where its view stands again — after the window was hidden, view events
   *  were not sent (LC-08), so the toolbar asks once it is visible. */
  announce(): void {
    if (this.shown) { const page = this.page(this.shown); if (page) this.emit({ key: this.shown, kind: 'navigated', page }); }
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
    if (action === 'home') void wc.loadURL(resolveLink(entry.origin, undefined, entry.dashboardPath)).catch(() => undefined);
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
