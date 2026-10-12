// #region after-exit — docs: docs/adr/0019-windows-and-linux.md#amendment-2026-10-12--helpers-that-outlive-the-app
// A helper that must run AFTER this app has exited: the update waiter, the uninstaller's waiter, the data purge,
// the AppImage relaunch. Measured on 2026-10-12 (the 0.7.4 → 0.7.5 update proof and runs 38186475486, 38190266069):
// - Windows, not detached: libuv puts the child into its job object (KILL_ON_JOB_CLOSE), so it dies with the app —
//   the update waiter started and no installer ever ran.
// - Windows, detached: a DETACHED_PROCESS PowerShell has no console and exits at once without running its script.
// - The job also has SILENT_BREAKAWAY_OK: a process the child starts is NOT in the job. So on Windows the helper is a
//   grandchild: a hidden cmd.exe starts PowerShell with `start "" /b` (sharing cmd's hidden console) and exits; the
//   PowerShell runs outside the job and outlives the app. The app quits only once cmd.exe exited 0 — the helper is
//   then running.
// - POSIX: a detached child leads its own session and is not stopped with the app.
import { spawn, type ChildProcess } from 'node:child_process';

/** POSIX: start `file args` detached, so it survives this process. */
export function spawnAfterExit(file: string, args: string[], env?: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(file, args, { detached: true, stdio: 'ignore', ...(env ? { env } : {}) });
  child.unref();
  return child;
}

/** cmd.exe's command-line limit; the encoded script must fit inside it. */
const CMD_MAX = 8191;

/** The launcher's command line: the script travels as `-EncodedCommand` (UTF-16LE, base64), so no quoting can break it. */
export function powerShellLauncherLine(script: string): string {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const line = `"start "" /b powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${encoded}"`;
  if (line.length > CMD_MAX - 16) throw new Error(`the helper script is too long for cmd.exe (${line.length} characters)`);
  return line;
}

/**
 * Windows: run a PowerShell script that outlives this app. Resolves once it runs outside this app's job (the
 * launcher exited 0); rejects with the reason otherwise. Quit only after it resolved.
 */
export function powerShellAfterExit(script: string, env?: NodeJS.ProcessEnv): Promise<void> {
  const launcher = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', powerShellLauncherLine(script)], { stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true, ...(env ? { env } : {}) });
  return new Promise((resolve, reject) => {
    launcher.once('error', reject);
    launcher.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`the helper's launcher exited ${code}`))));
  });
}
// #endregion after-exit
