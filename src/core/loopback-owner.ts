// FD-156, FD-159: whose process listens on a loopback port, so a service token is sent only to this user's own agent.
// On a Mac with several macOS users (the Studio, fabric-workspace docs/plans/2026-11-04-studio-spaces) 127.0.0.1 is
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
 * A check for `setLoopbackOwnerCheck` over a list of the ports this user's own processes listen on. One read serves
 * every call that asks at once; it is trusted `OWNED_FRESH_MS`, and a port not in it reads it again after
 * `MISS_REREAD_MS`. When the list cannot be read, the check says yes rather than stop every probe: it guards against
 * another user's process, and an unreadable list is no evidence of one; `failed` tells the caller.
 */
export function ownedPortsCheck(list: () => Promise<Set<number>>, now: () => number = Date.now, failed: (why: string) => void = () => {}) {
  let ports: Set<number> | null = null;
  let readAt = 0;
  let reading: Promise<void> | null = null;
  const read = (): Promise<void> => {
    reading ??= list()
      .then((p) => { ports = p; })
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

/**
 * macOS: this user's own listening TCP sockets, from `lsof -a -u <uid>`. A user's lsof never sees another user's
 * sockets, so a port held by someone else, or by nobody, is not there.
 */
export function loopbackOwnerCheck(run: Runner, uid: number, now: () => number = Date.now, failed: (why: string) => void = () => {}) {
  return ownedPortsCheck(() => run('lsof', ['-nP', '-a', '-u', String(uid), '-iTCP', '-sTCP:LISTEN', '-F', 'n'], 10_000).then((r) => {
    // lsof exits 1 with nothing printed when nothing listens: that is an empty list, not a failure.
    if (r.code !== 0 && (r.stdout.trim() || r.stderr.trim())) throw new Error(r.stderr.trim() || `lsof exit ${r.code}`);
    return portsOf(r.stdout);
  }), now, failed);
}

/**
 * FD-159: the listening ports a `/proc/net/tcp` or `/proc/net/tcp6` table gives to `uid`. Each row is
 * `sl local_address rem_address st ... uid ...`: the local port is the hex after the colon, `0A` is LISTEN and the
 * eighth field is the socket's owner. Every listening address counts, since one bound to any address (0.0.0.0, ::)
 * also takes connections to 127.0.0.1.
 */
export function procNetPorts(table: string, uid: number): Set<number> {
  const out = new Set<number>();
  for (const line of table.split('\n').slice(1)) {
    const f = line.trim().split(/\s+/);
    const local = f[1];
    if (f.length < 8 || local === undefined || f[3] !== '0A' || Number(f[7]) !== uid) continue;
    const port = Number.parseInt(local.slice(local.lastIndexOf(':') + 1), 16);
    if (Number.isInteger(port) && port > 0) out.add(port);
  }
  return out;
}

/**
 * FD-159: Linux, from the kernel's socket tables, which list every user's sockets with their owner (no process is
 * started). `/proc/net/tcp6` is absent when IPv6 is off: then only the IPv4 table is read.
 */
export function linuxLoopbackOwnerCheck(read: (path: string) => Promise<string>, uid: number, now: () => number = Date.now, failed: (why: string) => void = () => {}) {
  return ownedPortsCheck(async () => {
    const [v4, v6] = await Promise.all([read('/proc/net/tcp'), read('/proc/net/tcp6').catch(() => '')]);
    return new Set([...procNetPorts(v4, uid), ...procNetPorts(v6, uid)]);
  }, now, failed);
}
// #endregion loopback-owner
