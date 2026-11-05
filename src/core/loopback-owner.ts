// FD-156: whose process listens on a loopback port, so a service token is sent only to this user's own agent. On a
// Mac with several macOS users (the Studio, fabric-workspace docs/plans/2026-11-04-studio-spaces) 127.0.0.1 is
// shared: while this user's agent is stopped, another user's process may hold its port.
// #region loopback-owner — docs: SECURITY.md#what-the-app-touches
import type { Runner } from './launchd';

/** How long a read of this user's listening ports is trusted, and how soon a port not in it reads them again. */
export const OWNED_FRESH_MS = 30_000;
export const MISS_REREAD_MS = 5_000;

/** The ports in `lsof -F n` output (`n127.0.0.1:47851`, `n*:8080`, `n[::1]:47851`). */
export function portsOf(stdout: string): Set<number> {
  const out = new Set<number>();
  for (const line of stdout.split('\n')) {
    const m = /^n.*:(\d+)$/.exec(line.trim());
    if (m) out.add(Number(m[1]));
  }
  return out;
}

/**
 * A check for `setLoopbackOwnerCheck`. It lists this user's own listening TCP sockets with `lsof -a -u <uid>` (one
 * process for every port, shared by calls that ask at once) and answers whether the port is among them. On macOS a
 * user's lsof never sees another user's sockets, so a port held by someone else, or by nobody, is not there. When lsof
 * itself cannot answer (missing, failing, too slow), the check says yes rather than stop every probe: it guards
 * against another user's process, and an unreadable list is no evidence of one; `failed` tells the caller.
 */
export function loopbackOwnerCheck(run: Runner, uid: number, now: () => number = Date.now, failed: (why: string) => void = () => {}) {
  let ports: Set<number> | null = null;
  let readAt = 0;
  let reading: Promise<void> | null = null;
  const read = (): Promise<void> => {
    reading ??= run('lsof', ['-nP', '-a', '-u', String(uid), '-iTCP', '-sTCP:LISTEN', '-F', 'n'], 10_000)
      .then((r) => {
        // lsof exits 1 with nothing printed when nothing listens: that is an empty list, not a failure.
        if (r.code !== 0 && (r.stdout.trim() || r.stderr.trim())) throw new Error(r.stderr.trim() || `lsof exit ${r.code}`);
        ports = portsOf(r.stdout);
      })
      .catch((error: Error) => { ports = null; failed(error.message); })
      .finally(() => { readAt = now(); reading = null; });
    return reading;
  };
  return async (port: number): Promise<boolean> => {
    const age = now() - readAt;
    if (ports === null || age > OWNED_FRESH_MS || (!ports.has(port) && age > MISS_REREAD_MS)) await read();
    return ports === null ? true : ports.has(port);
  };
}
// #endregion loopback-owner
