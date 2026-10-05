// #region one-look — docs: packages/service-host/README.md#one-look
// One look at every service in services/: read the descriptors, find claim conflicts, read
// launchd once, probe each usable service's health once, derive each state. This is what a
// reader with no history needs (Fabric's registry scan, the Fabric Dashboards MCP server): with
// no earlier answer to measure silence from, a service that does not answer now is `down`, never
// «starting». Fabric Dashboards' own monitor keeps history and uses the parts directly.
import { claimConflicts, readDirectory, servicesDir as defaultServicesDir, type DescriptorEntry } from './descriptor';
import { authHeaders, fetchWellKnown, readToken, REMOTE_TIMEOUT_MS, type WellKnownOptions } from './health';
import { LaunchdReader, UNMANAGED } from './launchd';
import type { ClaimConflict, LaunchdStatus, Reason, ServiceState, WellKnown, WellKnownResult } from './protocol';
import { DOWN_AFTER_MS, REMOTE_DOWN_AFTER_MS, deriveState } from './state';

export interface LookOptions {
  /** Default: servicesDir() — FABRIC_SERVICES_DIR, else the OS location. */
  servicesDir?: string;
  /** Default: fetchWellKnown — 2 s for a local origin; for a remote one REMOTE_TIMEOUT_MS with the token (DEC-0019). */
  wellKnown?: (origin: string, options?: WellKnownOptions) => Promise<WellKnownResult>;
  /** Default: readToken. A remote placement's probe needs its token; a local one never reads it here. */
  token?: (tokenFile: string) => string;
  /** Default: a LaunchdReader on launchctl. */
  launchd?: LaunchdReader;
  now?: () => number;
  /** Look only at these keys (id.instance); claim conflicts are still found across every descriptor. */
  only?: readonly string[];
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
  const managed = (e: DescriptorEntry) => e.descriptor?.lifecycle.manager === 'launchd' && Boolean(e.descriptor.lifecycle.label);
  const chosen = o.only ? entries.filter((e) => o.only!.includes(e.key)) : entries;
  const table = chosen.some(managed) ? await reader.disabledTable() : '';
  const services = await Promise.all(chosen.map((e) => lookAtEntry(e, conflicts.get(e.key) ?? null, table, reader, o)));
  return { servicesDir: dir, error: null, services };
}

async function lookAtEntry(entry: DescriptorEntry, conflict: ClaimConflict | null, table: string, reader: LaunchdReader, o: LookOptions): Promise<ServiceLook> {
  const d = entry.descriptor;
  const now = (o.now ?? Date.now)();
  const remote = d?.placement === 'remote';
  const probeOf = o.wellKnown ?? ((origin: string, options?: WellKnownOptions) => fetchWellKnown(origin, remote ? REMOTE_TIMEOUT_MS : 2000, options));
  const problems = [...entry.problems];
  let probe: WellKnownResult | null = null;
  let options: WellKnownOptions | undefined;
  if (d && remote) {
    try {
      options = { headers: authHeaders(d, (o.token ?? readToken)(d.auth.tokenFile)) };
    } catch (error) {
      problems.push((error as Error).message); // a local configuration problem: invalid, never probed
    }
  }
  if (d && !conflict && !problems.length) {
    try {
      probe = await probeOf(d.origin, options);
    } catch (error) {
      probe = { kind: 'no-answer', detail: (error as Error).message };
    }
  }
  const launchd: LaunchdStatus = d && d.lifecycle.manager === 'launchd' && d.lifecycle.label
    ? { managed: true, ...(await reader.status(d.lifecycle.label, table)) }
    : { ...UNMANAGED };
  const { state, reasons } = deriveState({
    descriptor: d, problems, conflict, launchd, probe,
    firstUnansweredAt: now - (remote ? REMOTE_DOWN_AFTER_MS : DOWN_AFTER_MS), now, busy: null,
  });
  return {
    key: entry.key, path: entry.path, descriptor: d, problems, conflict, state, reasons,
    // A foreign answer is another program's document: never this service's version, tiles or usage.
    wellKnown: probe?.kind === 'answer' && state !== 'foreign' ? probe.doc : null, probe, launchd,
  };
}
// #endregion one-look
