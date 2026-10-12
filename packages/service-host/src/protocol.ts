// #region protocol-shapes — docs: packages/service-host/README.md#protocol
// The `fabric-service/0.1` shapes a host reads. They follow the Fabric Agent Contract's
// schemas/service-*.schema.json (DEC-0015; the remote placement DEC-0019); the contract stays normative. Pure: no Node import,
// so a renderer may import `@passioncode-ai/fabric-service-host/protocol`.

export const PROTOCOL = 'fabric-service/0.1';

/** A descriptor's `id`: lowercase letters, digits and dashes, starting with a letter. */
export const ID_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;
/** A descriptor's `instance`: `default`, `preview`, … */
export const INSTANCE_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

export interface Descriptor {
  protocol: string;
  id: string;
  instance: string;
  name: string;
  summary?: string;
  /** DEC-0019: `local` (default) — http://127.0.0.1:<port> under launchd or nothing; `remote` — an online service at an https origin. */
  placement?: 'local' | 'remote';
  origin: string;
  auth: { tokenFile: string; header?: string; scheme?: 'Bearer' | 'none' };
  /** DEC-0032, DEC-0057, DEC-0061, DEC-0069: the one supervisor and its own fields. `person` is an app's
   *  descriptor, which `readDirectory` keeps out of the services it returns. */
  lifecycle: { manager: 'launchd' | 'systemd' | 'task-scheduler' | 'node' | 'person' | 'none'; label?: string; plist?: string; unit?: string; task?: string; app?: string };
  /** Required for a local placement; optional for a remote one. */
  paths?: { data: string; logs: string[]; config?: string; cache?: string };
  commands?: { doctor?: string[]; update?: string[] };
  source?: { repository?: string };
  fabricManifest?: string;
  installedAt: string;
  installedBy: string;
}

export interface WellKnown {
  protocol: string;
  service: { id: string; instance: string; name: string; version: string; build: { commit?: string; digest?: string; dirty?: boolean; builtAt?: string } };
  process: { pid: number; startedAt: string };
  status: 'starting' | 'ready' | 'degraded' | 'stopping';
  /** DEC-0044: `setup: true` — the source waits for a person to finish setting it up; not an outage. */
  degraded: { source: string; reason: string; setup?: boolean }[];
  summary?: { label: string; value: number | string; attention?: boolean }[];
  surfaces: {
    dashboard?: { path: string; login: boolean };
    /** `capabilities` (contract DEC-0016/0020): the names the MCP surface serves, shown without the token. */
    mcp?: { path: string; transport: 'streamable-http'; capabilities?: string[] };
    events: { path: string; stream?: string };
    /** DEC-0021: the service's own spend report, behind the token (`./usage`). */
    usage?: { path: string };
  };
  update?: { available: string | null };
  /** Contract extensions by key URL; preserved and ignored by a reader that does not know a key. */
  extensions?: Record<string, unknown>;
}

/** One health probe: the service answered, something else answered, or nothing did. */
export type WellKnownResult =
  | { kind: 'answer'; doc: WellKnown; ms: number }
  | { kind: 'not-protocol'; detail: string } // something answers, but not fabric-service
  | { kind: 'refused'; detail: string } // DEC-0019: a remote service refused the token (401) — nothing disclosed
  | { kind: 'no-answer'; detail: string; cause?: 'tls' | 'redirect' | 'timeout' | 'network' | 'http' };

export interface ServiceEvent {
  id: string;
  at: string;
  kind: string;
  level: 'info' | 'notice' | 'warning' | 'error';
  text: string;
  subject?: { type: string; id: string; label?: string };
  link?: string;
  notify?: boolean;
}

/** The one state a host derives for a service (Fabric Dashboards design §3.3). */
export type ServiceState =
  | 'invalid' | 'stopped' | 'conflict' | 'foreign' | 'duplicate'
  | 'down' | 'starting' | 'stopping' | 'degraded' | 'ready';

export const SERVICE_STATES: readonly ServiceState[] = ['invalid', 'stopped', 'conflict', 'foreign', 'duplicate', 'down', 'starting', 'stopping', 'degraded', 'ready'];

/** A reason a host localizes: a message key plus the values it names. */
export interface Reason {
  code: string;
  params?: Record<string, string | number>;
}

/** Every reason code deriveState can return; a host's message catalogue covers each one. */
export const REASON_CODES = [
  'reason.invalid', 'reason.conflict.port', 'reason.conflict.key', 'reason.foreign.other', 'reason.foreign.protocol',
  'reason.duplicate', 'reason.degraded', 'reason.setup', 'reason.stopped', 'reason.not-loaded', 'reason.waiting', 'reason.down',
  // DEC-0019 — a remote placement
  'reason.remote.refused', 'reason.remote.tls', 'reason.remote.redirect', 'reason.remote.foreign', 'reason.remote.down',
] as const;

/** An action the host has in flight for the service. */
export type Busy = 'restarting' | 'stopping' | 'starting' | 'updating' | 'doctor' | null;

/** What launchd says of the service's job; `managed: false` when the descriptor names no launchd job. */
/** What the service's supervisor says. `by` names which one was read (FD-55): launchd, the only one this
 *  app also controls, or systemd, read for its MainPID only; absent means launchd, as before. */
export interface LaunchdStatus { managed: boolean; loaded: boolean; pid: number | null; disabled: boolean; by?: 'launchd' | 'systemd' }

/** Two descriptors claim the same port (`port` set) or the same id.instance (FAC-SEM-010). */
export interface ClaimConflict { port?: number; with: string[] }
// #endregion protocol-shapes

// #region dashboard-profile — docs: packages/service-host/README.md#embedded-dashboard-profile
// Fabric Agent Contract DEC-0036, profile `fabric-dashboard/0.1`, ED-9: a service whose dashboard
// meets the profile declares it in its well-known document under `extensions`, with `minWidth` (the
// page's floor in CSS pixels, an integer 360…1280). A host floor of max(480, minWidth) follows (ED-7).

/** The `extensions` key of the embedded dashboard profile (DEC-0036 ED-9). */
export const DASHBOARD_EXTENSION = 'https://fabric.passioncode.ai/agent-contract/extensions/dashboard/0.1';

/** The bounds of a declared `minWidth`, in CSS pixels (service-dashboard-extension.schema.json). */
export const DASHBOARD_MIN_WIDTH = { min: 360, max: 1280 } as const;

/** The dashboard's declared floor, or null for a legacy dashboard: no declaration, or one whose `minWidth` is not an integer in 360…1280. */
export function dashboardMinWidth(doc: Pick<WellKnown, 'extensions'> | null | undefined): number | null {
  const ext = doc?.extensions;
  if (!ext || typeof ext !== 'object' || Array.isArray(ext)) return null;
  const decl = (ext as Record<string, unknown>)[DASHBOARD_EXTENSION];
  if (!decl || typeof decl !== 'object' || Array.isArray(decl)) return null;
  const w = (decl as { minWidth?: unknown }).minWidth;
  return typeof w === 'number' && Number.isInteger(w) && w >= DASHBOARD_MIN_WIDTH.min && w <= DASHBOARD_MIN_WIDTH.max ? w : null;
}
// #endregion dashboard-profile
