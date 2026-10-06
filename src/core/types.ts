// Shared shapes between the main process and the renderer. The protocol shapes — descriptor,
// well-known document, events, states, reasons — live in @passioncode-ai/fabric-service-host
// (packages/service-host), the reading code Fabric Dashboards shares with Fabric; they follow
// fabric-agent-contract schemas/service-*.schema.json (DEC-0015). Type-only re-exports keep the
// renderer free of the package's Node code.
import type { Busy, Descriptor, LaunchdStatus, Reason, ServiceEvent, ServiceState, WellKnown } from '@passioncode-ai/fabric-service-host/protocol';
import type { EstateStatus } from './estate-update';

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
  /** The usage path the service's own last answer declared, kept while it does not answer (ADR-0013). */
  usagePath?: string | null;
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
  /** The app's language: the system's first one, or a choice that overrides it. */
  language: 'system' | 'en' | 'ru';
  /** Install a downloaded update by itself once the window has been hidden a while (ADR-0015). On by default. */
  autoUpdate: boolean;
  /** Whether the app has offered once to move itself into Applications, where updates can install. */
  moveToApplicationsAsked: boolean;
  notifications: {
    enabled: boolean;
    perService: Record<string, { enabled: boolean; minLevel: 'notice' | 'warning' | 'error' }>;
    quietHours: { enabled: boolean; from: string; to: string }; // "22:00" .. "08:00"
    pausedUntil: string | null;
  };
  /** ADR-0017: how much of the window the dashboard gets. Remembered across services and launches. */
  layout: {
    sidebar: 'expanded' | 'collapsed';
    header: 'compact' | 'full';
    console: { open: boolean; width: number };
  };
  /** ADR-0017: per service key, the runtime and folder its console last used (null: not chosen yet). */
  consoles: Record<string, { runtime: string | null; folder: string | null }>;
  // #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
  /** ADR-0018: the estate watcher — the contract clone and the skill family. */
  estate: {
    /** Master switch. Off: nothing runs, no probes, no children (default on). */
    enabled: boolean;
    /** Apply sshlg-skills updates by itself after the publisher check (default off: report only). */
    autoSkills: boolean;
    /** Absolute path to a local fabric-agent-contract clone; empty = the contract is not watched. */
    contractClone: string;
  };
  // #endregion estate-update
}

/** A change to the settings: any field, and any part of the layout or of one service's console alone. */
export type SettingsPatch = Partial<Omit<Settings, 'layout' | 'notifications'>> & {
  notifications?: Partial<Settings['notifications']>;
  layout?: Partial<Omit<Settings['layout'], 'console'>> & { console?: Partial<Settings['layout']['console']> };
};

/** The console panel's width bounds, in CSS pixels (the window may make it narrower still). */
export const CONSOLE_WIDTH = { min: 320, max: 1600, default: 440 } as const;

export const DEFAULT_SETTINGS: Settings = {
  launchAtLogin: false,
  launchAtLoginAsked: false,
  theme: 'dark',
  language: 'system',
  autoUpdate: true,
  moveToApplicationsAsked: false,
  notifications: {
    enabled: true,
    perService: {},
    quietHours: { enabled: false, from: '22:00', to: '08:00' },
    pausedUntil: null,
  },
  layout: { sidebar: 'expanded', header: 'compact', console: { open: false, width: CONSOLE_WIDTH.default } },
  consoles: {},
  // #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
  estate: { enabled: true, autoSkills: false, contractClone: '' },
  // #endregion estate-update
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
  /** Grows with every activity row, so an open Activity page refreshes for app events too (U-8). */
  activityRev?: number;
  /** `held`: a release that needs a person's step first (LC-16), verified, not installed; `steps` is its runbook. */
  update: { state: 'idle' | 'checking' | 'downloading' | 'ready' | 'held' | 'error' | 'unsupported' | 'misplaced'; version?: string; error?: string; checkedAt?: string; steps?: string };
  // #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
  /** ADR-0018: what the estate watcher saw last — the contract clone vs the remote, consumer pins, skills. */
  estate: EstateStatus;
  // #endregion estate-update
  version: string;
}
