// Reading and checking descriptors (fabric-service/0.1 → Descriptor).
// Mirrors schemas/service-descriptor.schema.json and FAC-SEM-010/012; the
// contract's schema stays normative, the contract fixtures are the test vectors.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROTOCOL, type Descriptor } from './types';

const ID = /^[a-z][a-z0-9-]{1,62}$/;
const INSTANCE = /^[a-z][a-z0-9-]{0,31}$/;
const ORIGIN = /^http:\/\/127\.0\.0\.1:([0-9]{3,5})$/;
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{2,254}$/;
const HEADER = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const LOCAL_PATH = /^(~\/|\/)[^\0]*$/;

export function servicesDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform, home = os.homedir()): string {
  if (env.FABRIC_SERVICES_DIR) return expand(env.FABRIC_SERVICES_DIR, home);
  if (platform === 'darwin') return path.join(home, 'Library/Application Support/ai.passioncode.fabric/services');
  return path.join(env.XDG_DATA_HOME || path.join(home, '.local/share'), 'passioncode-fabric/services');
}

export function expand(p: string, home = os.homedir()): string {
  return p.startsWith('~/') ? path.join(home, p.slice(2)) : p;
}

export function portOf(origin: string): number | null {
  const m = ORIGIN.exec(origin);
  if (!m) return null;
  const port = Number(m[1]);
  return port >= 100 && port <= 65535 ? port : null;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every problem as one sentence; an empty list means the descriptor is usable. */
export function validateDescriptor(raw: unknown): string[] {
  if (!isObj(raw)) return ['the file is not a JSON object'];
  const d = raw;
  const problems: string[] = [];
  for (const key of ['protocol', 'id', 'instance', 'name', 'origin', 'auth', 'lifecycle', 'paths', 'installedAt', 'installedBy']) {
    if (!(key in d)) problems.push(`missing ${key}`);
  }
  if (problems.length) return problems;
  if (d.protocol !== PROTOCOL) problems.push(`protocol must be ${PROTOCOL}, not ${JSON.stringify(d.protocol)}`);
  if (!isStr(d.id) || !ID.test(d.id)) problems.push('id must be lowercase letters, digits and dashes');
  if (!isStr(d.instance) || !INSTANCE.test(d.instance)) problems.push('instance must be lowercase letters, digits and dashes');
  if (!isStr(d.name) || !d.name || d.name.length > 80) problems.push('name must be 1 to 80 characters');
  if (!isStr(d.origin) || portOf(d.origin) === null) problems.push('origin must be http://127.0.0.1:<port>');
  const auth = d.auth;
  if (!isObj(auth) || !isStr(auth.tokenFile) || !LOCAL_PATH.test(auth.tokenFile)) problems.push('auth.tokenFile must be an absolute or ~/ path');
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
    if (!isStr(life.plist) || !LOCAL_PATH.test(life.plist) || !life.plist.endsWith('.plist')) problems.push('a launchd service declares lifecycle.plist');
  }
  const paths = d.paths;
  if (!isObj(paths) || !isStr(paths.data) || !LOCAL_PATH.test(paths.data)) problems.push('paths.data must be an absolute or ~/ path');
  else if (!Array.isArray(paths.logs) || !paths.logs.every((p) => isStr(p) && LOCAL_PATH.test(p))) problems.push('paths.logs must list absolute or ~/ paths');
  if (d.commands !== undefined) {
    if (!isObj(d.commands)) problems.push('commands must be an object');
    else {
      for (const [name, argv] of Object.entries(d.commands)) {
        if (name !== 'doctor' && name !== 'update') problems.push(`unknown command ${name}`);
        else if (!Array.isArray(argv) || !argv.length || !argv.every(isStr)) problems.push(`command ${name} must be an argument array, not a shell string`);
        else if (!LOCAL_PATH.test(argv[0] as string)) problems.push(`command ${name} must start with an absolute or ~/ executable`);
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

/** Read every *.json in the directory. A half-written or unreadable file is reported, never thrown. */
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
export function claimConflicts(entries: DescriptorEntry[]): Map<string, { port?: number; with: string[] }> {
  const byPort = new Map<number, string[]>();
  const byKey = new Map<string, number>();
  for (const e of entries) {
    if (!e.descriptor) continue;
    byKey.set(e.key, (byKey.get(e.key) ?? 0) + 1);
    const port = portOf(e.descriptor.origin);
    if (port !== null) byPort.set(port, [...(byPort.get(port) ?? []), e.key]);
  }
  const out = new Map<string, { port?: number; with: string[] }>();
  for (const [port, keys] of byPort) {
    const unique = [...new Set(keys)];
    if (unique.length > 1) for (const k of unique) out.set(k, { port, with: unique.filter((o) => o !== k) });
  }
  for (const [key, count] of byKey) if (count > 1 && !out.has(key)) out.set(key, { with: [key] });
  return out;
}
