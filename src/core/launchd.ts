// launchd is the only supervisor (ADR-0002). This module never starts a
// service process itself: every verb is a launchctl call on gui/<uid>/<label>.
// Reading a job's status is shared with Fabric (LaunchdReader in
// @passioncode-ai/fabric-service-host); the verbs that change a job live only here.
import { LaunchdReader, type RunResult } from '@passioncode-ai/fabric-service-host';

export { execRunner, LaunchdReader, parseDisabled, parsePrint } from '@passioncode-ai/fabric-service-host';
export type { JobStatus, Runner, RunResult } from '@passioncode-ai/fabric-service-host';

export class Launchd extends LaunchdReader {
  private async bootstrap(plist: string): Promise<RunResult> {
    let last: RunResult = { code: 1, stdout: '', stderr: '' };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      last = await this.run('launchctl', ['bootstrap', this.domain, plist]);
      // 0 = loaded; "service already loaded" (EEXIST / 17 / 37) is also the goal state.
      if (last.code === 0 || /already (loaded|bootstrapped)|File exists|Operation already in progress/i.test(last.stderr)) return { ...last, code: 0 };
      await new Promise((r) => setTimeout(r, 1000)); // EIO 5 right after a bootout
    }
    return last;
  }

  private async waitUnloaded(label: string, timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const r = await this.run('launchctl', ['print', this.target(label)]);
      if (r.code !== 0) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  /** Start = enable (persistent) + bootstrap. */
  async start(label: string, plist: string): Promise<RunResult> {
    const enabled = await this.run('launchctl', ['enable', this.target(label)]);
    if (enabled.code !== 0) return enabled;
    return this.bootstrap(plist);
  }

  /** Stop = bootout + disable, so it stays off across logins. */
  async stop(label: string): Promise<RunResult> {
    const out = await this.run('launchctl', ['bootout', this.target(label)]);
    if (out.code !== 0 && !/No such process|Could not find service|not find/i.test(out.stderr)) return out;
    await this.waitUnloaded(label);
    return this.run('launchctl', ['disable', this.target(label)]);
  }

  /** Restart = kickstart -k; a job that is not loaded is enabled and bootstrapped instead. */
  async restart(label: string, plist: string): Promise<RunResult> {
    const probe = await this.run('launchctl', ['print', this.target(label)]);
    if (probe.code !== 0) return this.start(label, plist);
    return this.run('launchctl', ['kickstart', '-k', this.target(label)]);
  }
}
