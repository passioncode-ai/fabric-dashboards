// FD-156, FD-159: whose process listens on a loopback port, so a service token is sent only to this user's own agent.
// On a Mac with several macOS users (the Studio, fabric-workspace docs/plans/2026-11-04-studio-spaces) 127.0.0.1 is
// shared: while this user's agent is stopped, another user's process may hold its port.
// #region loopback-owner — docs: SECURITY.md#what-the-app-touches
import type { LoopbackOwner } from '@passioncode-ai/fabric-service-host';
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
 * `MISS_REREAD_MS`. A port not in the list, or a list that cannot be read, is decided by `miss` when there is one;
 * otherwise a port not in a list read is not ours, and an unreadable list is `unknown`, which DEC-0154 HA-2 makes
 * `foreign-user`: nothing is sent (FD-159).
 * `failed` tells the caller why a list could not be read.
 */
export function ownedPortsCheck(list: () => Promise<Set<number>>, now: () => number = Date.now, failed: (why: string) => void = () => {}, miss?: (port: number) => Promise<LoopbackOwner>) {
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
  return async (port: number): Promise<LoopbackOwner> => {
    const age = now() - readAt;
    if (ports === null || age > OWNED_FRESH_MS || (!ports.has(port) && age > MISS_REREAD_MS)) await read();
    if (ports !== null && ports.has(port)) return true;
    if (miss) return miss(port);
    return ports === null ? 'unknown' : false;
  };
}

/**
 * FD-159: the processes listening on each port where a connection to 127.0.0.1 lands, from `netstat -anv -p tcp`
 * (macOS). Its rows name the owning process even for another user's socket: `tcp4  0  0  127.0.0.1.47851  *.*  LISTEN
 * ...  <name>:<pid>  <state> <options> ...`, the name possibly with spaces. Only IPv4 listeners on 127.0.0.1 or on any
 * address (`tcp4`, `tcp46`) take such a connection; an IPv6-only one does not. A row whose process it cannot read
 * gives pid 0, which no process has: an owner that cannot be told.
 */
export function listenersOf(stdout: string): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const line of stdout.split('\n')) {
    const m = /^(tcp4|tcp46)\s+\d+\s+\d+\s+(\S+)\s+\S+\s+LISTEN\s+(.*)$/.exec(line.trim());
    if (!m) continue;
    const local = m[2]!;
    const dot = local.lastIndexOf('.');
    const address = local.slice(0, dot);
    const port = Number(local.slice(dot + 1));
    if (!Number.isInteger(port) || port <= 0 || (address !== '127.0.0.1' && address !== '*')) continue;
    const pid = /:(\d+)\s+[0-9a-f]{5}\s+[0-9a-f]{8}\s/.exec(m[3]!);
    out.set(port, [...(out.get(port) ?? []), pid ? Number(pid[1]) : 0]);
  }
  return out;
}

/**
 * FD-159, DEC-0154 HA-2: on macOS a user's lsof finds its own listener but cannot tell an empty port from another
 * user's, so a port it does not find is decided by the socket table: `netstat -anv -p tcp` for the listening processes
 * (read again after `MISS_REREAD_MS`), then `ps` for their uids. Ours only when every listener there is this user's;
 * nobody listening or another user's process is not ours, and an owner it cannot tell is `unknown`.
 */
export function socketTableOwner(run: Runner, uid: number, now: () => number = Date.now, failed: (why: string) => void = () => {}) {
  let table: Map<number, number[]> | null = null;
  let readAt = -Infinity;
  let reading: Promise<void> | null = null;
  const read = (): Promise<void> => {
    reading ??= run('netstat', ['-anv', '-p', 'tcp'], 10_000)
      .then((r) => {
        if (r.code !== 0) throw new Error(r.stderr.trim() || `netstat exit ${r.code}`);
        table = listenersOf(r.stdout);
      })
      .catch((error: Error) => { table = null; failed(error.message); })
      .finally(() => { readAt = now(); reading = null; });
    return reading;
  };
  return async (port: number): Promise<LoopbackOwner> => {
    if (table === null || now() - readAt > MISS_REREAD_MS) await read();
    if (table === null) return 'unknown';
    const pids = table.get(port);
    if (!pids?.length) return false;
    if (pids.some((p) => p <= 0)) return 'unknown';
    try {
      const r = await run('ps', ['-o', 'pid=,uid=', '-p', pids.join(',')], 10_000);
      const uids = new Map<number, number>();
      for (const line of r.stdout.split('\n')) {
        const m = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
        if (m) uids.set(Number(m[1]), Number(m[2]));
      }
      if (pids.some((p) => uids.get(p) === undefined)) return 'unknown';
      return pids.every((p) => uids.get(p) === uid);
    } catch (error) {
      failed((error as Error).message);
      return 'unknown';
    }
  };
}

/**
 * macOS: this user's own listening TCP sockets, from `lsof -a -u <uid>`. A user's lsof never sees another user's
 * sockets; a port it does not find, or a listing that cannot be read, goes to the socket table (`socketTableOwner`).
 */
export function loopbackOwnerCheck(run: Runner, uid: number, now: () => number = Date.now, failed: (why: string) => void = () => {}) {
  return ownedPortsCheck(() => run('lsof', ['-nP', '-a', '-u', String(uid), '-iTCP', '-sTCP:LISTEN', '-F', 'n'], 10_000).then((r) => {
    // lsof exits 1 with nothing printed when nothing listens: that is an empty list, not a failure.
    if (r.code !== 0 && (r.stdout.trim() || r.stderr.trim())) throw new Error(r.stderr.trim() || `lsof exit ${r.code}`);
    return portsOf(r.stdout);
  }), now, failed, socketTableOwner(run, uid, now, failed));
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
/**
 * FD-159: the listeners of `fabric-dashboards-acl --listeners` (Windows, build/win/acl.cs): this user's SID and, for
 * each port a connection to 127.0.0.1 reaches, the owners' SIDs (null: a process or token it could not open).
 */
export function windowsListenersOf(stdout: string): { user: string; byPort: Map<number, (string | null)[]> } {
  const doc = JSON.parse(stdout) as { user?: unknown; listeners?: unknown };
  if (typeof doc.user !== 'string' || !Array.isArray(doc.listeners)) throw new Error('the listener reader answered no user or listeners');
  const byPort = new Map<number, (string | null)[]>();
  for (const l of doc.listeners as { port?: unknown; sid?: unknown }[]) {
    if (typeof l.port !== 'number' || !Number.isInteger(l.port) || l.port <= 0) continue;
    byPort.set(l.port, [...(byPort.get(l.port) ?? []), typeof l.sid === 'string' ? l.sid : null]);
  }
  return { user: doc.user, byPort };
}

/**
 * FD-159, DEC-0154 HA-2: Windows, from the app's compiled reader (`GetExtendedTcpTable`, then each owning process's
 * token user). Ours only when every listener on the port runs as this user; nobody listening or another user's process
 * is not ours, and a process it could not open, or a reader that fails, is `unknown`. An answer that the port is ours
 * is trusted `OWNED_FRESH_MS`; anything else reads the table again after `MISS_REREAD_MS`.
 */
export function windowsLoopbackOwnerCheck(run: Runner, reader: string, now: () => number = Date.now, failed: (why: string) => void = () => {}) {
  let table: ReturnType<typeof windowsListenersOf> | null = null;
  let readAt = -Infinity;
  let reading: Promise<void> | null = null;
  const read = (): Promise<void> => {
    reading ??= run(reader, ['--listeners'], 15_000)
      .then((r) => {
        if (r.code !== 0) throw new Error(r.stderr.trim() || `listener reader exit ${r.code}`);
        table = windowsListenersOf(r.stdout);
      })
      .catch((error: Error) => { table = null; failed(error.message); })
      .finally(() => { readAt = now(); reading = null; });
    return reading;
  };
  const decide = (port: number): LoopbackOwner => {
    if (table === null) return 'unknown';
    const sids = table.byPort.get(port);
    if (!sids?.length) return false;
    if (sids.some((s) => s === null)) return 'unknown';
    return sids.every((s) => s === table!.user);
  };
  return async (port: number): Promise<LoopbackOwner> => {
    const age = now() - readAt;
    if (table === null || age > OWNED_FRESH_MS || (decide(port) !== true && age > MISS_REREAD_MS)) await read();
    return decide(port);
  };
}
// #endregion loopback-owner
