// #region systemd-status — docs: packages/service-host/README.md#launchd
// FD-55 (contract DEC-0057): a copy waiting on its service's lock is `duplicate` when the supervisor's
// pid is another than the one answering. Under launchd that pid is `launchctl print`'s; under
// `systemd --user` it is the unit's `MainPID`; the Task Scheduler has no supervisor pid, so a waiting
// copy there is invisible and never an outage. This reads systemd into the same JobStatus launchd gives
// the state derivation. Read-only: starting and stopping a systemd unit is the Observatory node's.
import { execRunner, type JobStatus, type Runner } from './launchd';

/** `systemctl --user show <unit> -p LoadState,ActiveState,MainPID,UnitFileState` → the job's status. */
export function parseSystemdShow(text: string): JobStatus {
  const v: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const at = line.indexOf('=');
    if (at > 0) v[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  const pid = Number(v.MainPID);
  const active = ['active', 'activating', 'reloading', 'deactivating'].includes(v.ActiveState ?? '');
  return {
    loaded: v.LoadState === 'loaded' && active,
    pid: Number.isInteger(pid) && pid > 0 ? pid : null,
    disabled: v.UnitFileState === 'disabled' || v.UnitFileState === 'masked',
  };
}

export class SystemdReader {
  constructor(private readonly run: Runner = execRunner) {}

  async status(unit: string): Promise<JobStatus> {
    const r = await this.run('systemctl', ['--user', 'show', unit, '-p', 'LoadState,ActiveState,MainPID,UnitFileState']);
    if (r.code !== 0) return { loaded: false, pid: null, disabled: false };
    return parseSystemdShow(r.stdout);
  }
}
// #endregion systemd-status
