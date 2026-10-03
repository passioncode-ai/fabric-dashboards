// Navigation rules for embedded service views. Pure, so they are tested
// without Electron (the same shape as Fabric Inbox's policy.cjs).

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

/** Every service gets its own persistent session, so cookies never cross between services. */
export function partitionFor(serviceKey: string): string {
  return `persist:svc-${serviceKey.replace(/[^a-z0-9.-]/g, '-')}`;
}

/** A link from an event or a notification must be a path on the service origin. */
export function resolveLink(serviceOrigin: string, link: string | undefined, fallbackPath: string): string {
  const path = link && link.startsWith('/') && !link.startsWith('//') ? link : fallbackPath;
  return new URL(path, serviceOrigin).toString();
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
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Partition directories (Partitions/<name>) that belong to no installed service (LC-12): a service
 *  uninstalled while the app was not running leaves its cookies and caches behind otherwise. */
export function stalePartitions(names: string[], keys: string[]): string[] {
  const live = new Set(keys.map((k) => partitionFor(k).slice('persist:'.length)));
  return names.filter((n) => /^svc-[a-z0-9.-]+$/.test(n) && !live.has(n));
}
// #endregion view-release
