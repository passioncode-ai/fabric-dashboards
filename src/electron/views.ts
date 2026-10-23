// One live WebContentsView per service (SCN-015): created on first open, kept
// while the window is in use, swapped — never reloaded or duplicated — when the
// operator switches services. A window hidden past the grace period releases
// every view (releaseAll, lifecycle LC-08); showing it brings back the one that
// was on screen, on the page it was on (resume).
import { BrowserWindow, dialog, session, shell, WebContentsView } from 'electron';
import type { PageState, Rect } from '../core/api';
import { t, type Lang } from '../core/i18n';
import { loginUrl, readTokenAsync } from '../core/probe';
import type { ServiceSnapshot } from '../core/types';
import { fabricButtonCookie, fabricPress } from '../core/fabric-button';
import { appearanceCookie, appearanceValue, viewBackground, type Scheme } from '../core/appearance';
import { hostView } from '@passioncode-ai/fabric-service-host';
import { afterCrash, clampRect, dashboardPathOf, loadErrorText, navigation, pageAddress, partitionFor, resolveLink, resumePath, routeLink, ViewSlot } from './policy';
import { testRemote } from '../core/testhooks';

/** A view signs in again after a 401 at most this often (an agent owner's finding, 2026-10-05). */
const RESIGN_EVERY_MS = 60_000;
// #region warm-session — docs: docs/ux/scenarios.md#scn-015-dashboard-view-keeps-its-place
/** FD-74: a view made again opens the page straight away, without a new login code, while the same service
 *  process signed this app in less than this long ago. Measured 2026-10-19: a login code took 35–541 ms on
 *  this Mac's services, plus one more navigation through the login URL. */
export const WARM_SESSION_MS = 30 * 60_000;
/** FD-74: after such a direct open, a 401 from the page's own requests (fetch, XHR) this soon signs it in. */
const DIRECT_WATCH_MS = 15_000;
// #endregion warm-session


/** What showing a dashboard came to; `stage` tells a sign-in that failed from a page that would not load. */
export interface ShowResult { ok: boolean; error?: string; stage?: 'sign-in' | 'page' }

interface Entry { view: WebContentsView; origin: string; crashes: number; loadedOnce: boolean; loadedAt: number; dashboardPath: string; resignedAt: number; resignTo: string | undefined | null; navigationEpoch: number; lastStatus?: number;
  /** FD-74: when the page was last on screen, to keep the most recent ones across a hidden window. */
  shownAt: number;
  /** FD-74: a page opened without a login code, and when; its own 401 signs it in (DIRECT_WATCH_MS). -1 while
   *  that open is still loading: load() itself then decides, from `refusedWhileDirect`. */
  directAt: number;
  refusedWhileDirect?: boolean;
  /** FD-74: where a page left behind by a service restart reopens when it is shown again. */
  resumeLink?: string }


export class ServiceViews {
  private readonly views = new Map<string, Entry>();
  private shown: string | null = null;
  private readonly refreshes = new Map<string, symbol>();
  private readonly slot = new ViewSlot();
  private bounds: Rect | null = null;
  private released: { key: string; owner: string; rect: Rect; link?: string } | null = null;
  /** FD-74: the service process that last signed each view in, and when. Kept across a dropped view. */
  private readonly signedIn = new Map<string, { pid: number; origin: string; at: number }>();

  /** FD-92: called after a dashboard view is added, so the console drawer goes back on top of it. */
  afterAttach: () => void = () => undefined;

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
    /** FD-45: whether a `fabric://` handler is installed, for the `fabric_button` cookie (ADR-0021). */
    private readonly fabricPresent: () => boolean = () => false,
    /** FD-42: the operator's scheme and dashboard theme, and whether macOS is dark now (for `system`). */
    private readonly appearance: () => { scheme: Scheme; theme: string; systemDark: boolean } = () => ({ scheme: 'dark', theme: 'graphite', systemDark: true }),
    private readonly log: (line: string) => void = () => undefined,
  ) {}

  /** FD-42 (ED-8, DEC-0059): write `fabric_appearance` into the service's own partition before a load, with
   *  only the theme its declaration admits; and log an invalid declaration once per load (ED-9). */
  private async appearanceCookie(key: string, origin: string): Promise<void> {
    const snap = this.snapshotFor(key);
    const view = snap?.wellKnown ? hostView(snap.wellKnown) : null;
    if (view?.reported) this.log(`dashboard: ${key} declares an invalid dashboard profile, read as not declared (ED-9): ${view.errors.join('; ')}`);
    try {
      await session.fromPartition(partitionFor(key)).cookies.set(appearanceCookie(origin, appearanceValue(this.appearance(), view)));
    } catch {
      // Best effort: without it the page follows prefers-color-scheme, which ED-6 requires it to handle.
    }
  }

  /** FD-42: the operator changed the scheme or the theme — rewrite every open page's cookie and repaint
   *  the views' background. Nothing is reloaded: a page applies a field it declares when the cookie changes
   *  or when it is shown again, and a page that declares none reads no cookie (DEC-0059). */
  async applyAppearance(): Promise<void> {
    const a = this.appearance();
    for (const [key, entry] of this.views) {
      entry.view.setBackgroundColor(viewBackground(a.scheme, a.systemDark));
      try { await session.fromPartition(partitionFor(key)).cookies.set(appearanceCookie(entry.origin, appearanceValue(a, (() => { const w = this.snapshotFor(key)?.wellKnown; return w ? hostView(w) : null; })()))); } catch { /* best effort */ }
    }
  }

  /** FB-6 (ADR-0021 decision 5): before a show or a reload, tell the page whether the host draws Fabric's
   *  button and whether Fabric is here now — it may have been installed or removed since the last load. */
  private async fabricCookie(key: string, origin: string): Promise<void> {
    try {
      const present = this.fabricPresent();
      const cookie = fabricButtonCookie(origin, { hostDraws: fabricPress(key, present).kind !== 'none', fabricPresent: present });
      await session.fromPartition(partitionFor(key)).cookies.set(cookie);
    } catch {
      // Best effort: without it the page may show its own button beside ours, which costs nothing else.
    }
  }

  /** The service as it is now, when it may get a token: answering as itself, with its well-known. */
  private live(key: string): ServiceSnapshot | null {
    const snap = this.snapshotFor(key);
    return snap?.descriptor && snap.wellKnown && (snap.state === 'ready' || snap.state === 'degraded') ? snap : null;
  }

  private sameLiveService(snap: ServiceSnapshot): boolean {
    const now = this.live(snap.key);
    return !!now && now.descriptor!.origin === snap.descriptor!.origin
      && now.descriptor!.auth.tokenFile === snap.descriptor!.auth.tokenFile
      && now.wellKnown?.surfaces.dashboard?.login === snap.wellKnown?.surfaces.dashboard?.login;
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
      if (details.statusCode !== 401 || this.refreshes.has(snap.key)) return;
      const entry = this.views.get(snap.key);
      if (!entry || !this.live(snap.key)?.wellKnown?.surfaces.dashboard?.login) return;
      // FD-74: a page opened without a login code whose own requests are refused signs in, once.
      if (entry.directAt < 0) { entry.refusedWhileDirect = true; return; }
      const direct = entry.directAt > 0 && Date.now() - entry.directAt < DIRECT_WATCH_MS;
      if (details.resourceType !== 'mainFrame' && !direct) return;
      if (direct) { this.signedIn.delete(snap.key); entry.directAt = 0; entry.resignedAt = 0; }
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
    { const a = this.appearance(); view.setBackgroundColor(viewBackground(a.scheme, a.systemDark)); } // FD-42: before the page paints
    const entry: Entry = { view, origin: d.origin, crashes: 0, loadedOnce: false, loadedAt: 0, dashboardPath: dashboardPathOf(snap.wellKnown?.surfaces.dashboard?.path), resignedAt: 0, resignTo: null, navigationEpoch: 0, shownAt: 0, directAt: 0 };
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
    wc.on('did-navigate', (_event, _url, status) => { entry.lastStatus = status; navigated(); });
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
    const epoch = entry.navigationEpoch;
    const current = () => this.views.get(key) === entry && entry.navigationEpoch === epoch;
    void this.load(snap, to, current, false, true).then((r) => {
      if (current() && !r.ok) this.emit({ key, kind: 'error', error: r.error });
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

  /** FD-74: whether this service's current process signed this app in recently enough to skip a login code. */
  private warm(snap: ServiceSnapshot): boolean {
    const s = this.signedIn.get(snap.key);
    const pid = snap.wellKnown?.process?.pid;
    return !!s && !!pid && s.pid === pid && s.origin === snap.descriptor!.origin && Date.now() - s.at < WARM_SESSION_MS;
  }

  /** Load the dashboard, signed in through a one-time code when the service asks for one. `signIn` forces the
   *  code (Reload, Retry, a 401); otherwise a session this service's process gave recently is used (FD-74). */
  private async load(snap: ServiceSnapshot, link?: string, current: () => boolean = () => true, checkHttp = false, signIn = checkHttp): Promise<ShowResult> {
    const entry = this.views.get(snap.key) ?? this.create(snap);
    const d = snap.descriptor!;
    const dash = snap.wellKnown?.surfaces.dashboard;
    if (!dash) return { ok: false, error: 'no dashboard', stage: 'page' };
    let stage: ShowResult['stage'] = dash.login ? 'sign-in' : 'page';
    await this.fabricCookie(snap.key, d.origin);
    await this.appearanceCookie(snap.key, d.origin);
    const page = async (url: string) => {
      entry.lastStatus = undefined;
      await entry.view.webContents.loadURL(url);
      if (checkHttp && entry.lastStatus !== undefined && entry.lastStatus >= 400) throw new Error(`HTTP ${entry.lastStatus}`);
    };
    try {
      if (!current()) return { ok: true };
      let url = resolveLink(d.origin, link, dash.path);
      if (dash.login && !signIn && this.warm(snap)) {
        entry.directAt = -1;
        entry.refusedWhileDirect = false;
        try { await page(url); } finally { if (entry.directAt < 0) entry.directAt = 0; }
        if (!current()) return { ok: true };
        if (entry.lastStatus !== 401 && entry.lastStatus !== 403 && !entry.refusedWhileDirect) { entry.directAt = Date.now(); return { ok: true }; }
        entry.directAt = 0; // refused: the session is gone; sign in below, on the same page
        this.signedIn.delete(snap.key);
        link ??= resumePath(entry.view.webContents.getURL(), d.origin);
      }
      if (dash.login) {
        entry.directAt = 0;
        const token = await readTokenAsync(d.auth.tokenFile); // main process only
        url = await loginUrl(d, token);
        if (!current()) return { ok: true };
        await page(url);
        if (!current()) return { ok: true };
        stage = 'page';
        const pid = snap.wellKnown?.process?.pid;
        if (pid) this.signedIn.set(snap.key, { pid, origin: d.origin, at: Date.now() });
        if (link) await page(resolveLink(d.origin, link, dash.path));
        return { ok: true };
      }
      await page(url);
      return { ok: true };
    } catch (error) {
      const text = loadErrorText(error);
      if (/ERR_ABORTED/.test(text)) return { ok: true };
      this.signedIn.delete(snap.key);
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
    this.refreshes.delete(snap.key);
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
    if (entry) entry.navigationEpoch += 1;
    // Retry and Reload ask for a fresh load: the sign-in runs again and the view is attached again (R-6).
    if (entry && fresh) {
      entry.crashes = 0;
      entry.loadedOnce = false;
      if (link === undefined) link = resumePath(entry.view.webContents.getURL(), entry.origin);
    }
    // FD-74: a page a service restart left behind reopens where it was, freshly loaded.
    if (entry && !entry.loadedOnce && link === undefined && entry.resumeLink) link = entry.resumeLink;
    if (entry) entry.resumeLink = undefined;
    await this.fabricCookie(snap.key, snap.descriptor.origin);
    await this.appearanceCookie(snap.key, snap.descriptor.origin);
    if (!entry || !entry.loadedOnce) {
      entry = entry ?? this.create(snap);
      if (fresh) { entry.resignedAt = Date.now(); entry.resignTo = null; }
      result = await this.load(snap, link, () => this.slot.current(ticket)
        && this.views.get(snap.key) === entry && (!fresh || this.sameLiveService(snap)), fresh);
    } else if (link) {
      result = await this.go(entry, resolveLink(snap.descriptor.origin, link, entry.dashboardPath));
    }
    if (!this.slot.current(ticket) || !this.views.has(snap.key)) return result;
    if (fresh && !this.sameLiveService(snap)) result = { ok: false, error: 'unavailable', stage: 'page' };
    if (!result.ok) {
      entry.loadedOnce = false;
      // A failed load leaves Chromium's error page in the view: the app's own message shows instead.
      if (this.shown === snap.key) this.hideNow();
      return result;
    }
    if (this.shown && this.shown !== snap.key) this.detach(this.shown);
    if (this.shown !== snap.key) { this.window.contentView.addChildView(entry.view); this.afterAttach(); }
    this.shown = snap.key;
    entry.shownAt = Date.now();
    this.released = null;
    this.bounds = clampRect(rect);
    entry.view.setBounds(this.bounds);
    return result;
  }

  setBounds(rect: Rect): void {
    this.bounds = clampRect(rect);
    if (this.shown) this.views.get(this.shown)?.view.setBounds(this.bounds);
  }

  /** FD-74: a window hidden past the first grace keeps the `keep` views shown most recently (the one on
   *  screen first) and closes the rest, so the pages the person uses open at once when they come back. */
  releaseCold(keep: number): number {
    const order = [...this.views.entries()].sort((a, b) => (b[0] === this.shown ? 1 : 0) - (a[0] === this.shown ? 1 : 0) || b[1].shownAt - a[1].shownAt);
    const cold = order.slice(Math.max(0, keep)).map(([k]) => k);
    for (const k of cold) this.drop(k);
    return cold.length;
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
    return { key, address, link, canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward(), loading: this.refreshes.has(key) || wc.isLoading() };
  }

  /** Back, forward, the dashboard's own page, or the current page again — never another origin. */
  navigate(key: string, action: 'back' | 'forward' | 'home' | 'refresh'): void {
    const entry = this.views.get(key);
    if (!entry || entry.view.webContents.isDestroyed()) return;
    const wc = entry.view.webContents;
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    // A Reload signs in again once (dashboard-session-refresh, PR #58); FB-6's cookie is set again by its load(),
    // or, for a page without a sign-in, beside its plain reload in refresh().
    if (action === 'refresh') { void this.refresh(key, entry); return; }
    this.refreshes.delete(key);
    entry.navigationEpoch += 1;
    if (action === 'home') void this.fabricCookie(key, entry.origin).then(() => this.appearanceCookie(key, entry.origin)).then(() => wc.loadURL(resolveLink(entry.origin, undefined, entry.dashboardPath))).catch(() => undefined);
  }

  // #region dashboard-session-refresh — docs: docs/handoffs/2026-10-09-dashboard-session-refresh/README.md#requirements-and-delivery-profile
  /** Explicit recovery uses existing service authority once; an HTTP 404 never starts it. */
  private async refresh(key: string, entry: Entry): Promise<void> {
    if (this.refreshes.has(key) || this.shown !== key) return;
    const owner = this.slot.owner();
    const snap = this.live(key);
    if (!owner || !snap?.descriptor || snap.descriptor.origin !== entry.origin) {
      this.emit({ key, kind: 'error', error: 'unavailable' });
      return;
    }
    if (!snap.wellKnown?.surfaces.dashboard?.login) { void this.fabricCookie(key, entry.origin); void this.appearanceCookie(key, entry.origin); entry.view.webContents.reload(); return; }
    const attempt = Symbol('refresh');
    this.refreshes.set(key, attempt);
    entry.navigationEpoch += 1;
    const current = () => this.refreshes.get(key) === attempt && this.views.get(key) === entry
      && this.shown === key && this.slot.owner() === owner && this.slot.wanted() === key
      && this.sameLiveService(snap);
    const link = resumePath(entry.view.webContents.getURL(), entry.origin);
    entry.resignedAt = Date.now();
    entry.resignTo = null; // the explicit attempt supersedes a queued automatic 401 recovery
    entry.loadedOnce = false;
    const page = this.page(key);
    if (page) this.emit({ key, kind: 'navigated', page });
    try {
      const result = await this.load(snap, link, current, true);
      if (current() && !result.ok) { entry.loadedOnce = false; this.emit({ key, kind: 'error', error: result.error }); }
    } finally {
      const active = current();
      if (this.refreshes.get(key) === attempt) this.refreshes.delete(key);
      const page = active ? this.page(key) : null;
      if (page) this.emit({ key, kind: 'navigated', page });
    }
  }
  // #endregion dashboard-session-refresh

  /** FD-74: the service restarted (a new version, a crash): its session may be gone and its page is old. The page
   *  on screen signs in again and reloads where it is; one off screen reloads there the next time it is shown. */
  serviceRestarted(key: string): void {
    this.signedIn.delete(key);
    const entry = this.views.get(key);
    if (!entry || entry.view.webContents.isDestroyed()) return;
    if (this.shown === key) { this.emit({ key, kind: 'restarted' }); void this.refresh(key, entry); return; }
    entry.resumeLink = resumePath(entry.view.webContents.getURL(), entry.origin);
    entry.loadedOnce = false;
  }

  /** The dashboard on screen now, for the menu's Reload (FD-74). */
  shownKey(): string | null {
    return this.shown;
  }

  /** FD-74: ⌘R and ⇧⌘R. A reload signs in again (SCN-039); `hard` first empties the service's HTTP cache, so
   *  every file the page uses comes from the service again. */
  async reload(key: string, hard: boolean): Promise<void> {
    const entry = this.views.get(key);
    if (!entry || entry.view.webContents.isDestroyed()) return;
    if (hard) {
      try { await session.fromPartition(partitionFor(key)).clearCache(); } catch (error) { this.log(`dashboard: ${key} cache not cleared: ${(error as Error).message}`); }
    }
    this.navigate(key, 'refresh');
  }

  drop(key: string): void {
    this.refreshes.delete(key);
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
