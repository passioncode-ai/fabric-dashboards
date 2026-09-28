// Shared shapes between the main process and the renderer. The protocol shapes
// follow fabric-agent-contract schemas/service-*.schema.json (DEC-0015).

export const PROTOCOL = 'fabric-service/0.1';

export interface Descriptor {
  protocol: string;
  id: string;
  instance: string;
  name: string;
  summary?: string;
  origin: string;
  auth: { tokenFile: string; header?: string; scheme?: 'Bearer' | 'none' };
  lifecycle: { manager: 'launchd' | 'none'; label?: string; plist?: string };
  paths: { data: string; logs: string[]; config?: string; cache?: string };
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

export type WellKnownResult =
  | { kind: 'answer'; doc: WellKnown; ms: number }
  | { kind: 'not-protocol'; detail: string } // something answers, but not fabric-service
  | { kind: 'no-answer'; detail: string };

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

export type ServiceState =
  | 'invalid' | 'stopped' | 'conflict' | 'foreign' | 'duplicate'
  | 'down' | 'starting' | 'stopping' | 'degraded' | 'ready';

/** A reason the renderer localizes: a message key plus the values it names. */
export interface Reason {
  code: string;
  params?: Record<string, string | number>;
}

export type Busy = 'restarting' | 'stopping' | 'starting' | 'updating' | 'doctor' | null;

export interface ServiceSnapshot {
  key: string; // `${id}.${instance}`
  descriptorPath: string;
  descriptor: Descriptor | null;
  problems: string[];
  state: ServiceState;
  reasons: Reason[];
  wellKnown: WellKnown | null;
  launchd: { managed: boolean; loaded: boolean; pid: number | null; disabled: boolean };
  firstUnansweredAt: string | null; // when the service stopped answering (null while answering)
  lastAnswerAt: string | null;
  busy: Busy;
  lastAction: { action: string; ok: boolean; reason: Reason; at: string } | null;
  latestEvent: ServiceEvent | null;
  feedError: Reason | null;
}

/** An activity row: a service event, or one the app itself recorded. */
export interface ActivityItem extends ServiceEvent {
  serviceKey: string;
  serviceName: string;
  source: 'service' | 'app';
}

export interface Settings {
  launchAtLogin: boolean;
  theme: 'dark' | 'light';
  notifications: {
    enabled: boolean;
    perService: Record<string, { enabled: boolean; minLevel: 'notice' | 'warning' | 'error' }>;
    quietHours: { enabled: boolean; from: string; to: string }; // "22:00" .. "08:00"
    pausedUntil: string | null;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  launchAtLogin: true,
  theme: 'dark',
  notifications: {
    enabled: true,
    perService: {},
    quietHours: { enabled: false, from: '22:00', to: '08:00' },
    pausedUntil: null,
  },
};

export interface Listener {
  command: string;
  pid: number;
  address: string;
  port: number;
}

export interface AppStatus {
  services: ServiceSnapshot[];
  servicesDir: string;
  dirError: string | null;
  scanning: boolean;
  unread: number;
  update: { state: 'idle' | 'checking' | 'downloading' | 'ready' | 'error' | 'unsupported'; version?: string; error?: string };
  version: string;
}
