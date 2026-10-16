// #region launchd-status — docs: packages/service-host/README.md#launchd
// Reading what launchd says of a service's job: `launchctl print` and `print-disabled` only.
// This package never starts, stops or changes a job; Fabric Dashboards' control verbs extend
// LaunchdReader in the app (ADR-0002: launchd is the only supervisor).
import { execFile } from 'node:child_process';
import type { LaunchdStatus } from './protocol';

export interface RunResult { code: number; stdout: string; stderr: string }
export type Runner = (command: string, args: string[], timeoutMs?: number) => Promise<RunResult>;

type RunError = Error & { killed?: boolean; signal?: NodeJS.Signals | null; code?: unknown };

/** Why a command failed, when it wrote nothing on stderr. */
export function failureReason(e: RunError, timeoutMs: number): string {
  if (e.killed && (e.signal === 'SIGTERM' || !e.signal)) return `no answer within ${timeoutMs / 1000} s (stopped)`;
  if (e.signal) return `ended by ${e.signal}`;
  if (typeof e.code === 'number') return `exit ${e.code} with nothing on stderr`;
  if (typeof e.code === 'string') return `${e.code}: ${e.message.split('\n')[0]}`; // ENOENT and the like
  return e.message.split('\n')[0] || 'failed';
}

/** execFile, no shell; a failure to run is a non-zero code with the reason on stderr, never a throw. */
export const execRunner: Runner = (command, args, timeoutMs = 30_000) =>
  new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      const code = error ? (typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number' ? Number((error as { code: number }).code) : 1) : 0;
      // FD-69/FD-70: a killed or timed-out command leaves stderr empty, and Node's message ("Command failed: …") does not
      // say why — the reason is said here: the deadline, the signal, or the exit code.
      resolve({ code, stdout: String(stdout ?? ''), stderr: String(stderr || (error ? failureReason(error as RunError, timeoutMs) : '')) });
    });
  });

export interface JobStatus { loaded: boolean; pid: number | null; disabled: boolean }

/** The status of a service whose descriptor names no launchd job. */
export const UNMANAGED: LaunchdStatus = Object.freeze({ managed: false, loaded: false, pid: null, disabled: false }) as LaunchdStatus;

export function parsePrint(stdout: string): { pid: number | null } {
  const m = /^\s*pid = (\d+)\s*$/m.exec(stdout);
  return { pid: m ? Number(m[1]) : null };
}

export function parseDisabled(stdout: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`"${escaped}"\\s*=>\\s*(true|false|disabled|enabled)`).exec(stdout);
  return m ? m[1] === 'true' || m[1] === 'disabled' : false;
}

export class LaunchdReader {
  constructor(protected readonly run: Runner = execRunner, protected readonly uid: number = process.getuid ? process.getuid() : 0) {}

  get domain(): string {
    return `gui/${this.uid}`;
  }

  target(label: string): string {
    return `${this.domain}/${label}`;
  }

  /** One `print-disabled` for the whole domain; read it once per look and pass it to status(). */
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
}
// #endregion launchd-status
