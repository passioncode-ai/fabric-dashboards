// The typed bridge between the renderer and the main process. The renderer
// never sees a token, a file handle or a process: it asks, the main process acts.
import type { SetupCheckResult } from './doctor';
import type { CommandResult } from './outcome';
import type { SpendEntry } from './spend';
import type { LoadEntry } from './load';
import type { ActivityItem, AppStatus, Listener, Reason, Settings, SettingsPatch } from './types';

/** A job a console is opened to do (FD-39 D-3): fix what is wrong, or update; `output` is a failed command's. */
/** `audit` (FD-81): `output` carries the auditor's findings for this agent, as the person read them. */
export interface ConsoleTask { kind: 'fix' | 'update' | 'audit'; output?: string }

/** FD-92: a job the console starts once it is shown (Fix / Update with agent, Continue); taken once by its nonce. */
export interface DrawerTask { task?: ConsoleTask; mode?: 'new' | 'continue'; nonce: number }
/** FD-92: what the window's page asks of the console drawer. `rect` is the area under the page header, in window
 *  coordinates; `suspended` while one of the app's own dialogs is open (the drawer would lie over it). */
export interface DrawerState { key: string | null; open: boolean; rect: Rect | null; height: number; task: DrawerTask | null; suspended: boolean }
/** FD-92: what the drawer's own page is told: which console, its height now, the area's height and a job to start. */
export interface DrawerPush { key: string | null; height: number; areaHeight: number; task: DrawerTask | null }
/** FD-92: what the drawer's page reports back to the window's page. */
export type DrawerChange = { kind: 'hide' } | { kind: 'height'; height: number } | { kind: 'taskTaken'; nonce: number };

export interface Rect { x: number; y: number; width: number; height: number }

/** ADR-0017: what a service's console shows before and while it runs. */
export interface ConsoleInfo {
  key: string;
  runtimes: { id: string; name: string; canContinue: boolean; viaSwitchboard: boolean }[];
  /** The runtime chosen for this service (saved, else Claude Code, else the first found); null when none is installed. */
  runtime: string | null;
  /** The folder: saved by the person, or found from the descriptor's repository; null when neither. */
  folder: { path: string; source: 'saved' | 'found'; exists: boolean } | null;
  /** What Switchboard binds the folder to, for the chosen runtime. */
  binding: { kind: 'none' } | { kind: 'project'; name: string; pool: string; inPlace: boolean } | { kind: 'error'; detail: string } | { kind: 'absent' };
  session: { state: 'idle' | 'running' | 'exited'; label: string; cwd: string; output: string; end: number; exitCode: number | null; signal: number | null };
  /** FD-50 (LC-18): the session was closed after the idle time; opening the console continues it. */
  idle: { at: string; account: string | null } | null;
  /** FD-62: the session this console runs came from a Switchboard hand-over (SB-108). */
  /** FD-62; FD-83: `kind: 'resume'` is a session this app continued after a usage limit. */
  handover?: { id: string; workflow: string; agent: string; account: string; dir: string; kind?: 'handover' | 'resume' } | null;
}

/** FD-43/FD-51: the Switchboard sessions of a console's folder, or why there are none to show. */
export type ConsoleSessions =
  | { sessions: { state: 'starting' | 'running' | 'ended' | 'unknown'; label: string; mode: string; provider: string; launchedAt: number | null; movedTo: string | null }[] }
  | { unavailable: 'absent' | 'no-folder' | 'old' | 'error'; detail: string };

/** Why a start did not run in the console, worded by the renderer. */
export type ConsoleStartResult =
  | { ok: true }
  | { ok: false; reason: 'running' | 'no-runtime' | 'no-folder' | 'no-continue' | 'switchboard' | 'terminal-only' | 'spawn'; detail?: string; project?: string }
  /** FD-49 (LC-17): deferred — the machine cannot carry another session now. */
  | { ok: false; reason: 'admission'; why: 'disk' | 'swap' | 'cap'; freeGb?: number; running?: number; cap?: number };

/** Where an embedded dashboard is now (ADR-0014). */
export interface PageState { key: string; address: string; link: string; canGoBack: boolean; canGoForward: boolean; loading: boolean }

export interface FabricApi {
  status(): Promise<AppStatus>;
  onStatus(listener: (status: AppStatus) => void): () => void;
  control(key: string, action: 'restart' | 'stop' | 'start'): Promise<{ ok: boolean; reason: Reason }>;
  /** Run the descriptor's doctor or update. `refused` says why nothing ran (busy, not declared); `code: null` without `timedOut` means it could not start. */
  command(key: string, which: 'doctor' | 'update'): Promise<CommandResult & { refused?: string }>;
  logs(key: string): Promise<{ path: string; text?: string; error?: string }[]>;
  /** Every service's own usage report, read now and summed in the main process (ADR-0013). */
  /** What every agent spent, and when the main process read it. `force` (Refresh) reads now, even inside the 30 s reuse window. */
  spend(force?: boolean): Promise<{ entries: SpendEntry[]; readAt: string | null }>;
  /** FD-93: one agent's own load report, read now in the main process (DEC-0104); `readAt` is that read's time. */
  load(key: string): Promise<{ entry: LoadEntry; readAt: string }>;
  activity(filter: { serviceKey?: string; minLevel?: ActivityItem['level'] }): Promise<ActivityItem[]>;
  markActivitySeen(): Promise<void>;
  settings(): Promise<Settings>;
  /** FD-39 SCN-058: what is set up already (read only). */
  setupState(): Promise<{ mcp: boolean; skills: boolean; firstAgent: boolean }>;
  /** FD-65: runs the launcher's read-only doctor now (up to two minutes); the last result until the next press. */
  setupCheck(): Promise<SetupCheckResult>;
  setupCheckLast(): Promise<SetupCheckResult | null>;
  updateSettings(patch: SettingsPatch): Promise<{ settings: Settings; error?: string }>;
  listeners(): Promise<{ listeners: Listener[]; error?: string }>;
  /** Open a folder or reveal a file this app knows (the services folder, a descriptor, a service's data); never launches an app. */
  showPath(path: string): Promise<{ ok: boolean; error?: string }>;
  /** `owner` names the dashboard host asking (one per mounted host), so its later hide cannot
   *  remove a view another host has shown since (ViewSlot in src/electron/policy.ts). */
  /** Show a service's dashboard for the host `owner`; `fresh` signs in and loads again (Retry, Reload). */
  showView(key: string, rect: Rect, link: string | undefined, owner: string, fresh?: boolean): Promise<{ ok: boolean; error?: string; stage?: 'sign-in' | 'page' }>;
  /** With an owner, hide only that host's view; without, hide whatever is shown. */
  hideView(owner?: string): Promise<void>;
  viewBounds(rect: Rect): void;
  /** Where a service's embedded dashboard is now — address, app link, history (ADR-0014). */
  viewPage(key: string): Promise<PageState | null>;
  viewNavigate(key: string, action: 'back' | 'forward' | 'home' | 'refresh'): Promise<void>;
  /** Put text on the clipboard from the main process (the toolbar's Copy buttons). */
  copyText(text: string): Promise<void>;
  /** FD-74: the toolbar's one Copy button: a native menu under `anchor` with Copy address and Copy app link;
   *  answers what was copied, or null when the menu closed without a choice. */
  copyMenu(key: string, anchor: { x: number; y: number }): Promise<'address' | 'link' | null>;
  /** FD-45 (ADR-0021): what Fabric's button does for a service now — open Fabric at once, say it is not installed, or no button. */
  fabricButton(key: string): Promise<'direct' | 'absent' | 'none'>;
  /** FD-45: press it. The main process opens the `fabric://` link, or a native menu under `anchor` (window coordinates, CSS px). */
  fabricPress(key: string, anchor: { x: number; y: number }): Promise<{ opened: 'fabric' | 'menu' | 'none' }>;
  onViewEvent(listener: (event: { key: string; kind: 'restarted' | 'crashed' | 'loaded' | 'error' | 'navigated'; error?: string; page?: PageState }) => void): () => void;
  onNavigate(listener: (target: { page: 'service' | 'activity' | 'overview' | 'spend' | 'map' | 'settings'; key?: string; link?: string }) => void): () => void;
  /** Called once the renderer listens: the navigation that arrived before it did (a link at launch), if any. */
  takeNavigation(): Promise<{ page: 'service' | 'activity' | 'overview' | 'spend' | 'map' | 'settings'; key?: string; link?: string } | null>;
  /** U-18: the screen on show, so Restart to update can reopen on it. */
  routeChanged(route: { page: string; key?: string }): void;
  /** Read the services folder again now (the unreadable-folder Retry). */
  rescan(): Promise<void>;
  /** Open how a service joins (the building-fabric-services kit) in the browser — a fixed address, never one from a page. */
  openServiceGuide(): Promise<void>;
  restartToUpdate(): Promise<void>;
  checkForUpdates(): Promise<void>;
  /** Open the steps of a held release (LC-16 `needsPerson`) — the address comes from the verified feed in the main process, never from a page. */
  openUpdateSteps(): Promise<void>;
  /** Moves the app into Applications, where updates can install, and relaunches it (ADR-0015). */
  moveToApplications(): Promise<{ ok: boolean; error?: string }>;
  openNotificationSettings(): Promise<void>;
  locale(): Promise<string>;
  // ── ADR-0017: the agent console beside a service's dashboard ──
  consoleInfo(key: string): Promise<ConsoleInfo>;
  consoleChoose(key: string, choice: { runtime?: string }): Promise<ConsoleInfo>;
  /** A folder dialog; the choice is saved for this service. */
  consolePickFolder(key: string): Promise<ConsoleInfo>;
  /** FD-39: `task` hands a job with the context (Fix / Update with agent, ADR-0020). */
  consoleStart(key: string, mode: 'new' | 'continue', size: { cols: number; rows: number }, task?: ConsoleTask): Promise<ConsoleStartResult>;
  consoleInput(key: string, data: string): void;
  consoleResize(key: string, cols: number, rows: number): void;
  consoleStop(key: string): Promise<void>;
  /** FD-43: what Switchboard launched in this console's folder; asked only while the console is shown. */
  consoleSessions(key: string): Promise<ConsoleSessions>;
  /** FD-62: a finished hand-over console leaves the list. */
  consoleDismissHandover(key: string): Promise<void>;
  /** Continue the same runtime and folder in Terminal (through Switchboard for a bound folder). */
  consoleOpenTerminal(key: string, mode: 'new' | 'continue'): Promise<{ ok: boolean; error?: string }>;
  /** Output and exits while the window is visible; a hidden window gets nothing and asks `consoleInfo` again. */
  /** View menu: fold or unfold a panel (ADR-0017). */
  onLayoutCommand(listener: (which: 'sidebar' | 'console' | 'details') => void): () => void;
  /** FD-92: the window's page sets what the console drawer shows. */
  consoleDrawer(state: DrawerState): void;
  /** FD-92: the drawer's page: what to show (pushed on every change and after it loads). */
  onDrawer(listener: (push: DrawerPush) => void): () => void;
  /** FD-92: the drawer's page reports a fold, a new height or a taken job; the window's page hears it. */
  drawerChange(change: DrawerChange): void;
  onDrawerChange(listener: (change: DrawerChange) => void): () => void;
  /** FD-92: while its edge is dragged the drawer covers the whole area, to keep the pointer. */
  drawerDrag(on: boolean): void;
  onConsoleEvent(listener: (event: { key: string; kind: 'data'; data: string; end: number } | { key: string; kind: 'exit'; code: number | null; signal?: number | null }) => void): () => void;
  /** Asks the person to confirm, then removes the login item and the MCP registration, moves the
   *  app to the Trash and quits. Settings and history stay for a reinstall unless the person ticks
   *  the box to delete them too (lifecycle LC-14, ADR-0015). */
  uninstall(): Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
}

export const CHANNELS = {
  status: 'fd:status',
  statusPush: 'fd:status-push',
  control: 'fd:control',
  command: 'fd:command',
  logs: 'fd:logs',
  spend: 'fd:spend',
  load: 'fd:load',
  activity: 'fd:activity',
  activitySeen: 'fd:activity-seen',
  settings: 'fd:settings',
  settingsUpdate: 'fd:settings-update',
  setupState: 'fd:setup-state',
  setupCheck: 'fd:setup-check',
  setupCheckLast: 'fd:setup-check-last',
  listeners: 'fd:listeners',
  showPath: 'fd:show-path',
  viewShow: 'fd:view-show',
  viewHide: 'fd:view-hide',
  viewBounds: 'fd:view-bounds',
  viewPage: 'fd:view-page',
  viewNavigate: 'fd:view-navigate',
  copyText: 'fd:copy-text',
  copyMenu: 'fd:copy-menu',
  fabricButton: 'fd:fabric-button',
  fabricPress: 'fd:fabric-press',
  viewEvent: 'fd:view-event',
  navigate: 'fd:navigate',
  navigateTake: 'fd:navigate-take',
  routeChanged: 'fd:route-changed',
  rescan: 'fd:rescan',
  serviceGuide: 'fd:service-guide',
  updateRestart: 'fd:update-restart',
  updateCheck: 'fd:update-check',
  updateSteps: 'fd:update-steps',
  moveToApplications: 'fd:move-to-applications',
  notificationSettings: 'fd:notification-settings',
  locale: 'fd:locale',
  uninstall: 'fd:uninstall',
  consoleInfo: 'fd:console-info',
  consoleChoose: 'fd:console-choose',
  consolePickFolder: 'fd:console-pick-folder',
  consoleStart: 'fd:console-start',
  consoleInput: 'fd:console-input',
  consoleResize: 'fd:console-resize',
  consoleStop: 'fd:console-stop',
  consoleSessions: 'fd:console-sessions',
  consoleDismissHandover: 'fd:console-dismiss-handover',
  consoleOpenTerminal: 'fd:console-open-terminal',
  consoleEvent: 'fd:console-event',
  drawerState: 'fd:drawer-state',
  drawerPush: 'fd:drawer-push',
  drawerChange: 'fd:drawer-change',
  drawerDrag: 'fd:drawer-drag',
  layoutCommand: 'fd:layout-command',
} as const;
