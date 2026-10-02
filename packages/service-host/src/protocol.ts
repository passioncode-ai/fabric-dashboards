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
  lifecycle: { manager: 'launchd' | 'none'; label?: string; plist?: string };
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
  degraded: { source: string; reason: string }[];
  summary?: { label: string; value: number | string; attention?: boolean }[];
  surfaces: {
    dashboard?: { path: string; login: boolean };
    mcp?: { path: string; transport: 'streamable-http' };
    events: { path: string; stream?: string };
  };
  update?: { available: string | null };
}

/** One health probe: the service answered, something else answered, or nothing did. */
export type WellKnownResult =
  | { kind: 'answer'; doc: WellKnown; ms: number }
  | { kind: 'not-protocol'; detail: string } // something answers, but not fabric-service
  | { kind: 'refused'; detail: string } // DEC-0019: a remote service refused the token (401) — nothing disclosed
  | { kind: 'no-answer'; detail: string; cause?: 'tls' | 'redirect' | 'timeout' | 'network' };

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
  'reason.duplicate', 'reason.degraded', 'reason.stopped', 'reason.not-loaded', 'reason.waiting', 'reason.down',
  // DEC-0019 — a remote placement
  'reason.remote.refused', 'reason.remote.tls', 'reason.remote.redirect', 'reason.remote.foreign', 'reason.remote.down',
] as const;

/** An action the host has in flight for the service. */
export type Busy = 'restarting' | 'stopping' | 'starting' | 'updating' | 'doctor' | null;

/** What launchd says of the service's job; `managed: false` when the descriptor names no launchd job. */
export interface LaunchdStatus { managed: boolean; loaded: boolean; pid: number | null; disabled: boolean }

/** Two descriptors claim the same port (`port` set) or the same id.instance (FAC-SEM-010). */
export interface ClaimConflict { port?: number; with: string[] }
// #endregion protocol-shapes
