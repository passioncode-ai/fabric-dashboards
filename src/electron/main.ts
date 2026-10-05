// Fabric Dashboards main process. Built like Fabric Inbox's shell: one main
// process, sandboxed renderers, context isolation, a single instance. It owns
// no service process — launchd does (ADR-0002) — so quitting stops nothing.
import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { ActivityStore } from '../core/activity';
import { CHANNELS, type Rect } from '../core/api';
import { killOwned } from '../core/children';
import { appendLog, sweepTemps } from '../core/fsutil';
import { parseDeepLink, SCHEME } from '../core/deeplink';
import { servicesDir } from '@passioncode-ai/fabric-service-host';
import { langFor, t, type Lang } from '../core/i18n';
import { execRunner } from '../core/launchd';
import { listListeners, unattributed } from '../core/listeners';
import { applyLoginItem, loginItemAtStartup, type LoginItemOs } from '../core/loginitem';
import { Monitor, type Notice } from '../core/monitor';
import { fetchUsage, readToken } from '../core/probe';
import { readSpend, type SpendEntry } from '../core/spend';
import { NotifyLedger } from '../core/notify';
import { SettingsStore } from '../core/settings';
import type { AppStatus, Settings } from '../core/types';
import { productDataPaths, purgeAfterExit, removeMcpRegistrations } from '../core/uninstall';
import { HiddenGrace, partitionFor, stalePartitions, VIEW_RELEASE_GRACE_MS } from './policy';
import { AppTray } from './tray';
import { Updater } from './updater';
import { ServiceViews } from './views';
import { parseTestRemote, setTestRemote } from '../core/testhooks';

app.enableSandbox();
app.setName('Fabric Dashboards');
if (process.env.FABRIC_DASHBOARDS_USER_DATA) {
  // A test or second profile keeps its logs beside its data; Electron derives `logs` from the
  // app name, not from userData, so without this a test run writes into the operator's log.
  app.setPath('userData', process.env.FABRIC_DASHBOARDS_USER_DATA);
  app.setPath('logs', path.join(process.env.FABRIC_DASHBOARDS_USER_DATA, 'logs'));
}

// DEC-0019 test hook — an unpackaged build only (testhooks.ts). Chromium resolves the test name to
// the dial address; the main process dials it directly. A packaged app ignores FD_TEST_REMOTE.
if (!app.isPackaged && process.env.FD_TEST_REMOTE) {
  const remote = parseTestRemote(process.env.FD_TEST_REMOTE);
  setTestRemote(remote);
  if (remote) app.commandLine.appendSwitch('host-resolver-rules', `MAP ${remote.name} ${remote.connectHost}`);
}

const assets = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, '../../../build/assets');
const rendererIndex = path.join(__dirname, '../../renderer/index.html');

/** ~/Library/Logs/Fabric Dashboards/main.log: timestamped, 0600, 5 × 5 MB at most (LC-12). */
function log(message: string): void {
  appendLog(path.join(app.getPath('logs'), 'main.log'), `${new Date().toISOString()} ${message}`);
}

// Deep links (docs/adr/0004-deep-links-and-mcp.md). macOS delivers `open-url` as early as
// `will-finish-launching`, before the window or the monitor exists: the link waits in a queue.
const pendingLinks: string[] = [];
let handleLink: ((raw: string) => void) | null = null;
app.on('will-finish-launching', () => {
  app.on('open-url', (event, raw) => {
    event.preventDefault();
    if (handleLink) handleLink(raw);
    else pendingLinks.push(raw);
  });
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let window: BrowserWindow | null = null;
  let views: ServiceViews | null = null;
  let quitting = false;
  const userData = app.getPath('userData');
  // A writer killed between write and rename leaves its temporary file; nothing else removes it (LC-12).
  for (const name of sweepTemps(userData)) log(`removed a temporary file left by a stopped process: ${name}`);
  const settings = new SettingsStore(userData);
  const activity = new ActivityStore(userData);
  const lang = (): Lang => langFor(app.getPreferredSystemLanguages()[0] ?? app.getLocale());
  const monitor = new Monitor({ servicesDir: servicesDir(), activity, settings: () => settings.get(), lang, ledger: new NotifyLedger(path.join(userData, 'notified.json')) });
  let tray: AppTray | null = null;
  const updater = new Updater(() => pushStatus(), log);

  const status = (): AppStatus => ({
    services: monitor.snapshots(), ...monitor.meta(), unread: activity.unread(), update: updater.state, version: app.getVersion(),
  });

  // #region quiet-push — docs: AGENTS.md#lifecycle
  // The monitor emits only real changes; here a hidden window gets no IPC (it is sent the current
  // status the moment it shows), the tray rebuilds only when its menu would differ, and the Dock
  // badge is set only when it changes (LC-08).
  let pushTimer: NodeJS.Timeout | null = null;
  let badge: string | null = null;
  const windowVisible = () => Boolean(window && !window.isDestroyed() && window.isVisible() && !window.isMinimized());
  function pushStatus(): void {
    if (pushTimer) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      const s = status();
      if (windowVisible()) window!.webContents.send(CHANNELS.statusPush, s);
      tray?.update(s.services);
      const next = s.services.filter((x) => ['down', 'duplicate', 'foreign', 'conflict', 'invalid'].includes(x.state)).length ? '!' : '';
      if (next !== badge) { badge = next; app.dock?.setBadge(next); }
    }, 30);
  }

  // Embedded dashboards are released once the window has been hidden for the grace period.
  const viewGrace = new HiddenGrace(VIEW_RELEASE_GRACE_MS, () => {
    const count = views?.keys().length ?? 0;
    if (!count) return;
    views?.releaseAll();
    log(`released ${count} dashboard view(s) after ${VIEW_RELEASE_GRACE_MS / 60_000} min hidden`);
  });
  function windowShown(): void {
    viewGrace.shown();
    monitor.setVisible(true);
    pushStatus();
    void views?.resume((key) => monitor.snapshot(key));
  }
  function windowHidden(): void {
    monitor.setVisible(false);
    viewGrace.hidden();
  }
  // #endregion quiet-push

  function showWindow(): BrowserWindow {
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
      return window;
    }
    window = new BrowserWindow({
      width: 1280, height: 820, minWidth: 960, minHeight: 600, show: false, title: 'Fabric Dashboards',
      titleBarStyle: 'hiddenInset', backgroundColor: settings.get().theme === 'light' ? '#ffffff' : '#0a070d',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
    });
    const w = window;
    rendererListening = false;
    w.webContents.on('did-start-loading', () => { rendererListening = false; });
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    w.webContents.on('will-navigate', (event) => event.preventDefault());
    w.webContents.session.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
    views = new ServiceViews(w, lang, (event) => w.webContents.send(CHANNELS.viewEvent, event));
    w.once('ready-to-show', () => w.show());
    w.on('show', windowShown);
    w.on('hide', windowHidden);
    w.on('minimize', windowHidden);
    w.on('restore', windowShown);
    w.on('close', (event) => {
      if (quitting) return;
      event.preventDefault(); // the window hides; the app keeps watching from the menu bar
      w.hide();
    });
    w.on('closed', () => { window = null; views = null; });
    void w.loadFile(rendererIndex);
    return w;
  }

  // A navigation sent before the renderer subscribes is lost (a link at launch lands while React
  // is still mounting), so until the renderer takes it (CHANNELS.navigateTake) it waits here.
  type NavTarget = { page: 'service' | 'activity'; key?: string; link?: string };
  let rendererListening = false;
  let pendingNav: NavTarget | null = null;
  function navigate(target: NavTarget): void {
    const w = showWindow();
    if (rendererListening) w.webContents.send(CHANNELS.navigate, target);
    else pendingNav = target; // the latest wins, as a click would
  }

  function notify(notice: Notice): void {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: notice.title, subtitle: notice.subtitle, body: notice.body, silent: false });
    n.on('click', () => navigate({ page: notice.target, key: notice.serviceKey, link: notice.link }));
    n.show();
  }

  // A development run must never register the Electron binary at login: no OS port at all.
  const loginOs: LoginItemOs | null = app.isPackaged
    ? { get: () => app.getLoginItemSettings(), set: (openAtLogin) => app.setLoginItemSettings({ openAtLogin }) }
    : null;

  // #region uninstall-flow — docs: docs/ux/scenarios.md#scn-024-settings-launch-at-login-notifications-quiet-hours
  /** LC-14: undo what installing and running added. Registrations go first and stop the flow on
   *  failure, so a half-uninstalled app never deletes its data and leaves an entry behind. */
  async function uninstall(): Promise<{ ok: boolean; cancelled?: boolean; error?: string }> {
    const l = lang();
    const parent = window && !window.isDestroyed() ? window : undefined;
    const ask = { type: 'warning' as const, buttons: [t(l, 'uninstall.confirm'), t(l, 'action.cancel')], defaultId: 1, cancelId: 1, message: t(l, 'uninstall.title'), detail: t(l, 'settings.uninstall.body') };
    const { response } = parent ? await dialog.showMessageBox(parent, ask) : await dialog.showMessageBox(ask);
    if (response !== 0) return { ok: false, cancelled: true };
    try {
      if (loginOs) {
        const refused = applyLoginItem(false, loginOs);
        if (refused) throw new Error(refused);
      }
      // A development build leaves the installed app's registration alone.
      if (app.isPackaged) log(`uninstall: MCP registration removed from ${JSON.stringify(removeMcpRegistrations().removed)}`);
    } catch (error) {
      log(`uninstall stopped: ${(error as Error).message}`);
      return { ok: false, error: t(l, 'uninstall.failed', { error: (error as Error).message }) };
    }
    // Data goes after this process exits — Chromium writes into userData until then (purgeAfterExit).
    // A development run shares the installed app's profile name, so it purges nothing.
    const targets = app.isPackaged ? [...new Set([...productDataPaths(app.getPath('home')), userData, app.getPath('logs')])] : [];
    purgeAfterExit(process.pid, targets);
    if (app.isPackaged) {
      const bundle = path.resolve(process.execPath, '../../..');
      try {
        await shell.trashItem(bundle);
      } catch (error) {
        await dialog.showMessageBox({ type: 'info', message: t(l, 'uninstall.trashFailed', { error: (error as Error).message }), buttons: ['OK'] });
      }
    }
    log('uninstall: login item and registration removed; data is removed after exit');
    quitting = true;
    setImmediate(() => app.quit());
    return { ok: true };
  }
  // #endregion uninstall-flow

  function registerIpc(): void {
    const snap = (key: string) => monitor.snapshot(key);
    ipcMain.handle(CHANNELS.status, () => status());
    ipcMain.handle(CHANNELS.navigateTake, () => {
      rendererListening = true;
      const target = pendingNav;
      pendingNav = null;
      return target;
    });
    ipcMain.handle(CHANNELS.control, async (_e, key: string, action: 'restart' | 'stop' | 'start') => {
      if (!['restart', 'stop', 'start'].includes(action)) throw new Error('unknown action');
      if (action !== 'restart') views?.drop(key);
      return monitor.control(key, action);
    });
    ipcMain.handle(CHANNELS.command, (_e, key: string, which: 'doctor' | 'update') => {
      if (which !== 'doctor' && which !== 'update') throw new Error('unknown command');
      return monitor.command(key, which);
    });
    ipcMain.handle(CHANNELS.logs, (_e, key: string) => monitor.logs(key));
    // LC-08: a hidden window reads nothing — the Spend page's timer may keep running while hidden,
    // and the renderer cannot tell (no visibility change on hide), so the main process answers the
    // last sums instead of reading every service again.
    let lastSpend: SpendEntry[] = [];
    ipcMain.handle(CHANNELS.spend, async () => {
      if (windowVisible() || !lastSpend.length) lastSpend = await readSpend(monitor.snapshots(), { token: readToken, fetchUsage, now: () => Date.now() });
      return lastSpend;
    });
    ipcMain.handle(CHANNELS.activity, (_e, filter) => activity.list(filter ?? {}));
    ipcMain.handle(CHANNELS.activitySeen, () => { activity.markSeen(); pushStatus(); });
    ipcMain.handle(CHANNELS.settings, () => settings.get());
    ipcMain.handle(CHANNELS.settingsUpdate, (_e, patch: Partial<Settings>) => {
      // Choosing launch at login — on the first-run card or in Settings — is the one moment it is registered (LC-07).
      const choosing = 'launchAtLogin' in patch;
      const next = settings.update(choosing ? { ...patch, launchAtLoginAsked: true } : patch);
      const error = choosing && loginOs ? applyLoginItem(next.launchAtLogin, loginOs) : undefined;
      if (error) {
        const reverted = settings.update({ launchAtLogin: false });
        return { settings: reverted, error };
      }
      pushStatus();
      return { settings: next };
    });
    ipcMain.handle(CHANNELS.listeners, async () => {
      try {
        const claimed = new Set(monitor.snapshots().map((s) => Number(/:(\d+)$/.exec(s.descriptor?.origin ?? '')?.[1] ?? 0)));
        return { listeners: unattributed(await listListeners(execRunner), claimed) };
      } catch (error) {
        return { listeners: [], error: (error as Error).message };
      }
    });
    ipcMain.handle(CHANNELS.showPath, (_e, p: string) => {
      const known = monitor.snapshots().flatMap((s) => [s.descriptorPath, s.descriptor?.paths?.data, s.descriptor?.auth.tokenFile].filter(Boolean) as string[]);
      const allowed = [monitor.meta().servicesDir, ...known].map((x) => x.replace(/^~\//, `${app.getPath('home')}/`));
      const target = p.replace(/^~\//, `${app.getPath('home')}/`);
      if (!allowed.includes(target)) throw new Error('not a path this app shows');
      if (target === monitor.meta().servicesDir) fs.mkdirSync(target, { recursive: true, mode: 0o700 });
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) void shell.openPath(target);
      else shell.showItemInFolder(target);
    });
    ipcMain.handle(CHANNELS.viewShow, async (_e, key: string, rect: Rect, link: string | undefined, owner: string) => {
      const s = snap(key);
      if (!s || !views) return { ok: false, error: 'unknown service' };
      if (typeof owner !== 'string' || !owner) throw new Error('a view is shown for a dashboard host');
      return views.show(s, rect, link, owner);
    });
    ipcMain.handle(CHANNELS.viewHide, (_e, owner?: string) => views?.hide(typeof owner === 'string' ? owner : undefined));
    ipcMain.handle(CHANNELS.viewReload, async (_e, key: string) => { const s = snap(key); if (s) await views?.reload(s); });
    ipcMain.handle(CHANNELS.updateRestart, () => { quitting = true; updater.restart(); });
    ipcMain.handle(CHANNELS.updateCheck, () => updater.check());
    ipcMain.handle(CHANNELS.notificationsAllowed, () => Notification.isSupported());
    ipcMain.handle(CHANNELS.notificationSettings, () => shell.openExternal('x-apple.systempreferences:com.apple.Notifications-Settings.extension'));
    ipcMain.handle(CHANNELS.locale, () => lang());
    ipcMain.handle(CHANNELS.uninstall, () => uninstall());
    ipcMain.on(CHANNELS.viewBounds, (_e, rect: Rect) => views?.setBounds(rect));
  }

  function appMenu(): void {
    const l = lang();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu', submenu: [
        { role: 'about' },
        { label: l === 'ru' ? 'Проверить обновления…' : 'Check for Updates…', click: () => updater.check() },
        { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' },
        { role: 'quit' },
      ] },
      { role: 'editMenu' },
      { role: 'windowMenu' },
    ]));
  }

  // A link opened while the app runs reaches the first instance as an argument (and through
  // `open-url` on macOS); a second process only forwards it and exits.
  app.on('second-instance', (_event, argv) => {
    const raw = argv.find((a) => a.startsWith(`${SCHEME}:`));
    if (raw && handleLink) handleLink(raw);
    else showWindow();
  });
  app.on('activate', () => showWindow());
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => {
    // Nothing starts after quit begins; pending state reaches disk; commands we started end with us (LC-01, LC-02).
    monitor.stop();
    viewGrace.dispose();
    activity.flush();
    void killOwned(300);
  });

  void app.whenReady().then(() => {
    registerIpc();
    appMenu();
    tray = new AppTray(assets, {
      open: (key) => (key ? navigate({ page: 'service', key }) : showWindow()),
      pause: () => {
        settings.update({ notifications: { ...settings.get().notifications, pausedUntil: new Date(Date.now() + 3600_000).toISOString() } });
        pushStatus();
        setTimeout(pushStatus, 3600_000 + 1000).unref(); // the tray says Resume until the pause ends, then rebuilds once
      },
      resume: () => { settings.update({ notifications: { ...settings.get().notifications, pausedUntil: null } }); pushStatus(); },
      paused: () => { const p = settings.get().notifications.pausedUntil; return Boolean(p && new Date(p) > new Date()); },
      quit: () => { quitting = true; app.quit(); }, // the menu itself says quitting stops no service (LC-07)
    }, lang);
    monitor.on('change', pushStatus);
    monitor.on('notify', notify);
    monitor.on('restarted', (key: string) => views?.serviceRestarted(key));
    // An uninstalled service takes its view and its stored session with it (LC-12).
    monitor.on('removed', (key: string) => {
      views?.drop(key);
      const ses = session.fromPartition(partitionFor(key));
      void Promise.all([ses.clearStorageData(), ses.clearCache()]).catch((error) => log(`could not clear the session of ${key}: ${(error as Error).message}`));
    });
    // Partitions of services removed while the app was not running: no session holds them yet.
    monitor.once('change', () => {
      if (monitor.meta().dirError) return; // an unreadable directory says nothing about what is installed
      const dir = path.join(userData, 'Partitions');
      let names: string[] = [];
      try { names = fs.readdirSync(dir); } catch { return; }
      for (const name of stalePartitions(names, monitor.snapshots().map((s) => s.key))) {
        try { fs.rmSync(path.join(dir, name), { recursive: true, force: true }); log(`removed the stored session of a service that is gone: ${name}`); } catch (error) { log(`could not remove ${name}: ${(error as Error).message}`); }
      }
    });
    monitor.start();
    updater.start();
    if (app.isPackaged) app.setAsDefaultProtocolClient(SCHEME);
    handleLink = (raw: string) => {
      const known = monitor.snapshots().map((s) => ({ key: s.key, descriptor: s.descriptor }));
      const result = parseDeepLink(raw, known);
      if (!result.ok) {
        // The reason is logged, never the raw link — a link is not trusted text; the parts a
        // reason quotes are JSON-escaped and clipped (src/core/deeplink.ts).
        log(`deep link refused: ${result.reason}`);
        showWindow();
        // The reason names what is wrong (an unknown service, a path off its origin), never the link.
        void dialog.showMessageBox({ type: 'warning', message: t(lang(), 'link.refused.title'), detail: t(lang(), 'link.refused.body', { reason: result.reason }), buttons: ['OK'] });
        return;
      }
      const { target } = result;
      if (target.page === 'overview') showWindow();
      else navigate(target);
    };
    // The first scan fills the snapshots a link is checked against; a link that arrived with the
    // launch waits for it rather than being refused as «no installed service».
    const argvLink = process.argv.find((a) => a.startsWith(`${SCHEME}:`));
    if (argvLink) pendingLinks.push(argvLink);
    const flush = () => { for (const raw of pendingLinks.splice(0)) handleLink?.(raw); };
    if (monitor.snapshots().length || !pendingLinks.length) flush();
    else monitor.once('change', flush);
    // A launch registers nothing (LC-07): it only adopts a change the person made in System Settings.
    const adopted = loginItemAtStartup(settings.get(), loginOs);
    if (adopted) { settings.update(adopted); log(`login item changed in System Settings: launchAtLogin=${adopted.launchAtLogin}`); }
    // Opened at login: stay in the menu bar; the operator opens the window when they want it.
    const hidden = app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes('--hidden');
    if (!hidden) showWindow();
    log(`started ${app.getVersion()} watching ${monitor.meta().servicesDir}`);
  });

  process.on('uncaughtException', (error) => log(`uncaught: ${error.stack ?? error.message}`));
  process.on('unhandledRejection', (error) => log(`unhandled: ${String(error)}`));
}
