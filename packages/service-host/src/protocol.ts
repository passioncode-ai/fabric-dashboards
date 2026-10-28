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
  /** DEC-0046: what the operator can configure for this agent and what applies now — read-only here; a
   *  change is made in Fabric (FD-46). */
  configuration?: { slots: ('runner' | 'model')[]; resolved: { from?: 'request' | 'agent' | 'binding' | 'estate'; runnerProfile?: string; runnerKind?: string; route?: 'subscription' | 'key'; modelProfile?: string; models?: string[] } };
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
  // FD-132 — placed on another machine (observatory-placement/1)
  'reason.elsewhere', 'reason.duplicate.elsewhere',
  // DEC-0019 — a remote placement
  'reason.remote.refused', 'reason.remote.tls', 'reason.remote.redirect', 'reason.remote.foreign', 'reason.remote.down',
] as const;

/** FD-132: this machine's placement record names the service as placed on another machine. */
export interface Elsewhere {
  /** The machine it is placed on, as the record names it. */
  placedOn: string;
  /** ISO time it was placed there, when the record says. */
  since?: string;
}

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

/** What a host takes from a well-known document for the page it shows (ED-6, ED-7, ED-9; DEC-0059) — a
 *  port of the contract's `hostView` (src/dashboard-declaration.ts), run on its vectors. */
export interface HostView {
  /** A valid declaration is present under the dashboard key. */
  declared: boolean;
  /** The key is present and its value invalid: treated as not declared, and logged once per load (ED-9). */
  reported: boolean;
  /** `minWidth`, or 360 (ED-1). */
  pageFloor: number;
  /** max(480, minWidth), or 480 (ED-7). */
  hostFloor: number;
  /** The carrier fields the page applies; none: it follows prefers-color-scheme only (ED-6). */
  appearance: ('scheme' | 'theme')[];
  /** The theme ids the page ships, or null (ED-10). */
  themes: string[] | null;
  kit: string | null;
  /** Why the value is invalid; empty unless `reported`. */
  errors: string[];
}

const THEME_ID = /^[a-z][a-z0-9-]{0,31}$/;
const KIT = /^[a-z][a-z0-9-]{0,63}@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** service-dashboard-extension.schema.json, by hand: every reason the value is invalid. */
function declarationErrors(v: unknown): string[] {
  if (!isPlain(v)) return ['/ type: must be object'];
  const out: string[] = [];
  for (const k of Object.keys(v)) if (!['minWidth', 'appearance', 'themes', 'kit'].includes(k)) out.push(`/ additionalProperties: ${k}`);
  const w = v.minWidth;
  if (!Object.hasOwn(v, 'minWidth')) out.push('/ required: minWidth');
  else if (typeof w !== 'number' || !Number.isInteger(w) || w < DASHBOARD_MIN_WIDTH.min || w > DASHBOARD_MIN_WIDTH.max) out.push('/minWidth: an integer 360…1280');
  if (Object.hasOwn(v, 'appearance')) {
    const a = v.appearance;
    if (!Array.isArray(a) || a.length > 2 || new Set(a).size !== a.length || !a.every((x) => x === 'scheme' || x === 'theme')) out.push('/appearance: unique items of scheme, theme');
  }
  if (Object.hasOwn(v, 'themes')) {
    const t = v.themes;
    if (!Array.isArray(t) || t.length < 1 || t.length > 32 || new Set(t).size !== t.length || !t.every((x) => typeof x === 'string' && THEME_ID.test(x))) out.push('/themes: 1…32 unique theme ids');
  }
  if (Object.hasOwn(v, 'kit') && (typeof v.kit !== 'string' || !KIT.test(v.kit))) out.push('/kit: name@semver');
  return out;
}

const LEGACY_VIEW = { declared: false, pageFloor: DASHBOARD_MIN_WIDTH.min, hostFloor: 480, appearance: [], themes: null, kit: null } as const;

/** The host's reading of a dashboard declaration. Never throws; an invalid value is a legacy dashboard, reported. */
export function hostView(wellKnown: unknown): HostView {
  const ext = isPlain(wellKnown) && isPlain(wellKnown.extensions) ? wellKnown.extensions : undefined;
  // Object.hasOwn: a key such as `constructor` must not reach Object.prototype.
  if (!ext || !Object.hasOwn(ext, DASHBOARD_EXTENSION)) return { ...LEGACY_VIEW, appearance: [], reported: false, errors: [] };
  const value = ext[DASHBOARD_EXTENSION];
  const errors = declarationErrors(value);
  if (errors.length) return { ...LEGACY_VIEW, appearance: [], reported: true, errors };
  const d = value as { minWidth: number; appearance?: ('scheme' | 'theme')[]; themes?: string[]; kit?: string };
  return { declared: true, reported: false, pageFloor: d.minWidth, hostFloor: Math.max(480, d.minWidth), appearance: d.appearance ?? [], themes: d.themes ?? null, kit: d.kit ?? null, errors: [] };
}

/** The dashboard's declared floor, or null for a legacy dashboard — no declaration, or an invalid one (DEC-0059). */
export function dashboardMinWidth(doc: Pick<WellKnown, 'extensions'> | null | undefined): number | null {
  const view = hostView(doc);
  return view.declared ? view.pageFloor : null;
}
// #endregion dashboard-profile
