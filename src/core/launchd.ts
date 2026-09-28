// launchd is the only supervisor (ADR-0002). This module never starts a
// service process itself: every verb is a launchctl call on gui/<uid>/<label>.
import { execFile } from 'node:child_process';

export interface RunResult { code: number; stdout: string; stderr: string }
export type Runner = (command: string, args: string[], timeoutMs?: number) => Promise<RunResult>;

export const execRunner: Runner = (command, args, timeoutMs = 30_000) =>
  new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      const code = error ? (typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number' ? Number((error as { code: number }).code) : 1) : 0;
      resolve({ code, stdout: String(stdout ?? ''), stderr: String(stderr ?? (error ? error.message : '')) });
    });
  });

export interface JobStatus { loaded: boolean; pid: number | null; disabled: boolean }

export function parsePrint(stdout: string): { pid: number | null } {
  const m = /^\s*pid = (\d+)\s*$/m.exec(stdout);
  return { pid: m ? Number(m[1]) : null };
}

export function parseDisabled(stdout: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`"${escaped}"\\s*=>\\s*(true|false|disabled|enabled)`).exec(stdout);
  return m ? m[1] === 'true' || m[1] === 'disabled' : false;
}

export class Launchd {
  constructor(private readonly run: Runner = execRunner, private readonly uid: number = process.getuid ? process.getuid() : 0) {}

  get domain(): string {
    return `gui/${this.uid}`;
  }

  target(label: string): string {
    return `${this.domain}/${label}`;
  }

  /** One `print-disabled` for the whole domain, read once per probe round. */
  async disabledTable(): Promise<string> {
    const r = await this.run('launchctl', ['print-disabled', this.domain]);
    return r.code === 0 ? r.stdout : '';
  }

  async status(label: string, disabledTable?: string): Promise<JobStatus> {
    const r = await this.run('launchctl', ['print', this.target(label)]);
    const disabled = parseDisabled(disabledTable ?? (await this.disabledTable()), label);
    if (r.code !== 0) return { loaded: false, pid: null, disabled };
    return { loaded: true, pid: parsePrint(r.stdout).pid, disabled };
  }

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
