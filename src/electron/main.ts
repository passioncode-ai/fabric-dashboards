// Fabric Dashboards main process. Built like Fabric Inbox's shell: one main
// process, sandboxed renderers, context isolation, a single instance. It owns
// no service process — launchd does (ADR-0002) — so quitting stops nothing.
import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, shell, systemPreferences } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { ActivityStore } from '../core/activity';
import { CHANNELS, type Rect } from '../core/api';
import { parseDeepLink, SCHEME } from '../core/deeplink';
import { servicesDir } from '../core/descriptor';
import { langFor, t, type Lang } from '../core/i18n';
import { execRunner } from '../core/launchd';
import { listListeners, unattributed } from '../core/listeners';
import { Monitor, type Notice } from '../core/monitor';
import { SettingsStore } from '../core/settings';
import type { AppStatus, Settings } from '../core/types';
import { AppTray } from './tray';
import { Updater } from './updater';
import { ServiceViews } from './views';

app.enableSandbox();
app.setName('Fabric Dashboards');
if (process.env.FABRIC_DASHBOARDS_USER_DATA) {
  // A test or second profile keeps its logs beside its data; Electron derives `logs` from the
  // app name, not from userData, so without this a test run writes into the operator's log.
  app.setPath('userData', process.env.FABRIC_DASHBOARDS_USER_DATA);
  app.setPath('logs', path.join(process.env.FABRIC_DASHBOARDS_USER_DATA, 'logs'));
}

const assets = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, '../../../build/assets');
const rendererIndex = path.join(__dirname, '../../renderer/index.html');

function log(message: string): void {
  try {
    const dir = path.join(app.getPath('logs'));
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'main.log'), `${new Date().toISOString()} ${message}\n`);
  } catch { /* logging must never take the app down */ }
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
  const settings = new SettingsStore(userData);
  const activity = new ActivityStore(userData);
  const lang = (): Lang => langFor(app.getPreferredSystemLanguages()[0] ?? app.getLocale());
  const monitor = new Monitor({ servicesDir: servicesDir(), activity, settings: () => settings.get(), lang });
  let tray: AppTray | null = null;
  const updater = new Updater(() => pushStatus(), log);

  const status = (): AppStatus => ({
    services: monitor.snapshots(), ...monitor.meta(), unread: activity.unread(), update: updater.state, version: app.getVersion(),
  });

  let pushTimer: NodeJS.Timeout | null = null;
  function pushStatus(): void {
    if (pushTimer) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      const s = status();
      window?.webContents.send(CHANNELS.statusPush, s);
      tray?.update(s.services);
      app.dock?.setBadge(s.services.filter((x) => ['down', 'duplicate', 'foreign', 'conflict', 'invalid'].includes(x.state)).length ? '!' : '');
    }, 30);
  }

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
    w.on('show', () => monitor.setVisible(true));
    w.on('hide', () => monitor.setVisible(false));
    w.on('minimize', () => monitor.setVisible(false));
    w.on('restore', () => monitor.setVisible(true));
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
    const n = new Notification({ title: notice.title, body: notice.body, silent: false });
    n.on('click', () => navigate({ page: notice.target, key: notice.serviceKey, link: notice.link }));
    n.show();
  }

  function applyLoginItem(value: Settings): string | undefined {
    if (!app.isPackaged) return undefined; // a dev run must not register the Electron binary at login
    try {
      app.setLoginItemSettings({ openAtLogin: value.launchAtLogin });
      const now = app.getLoginItemSettings();
      if (value.launchAtLogin && now.status === 'requires-approval') return 'approve Fabric Dashboards in System Settings → General → Login Items';
      if (value.launchAtLogin && !now.openAtLogin && now.status !== 'enabled') return now.status;
    } catch (error) {
      return (error as Error).message;
    }
    return undefined;
  }

  function quitNote(): void {
    const flag = path.join(userData, 'quit-note-shown');
    if (fs.existsSync(flag)) return;
    fs.writeFileSync(flag, new Date().toISOString());
    dialog.showMessageBoxSync({ type: 'info', message: t(lang(), 'quit.note'), buttons: ['OK'] });
  }

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
    ipcMain.handle(CHANNELS.activity, (_e, filter) => activity.list(filter ?? {}));
    ipcMain.handle(CHANNELS.activitySeen, () => { activity.markSeen(); pushStatus(); });
    ipcMain.handle(CHANNELS.settings, () => settings.get());
    ipcMain.handle(CHANNELS.settingsUpdate, (_e, patch: Partial<Settings>) => {
      const next = settings.update(patch);
      const error = 'launchAtLogin' in patch ? applyLoginItem(next) : undefined;
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
      const known = monitor.snapshots().flatMap((s) => [s.descriptorPath, s.descriptor?.paths.data, s.descriptor?.auth.tokenFile].filter(Boolean) as string[]);
      const allowed = [monitor.meta().servicesDir, ...known].map((x) => x.replace(/^~\//, `${app.getPath('home')}/`));
      const target = p.replace(/^~\//, `${app.getPath('home')}/`);
      if (!allowed.includes(target)) throw new Error('not a path this app shows');
      if (target === monitor.meta().servicesDir) fs.mkdirSync(target, { recursive: true, mode: 0o700 });
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) void shell.openPath(target);
      else shell.showItemInFolder(target);
    });
    ipcMain.handle(CHANNELS.viewShow, async (_e, key: string, rect: Rect, link?: string) => {
      const s = snap(key);
      if (!s || !views) return { ok: false, error: 'unknown service' };
      return views.show(s, rect, link);
    });
    ipcMain.handle(CHANNELS.viewHide, () => views?.hide());
    ipcMain.handle(CHANNELS.viewReload, async (_e, key: string) => { const s = snap(key); if (s) await views?.reload(s); });
    ipcMain.handle(CHANNELS.updateRestart, () => { quitting = true; updater.restart(); });
    ipcMain.handle(CHANNELS.updateCheck, () => updater.check());
    ipcMain.handle(CHANNELS.notificationsAllowed, () => Notification.isSupported());
    ipcMain.handle(CHANNELS.notificationSettings, () => shell.openExternal('x-apple.systempreferences:com.apple.Notifications-Settings.extension'));
    ipcMain.handle(CHANNELS.locale, () => lang());
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
  app.on('will-quit', () => monitor.stop());

  void app.whenReady().then(() => {
    registerIpc();
    appMenu();
    tray = new AppTray(assets, {
      open: (key) => (key ? navigate({ page: 'service', key }) : showWindow()),
      pause: () => { settings.update({ notifications: { ...settings.get().notifications, pausedUntil: new Date(Date.now() + 3600_000).toISOString() } }); pushStatus(); },
      resume: () => { settings.update({ notifications: { ...settings.get().notifications, pausedUntil: null } }); pushStatus(); },
      paused: () => { const p = settings.get().notifications.pausedUntil; return Boolean(p && new Date(p) > new Date()); },
      quit: () => { quitNote(); quitting = true; app.quit(); },
    }, lang);
    monitor.on('change', pushStatus);
    monitor.on('notify', notify);
    monitor.on('restarted', (key: string) => views?.serviceRestarted(key));
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
    applyLoginItem(settings.get());
    // Opened at login: stay in the menu bar; the operator opens the window when they want it.
    const hidden = app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes('--hidden');
    if (!hidden) showWindow();
    log(`started ${app.getVersion()} watching ${monitor.meta().servicesDir}`);
  });

  process.on('uncaughtException', (error) => log(`uncaught: ${error.stack ?? error.message}`));
  process.on('unhandledRejection', (error) => log(`unhandled: ${String(error)}`));
}
