// Fabric Dashboards main process. Built like Fabric Inbox's shell: one main
// process, sandboxed renderers, context isolation, a single instance. It owns
// no service process — launchd does (ADR-0002) — so quitting stops nothing.
import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, shell, systemPreferences } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { ActivityStore } from '../core/activity';
import { CHANNELS, type Rect } from '../core/api';
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
if (process.env.FABRIC_DASHBOARDS_USER_DATA) app.setPath('userData', process.env.FABRIC_DASHBOARDS_USER_DATA);

const assets = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, '../../../build/assets');
const rendererIndex = path.join(__dirname, '../../renderer/index.html');

function log(message: string): void {
  try {
    const dir = path.join(app.getPath('logs'));
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'main.log'), `${new Date().toISOString()} ${message}\n`);
  } catch { /* logging must never take the app down */ }
}

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

  function navigate(target: { page: 'service' | 'activity'; key?: string; link?: string }): void {
    const w = showWindow();
    const send = () => w.webContents.send(CHANNELS.navigate, target);
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send);
    else send();
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

  app.on('second-instance', () => showWindow());
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
    applyLoginItem(settings.get());
    // Opened at login: stay in the menu bar; the operator opens the window when they want it.
    const hidden = app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes('--hidden');
    if (!hidden) showWindow();
    log(`started ${app.getVersion()} watching ${monitor.meta().servicesDir}`);
  });

  process.on('uncaughtException', (error) => log(`uncaught: ${error.stack ?? error.message}`));
  process.on('unhandledRejection', (error) => log(`unhandled: ${String(error)}`));
}
