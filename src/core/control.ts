// #region control — docs: docs/reports/2026-10-05-release-audit/README.md#mcp-architecture-release
// FD-20 (audit M-3): the one start / stop / restart sequence. The app (`Monitor.control`) and the
// MCP server (`tools.control`) each ran their own copy, and the two diverged once (the MCP copy
// lacked the missing-plist refusal). Both now call this and only translate its outcome — the app
// into a Reason and its tracked state, the MCP tool into a result or a ToolError.
import fs from 'node:fs';
import { expand, portOf, type Descriptor, type Elsewhere, type WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { supervises } from './platform';
import type { RunResult } from './launchd';

export const CONTROL_TIMEOUT_MS = 40_000;
export type ControlAction = 'start' | 'stop' | 'restart';

export interface ControlDeps {
  platform: NodeJS.Platform;
  launchd: {
    start(label: string, plist: string): Promise<RunResult>;
    stop(label: string): Promise<RunResult>;
    restart(label: string, plist: string): Promise<RunResult>;
  };
  /** One look at the service's well-known document. */
  wellKnown(origin: string): Promise<WellKnownResult>;
  /** Whether the plist exists (default `fs.existsSync`). */
  exists?: (file: string) => boolean;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** How often the answer is looked for after launchctl returns. */
  pollMs?: number;
  /** Called once the refusals have passed, before launchctl runs — the app marks the service busy
   *  here, so a second click during a slow bootstrap is refused (audit R-8). */
  onLaunch?: () => void;
  /** FD-132: where the placement record puts the service; start and restart are refused when it is elsewhere. */
  elsewhere?: Elsewhere | null;
}

export type ControlOutcome =
  | { kind: 'refused'; why: 'remote' | 'unsupervised-here' | 'unmanaged' }
  | { kind: 'refused'; why: 'plist-missing'; plist: string }
  /** FD-132: the placement record puts it on another machine; starting it here would make a second copy. */
  | { kind: 'refused'; why: 'placed-elsewhere'; machine: string }
  | { kind: 'launchctl-failed'; detail: string }
  | { kind: 'stopped'; probe: WellKnownResult }
  | { kind: 'answered'; probe: Extract<WellKnownResult, { kind: 'answer' }>; pid: number }
  /** U-15: a restart of a duplicate where the stray copy kept the port: named by its pid. */
  | { kind: 'stray-holds'; pid: number; port: number }
  | { kind: 'still-answering' }
  | { kind: 'timeout' };

/**
 * Run one action on a launchd-supervised service and wait for the result: for stop, no answer;
 * for start, an answer as this service; for restart, an answer as this service from a new pid.
 * `oldPid` is the pid the caller last saw; `duplicate` says the caller saw a stray copy on the port.
 */
export async function controlService(
  d: Descriptor, action: ControlAction, deps: ControlDeps, seen: { oldPid: number | null; duplicate?: boolean } = { oldPid: null },
): Promise<ControlOutcome> {
  if (d.placement === 'remote') return { kind: 'refused', why: 'remote' };
  // ADR-0019 §7: launchd is macOS's; elsewhere the service is shown, never controlled.
  if (d.lifecycle.manager === 'launchd' && !supervises(deps.platform, d.lifecycle.manager)) return { kind: 'refused', why: 'unsupervised-here' };
  if (d.lifecycle.manager !== 'launchd' || !d.lifecycle.label || !d.lifecycle.plist) return { kind: 'refused', why: 'unmanaged' };
  if (action !== 'stop' && deps.elsewhere) return { kind: 'refused', why: 'placed-elsewhere', machine: deps.elsewhere.placedOn };
  const label = d.lifecycle.label;
  const plist = expand(d.lifecycle.plist);
  // M-3: a missing plist is said at once, not retried by bootstrap.
  if (action !== 'stop' && !(deps.exists ?? fs.existsSync)(plist)) return { kind: 'refused', why: 'plist-missing', plist };
  deps.onLaunch?.();
  const r = action === 'restart' ? await deps.launchd.restart(label, plist)
    : action === 'stop' ? await deps.launchd.stop(label)
    : await deps.launchd.start(label, plist);
  if (r.code !== 0) return { kind: 'launchctl-failed', detail: (r.stderr || r.stdout).trim() || `launchctl exit ${r.code}` };
  const strayPid = seen.duplicate ? seen.oldPid : null;
  let lastSeenPid: number | null = null;
  const deadline = deps.now() + CONTROL_TIMEOUT_MS;
  while (deps.now() < deadline) {
    const probe = await deps.wellKnown(d.origin);
    if (probe.kind === 'answer') lastSeenPid = probe.doc.process.pid;
    if (action === 'stop') {
      if (probe.kind === 'no-answer') return { kind: 'stopped', probe };
    } else if (probe.kind === 'answer' && probe.doc.service.id === d.id && probe.doc.service.instance === d.instance
      && (action !== 'restart' || probe.doc.process.pid !== seen.oldPid)) {
      return { kind: 'answered', probe, pid: probe.doc.process.pid };
    }
    await deps.sleep(deps.pollMs ?? 400);
  }
  if (action === 'restart' && strayPid !== null && lastSeenPid === strayPid) return { kind: 'stray-holds', pid: strayPid, port: portOf(d.origin) ?? 0 };
  return { kind: action === 'stop' ? 'still-answering' : 'timeout' };
}
// #endregion control
