// #region space-daemons — docs: packages/service-host/README.md#space-daemons
// FD-167: in a space nobody logs into there is no gui/<uid> domain, so Observatory installs the space's agents as
// system daemons that run as the space's user (`UserName`, engine 0.35.0, OBS-361). It records each one it installs in
// one root-owned file (observatory-space-daemons/1): a descriptor whose launchd label is recorded there for this user's
// uid is read in the `system` domain, never guessed. Until the contract names the descriptor's own field (CT-234,
// `lifecycle.domain`), this record is the only source. No file: every job is in gui/<uid>, as before.
import { readFileSync, statSync } from 'node:fs';

export const SPACE_DAEMONS_SCHEMA = 'observatory-space-daemons/1';
export const SPACE_DAEMONS_FILE = '/Library/Application Support/ProjectObservatory/space-daemons.json';

export interface SpaceDaemon { label: string; user: string; uid: number }

export type SpaceDaemonsRead = { daemons: SpaceDaemon[]; error: null } | { daemons: null; error: string };

const text = (v: unknown, max = 256): string | undefined => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined);

/** Reads the record; an entry without a label, a user or a whole uid is dropped, never guessed. */
export function parseSpaceDaemons(raw: string): SpaceDaemonsRead {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (error) {
    return { daemons: null, error: `the space daemons record is not JSON: ${(error as Error).message}` };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { daemons: null, error: 'the space daemons record is not an object' };
  const o = doc as Record<string, unknown>;
  if (o.schema !== SPACE_DAEMONS_SCHEMA) return { daemons: null, error: `the space daemons record speaks ${String(o.schema)}, not ${SPACE_DAEMONS_SCHEMA}` };
  if (!Array.isArray(o.entries)) return { daemons: null, error: 'the space daemons record has no entries list' };
  const daemons: SpaceDaemon[] = [];
  for (const e of o.entries.slice(0, 1000)) {
    if (!e || typeof e !== 'object') continue;
    const x = e as Record<string, unknown>;
    const label = text(x.label);
    const user = text(x.user, 64);
    if (!label || !user || typeof x.uid !== 'number' || !Number.isInteger(x.uid) || x.uid < 0) continue;
    daemons.push({ label, user, uid: x.uid });
  }
  return { daemons, error: null };
}

export interface SpaceDaemonsFileInfo { uid: number; mode: number; size: number; mtimeMs: number }

/** Only root writes the record (`observatory-space-daemons apply`): one another user owns, or others may write, is not read. */
export function spaceDaemonsFileProblem(info: SpaceDaemonsFileInfo): string | null {
  if (info.uid !== 0) return 'the space daemons record is not owned by root';
  if (info.mode & 0o022) return 'others may write the space daemons record';
  if (info.size > 1_000_000) return 'the space daemons record is larger than 1 MB';
  return null;
}

/**
 * Whether a launchd label runs as a system daemon for this user. Reads the file again only when it changed, and at most
 * once per `everyMs`. `error` is the last reason the record could not be used (null when it is absent).
 */
export class SpaceDaemonReader {
  private checkedAt = -Infinity;
  private stamp = '';
  private current: SpaceDaemon[] = [];
  error: string | null = null;

  constructor(private readonly o: { file?: string; everyMs?: number; platform?: NodeJS.Platform; uid?: number; stat?: (f: string) => SpaceDaemonsFileInfo; read?: (f: string) => string } = {}) {}

  get file(): string { return this.o.file ?? SPACE_DAEMONS_FILE; }

  private get uid(): number | undefined { return this.o.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined); }

  /** True when the record installs `label` as a system daemon running as this user. */
  isSystem(label: string, now: number): boolean {
    if ((this.o.platform ?? process.platform) !== 'darwin') return false;
    const uid = this.uid;
    if (uid === undefined) return false;
    return this.daemons(now).some((d) => d.label === label && d.uid === uid);
  }

  private daemons(now: number): SpaceDaemon[] {
    if (now - this.checkedAt < (this.o.everyMs ?? 5000)) return this.current;
    this.checkedAt = now;
    let info: SpaceDaemonsFileInfo;
    try {
      info = (this.o.stat ?? ((f) => statSync(f)))(this.file);
    } catch {
      this.stamp = '';
      this.current = [];
      this.error = null;
      return this.current;
    }
    const stamp = `${info.mtimeMs}:${info.size}`;
    if (stamp === this.stamp) return this.current;
    this.stamp = stamp;
    const problem = spaceDaemonsFileProblem(info);
    if (problem) {
      this.current = [];
      this.error = problem;
      return this.current;
    }
    let read: SpaceDaemonsRead;
    try {
      read = parseSpaceDaemons((this.o.read ?? ((f) => readFileSync(f, 'utf8')))(this.file));
    } catch (error) {
      read = { daemons: null, error: (error as Error).message };
    }
    this.current = read.daemons ?? [];
    this.error = read.error;
    return this.current;
  }
}
// #endregion space-daemons
