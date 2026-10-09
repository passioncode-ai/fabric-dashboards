// #region platform-policy — docs: docs/adr/0019-windows-and-linux.md#decision
// FD-37: what differs between macOS, Windows and Linux, decided in one pure module so every branch is
// tested on any operating system (test/platform.test.ts). The main process asks; it does not branch on
// `process.platform` itself where a decision lives here.
import path from 'node:path';

/** The product name, which NSIS uses for the install folder and its uninstaller. */
const PRODUCT = 'Fabric Dashboards';

export type UninstallTarget =
  /** macOS: the .app bundle goes to the Trash. */
  | { kind: 'trash-bundle'; path: string }
  /** Windows: this install's own NSIS uninstaller, silent — the person confirmed in the app. */
  | { kind: 'run-uninstaller'; path: string; args: string[] }
  /** Linux AppImage: the image file goes to the Trash. */
  | { kind: 'trash-file'; path: string }
  /** Linux .deb: the package manager removes it; the app says the command. */
  | { kind: 'package'; command: string }
  /** Nothing this app may remove by itself; `reason` is an i18n key saying what the person does instead. */
  | { kind: 'none'; reason: UninstallReason };

export type UninstallReason = 'uninstall.reason.noBundle' | 'uninstall.reason.noUninstaller' | 'uninstall.reason.notAppImage' | 'uninstall.reason.notInstalled';

/**
 * What uninstalling removes. Never a guess: the macOS bundle must end in `.app`, the Windows
 * uninstaller must sit beside the running executable, and an AppImage must be named by `APPIMAGE`
 * and be an `.AppImage` file. Anything else is `none` — the old `execPath/../../..` would have been
 * `%LOCALAPPDATA%` on Windows and `/` on Linux.
 */
export function uninstallTarget(platform: NodeJS.Platform, execPath: string, env: NodeJS.ProcessEnv, exists: (p: string) => boolean): UninstallTarget {
  if (platform === 'darwin') {
    const bundle = path.posix.resolve(execPath, '../../..');
    return bundle.endsWith('.app') ? { kind: 'trash-bundle', path: bundle } : { kind: 'none', reason: 'uninstall.reason.noBundle' };
  }
  if (platform === 'win32') {
    const uninstaller = path.win32.join(path.win32.dirname(execPath), `Uninstall ${PRODUCT}.exe`);
    return exists(uninstaller)
      ? { kind: 'run-uninstaller', path: uninstaller, args: ['/S'] }
      : { kind: 'none', reason: 'uninstall.reason.noUninstaller' };
  }
  const image = env.APPIMAGE;
  if (image) {
    return image.endsWith('.AppImage') && exists(image) ? { kind: 'trash-file', path: image } : { kind: 'none', reason: 'uninstall.reason.notAppImage' };
  }
  if (execPath.startsWith('/opt/') || execPath.startsWith('/usr/')) return { kind: 'package', command: 'sudo apt remove fabric-dashboards' };
  return { kind: 'none', reason: 'uninstall.reason.notInstalled' };
}

/**
 * How the Windows uninstaller is started: a hidden PowerShell that waits (at most 30 s) for this app's
 * process to exit — NSIS cannot replace or remove files the running app still holds — then starts the
 * uninstaller by its path. The path goes in a single-quoted literal with quotes doubled, so no path can
 * end the literal; nothing passes through cmd.exe.
 */
export function uninstallCommand(target: { path: string; args: string[] }, pid: number): { file: string; args: string[] } {
  const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const script = `Wait-Process -Id ${Math.trunc(pid)} -Timeout 30 -ErrorAction SilentlyContinue; Start-Process -FilePath ${lit(target.path)} -ArgumentList ${target.args.map(lit).join(',')}`;
  return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script] };
}

/** A folder path a setting may keep: absolute in the grammar of `platform`, never a network share. */
export function isAbsoluteFolder(p: string, platform: NodeJS.Platform): boolean {
  if (platform === 'win32') return /^[A-Za-z]:[\\/]/.test(p);
  return p.startsWith('/');
}

/** Window options that exist only on macOS: the inset title bar (elsewhere the system frame keeps its controls). */
export function windowChrome(platform: NodeJS.Platform): { titleBarStyle?: 'hiddenInset' } {
  return platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {};
}

export type TrayLevelName = 'ok' | 'degraded' | 'problem';

/** macOS draws a monochrome template in the menu bar; a Windows or Linux panel shows the colour mark,
 *  since a black template is invisible on a dark taskbar — and the tray is the way back to a hidden window. */
export function trayIcon(platform: NodeJS.Platform, level: TrayLevelName): { file: string; template: boolean } {
  if (platform === 'darwin') {
    const name = { ok: 'tray', degraded: 'trayDegraded', problem: 'trayProblem' }[level];
    return { file: `${name}Template.png`, template: true };
  }
  return { file: `tray-${level}.png`, template: false };
}

/** Keyboard shortcuts and menu shape: the Command key and the app menu exist only on macOS. */
export function menuKeys(platform: NodeJS.Platform): { appMenu: boolean; quit: string; sidebar: string; console: string; details: string } {
  return platform === 'darwin'
    ? { appMenu: true, quit: 'Command+Q', sidebar: 'Ctrl+Cmd+S', console: 'Ctrl+Cmd+T', details: 'Ctrl+Cmd+D' }
    : { appMenu: false, quit: 'Ctrl+Q', sidebar: 'Ctrl+Shift+S', console: 'Ctrl+Shift+T', details: 'Ctrl+Shift+D' };
}

/** A login launch starts hidden: macOS reports it (`wasOpenedAtLogin`); Windows and Linux register the
 *  login item with `--hidden`, as an automatic update's relaunch does. */
export function startHidden(platform: NodeJS.Platform, o: { argv: string[]; wasOpenedAtLogin: boolean | undefined; afterUpdate: boolean }): boolean {
  return o.afterUpdate || o.argv.includes('--hidden') || (platform === 'darwin' && o.wasOpenedAtLogin === true);
}
/** Where the system's notification settings open: macOS System Settings, Windows Settings; Linux has no
 *  standard address, so the app opens nothing and says where to look (`notificationSettingsUrl` is null). */
export function notificationSettingsUrl(platform: NodeJS.Platform): string | null {
  if (platform === 'darwin') return 'x-apple.systempreferences:com.apple.Notifications-Settings.extension';
  if (platform === 'win32') return 'ms-settings:notifications';
  return null;
}
/** Whether this system has the supervisor a descriptor names (ADR-0019 §7): launchd is macOS's; the
 *  Windows and Linux supervisors wait for the contract decision, so they are shown read-only until then. */
export function supervises(platform: NodeJS.Platform, manager: string | undefined): boolean {
  return manager === 'launchd' && platform === 'darwin';
}
/** Where the app keeps its data and logs (PL-06): Windows `%LOCALAPPDATA%\\Fabric Dashboards` (never the
 *  roaming profile) with `Logs` inside; Linux the XDG data and state folders. null on macOS: Electron's
 *  own places (`~/Library/Application Support`, `~/Library/Logs`) are already the platform's. */
export function places(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string): { userData: string; logs: string } | null {
  if (platform === 'win32') {
    const userData = path.win32.join(env.LOCALAPPDATA || path.win32.join(home, 'AppData', 'Local'), PRODUCT);
    return { userData, logs: path.win32.join(userData, 'Logs') };
  }
  if (platform === 'linux') {
    return {
      userData: path.posix.join(env.XDG_DATA_HOME || path.posix.join(home, '.local/share'), 'fabric-dashboards'),
      logs: path.posix.join(env.XDG_STATE_HOME || path.posix.join(home, '.local/state'), 'fabric-dashboards'),
    };
  }
  return null;
}
// #endregion platform-policy
