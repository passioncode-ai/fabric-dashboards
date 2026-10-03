// Shared shapes between the main process and the renderer. The protocol shapes — descriptor,
// well-known document, events, states, reasons — live in @passioncode-ai/fabric-service-host
// (packages/service-host), the reading code Fabric Dashboards shares with Fabric; they follow
// fabric-agent-contract schemas/service-*.schema.json (DEC-0015). Type-only re-exports keep the
// renderer free of the package's Node code.
import type { Busy, Descriptor, LaunchdStatus, Reason, ServiceEvent, ServiceState, WellKnown } from '@passioncode-ai/fabric-service-host/protocol';

export { PROTOCOL } from '@passioncode-ai/fabric-service-host/protocol';
export type { Busy, Descriptor, LaunchdStatus, Reason, ServiceEvent, ServiceState, WellKnown, WellKnownResult } from '@passioncode-ai/fabric-service-host/protocol';

export interface ServiceSnapshot {
  key: string; // `${id}.${instance}`
  descriptorPath: string;
  descriptor: Descriptor | null;
  problems: string[];
  state: ServiceState;
  reasons: Reason[];
  wellKnown: WellKnown | null;
  launchd: LaunchdStatus;
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
  /** Off until the person chooses (lifecycle LC-07); the launch never registers it on its own. */
  launchAtLogin: boolean;
  /** Whether the person has answered the launch-at-login question (first-run card or Settings). */
  launchAtLoginAsked: boolean;
  theme: 'dark' | 'light';
  notifications: {
    enabled: boolean;
    perService: Record<string, { enabled: boolean; minLevel: 'notice' | 'warning' | 'error' }>;
    quietHours: { enabled: boolean; from: string; to: string }; // "22:00" .. "08:00"
    pausedUntil: string | null;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  launchAtLogin: false,
  launchAtLoginAsked: false,
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
