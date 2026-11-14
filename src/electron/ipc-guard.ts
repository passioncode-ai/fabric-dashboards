// #region ipc-guard — docs: SECURITY.md#what-the-app-touches
import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { trustedSender } from '../core/ipc-guard';

let installed = false;

/** FD-259 (security audit F7): wraps `ipcMain.handle` and `ipcMain.on` once, so every handler registered after it
 *  answers only the app's own page in its main frame; any other caller is refused (invoke) or ignored (send), logged
 *  once per address without its query. */
export function guardIpc(indexUrl: string, log: (message: string) => void): void {
  if (installed) return;
  installed = true;
  const logged = new Set<string>();
  const ok = (e: IpcMainEvent | IpcMainInvokeEvent, channel: string): boolean => {
    const frame = e.senderFrame;
    if (trustedSender(frame?.url, !!frame && frame === e.sender.mainFrame, indexUrl)) return true;
    let where = 'a frame already gone';
    try { if (frame?.url) { const u = new URL(frame.url); where = `${u.protocol}//${u.host}${u.pathname}`; } } catch { where = 'an address that does not parse'; }
    if (!logged.has(where)) { logged.add(where); log(`ipc: refused ${channel} from ${where}: not the app's own page (FD-259)`); }
    return false;
  };
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) => handle(channel, (e, ...args) => (ok(e, channel) ? listener(e, ...args) : Promise.reject(new Error('not the app\'s own page'))));
  const on = ipcMain.on.bind(ipcMain);
  ipcMain.on = (channel, listener) => on(channel, (e, ...args) => { if (ok(e, channel)) listener(e, ...args); });
}
// #endregion ipc-guard
