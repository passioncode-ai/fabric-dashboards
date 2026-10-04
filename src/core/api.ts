// The typed bridge between the renderer and the main process. The renderer
// never sees a token, a file handle or a process: it asks, the main process acts.
import type { SpendEntry } from './spend';
import type { ActivityItem, AppStatus, Listener, Reason, Settings } from './types';

export interface Rect { x: number; y: number; width: number; height: number }

export interface FabricApi {
  status(): Promise<AppStatus>;
  onStatus(listener: (status: AppStatus) => void): () => void;
  control(key: string, action: 'restart' | 'stop' | 'start'): Promise<{ ok: boolean; reason: Reason }>;
  command(key: string, which: 'doctor' | 'update'): Promise<{ code: number | null; output: string; timedOut: boolean }>;
  logs(key: string): Promise<{ path: string; text?: string; error?: string }[]>;
  /** Every service's own usage report, read now and summed in the main process (ADR-0013). */
  spend(): Promise<SpendEntry[]>;
  activity(filter: { serviceKey?: string; minLevel?: ActivityItem['level'] }): Promise<ActivityItem[]>;
  markActivitySeen(): Promise<void>;
  settings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<{ settings: Settings; error?: string }>;
  listeners(): Promise<{ listeners: Listener[]; error?: string }>;
  showPath(path: string): Promise<void>;
  /** `owner` names the dashboard host asking (one per mounted host), so its later hide cannot
   *  remove a view another host has shown since (ViewSlot in src/electron/policy.ts). */
  showView(key: string, rect: Rect, link: string | undefined, owner: string): Promise<{ ok: boolean; error?: string }>;
  /** With an owner, hide only that host's view; without, hide whatever is shown. */
  hideView(owner?: string): Promise<void>;
  viewBounds(rect: Rect): void;
  reloadView(key: string): Promise<void>;
  onViewEvent(listener: (event: { key: string; kind: 'restarted' | 'crashed' | 'loaded' | 'error'; error?: string }) => void): () => void;
  onNavigate(listener: (target: { page: 'service' | 'activity'; key?: string; link?: string }) => void): () => void;
  /** Called once the renderer listens: the navigation that arrived before it did (a link at launch), if any. */
  takeNavigation(): Promise<{ page: 'service' | 'activity'; key?: string; link?: string } | null>;
  restartToUpdate(): Promise<void>;
  checkForUpdates(): Promise<void>;
  notificationsAllowed(): Promise<boolean>;
  openNotificationSettings(): Promise<void>;
  locale(): Promise<string>;
  /** Asks the person to confirm, then removes the login item, the MCP registration and the app's
   *  data, moves the app to the Trash and quits (lifecycle LC-14). */
  uninstall(): Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
}

export const CHANNELS = {
  status: 'fd:status',
  statusPush: 'fd:status-push',
  control: 'fd:control',
  command: 'fd:command',
  logs: 'fd:logs',
  spend: 'fd:spend',
  activity: 'fd:activity',
  activitySeen: 'fd:activity-seen',
  settings: 'fd:settings',
  settingsUpdate: 'fd:settings-update',
  listeners: 'fd:listeners',
  showPath: 'fd:show-path',
  viewShow: 'fd:view-show',
  viewHide: 'fd:view-hide',
  viewBounds: 'fd:view-bounds',
  viewReload: 'fd:view-reload',
  viewEvent: 'fd:view-event',
  navigate: 'fd:navigate',
  navigateTake: 'fd:navigate-take',
  updateRestart: 'fd:update-restart',
  updateCheck: 'fd:update-check',
  notificationsAllowed: 'fd:notifications-allowed',
  notificationSettings: 'fd:notification-settings',
  locale: 'fd:locale',
  uninstall: 'fd:uninstall',
} as const;
