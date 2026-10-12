// #region console-admission — docs: AGENTS.md#lifecycle
// FD-49, lifecycle LC-17 (fabric-workspace knowledge/lifecycle.md): start only what the machine can
// carry. Before a console session starts: free disk on the folder's volume ≥ 5 GB, swap not
// exhausted, and fewer live console sessions than the cap. When the machine cannot carry it the
// start is deferred and the console says why and what frees it — never started to fail its
// neighbours. Pure over a probe, so a test stubs disk and swap; `machineProbe()` reads the real ones.
import { execFile } from 'node:child_process';
import fs from 'node:fs';

export const MIN_FREE_DISK_BYTES = 5 * 1024 ** 3;
/** D1 of the 2026-10-12 board waves: six console sessions at once (LC-17's day had 37 at ≈ 12 GB). */
export const CONSOLE_SESSION_CAP = 6;
/** Swap counts as exhausted when less than this share of it is free. */
export const SWAP_FREE_FLOOR = 0.05;

export interface MachineState {
  /** Free bytes on the volume the session starts on; null when it could not be read. */
  freeDisk: number | null;
  /** Swap in bytes; null when the system does not say (Windows' page file, an unreadable answer).
   *  `growable`: macOS adds swap files while the disk has room, so its swap runs out only when the
   *  disk does — the disk floor is that check, and the ratio is not read (it sits near 5% for hours). */
  swap: { total: number; free: number; growable?: boolean } | null;
  /** Console sessions running now. */
  running: number;
}

export type Admission =
  | { ok: true }
  | { ok: false; why: 'disk'; freeDisk: number }
  | { ok: false; why: 'swap'; swapFree: number; swapTotal: number }
  | { ok: false; why: 'cap'; running: number; cap: number };

export function admit(m: MachineState, cap = CONSOLE_SESSION_CAP): Admission {
  if (m.running >= cap) return { ok: false, why: 'cap', running: m.running, cap };
  if (m.freeDisk !== null && m.freeDisk < MIN_FREE_DISK_BYTES) return { ok: false, why: 'disk', freeDisk: m.freeDisk };
  if (m.swap && !m.swap.growable && m.swap.total > 0 && m.swap.free / m.swap.total < SWAP_FREE_FLOOR) return { ok: false, why: 'swap', swapFree: m.swap.free, swapTotal: m.swap.total };
  return { ok: true };
}

/** `sysctl vm.swapusage` on macOS: `total = 4096.00M  used = 3500.00M  free = 596.00M  (encrypted)`. */
export function parseSwapUsage(text: string): { total: number; free: number } | null {
  const unit = (n: string, u: string) => Number(n) * ({ K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[u.toUpperCase()] ?? 1);
  const total = /total\s*=\s*([\d.]+)([KMG])/i.exec(text);
  const free = /free\s*=\s*([\d.]+)([KMG])/i.exec(text);
  return total && free ? { total: unit(total[1]!, total[2]!), free: unit(free[1]!, free[2]!) } : null;
}

/** `/proc/meminfo` on Linux: `SwapTotal: 2097148 kB` / `SwapFree: …`. */
export function parseMeminfo(text: string): { total: number; free: number } | null {
  const total = /^SwapTotal:\s+(\d+)\s*kB/m.exec(text);
  const free = /^SwapFree:\s+(\d+)\s*kB/m.exec(text);
  return total && free ? { total: Number(total[1]) * 1024, free: Number(free[1]) * 1024 } : null;
}

function freeDiskAt(folder: string): number | null {
  try {
    const s = fs.statfsSync(folder);
    return s.bavail * s.bsize;
  } catch {
    return null;
  }
}

function swapNow(platform: NodeJS.Platform): Promise<MachineState["swap"]> {
  if (platform === 'linux') {
    try { return Promise.resolve(parseMeminfo(fs.readFileSync('/proc/meminfo', 'utf8'))); } catch { return Promise.resolve(null); }
  }
  if (platform !== 'darwin') return Promise.resolve(null);
  return new Promise((resolve) => execFile('/usr/sbin/sysctl', ['-n', 'vm.swapusage'], { timeout: 3000 }, (error, out) => {
    const swap = error ? null : parseSwapUsage(String(out));
    resolve(swap ? { ...swap, growable: true } : null);
  }));
}

/** The machine as it is now, for a session that would start in `folder`. */
export async function machineProbe(folder: string, running: number, platform: NodeJS.Platform = process.platform): Promise<MachineState> {
  return { freeDisk: freeDiskAt(folder), swap: await swapNow(platform), running };
}
// #endregion console-admission
