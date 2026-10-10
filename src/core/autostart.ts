// #region xdg-autostart — docs: docs/adr/0019-windows-and-linux.md#decision
// FD-37 M3 / LC-07: launch at login on Linux is an XDG autostart entry (freedesktop.org Desktop
// Application Autostart Specification): `$XDG_CONFIG_HOME/autostart/fabric-dashboards.desktop`, starting
// the app hidden. Electron has no login item on Linux, so this is the LoginItemOs port main.ts passes —
// written only by the person's choice (loginitem.ts), like the macOS and Windows ones.
import fs from 'node:fs';
import path from 'node:path';
import type { LoginItemOs } from './loginitem';

export const AUTOSTART_FILE = 'fabric-dashboards.desktop';

/** Where the entry lives: `$XDG_CONFIG_HOME/autostart`, or `~/.config/autostart`. */
export function autostartPath(env: NodeJS.ProcessEnv, home: string): string {
  const config = env.XDG_CONFIG_HOME && path.posix.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.posix.join(home, '.config');
  return path.posix.join(config, 'autostart', AUTOSTART_FILE);
}

/** The program a login starts: the AppImage file itself when run from one (its mount point changes every run), else this executable. */
export function autostartProgram(env: NodeJS.ProcessEnv, execPath: string): string {
  return env.APPIMAGE && path.posix.isAbsolute(env.APPIMAGE) ? env.APPIMAGE : execPath;
}

/** One `Exec=` argument, quoted as the Desktop Entry Specification requires when it holds a reserved character. */
export function execArg(arg: string): string {
  if (!/[\s"'\\><~|&;$*?#()`=%]/.test(arg)) return arg;
  return `"${arg.replace(/["`$\\]/g, (c) => `\\${c}`)}"`.replace(/%/g, '%%');
}

export function autostartEntry(program: string): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Fabric Dashboards',
    'Comment=Every local agent service, watched and opened in one window',
    `Exec=${execArg(program)} --hidden`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n');
}

/** Whether `text` is an entry that would start this program now: ours, not switched off by the desktop. */
export function entryIsOn(text: string, program: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (lines.includes('Hidden=true') || lines.includes('X-GNOME-Autostart-enabled=false')) return false;
  return lines.includes(`Exec=${execArg(program)} --hidden`);
}

/** The LoginItemOs port for Linux. `status` says when an entry exists but starts another copy of the app. */
export function xdgLoginItem(env: NodeJS.ProcessEnv, home: string, execPath: string): LoginItemOs {
  const file = autostartPath(env, home);
  const program = autostartProgram(env, execPath);
  return {
    get() {
      let text: string;
      try { text = fs.readFileSync(file, 'utf8'); } catch { return { openAtLogin: false, status: 'not-registered' }; }
      return entryIsOn(text, program) ? { openAtLogin: true, status: 'enabled' } : { openAtLogin: false, status: 'not-registered' };
    },
    set(openAtLogin) {
      if (!openAtLogin) { fs.rmSync(file, { force: true }); return; }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temp, autostartEntry(program), { mode: 0o644 });
      fs.renameSync(temp, file);
    },
  };
}
// #endregion xdg-autostart
