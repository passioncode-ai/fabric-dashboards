// #region systemd-status — docs: packages/service-host/README.md#launchd
// FD-55 (contract DEC-0057): a copy waiting on its service's lock is `duplicate` when the supervisor's
// pid is another than the one answering. Under launchd that pid is `launchctl print`'s; under
// `systemd --user` it is the unit's `MainPID`; the Task Scheduler has no supervisor pid, so a waiting
// copy there is invisible and never an outage. This reads systemd into the same JobStatus launchd gives
// the state derivation. Read-only: starting and stopping a systemd unit is the Observatory node's.
import { execRunner, type JobStatus, type Runner } from './launchd';

/** FD-250: the signal names systemd's `ExecMainStatus` numbers (Linux), as launchd names a terminating signal. */
const SIGNALS: Record<number, string> = { 1: 'SIGHUP', 2: 'SIGINT', 3: 'SIGQUIT', 4: 'SIGILL', 5: 'SIGTRAP', 6: 'SIGABRT', 7: 'SIGBUS', 8: 'SIGFPE', 9: 'SIGKILL', 10: 'SIGUSR1', 11: 'SIGSEGV', 12: 'SIGUSR2', 13: 'SIGPIPE', 14: 'SIGALRM', 15: 'SIGTERM' };

/** FD-250: how the unit's main process last ended. `ExecMainCode` is the child's `si_code`: 1 exited (the status is its
 *  exit code), 2 killed and 3 dumped core (the status is the signal); 0, or nothing, is a unit that never ran. */
function lastExitOf(code: string | undefined, status: string | undefined): JobStatus['lastExit'] {
  const n = Number(status);
  if (status === undefined || status === '' || !Number.isInteger(n)) return undefined;
  if (code === '1') return { code: n };
  if (code === '2' || code === '3') return { signal: SIGNALS[n] ?? `signal ${n}` };
  return undefined;
}

/** `systemctl --user show <unit> -p LoadState,ActiveState,MainPID,UnitFileState,ExecMainCode,ExecMainStatus,NRestarts`
 *  → the job's status; FD-250: `runs` counts the start and systemd's own restarts of it (`NRestarts` + 1). */
export function parseSystemdShow(text: string): JobStatus {
  const v: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const at = line.indexOf('=');
    if (at > 0) v[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  const pid = Number(v.MainPID);
  const active = ['active', 'activating', 'reloading', 'deactivating'].includes(v.ActiveState ?? '');
  const restarts = Number(v.NRestarts);
  const lastExit = lastExitOf(v.ExecMainCode, v.ExecMainStatus);
  return {
    loaded: v.LoadState === 'loaded' && active,
    pid: Number.isInteger(pid) && pid > 0 ? pid : null,
    disabled: v.UnitFileState === 'disabled' || v.UnitFileState === 'masked',
    ...(lastExit ? { lastExit, runs: (v.NRestarts !== undefined && Number.isInteger(restarts) && restarts >= 0 ? restarts : 0) + 1 } : {}),
  };
}

export class SystemdReader {
  constructor(private readonly run: Runner = execRunner) {}

  async status(unit: string): Promise<JobStatus> {
    const r = await this.run('systemctl', ['--user', 'show', unit, '-p', 'LoadState,ActiveState,MainPID,UnitFileState,ExecMainCode,ExecMainStatus,NRestarts']);
    if (r.code !== 0) return { loaded: false, pid: null, disabled: false };
    return parseSystemdShow(r.stdout);
  }
}
// #endregion systemd-status
