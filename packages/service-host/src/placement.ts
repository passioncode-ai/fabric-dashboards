// #region placement — docs: packages/service-host/README.md#placement
// FD-132: which services this machine's placement record puts on another machine. Until Observatory's
// node serves the estate record's machines[].packages[] (FAC-SEM-074), the record is one file Observatory
// writes on each machine (observatory-placement/1, OBS-283): a service it names is placed elsewhere, so a
// silent copy here is off, not down, and an answering one is a second copy. No file: everything is placed
// here, as before.
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Descriptor, Elsewhere } from './protocol';

export const PLACEMENT_SCHEMA = 'observatory-placement/1';

export interface PlacementEntry {
  /** The launchd label of the service's job. */
  label?: string;
  /** The service's key, id.instance (an id alone stands for its default instance). */
  serviceId?: string;
  placedOn: string;
  since?: string;
  by?: string;
}

export interface Placement {
  machine: string | null;
  updatedAt: string | null;
  elsewhere: PlacementEntry[];
}

export type PlacementRead = { placement: Placement; error: null } | { placement: null; error: string };

/** XDG_DATA_HOME, else ~/.local/share, then project-observatory/placement.json (Observatory's own path). */
export function placementFile(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const base = env.XDG_DATA_HOME && env.XDG_DATA_HOME.trim() ? env.XDG_DATA_HOME : join(home, '.local', 'share');
  return join(base, 'project-observatory', 'placement.json');
}

const text = (v: unknown, max = 256): string | undefined => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined);

/** Reads the document; an entry without a machine or without anything to match it by is dropped, never guessed. */
export function parsePlacement(raw: string): PlacementRead {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (error) {
    return { placement: null, error: `the placement file is not JSON: ${(error as Error).message}` };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { placement: null, error: 'the placement file is not an object' };
  const o = doc as Record<string, unknown>;
  if (o.schema !== undefined && o.schema !== PLACEMENT_SCHEMA) return { placement: null, error: `the placement file speaks ${String(o.schema)}, not ${PLACEMENT_SCHEMA}` };
  if (!Array.isArray(o.elsewhere)) return { placement: null, error: 'the placement file has no elsewhere list' };
  const elsewhere: PlacementEntry[] = [];
  for (const e of o.elsewhere.slice(0, 1000)) {
    if (!e || typeof e !== 'object') continue;
    const x = e as Record<string, unknown>;
    const placedOn = text(x.placedOn);
    const label = text(x.label);
    const serviceId = text(x.serviceId);
    if (!placedOn || (!label && !serviceId)) continue;
    elsewhere.push({ placedOn, ...(label ? { label } : {}), ...(serviceId ? { serviceId } : {}), ...(text(x.since) ? { since: text(x.since) } : {}), ...(text(x.by) ? { by: text(x.by) } : {}) });
  }
  return { placement: { machine: text(o.machine) ?? null, updatedAt: text(o.updatedAt) ?? null, elsewhere }, error: null };
}

/** The entry that places this descriptor elsewhere: its launchd label, or its key (an id alone matches the default instance). */
export function elsewhereOf(placement: Placement | null, d: Pick<Descriptor, 'id' | 'instance' | 'lifecycle'> | null): Elsewhere | null {
  if (!placement || !d) return null;
  const key = `${d.id}.${d.instance}`;
  const label = d.lifecycle.label;
  const hit = placement.elsewhere.find((e) => (label && e.label === label) || e.serviceId === key || (e.serviceId === d.id && d.instance === 'default'));
  if (!hit || hit.placedOn === placement.machine) return null;
  return { placedOn: hit.placedOn, ...(hit.since ? { since: hit.since } : {}) };
}

export interface PlacementFileInfo { uid: number; mode: number; size: number; mtimeMs: number }

/** Only the owner writes the record: one another user owns, or others may write, is not read (it could hide Start). */
export function placementFileProblem(info: PlacementFileInfo, o: { platform: NodeJS.Platform; uid: number | undefined }): string | null {
  if (o.platform === 'win32') return null;
  if (o.uid !== undefined && info.uid !== o.uid) return 'the placement file belongs to another user';
  if (info.mode & 0o022) return 'others may write the placement file; set mode 0600';
  if (info.size > 1_000_000) return 'the placement file is larger than 1 MB';
  return null;
}

/**
 * Reads the file again only when it changed, and at most once per `everyMs`: a monitor asks on every snapshot.
 * `error` is the last reason the file could not be used (null when it is absent: nothing is placed elsewhere).
 */
export class PlacementReader {
  private checkedAt = -Infinity;
  private stamp = '';
  private current: Placement | null = null;
  error: string | null = null;

  constructor(private readonly o: { file?: string; everyMs?: number; platform?: NodeJS.Platform; uid?: number; stat?: (f: string) => PlacementFileInfo; read?: (f: string) => string } = {}) {}

  get file(): string { return this.o.file ?? placementFile(); }

  get(now: number): Placement | null {
    if (now - this.checkedAt < (this.o.everyMs ?? 5000)) return this.current;
    this.checkedAt = now;
    let info: PlacementFileInfo;
    try {
      info = (this.o.stat ?? ((f) => statSync(f)))(this.file);
    } catch {
      this.stamp = '';
      this.current = null;
      this.error = null;
      return null;
    }
    const stamp = `${info.mtimeMs}:${info.size}`;
    if (stamp === this.stamp) return this.current;
    this.stamp = stamp;
    const problem = placementFileProblem(info, { platform: this.o.platform ?? process.platform, uid: this.o.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined) });
    if (problem) {
      this.current = null;
      this.error = problem;
      return null;
    }
    let read: PlacementRead;
    try {
      read = parsePlacement((this.o.read ?? ((f) => readFileSync(f, 'utf8')))(this.file));
    } catch (error) {
      read = { placement: null, error: (error as Error).message };
    }
    this.current = read.placement;
    this.error = read.error;
    return this.current;
  }
}
// #endregion placement
