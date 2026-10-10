// The only surface the renderer gets: typed calls, no Node, no files, no tokens.
import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type FabricApi } from '../core/api';

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const wrapped = (_event: unknown, value: T) => listener(value);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const api: FabricApi = {
  status: () => ipcRenderer.invoke(CHANNELS.status),
  onStatus: (l) => subscribe(CHANNELS.statusPush, l),
  control: (key, action) => ipcRenderer.invoke(CHANNELS.control, key, action),
  command: (key, which) => ipcRenderer.invoke(CHANNELS.command, key, which),
  logs: (key) => ipcRenderer.invoke(CHANNELS.logs, key),
  spend: (force) => ipcRenderer.invoke(CHANNELS.spend, force === true),
  activity: (filter) => ipcRenderer.invoke(CHANNELS.activity, filter),
  markActivitySeen: () => ipcRenderer.invoke(CHANNELS.activitySeen),
  settings: () => ipcRenderer.invoke(CHANNELS.settings),
  updateSettings: (patch) => ipcRenderer.invoke(CHANNELS.settingsUpdate, patch),
  listeners: () => ipcRenderer.invoke(CHANNELS.listeners),
  showPath: (p) => ipcRenderer.invoke(CHANNELS.showPath, p),
  showView: (key, rect, link, owner, fresh) => ipcRenderer.invoke(CHANNELS.viewShow, key, rect, link, owner, fresh === true),
  hideView: (owner) => ipcRenderer.invoke(CHANNELS.viewHide, owner),
  viewBounds: (rect) => ipcRenderer.send(CHANNELS.viewBounds, rect),
  viewPage: (key) => ipcRenderer.invoke(CHANNELS.viewPage, key),
  viewNavigate: (key, action) => ipcRenderer.invoke(CHANNELS.viewNavigate, key, action),
  copyText: (text) => ipcRenderer.invoke(CHANNELS.copyText, text),
  onViewEvent: (l) => subscribe(CHANNELS.viewEvent, l),
  onNavigate: (l) => subscribe(CHANNELS.navigate, l),
  takeNavigation: () => ipcRenderer.invoke(CHANNELS.navigateTake),
  rescan: () => ipcRenderer.invoke(CHANNELS.rescan),
  openServiceGuide: () => ipcRenderer.invoke(CHANNELS.serviceGuide),
  restartToUpdate: () => ipcRenderer.invoke(CHANNELS.updateRestart),
  checkForUpdates: () => ipcRenderer.invoke(CHANNELS.updateCheck),
  openUpdateSteps: () => ipcRenderer.invoke(CHANNELS.updateSteps),
  moveToApplications: () => ipcRenderer.invoke(CHANNELS.moveToApplications),
  openNotificationSettings: () => ipcRenderer.invoke(CHANNELS.notificationSettings),
  locale: () => ipcRenderer.invoke(CHANNELS.locale),
  uninstall: () => ipcRenderer.invoke(CHANNELS.uninstall),
  consoleInfo: (key) => ipcRenderer.invoke(CHANNELS.consoleInfo, key),
  consoleChoose: (key, choice) => ipcRenderer.invoke(CHANNELS.consoleChoose, key, choice),
  consolePickFolder: (key) => ipcRenderer.invoke(CHANNELS.consolePickFolder, key),
  setupState: () => ipcRenderer.invoke(CHANNELS.setupState),
  consoleStart: (key, mode, size, task) => ipcRenderer.invoke(CHANNELS.consoleStart, key, mode, size, task),
  consoleInput: (key, data) => ipcRenderer.send(CHANNELS.consoleInput, key, data),
  consoleResize: (key, cols, rows) => ipcRenderer.send(CHANNELS.consoleResize, key, cols, rows),
  consoleStop: (key) => ipcRenderer.invoke(CHANNELS.consoleStop, key),
  consoleOpenTerminal: (key, mode) => ipcRenderer.invoke(CHANNELS.consoleOpenTerminal, key, mode),
  onConsoleEvent: (l) => subscribe(CHANNELS.consoleEvent, l),
  onLayoutCommand: (l) => subscribe(CHANNELS.layoutCommand, l),
};

contextBridge.exposeInMainWorld('fabric', api);
