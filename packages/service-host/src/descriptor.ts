// #region descriptor-discovery — docs: packages/service-host/README.md#discovery
// Reading and checking descriptors in services/ (fabric-service/0.1 → Descriptor).
// Mirrors schemas/service-descriptor.schema.json and FAC-SEM-010/012; the contract's schema stays
// normative, the contract fixtures are the test vectors.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ID_PATTERN, INSTANCE_PATTERN, PROTOCOL, type ClaimConflict, type Descriptor } from './protocol';

const ORIGIN = /^http:\/\/127\.0\.0\.1:([0-9]{3,5})$/;
// DEC-0019: a remote origin is https on a public DNS name, an optional port and nothing else.
const REMOTE_ORIGIN = /^https:\/\/((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?::([0-9]{1,5}))?$/;
const RESERVED_HOST = /(^|\.)(localhost|local|internal|home\.arpa|lan|localdomain)$/;
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{2,254}$/;
const HEADER = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const POSIX_LOCAL_PATH = /^(~\/|\/)[^\0]*$/;
// FD-37: on Windows a descriptor path is drive-absolute (`C:\` or `C:/`) or under `~\`/`~/` — never a
// network share (`\\server\share`), which would make a token or a command depend on another machine.
const WIN32_LOCAL_PATH = /^(~[\\/]|[A-Za-z]:[\\/])[^\0]*$/;

/** Whether `p` is a local absolute (or home-relative) path in the grammar of `platform`. */
export function isLocalPath(p: unknown, platform: NodeJS.Platform = process.platform): p is string {
  return typeof p === 'string' && (platform === 'win32' ? WIN32_LOCAL_PATH : POSIX_LOCAL_PATH).test(p);
}

/** Where installers write descriptors: FABRIC_SERVICES_DIR, else the OS location. */
export function servicesDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform, home = os.homedir()): string {
  if (env.FABRIC_SERVICES_DIR) return expand(env.FABRIC_SERVICES_DIR, home, platform);
  if (platform === 'darwin') return path.posix.join(home, 'Library/Application Support/ai.passioncode.fabric/services');
  // FD-37 (proposed to the contract with Fabric's port): LOCALAPPDATA, because token files must not roam.
  if (platform === 'win32') return path.win32.join(env.LOCALAPPDATA || path.win32.join(home, 'AppData', 'Local'), 'passioncode-fabric', 'services');
  return path.posix.join(env.XDG_DATA_HOME || path.posix.join(home, '.local/share'), 'passioncode-fabric/services');
}

/** `~/` (and on Windows `~\`) resolved against the home folder; any other path unchanged. */
export function expand(p: string, home = os.homedir(), platform: NodeJS.Platform = process.platform): string {
  const join = platform === 'win32' ? path.win32.join : path.posix.join;
  return p.startsWith('~/') || (platform === 'win32' && p.startsWith('~\\')) ? join(home, p.slice(2)) : p;
}

/** The port of an `http://127.0.0.1:<port>` origin, or null for anything else. */
export function portOf(origin: string): number | null {
  const m = ORIGIN.exec(origin);
  if (!m) return null;
  const port = Number(m[1]);
  return port >= 100 && port <= 65535 ? port : null;
}

/** DEC-0019: `local` unless the descriptor says `remote`. */
export function placementOf(d: { placement?: unknown } | null | undefined): 'local' | 'remote' {
  return d?.placement === 'remote' ? 'remote' : 'local';
}

/** The problem with a remote origin, or null. */
export function remoteOriginProblem(origin: unknown): string | null {
  const m = typeof origin === 'string' ? REMOTE_ORIGIN.exec(origin) : null;
  if (!m) return 'a remote origin must be https://<dns-name>[:<port>] with no path, query or IP literal';
  if (RESERVED_HOST.test(m[1]!)) return `a remote service cannot live on the reserved name ${m[1]}`;
  if (m[2] !== undefined && (Number(m[2]) < 1 || Number(m[2]) > 65535)) return 'the origin port is out of range';
  return null;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every problem as one sentence; an empty list means the descriptor is usable. */
export function validateDescriptor(raw: unknown, platform: NodeJS.Platform = process.platform): string[] {
  if (!isObj(raw)) return ['the file is not a JSON object'];
  const d = raw;
  const problems: string[] = [];
  const remote = placementOf(d) === 'remote';
  if (d.placement !== undefined && d.placement !== 'local' && d.placement !== 'remote') problems.push('placement must be local or remote');
  const required = ['protocol', 'id', 'instance', 'name', 'origin', 'auth', 'lifecycle', 'installedAt', 'installedBy'];
  for (const key of remote ? required : [...required, 'paths']) {
    if (!(key in d)) problems.push(`missing ${key}`);
  }
  if (problems.length) return problems;
  if (d.protocol !== PROTOCOL) problems.push(`protocol must be ${PROTOCOL}, not ${JSON.stringify(d.protocol)}`);
  if (!isStr(d.id) || !ID_PATTERN.test(d.id)) problems.push('id must be lowercase letters, digits and dashes');
  if (!isStr(d.instance) || !INSTANCE_PATTERN.test(d.instance)) problems.push('instance must be lowercase letters, digits and dashes');
  if (!isStr(d.name) || !d.name || d.name.length > 80) problems.push('name must be 1 to 80 characters');
  if (remote) {
    const problem = remoteOriginProblem(d.origin);
    if (problem) problems.push(problem);
  } else if (!isStr(d.origin) || portOf(d.origin) === null) problems.push('origin must be http://127.0.0.1:<port>');
  const auth = d.auth;
  if (!isObj(auth) || !isLocalPath(auth.tokenFile, platform)) problems.push('auth.tokenFile must be an absolute or ~/ path');
  else {
    const header = auth.header ?? 'Authorization';
    const scheme = auth.scheme ?? 'Bearer';
    if (!isStr(header) || !HEADER.test(header)) problems.push('auth.header is not a valid header name');
    if (scheme !== 'Bearer' && scheme !== 'none') problems.push('auth.scheme must be Bearer or none');
    if (header !== 'Authorization' && scheme !== 'none') problems.push('a custom auth header carries the raw token: auth.scheme must be none');
  }
  const life = d.lifecycle;
  if (!isObj(life) || (life.manager !== 'launchd' && life.manager !== 'none')) problems.push('lifecycle.manager must be launchd or none');
  else if (life.manager === 'launchd') {
    if (!isStr(life.label) || !LABEL.test(life.label)) problems.push('a launchd service declares lifecycle.label');
    if (!isLocalPath(life.plist, platform) || !life.plist.endsWith('.plist')) problems.push('a launchd service declares lifecycle.plist');
  }
  if (remote && isObj(life)) {
    if (life.manager !== 'none') problems.push('a remote service is supervised by its platform: lifecycle.manager must be none');
    for (const field of ['label', 'plist']) if (life[field] !== undefined) problems.push(`a remote service has no launchd ${field}`);
  }
  const paths = d.paths;
  if (remote && paths === undefined) {
    // DEC-0019: a remote placement keeps no state on this computer.
  } else if (!isObj(paths) || !isLocalPath(paths.data, platform)) problems.push('paths.data must be an absolute or ~/ path');
  else if (!Array.isArray(paths.logs) || !paths.logs.every((p) => isLocalPath(p, platform))) problems.push('paths.logs must list absolute or ~/ paths');
  if (remote && isObj(d.commands) && d.commands.update !== undefined) problems.push('a remote service declares no update command');
  if (d.commands !== undefined) {
    if (!isObj(d.commands)) problems.push('commands must be an object');
    else {
      for (const [name, argv] of Object.entries(d.commands)) {
        if (name !== 'doctor' && name !== 'update') problems.push(`unknown command ${name}`);
        else if (!Array.isArray(argv) || !argv.length || !argv.every(isStr)) problems.push(`command ${name} must be an argument array, not a shell string`);
        else if (!isLocalPath(argv[0], platform)) problems.push(`command ${name} must start with an absolute or ~/ executable`);
      }
    }
  }
  return problems;
}

export interface DescriptorEntry {
  path: string;
  key: string; // id.instance, or the file stem when unreadable
  descriptor: Descriptor | null;
  problems: string[];
}

/**
 * Read every *.json in the directory. A half-written or unreadable file is an entry with its
 * problem, never a throw; an absent directory is an empty list. Anything else the directory
 * itself refuses (not a directory, no permission) is thrown for the caller to report.
 */
export function readDirectory(dir: string): DescriptorEntry[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && !n.startsWith('.')).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return names.map((name) => {
    const file = path.join(dir, name);
    const stem = name.slice(0, -'.json'.length);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      return { path: file, key: stem, descriptor: null, problems: [`the file cannot be read as JSON: ${(error as Error).message}`] };
    }
    const problems = validateDescriptor(raw);
    const d = raw as Descriptor;
    const key = isStr(d?.id) && isStr(d?.instance) ? `${d.id}.${d.instance}` : stem;
    if (!problems.length && `${d.id}.${d.instance}` !== stem) {
      problems.push(`the file is named ${name} but describes ${d.id}.${d.instance}`);
    }
    return { path: file, key, descriptor: problems.length ? null : d, problems };
  });
}

/** FAC-SEM-010: which entries claim a port or an id.instance another entry claims. */
export function claimConflicts(entries: readonly DescriptorEntry[]): Map<string, ClaimConflict> {
  const byPort = new Map<number, string[]>();
  const byKey = new Map<string, number>();
  for (const e of entries) {
    if (!e.descriptor) continue;
    byKey.set(e.key, (byKey.get(e.key) ?? 0) + 1);
    const port = portOf(e.descriptor.origin);
    if (port !== null) byPort.set(port, [...(byPort.get(port) ?? []), e.key]);
  }
  const out = new Map<string, ClaimConflict>();
  for (const [port, keys] of byPort) {
    const unique = [...new Set(keys)];
    if (unique.length > 1) for (const k of unique) out.set(k, { port, with: unique.filter((o) => o !== k) });
  }
  for (const [key, count] of byKey) if (count > 1 && !out.has(key)) out.set(key, { with: [key] });
  return out;
}
// #endregion descriptor-discovery
