// #region process-tree — docs: docs/adr/0019-windows-and-linux.md#decision
// FD-37 / platforms.md PL-07: Windows has no process groups and no SIGTERM. A command's tree is ended
// with `taskkill /T /F` while the command lives; what it left behind after exiting is found from a
// process snapshot by parent chain, and only processes created after the command started count —
// the identity check that keeps a reused pid of someone else's process out of it. Pure, tested on any OS.

export interface ProcessRow {
  pid: number;
  ppid: number;
  /** Creation time, epoch ms. */
  created: number;
}

/**
 * Every descendant of `root` in the snapshot that was created at or after `sinceMs` (the command's
 * start, less a small clock allowance). Walks parent links, so a child of an exited child still
 * counts while its own parent link points into the tree; a row created before `sinceMs` is a pid
 * that only happens to match, and it and its subtree are left alone.
 */
export function descendantsOf(rows: readonly ProcessRow[], root: number, sinceMs: number): number[] {
  const children = new Map<number, ProcessRow[]>();
  for (const r of rows) {
    if (r.pid === r.ppid) continue; // the System Idle Process is its own parent
    const list = children.get(r.ppid);
    if (list) list.push(r); else children.set(r.ppid, [r]);
  }
  const out: number[] = [];
  const seen = new Set<number>([root]);
  const queue = [root];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const r of children.get(parent) ?? []) {
      if (seen.has(r.pid) || r.created < sinceMs) continue;
      seen.add(r.pid);
      out.push(r.pid);
      queue.push(r.pid);
    }
  }
  return out;
}

/** PowerShell that prints every process as `[{pid,ppid,created}]` JSON (created: epoch ms, UTC). */
export const SNAPSHOT_SCRIPT =
  'Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; ' +
  'created = [long](([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds()) } } | ConvertTo-Json -Compress';

/** The snapshot's rows, or [] for anything that is not the expected JSON (a refusal is not a crash). */
export function parseSnapshot(text: string): ProcessRow[] {
  let raw: unknown;
  try { raw = JSON.parse(text.trim()); } catch { return []; }
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  return list.flatMap((r) => {
    const o = r as Record<string, unknown>;
    return Number.isInteger(o.pid) && Number.isInteger(o.ppid) && typeof o.created === 'number' ? [{ pid: o.pid as number, ppid: o.ppid as number, created: o.created }] : [];
  });
}
// #endregion process-tree
