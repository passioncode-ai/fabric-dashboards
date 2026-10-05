// Navigation rules for embedded service views. Pure, so they are tested
// without Electron (the same shape as Fabric Inbox's policy.cjs).

import { safePath, serviceLink } from '@passioncode-ai/fabric-service-host/links';

export type NavigationVerdict = 'allow' | 'external' | 'deny';

/** A view may move within its service origin only; web links leave through the browser, after a question. */
export function navigation(serviceOrigin: string, target: string): NavigationVerdict {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return 'deny';
  }
  if (url.origin === new URL(serviceOrigin).origin) return 'allow';
  if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') return 'external';
  return 'deny';
}

// #region cross-links — docs: docs/adr/0016-agent-summary-tools-and-cross-links.md#decision
export type LinkRoute = { kind: 'allow' } | { kind: 'app'; link: string } | { kind: 'external' } | { kind: 'deny' };

/**
 * Where a link clicked (or window.open'ed) inside an embedded dashboard goes (ADR-0016). Its own
 * origin: stays in the view. A `fabric-dashboards:` link, or the origin of another registered
 * service: back to the app, which checks it with parseDeepLink and opens that service signed in
 * with its own session. Any other web link: the system browser, after a question.
 */
export function routeLink(serviceOrigin: string, target: string, serviceOrigins: readonly string[]): LinkRoute {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return { kind: 'deny' };
  }
  const own = new URL(serviceOrigin).origin;
  if (url.origin === own && url.protocol !== 'fabric-dashboards:') return { kind: 'allow' };
  if (url.protocol === 'fabric-dashboards:') return { kind: 'app', link: target };
  if ((url.protocol === 'http:' || url.protocol === 'https:') && serviceOrigins.some((o) => { try { return new URL(o).origin === url.origin; } catch { return false; } })) {
    return { kind: 'app', link: `fabric-dashboards://open?url=${encodeURIComponent(target)}` };
  }
  if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') return { kind: 'external' };
  return { kind: 'deny' };
}
// #endregion cross-links

/** Every service gets its own persistent session, so cookies never cross between services. */
export function partitionFor(serviceKey: string): string {
  return `persist:svc-${serviceKey.replace(/[^a-z0-9.-]/g, '-')}`;
}

/**
 * A link from an event, a notification or the service's own well-known document must be a path
 * on the service origin (S-4). `safePath` refuses `//host` and `/\host`; the result is checked
 * against the origin once more, so nothing the service or a link says can load another host.
 */
export function resolveLink(serviceOrigin: string, link: string | undefined, fallbackPath: string): string {
  const path = (link && safePath(link)) || safePath(fallbackPath) || '/';
  const own = new URL(serviceOrigin).origin;
  const url = new URL(path, own);
  return url.origin === own ? url.toString() : new URL('/', own).toString();
}

/**
 * What a failed page load says to a person (S-3). Electron's rejection reads
 * "ERR_X (-n) loading '<url>'", and the URL of a sign-in is the one-time login code: only the
 * error's name is kept, never the URL.
 */
export function loadErrorText(error: unknown): string {
  const e = error as { code?: unknown; message?: unknown } | null;
  if (e && typeof e.code === 'string' && /^ERR_[A-Z_]+$/.test(e.code)) return e.code;
  const message = typeof e?.message === 'string' ? e.message : String(error);
  return message.replace(/\s*loading\s+'[^']*'\s*$/s, '').replace(/https?:\/\/\S+/g, '<address>').slice(0, 200);
}

/** The dashboard path a well-known document declares, if it is a path on the origin; '/' otherwise. */
export function dashboardPathOf(declared: string | undefined): string {
  return (declared && safePath(declared)) || '/';
}

export function clampRect(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } {
  const n = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  return { x: n(rect.x), y: n(rect.y), width: n(rect.width), height: n(rect.height) };
}

// #region view-slot — docs: docs/ux/scenarios.md#scn-015-dashboard-view-keeps-its-place
/** Which service view belongs on screen. Show and hide come over IPC in the order React commits
 *  effects — the new dashboard host's show before the old host's cleanup hide — so the slot goes
 *  by who asked: a host (`owner`, one per mounted dashboard host) may hide only its own request,
 *  and a show that a newer show or a hide overtook while it loaded never attaches. */
export class ViewSlot {
  private holder: string | null = null;
  private key: string | null = null;
  private seq = 0;

  /** A host asks to show a service; returns the ticket its show attaches with. */
  request(owner: string, key: string): number {
    this.holder = owner;
    this.key = key;
    this.seq += 1;
    return this.seq;
  }

  /** May the show holding this ticket attach its view now? */
  current(ticket: number): boolean {
    return ticket === this.seq && this.holder !== null;
  }

  /** A hide. With an owner, only that host's own request is withdrawn; without, any. True: hide now. */
  release(owner?: string): boolean {
    if (this.holder === null || (owner !== undefined && owner !== this.holder)) return false;
    this.holder = null;
    this.key = null;
    this.seq += 1;
    return true;
  }

  /** The service key currently wanted on screen, or null. */
  wanted(): string | null {
    return this.key;
  }

  /** The host holding the slot, or null. */
  owner(): string | null {
    return this.holder;
  }
}
// #endregion view-slot

// #region view-release — docs: AGENTS.md#lifecycle
/** Embedded dashboards are the heaviest thing the app holds (one renderer, ~45 MB footprint, per
 *  service ever opened). A window hidden longer than the grace period gives them back (LC-08);
 *  showing it again inside the grace cancels the release. Electron-free, so it is tested. */
export const VIEW_RELEASE_GRACE_MS = 5 * 60_000;

export class HiddenGrace {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly graceMs: number, private readonly release: () => void) {}

  hidden(): void {
    if (this.timer) return; // minimize, then hide: one countdown
    this.timer = setTimeout(() => { this.timer = null; this.release(); }, this.graceMs);
    this.timer.unref?.();
  }

  shown(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.shown();
  }
}

/** The page a released view was on, as a path on its origin; anything else resumes at the dashboard. */
export function resumePath(currentUrl: string, serviceOrigin: string): string | undefined {
  let url: URL;
  try {
    url = new URL(currentUrl);
  } catch {
    return undefined;
  }
  if (url.origin !== new URL(serviceOrigin).origin) return undefined;
  // R-9: the sign-in URL carries a one-time code that is spent: resuming there would land on a 401.
  if (url.pathname.startsWith('/fabric/v1/login')) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}

// #region page-address — docs: docs/adr/0014-dashboard-toolbar.md#decision
/** What the dashboard toolbar shows and copies for the page a view is on (ADR-0014): the page's
 *  own https/http address and the fabric-dashboards:// link that opens it here, signed in. A page
 *  off the service origin, or the one-time sign-in URL (it carries a login code), reads as the
 *  dashboard itself — a login code is never shown or copied. */
export function pageAddress(currentUrl: string, serviceOrigin: string, dashboardPath: string, key: string): { address: string; path: string; link: string } {
  const origin = new URL(serviceOrigin).origin;
  let path = resumePath(currentUrl, serviceOrigin) ?? dashboardPath;
  if (path.startsWith('/fabric/v1/login')) path = dashboardPath;
  let link: string;
  try { link = serviceLink(key, path); } catch { path = dashboardPath; link = serviceLink(key, path); }
  return { address: `${origin}${path}`, path, link };
}
// #endregion page-address

/** Partition directories (Partitions/<name>) that belong to no installed service (LC-12): a service
 *  uninstalled while the app was not running leaves its cookies and caches behind otherwise. */
export function stalePartitions(names: string[], keys: string[]): string[] {
  const live = new Set(keys.map((k) => partitionFor(k).slice('persist:'.length)));
  return names.filter((n) => /^svc-[a-z0-9.-]+$/.test(n) && !live.has(n));
}
// #endregion view-release

// #region auto-install — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#decision
/** How long the window stays hidden before a downloaded update installs by itself (ADR-0015). */
export const UPDATE_IDLE_MS = 10 * 60_000;
/** Written just before an automatic install: the relaunch that follows stays in the menu bar. */
export const RELAUNCH_MARKER = '.relaunch-hidden';
const RELAUNCH_FRESH_MS = 10 * 60_000;

/** Install now: an update is ready, the person allows it, nobody is looking and nothing runs. */
export function autoInstallNow(o: { ready: boolean; autoUpdate: boolean; visible: boolean; busy: number }): boolean {
  return o.ready && o.autoUpdate && !o.visible && o.busy === 0;
}

/** The marker an automatic install wrote, if it was written recently enough to be this relaunch. */
export function relaunchHidden(markerText: string | null, now: number): boolean {
  if (markerText === null) return false;
  const at = Date.parse(markerText.trim());
  return Number.isFinite(at) && at <= now && now - at < RELAUNCH_FRESH_MS;
}
// #endregion auto-install
