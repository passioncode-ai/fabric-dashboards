// Shared shapes between the main process and the renderer. The protocol shapes — descriptor,
// well-known document, events, states, reasons — live in @passioncode-ai/fabric-service-host
// (packages/service-host), the reading code Fabric Dashboards shares with Fabric; they follow
// fabric-agent-contract schemas/service-*.schema.json (DEC-0015). Type-only re-exports keep the
// renderer free of the package's Node code.
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import type { Busy, Descriptor, LaunchdStatus, Reason, ServiceEvent, ServiceState, WellKnown } from '@passioncode-ai/fabric-service-host/protocol';
import type { EstateStatus } from './estate-update';
import type { Dismissal, SessionRecord, SessionsStatus } from './sessions';

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
  /** DEC-0036 ED-9: the dashboard's declared floor in CSS pixels (360…1280), null for a legacy dashboard; the host floor is max(480, it) (ED-7, src/core/layout.ts). */
  dashboardMinWidth: number | null;
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
  /** The colour scheme of the app and, through `fabric_appearance`, of every dashboard (FD-42): `system`
   *  follows macOS. */
  theme: 'system' | 'dark' | 'light';
  /** FD-42 (ED-10): the theme dashboards are asked to use; one of the reference ids, `graphite` by default. */
  pageTheme: string;
  /** The app's language: the system's first one, or a choice that overrides it. */
  language: 'system' | 'en' | 'ru';
  /** Install a downloaded update by itself once the window has been hidden a while (ADR-0015). On by default. */
  autoUpdate: boolean;
  /** Whether the app has offered once to move itself into Applications, where updates can install. */
  moveToApplicationsAsked: boolean;
  /** FD-39 SCN-058: the person finished or hid the setup card; the Setup console stays reachable from Settings. */
  setupDone: boolean;
  /** FD-39 SCN-059: the previous visit — when, which agents it saw, which one was selected last. */
  lastVisitAt: string | null;
  knownServices: string[];
  lastService: string | null;
  notifications: {
    enabled: boolean;
    perService: Record<string, { enabled: boolean; minLevel: 'notice' | 'warning' | 'error' }>;
    quietHours: { enabled: boolean; from: string; to: string }; // "22:00" .. "08:00"
    pausedUntil: string | null;
    /** FD-48: where outages also go — `auto` (the one service offering `<id>.notify`), `off`, or a service key. */
    channel: string;
  };
  /** ADR-0017: how much of the window the dashboard gets. Remembered across services and launches. */
  layout: {
    sidebar: 'expanded' | 'collapsed';
    /** FD-121 (SCN-087): the expanded sidebar's width in px, as the person dragged it (SIDEBAR_WIDTH bounds). */
    sidebarWidth: number;
    header: 'compact' | 'full';
    console: { open: boolean; height: number };
    /** FD-39 (ADR-0020): pinned products in pin order (product ids, ADR-0012), and how the rest is sorted.
     *  FD-78: products the person hid (still watched, listed in a folded Hidden section), a kind the person chose for a
     *  product (`service` or `agent`, else the app's guess), and whether the Hidden section is open. */
    list: ListLayout;
    /** FD-103 (SCN-077): which list the sidebar shows, Agents or Sessions; the window reopens in it. */
    mode: 'agents' | 'sessions';
    /** FD-103 (SCN-077): the session page last open in the Sessions mode (a row id), null for All sessions. */
    sessionId: string | null;
    /** FD-103 (SCN-078): whether the Ended group is unfolded (folded by default). */
    endedOpen: boolean;
  };
  /** ADR-0017: per service key, the runtime and folder its console last used (null: not chosen yet). */
  consoles: Record<string, { runtime: string | null; folder: string | null;
    /** FD-50 (LC-18): the session closed after the idle time — when, and the Switchboard account it ran on;
     *  opening the console again continues it. Cleared by the next start. */
    idle?: { at: string; account: string | null } | null }>;
  /** FD-83: continue a session stopped on a usage limit in the console once Switchboard has capacity for it (default on). */
  resumeAfterLimit: boolean;
  /** FD-103: the Sessions list's memory, kept 24 hours (src/core/sessions.ts): console sessions that ended and hand-overs
   *  that did not open here, and the rows the person removed. */
  sessions: { records: SessionRecord[]; dismissed: Dismissal[] };
  /** FD-103 (SCN-079): the person dismissed the All sessions page's one-time explanation. */
  sessionsNoteSeen: boolean;
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

/** FD-39: the order of the agents list below the pinned ones. */
/** FD-121 (SCN-087): `manual` is the order the person dragged the agents into (ListLayout.order). */
export type ListSort = 'name' | 'status' | 'activity' | 'manual';

/** FD-78: what a product is, as the person set it; absent means the app decides (a product with no dashboard is a service). */
export type ProductKind = 'agent' | 'service';

export interface ListLayout {
  sort: ListSort;
  pinned: string[];
  hidden: string[];
  kinds: Record<string, ProductKind>;
  hiddenOpen: boolean;
  /** FD-121 (SCN-087): product ids in the order the person dragged them; read when `sort` is `manual`. */
  order: string[];
}

/** A change to the settings: any field, and any part of the layout or of one service's console alone. */
export type SettingsPatch = Partial<Omit<Settings, 'layout' | 'notifications'>> & {
  notifications?: Partial<Settings['notifications']>;
  layout?: Partial<Omit<Settings['layout'], 'console' | 'list'>> & { console?: Partial<Settings['layout']['console']>; list?: Partial<Settings['layout']['list']> };
};

/** The console panel's width bounds, in CSS pixels (the window may make it narrower still). */
/** FD-92: the console drawer's height in CSS px; `reveal` is the least of the page that always shows under it. */
export const CONSOLE_HEIGHT = { min: 180, max: 2400, default: 380, reveal: 96 } as const;
/** FD-121 (SCN-087): the expanded sidebar's width; the default is the width it had before it could change. */
export const SIDEBAR_WIDTH = { min: 200, max: 420, default: 240, step: 16 } as const;

export const DEFAULT_SETTINGS: Settings = {
  launchAtLogin: false,
  launchAtLoginAsked: false,
  theme: 'dark',
  pageTheme: 'graphite',
  language: 'system',
  autoUpdate: true,
  moveToApplicationsAsked: false,
  setupDone: false,
  lastVisitAt: null,
  knownServices: [],
  lastService: null,
  notifications: {
    enabled: true,
    perService: {},
    quietHours: { enabled: false, from: '22:00', to: '08:00' },
    pausedUntil: null,
    channel: 'auto',
  },
  layout: { sidebar: 'expanded', sidebarWidth: SIDEBAR_WIDTH.default, header: 'compact', console: { open: false, height: CONSOLE_HEIGHT.default }, list: { sort: 'name', pinned: [], hidden: [], kinds: {}, hiddenOpen: false, order: [] }, mode: 'agents', sessionId: null, endedOpen: false },
  consoles: {},
  resumeAfterLimit: true,
  sessions: { records: [], dismissed: [] },
  sessionsNoteSeen: false,
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
  update: { state: 'idle' | 'checking' | 'downloading' | 'ready' | 'held' | 'error' | 'unsupported' | 'misplaced' | 'package' | 'notyet'; version?: string; error?: string; checkedAt?: string; steps?: string };
  /** FD-48: the operator channel outages go to, why there is none, and the last delivery. */
  alerts?: { channel: { key: string; capability: string } | null; none?: 'off' | 'none-installed' | 'several' | 'chosen-gone' | 'chosen-unreachable'; candidates: string[]; last?: { at: string; ok: boolean; subject: string; error?: string } };
  // #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
  /** ADR-0018: what the estate watcher saw last — the contract clone vs the remote, consumer pins, skills. */
  estate: EstateStatus;
  // #endregion estate-update
  /** FD-103: every coding session of this Mac, merged from Switchboard and this app's consoles (src/core/sessions.ts). */
  sessions?: SessionsStatus;
  /** W2 (UX-05, UX-06): the spending limits that need a person (tripped or over the line), by agent, from the last
   *  spend read (`limitsNeedingPerson`); absent until Spend, Overview or Connections asked once (LC-08). */
  limits?: Record<string, LimitView[]>;
  /** W2 (UX-08): when the window was last shown and how long it had been hidden before; the renderer opens a new
   *  "Since you were last here" after a long gap (`revisitDue`). */
  shown?: { at: string; afterHiddenMs: number };
  version: string;
}

// #region limit-recovery — docs: docs/ux/scenarios.md#scn-075-a-session-stopped-on-a-limit-continues-by-itself
/** Why a stop is not continued here, or `resume`. The Connections page shows every stop that is not resumed or
 *  `continued` (FIX-5: its session went on after it, so nothing waits for it). */
export type StopVerdict = 'resume' | 'open' | 'old' | 'billing' | 'waiting' | 'no-folder' | 'no-transcript' | 'claimed' | 'continued';

/** One stop on the Connections page: never its prompt, only where and since when. */
export interface StopView { event: string; session: string; dir: string; provider: 'claude' | 'codex'; stoppedAt: number; attempt: number; verdict: StopVerdict | 'resumed' | 'failed'; key?: string;
  /** FD-103: the accounts that could take it now (Switchboard's candidates, its order), ids and labels only. */
  candidates?: { id: string; label: string }[];
  /** R1-S3: when Switchboard will probe a waiting stop (its `probe_at`, ms); null or absent when it names none. */
  probeAt?: number | null;
  /** V-1 (FIX-2): the label of the account the session stopped on (Switchboard's `account`, named by its label when the
   *  account list has it); null or absent when unknown. */
  account?: string | null;
  /** FD-118: Switchboard's reason a waiting stop is not ready (0.6.83); null or absent when it names none. */
  waitReason?: 'billing' | 'account_removed' | 'no_account' | 'backoff' | null }

/** What the app knows about sessions stopped on a limit: off, unreadable, or the stops still open. */
export interface RecoveryStatus {
  on: boolean;
  unavailable?: 'absent' | 'old' | 'error';
  /** Stops still `waiting` in Switchboard, and the ones this launch continued. */
  stops: StopView[];
  /** Sessions this launch continued. */
  resumed: number;
}
// #endregion limit-recovery
