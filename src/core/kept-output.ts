// #region kept-output — docs: docs/ux/scenarios.md#scn-080-open-one-sessions-page
// FD-124: what an ended console session printed outlives an app restart for as long as its row is listed (24 hours,
// SESSION_KEEP_MS). One file per session in the app's data folder (0700 folder, 0600 file), named by a hash of the row
// id so no key or folder appears in a file name; written once when the session ends, removed with its row.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SESSION_KEEP_MS } from './sessions';

export interface KeptOutput {
  /** The session's row id, `c:<console key>:<start>`. */
  id: string;
  key: string;
  label: string;
  cwd: string;
  startedAt: number;
  endedAt: number;
  exitCode: number | null;
  signal: number | null;
  /** The console's ring as it was at the end (at most its 1 MB). */
  output: string;
}

/** The largest file read back: a ring of 1,000,000 characters is at most about 4 MB of UTF-8, plus the JSON around it. */
const MAX_BYTES = 8 * 1024 * 1024;

export const keptFile = (dir: string, id: string) => path.join(dir, `${crypto.createHash('sha256').update(id).digest('hex').slice(0, 32)}.json`);

/** Written to a temporary file and renamed, so a killed writer never leaves half a file under the real name. */
export function saveKept(dir: string, k: KeptOutput): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = keptFile(dir, k.id);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(k), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function dropKept(dir: string, id: string): void {
  fs.rmSync(keptFile(dir, id), { force: true });
}

function isKept(x: unknown): x is KeptOutput {
  const k = x as KeptOutput;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  return Boolean(k) && typeof k === 'object' && typeof k.id === 'string' && typeof k.key === 'string' && k.id.startsWith(`c:${k.key}:`)
    && typeof k.label === 'string' && typeof k.cwd === 'string' && typeof k.output === 'string' && num(k.startedAt) && num(k.endedAt)
    && (k.exitCode === null || num(k.exitCode)) && (k.signal === null || num(k.signal));
}

/** The sessions still listed (`listed`: the ids of the rows kept and not removed), at most one per console key, the
 *  latest; every other file (another row's, older than a day, left by a killed writer, unreadable) is removed. */
export function loadKept(dir: string, listed: ReadonlySet<string>, now: number): KeptOutput[] {
  let names: string[];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const latest = new Map<string, KeptOutput>();
  for (const name of names) {
    const file = path.join(dir, name);
    let k: unknown = null;
    if (name.endsWith('.json')) {
      try { if (fs.statSync(file).size <= MAX_BYTES) k = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* removed below */ }
    }
    if (!isKept(k) || file !== keptFile(dir, k.id) || !listed.has(k.id) || !(now - k.endedAt <= SESSION_KEEP_MS)) {
      fs.rmSync(file, { force: true });
      continue;
    }
    const was = latest.get(k.key);
    if (!was || k.startedAt > was.startedAt) latest.set(k.key, k);
  }
  return [...latest.values()];
}
// #endregion kept-output
