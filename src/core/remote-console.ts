// #region remote-console — docs: docs/ux/scenarios.md#scn-103-edit-an-agent-on-the-machine-it-runs-on
// FD-199: an agent the placement record puts on another machine (FD-132) is edited there. Its console runs the coding
// agent on that machine over SSH, in the same repository folder, through the route its port forward already uses
// (FD-179, FD-196): a launchd job `ssh -N -L 127.0.0.1:<port>:127.0.0.1:<port> <user>@<host>` with its key options.
// The forward is the one fact on this machine that says how that machine is reached, by whom and with which key, so
// nothing new is configured and no secret is read: the key stays a file path that ssh opens itself.
import fs from 'node:fs';
import path from 'node:path';
import { shellQuote } from './consoles';

/** How ssh reaches the machine: its destination and the options of the forward that name the key or the jump. */
export interface SshRoute {
  destination: string;
  options: string[];
  /** The launchd label of the forward this route was read from. */
  via: string;
}

export interface LaunchJob { label: string; argv: string[] }

/** ssh options that take a value (OpenSSH 9: `ssh -h`). */
const VALUED = new Set(['-B', '-b', '-c', '-D', '-E', '-e', '-F', '-I', '-i', '-J', '-L', '-l', '-m', '-O', '-o', '-P', '-p', '-Q', '-R', '-S', '-W', '-w']);
/** `-o` settings that say which key, user, port or jump reach the machine; the forward's own settings stay behind. */
const KEPT_OPTIONS = /^(IdentityFile|IdentitiesOnly|IdentityAgent|User|Port|ProxyJump|ProxyCommand|HostKeyAlias|UserKnownHostsFile|StrictHostKeyChecking|CertificateFile|PubkeyAuthentication)=/i;
const DESTINATION = /^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9._:-]+$/;

/** The route of one launchd job when it is an ssh local forward, with the local ports it forwards; null otherwise. */
export function forwardOf(job: LaunchJob): { route: SshRoute; ports: number[] } | null {
  const [bin, ...args] = job.argv;
  if (!bin || path.basename(bin) !== 'ssh') return null;
  const options: string[] = [];
  const ports: number[] = [];
  let destination: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (destination !== null) return null; // a remote command after the destination: not a plain forward
    if (VALUED.has(a)) {
      const v = args[++i];
      if (v === undefined) return null;
      if (a === '-L') { const port = localPort(v); if (port !== null) ports.push(port); }
      else if (a === '-i' || a === '-J' || a === '-p' || a === '-l' || a === '-F') options.push(a, v);
      else if (a === '-o' && KEPT_OPTIONS.test(v)) options.push(a, v);
      continue;
    }
    if (a.startsWith('-')) continue; // flags without a value (-N, -T, -q, -4 ...)
    destination = a;
  }
  if (!destination || !DESTINATION.test(destination) || ports.length === 0) return null;
  return { route: { destination, options, via: job.label }, ports };
}

/** `[bind:]port:host:hostport` → port; a socket path or anything else → null. */
function localPort(spec: string): number | null {
  const parts = spec.startsWith('[') ? spec.replace(/^\[[^\]]*\]:/, 'x:').split(':') : spec.split(':');
  const raw = parts.length === 4 ? parts[1] : parts.length === 3 ? parts[0] : null;
  const port = raw !== null && raw !== undefined && /^\d{1,5}$/.test(raw) ? Number(raw) : NaN;
  return port > 0 && port < 65536 ? port : null;
}

/** The route to the machine an agent runs on: the forward the placement record names (`forward`), else the one that
 *  brings the agent's port here. Null when no forward reaches it. */
export function routeTo(o: { forward?: string; port: number | null; jobs: LaunchJob[] }): SshRoute | null {
  const forwards = o.jobs.map((j) => ({ job: j, f: forwardOf(j) })).filter((x): x is { job: LaunchJob; f: NonNullable<ReturnType<typeof forwardOf>> } => x.f !== null);
  const named = o.forward ? forwards.find((x) => x.job.label === o.forward) : undefined;
  if (named) return named.f.route;
  const byPort = o.port !== null ? forwards.find((x) => x.f.ports.includes(o.port!)) : undefined;
  return byPort?.f.route ?? null;
}

/** The line the remote machine's shell runs: into the folder (under the remote home when it is under the home here),
 *  then the coding agent through a login shell, so its PATH is the one a person there has. */
export function remoteScript(o: { folder: string; home: string; argv: string[] }): string {
  const rel = o.folder === o.home ? '' : o.folder.startsWith(o.home + '/') ? o.folder.slice(o.home.length + 1) : null;
  const dir = rel === null ? shellQuote(o.folder) : rel === '' ? '"$HOME"' : `"$HOME"/${shellQuote(rel)}`;
  return `cd ${dir} && exec "\${SHELL:-/bin/zsh}" -lc ${shellQuote(`exec ${o.argv.map(shellQuote).join(' ')}`)}`;
}

/** The argv this Mac runs for a console on the other machine: ssh with a terminal, no prompt (the key is the forward's),
 *  a bounded connect, the route's key options, the destination and the remote line. */
export function remoteArgv(o: { ssh?: string; route: SshRoute; folder: string; home: string; argv: string[] }): string[] {
  return [o.ssh ?? '/usr/bin/ssh', '-t', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=30', ...o.route.options, o.route.destination, remoteScript(o)];
}

/** The coding agent's command on the other machine: its program by name (the remote PATH finds it), its arguments. */
export function remoteRuntimeArgv(argv: string[]): string[] {
  const [bin, ...rest] = argv;
  return [path.basename(bin ?? 'claude'), ...rest];
}

/** The user's launchd jobs that run ssh, read from their XML property lists (a binary one is skipped). */
export function readLaunchJobs(dir: string): LaunchJob[] {
  let names: string[] = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.plist')); } catch { return []; }
  const jobs: LaunchJob[] = [];
  for (const name of names.slice(0, 2000)) {
    let text: string;
    try {
      const file = path.join(dir, name);
      if (fs.statSync(file).size > 256 * 1024) continue;
      text = fs.readFileSync(file, 'utf8');
    } catch { continue; }
    if (!text.startsWith('<?xml') && !text.startsWith('<!DOCTYPE') && !text.startsWith('<plist')) continue;
    if (!text.includes('ssh')) continue;
    const job = launchJobOf(text);
    if (job) jobs.push(job);
  }
  return jobs;
}

/** The Label and ProgramArguments of an XML property list. */
export function launchJobOf(xml: string): LaunchJob | null {
  const label = /<key>Label<\/key>\s*<string>([^<]*)<\/string>/.exec(xml)?.[1];
  const array = /<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(xml)?.[1];
  if (!label || array === undefined) return null;
  const argv = [...array.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => unescapeXml(m[1]!));
  return argv.length ? { label: unescapeXml(label), argv } : null;
}

function unescapeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
// #endregion remote-console
