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
