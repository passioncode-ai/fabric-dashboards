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
  activity: (filter) => ipcRenderer.invoke(CHANNELS.activity, filter),
  markActivitySeen: () => ipcRenderer.invoke(CHANNELS.activitySeen),
  settings: () => ipcRenderer.invoke(CHANNELS.settings),
  updateSettings: (patch) => ipcRenderer.invoke(CHANNELS.settingsUpdate, patch),
  listeners: () => ipcRenderer.invoke(CHANNELS.listeners),
  showPath: (p) => ipcRenderer.invoke(CHANNELS.showPath, p),
  showView: (key, rect, link) => ipcRenderer.invoke(CHANNELS.viewShow, key, rect, link),
  hideView: () => ipcRenderer.invoke(CHANNELS.viewHide),
  viewBounds: (rect) => ipcRenderer.send(CHANNELS.viewBounds, rect),
  reloadView: (key) => ipcRenderer.invoke(CHANNELS.viewReload, key),
  onViewEvent: (l) => subscribe(CHANNELS.viewEvent, l),
  onNavigate: (l) => subscribe(CHANNELS.navigate, l),
  restartToUpdate: () => ipcRenderer.invoke(CHANNELS.updateRestart),
  checkForUpdates: () => ipcRenderer.invoke(CHANNELS.updateCheck),
  notificationsAllowed: () => ipcRenderer.invoke(CHANNELS.notificationsAllowed),
  openNotificationSettings: () => ipcRenderer.invoke(CHANNELS.notificationSettings),
  locale: () => ipcRenderer.invoke(CHANNELS.locale),
};

contextBridge.exposeInMainWorld('fabric', api);
