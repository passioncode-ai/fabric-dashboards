// #region run-facts — docs: docs/ux/scenarios.md#scn-025-run-doctor-and-read-logs
// FD-250: how the supervisor last saw an agent run, for the Logs tab: how often launchd (or `systemd --user`) started
// it and how its last run ended, and the process it runs as now. Read from the snapshot the monitor already holds; no
// new probe. A job no supervisor manages, or one never run, says nothing.
import type { LaunchdStatus, Reason } from '@passioncode-ai/fabric-service-host/protocol';

export function runFacts(l: LaunchdStatus | null | undefined): Reason[] {
  if (!l?.managed) return [];
  const by = l.by === 'systemd' ? 'systemd' : 'launchd';
  const out: Reason[] = [];
  if (l.pid) out.push({ code: 'logs.pid', params: { pid: l.pid } });
  if (l.lastExit) {
    const runs = l.runs ?? 1;
    out.push('signal' in l.lastExit
      ? { code: 'logs.ran.signal', params: { by, runs, signal: l.lastExit.signal } }
      : { code: 'logs.ran.code', params: { by, runs, code: l.lastExit.code } });
  }
  return out;
}
// #endregion run-facts
