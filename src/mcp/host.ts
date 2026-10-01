// #region dashboard-host — docs: docs/runs/2026-10-01-dashboard-links/README.md#host-routing
import { execRunner, type Runner } from '../core/launchd';

export const BUNDLE_ID = 'ai.passioncode.fabric-dashboards';
export type HostState = 'available' | 'not_installed' | 'unknown' | 'incompatible' | 'handler_mismatch' | 'unsupported';
export interface HostStatus {
  state: HostState;
  observed_at: string;
  application: { path: string; id: string; version: string } | null;
}

// Static JXA, never interpolated with a service URL or user input. NSWorkspace queries do
// not launch an app, activate Finder or register/replace a protocol handler.
export const DISCOVER_HOST = `
ObjC.import('AppKit');
ObjC.import('Foundation');
const ws = $.NSWorkspace.sharedWorkspace;
function bundle(u) {
  if (!u || u.isNil()) return null;
  const b = $.NSBundle.bundleWithURL(u);
  return {path:ObjC.unwrap(u.path), id:ObjC.unwrap(b.bundleIdentifier),
    version:ObjC.unwrap(b.objectForInfoDictionaryKey('CFBundleShortVersionString'))};
}
JSON.stringify({
  application:bundle(ws.URLForApplicationWithBundleIdentifier('${BUNDLE_ID}')),
  handler:bundle(ws.URLForApplicationToOpenURL($.NSURL.URLWithString('fabric-dashboards://')))
});`;

function bundle(value: unknown): HostStatus['application'] {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.path !== 'string' || !v.path.startsWith('/') || /[\u0000-\u001f\u007f]/.test(v.path)
    || typeof v.id !== 'string' || typeof v.version !== 'string') return null;
  return { path: v.path, id: v.id, version: v.version };
}

/** 0.3.0 introduced the canonical service/<id.instance> form. Fail closed on unknown versions. */
function compatible(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return Boolean(match && (Number(match[1]) > 0 || Number(match[2]) >= 3));
}

export async function discoverHost(run: Runner = execRunner, platform = process.platform): Promise<HostStatus> {
  const base = { observed_at: new Date().toISOString(), application: null };
  if (platform !== 'darwin') return { ...base, state: 'unsupported' };
  try {
    const result = await run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', DISCOVER_HOST]);
    if (result.code !== 0) return { ...base, state: 'unknown' };
    const raw: unknown = JSON.parse(result.stdout);
    if (!raw || typeof raw !== 'object') return { ...base, state: 'unknown' };
    const data = raw as Record<string, unknown>;
    // Only a successful OS query with an explicit null proves absence. A bad response,
    // a timeout, an exception or missing field never permits browser fallback.
    if (data.application === null && data.handler === null) return { ...base, state: 'not_installed' };
    const application = bundle(data.application);
    if (!application || application.id !== BUNDLE_ID) return { ...base, state: 'unknown' };
    if (!compatible(application.version)) return { ...base, application, state: 'incompatible' };
    const handler = bundle(data.handler);
    if (!handler || handler.id !== BUNDLE_ID || handler.path !== application.path) {
      return { ...base, application, state: 'handler_mismatch' };
    }
    return { ...base, application, state: 'available' };
  } catch {
    return { ...base, state: 'unknown' };
  }
}
// #endregion dashboard-host
