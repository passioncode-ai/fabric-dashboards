// #region one-look — docs: packages/service-host/README.md#one-look
// One look at every service in services/: read the descriptors, find claim conflicts, read
// launchd once, probe each usable service's health once, derive each state. This is what a
// reader with no history needs (Fabric's registry scan, the Fabric Dashboards MCP server): with
// no earlier answer to measure silence from, a service that does not answer now is `down`, never
// «starting». Fabric Dashboards' own monitor keeps history and uses the parts directly.
import { claimConflicts, portOf, readDirectory, servicesDir as defaultServicesDir, type DescriptorEntry } from './descriptor';
import { authHeaders, fetchWellKnown, heldButSilent, loopbackOwnerOf, readTokenAsync, REMOTE_TIMEOUT_MS, type WellKnownOptions } from './health';
import { LaunchdReader, UNMANAGED } from './launchd';
import { elsewhereOf, PlacementReader, type Placement } from './placement';
import { isSystemJob, SpaceDaemonReader } from './space-daemons';
import type { RemoteTokenLatch } from './latch';
import type { ClaimConflict, LaunchdStatus, Reason, ServiceState, WellKnown, WellKnownResult } from './protocol';
import { DOWN_AFTER_MS, REMOTE_DOWN_AFTER_MS, deriveState } from './state';

export interface LookOptions {
  /** Default: servicesDir() — FABRIC_SERVICES_DIR, else the OS location. */
  servicesDir?: string;
  /** Default: fetchWellKnown — 2 s for a local origin; for a remote one REMOTE_TIMEOUT_MS with the token (DEC-0019). */
  wellKnown?: (origin: string, options?: WellKnownOptions) => Promise<WellKnownResult>;
  /** Default: readTokenAsync. A remote placement's probe needs its token; a local one never reads it here. */
  token?: (tokenFile: string) => string | Promise<string>;
  /** Default: a LaunchdReader on launchctl. */
  launchd?: LaunchdReader;
  /** FD-201: how long a one-shot read waits before it asks an unknown loopback owner again (default 5.5 s; tests pass 0). */
  ownerRecheckMs?: number;
  /** FD-37: launchd is read only on macOS (default `process.platform`); elsewhere a launchd service is unmanaged here. */
  platform?: NodeJS.Platform;
  /** FD-167: which labels are system daemons of this user's space. Default: a SpaceDaemonReader on Observatory's record. */
  daemons?: Pick<SpaceDaemonReader, 'isSystem'>;
  now?: () => number;
  /** Look only at these keys (id.instance); claim conflicts are still found across every descriptor. */
  only?: readonly string[];
  /** A reader that looks more than once (the MCP server) passes one latch for its lifetime: an online
   *  origin that answered as something else then gets no token again (RemoteTokenLatch). */
  latch?: RemoteTokenLatch;
  /** FD-132: this machine's placement record. Default: read once from placementFile(); null: placed here. */
  placement?: Placement | null;
}

export interface ServiceLook {
  key: string;
  path: string;
  descriptor: DescriptorEntry['descriptor'];
  problems: string[];
  conflict: ClaimConflict | null;
  state: ServiceState;
  reasons: Reason[];
  wellKnown: WellKnown | null;
  /** The probe as it came back; null when the service was not probed (invalid, conflict). */
  probe: WellKnownResult | null;
  launchd: LaunchdStatus;
}

export interface Look {
  servicesDir: string;
  /** The directory itself could not be read (not absent — that is an empty look). */
  error: string | null;
  services: ServiceLook[];
}

export async function lookAtServices(o: LookOptions = {}): Promise<Look> {
  const dir = o.servicesDir ?? defaultServicesDir();
  let entries: DescriptorEntry[];
  try {
    entries = readDirectory(dir);
  } catch (error) {
    return { servicesDir: dir, error: (error as Error).message, services: [] };
  }
  const conflicts = claimConflicts(entries);
  const reader = o.launchd ?? new LaunchdReader();
  const onLaunchd = (o.platform ?? process.platform) === 'darwin';
  const managed = (e: DescriptorEntry) => onLaunchd && e.descriptor?.lifecycle.manager === 'launchd' && Boolean(e.descriptor.lifecycle.label);
  const chosen = o.only ? entries.filter((e) => o.only!.includes(e.key)) : entries;
  const table = chosen.some(managed) ? await reader.disabledTable() : '';
  // FD-167: the system domain's disabled table, read once when any chosen job is a system daemon of this space.
  const daemons = o.daemons ?? new SpaceDaemonReader({ platform: o.platform });
  const at = (o.now ?? Date.now)();
  const system = (e: DescriptorEntry) => managed(e) && isSystemJob(e.descriptor, daemons, at);
  const systemTable = chosen.some(system) ? await reader.disabledTable('system') : '';
  const placement = o.placement !== undefined ? o.placement : new PlacementReader().get((o.now ?? Date.now)());
  const services = await Promise.all(chosen.map((e) => lookAtEntry(e, conflicts.get(e.key) ?? null, system(e) ? systemTable : table, reader, { ...o, placement }, system(e))));
  return { servicesDir: dir, error: null, services };
}

async function lookAtEntry(entry: DescriptorEntry, conflict: ClaimConflict | null, table: string, reader: LaunchdReader, o: LookOptions, system = false): Promise<ServiceLook> {
  const d = entry.descriptor;
  const now = (o.now ?? Date.now)();
  const remote = d?.placement === 'remote';
  const probeOf = o.wellKnown ?? ((origin: string, options?: WellKnownOptions) => fetchWellKnown(origin, remote ? REMOTE_TIMEOUT_MS : 2000, options));
  const problems = [...entry.problems];
  let probe: WellKnownResult | null = null;
  let options: WellKnownOptions | undefined;
  if (d && remote) {
    try {
      options = { headers: authHeaders(d, await (o.token ?? readTokenAsync)(d.auth.tokenFile)) };
    } catch (error) {
      problems.push((error as Error).message); // a local configuration problem: invalid, never probed
    }
  }
  if (d && !conflict && !problems.length) {
    try {
      probe = remote && o.latch
        ? await o.latch.probe(d, (withToken) => probeOf(d.origin, withToken ? options : undefined))
        : await probeOf(d.origin, options);
    } catch (error) {
      probe = { kind: 'no-answer', detail: (error as Error).message };
    }
  }
  const launchd: LaunchdStatus = d && (o.platform ?? process.platform) === 'darwin' && d.lifecycle.manager === 'launchd' && d.lifecycle.label
    ? { managed: true, ...(await reader.status(d.lifecycle.label, table, system ? 'system' : 'gui')), ...(system ? { domain: 'system' as const } : {}) }
    : { ...UNMANAGED };
  // FD-158, DEC-0154 HA-2: an answer on loopback, or a silent listener, is this user's only when this user's own process
  // listens there.
  const port = d && !remote && probe && (probe.kind !== 'no-answer' || heldButSilent(probe)) ? portOf(d.origin) : null;
  // FD-201: a one-shot read asks an unknown owner once more after the tables' re-read time before saying `foreign-user`.
  let owner = port === null ? null : await loopbackOwnerOf(port);
  if (owner === 'unknown' && port !== null) {
    await new Promise((r) => setTimeout(r, o.ownerRecheckMs ?? 5_500));
    owner = await loopbackOwnerOf(port);
  }
  const foreignUser = owner === 'unknown' ? 'unknown' : owner === false;
  const { state, reasons } = deriveState({
    descriptor: d, problems, conflict, launchd, probe,
    firstUnansweredAt: now - (remote ? REMOTE_DOWN_AFTER_MS : DOWN_AFTER_MS), now, busy: null,
    elsewhere: elsewhereOf(o.placement ?? null, d), foreignUser,
  });
  return {
    key: entry.key, path: entry.path, descriptor: d, problems, conflict, state, reasons,
    // A foreign answer is another program's document: never this service's version, tiles or usage.
    wellKnown: probe?.kind === 'answer' && state !== 'foreign' && state !== 'foreign-user' ? probe.doc : null, probe, launchd,
  };
}
// #endregion one-look
