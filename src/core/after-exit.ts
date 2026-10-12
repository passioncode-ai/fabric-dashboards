// #region after-exit — docs: docs/adr/0019-windows-and-linux.md#amendment-2026-10-12--helpers-that-outlive-the-app
// A helper that must run AFTER this app has exited (the update waiter, the uninstaller's waiter, the data purge).
// It is always started detached. On Windows libuv puts every non-detached child into one job object created with
// JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, so the child is killed the moment this process exits — exactly when such a
// helper is meant to start working (the 0.7.4 → 0.7.5 update proof on both Windows runners, 2026-10-12: the waiter
// started, then died with the app, and no installer ran). Detached, a PowerShell has no console at all, so no
// window can flash; on POSIX a detached child leads its own session and is not stopped with the app's group.
import { spawn, type ChildProcess } from 'node:child_process';

export function spawnAfterExit(file: string, args: string[], env?: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: true, ...(env ? { env } : {}) });
  child.unref();
  return child;
}
// #endregion after-exit
