// The Fabric Dashboards MCP tools: what an agent on this Mac may ask of the services the app
// watches — see them, open one (or one page of one) in the app, and the operator's small set of
// administration: start, stop, restart through launchd, run the descriptor's doctor or update,
// read the recent activity. docs/adr/0004-deep-links-and-mcp.md.
//
// Same rules as the app: launchd is the only supervisor (ADR-0002); a token is read here and
// never returned; a command is only ever the descriptor's own argument array.
import { execFile } from 'node:child_process';
import { claimConflicts, expand, readDirectory, servicesDir as defaultServicesDir, type DescriptorEntry } from '../core/descriptor';
import { fromServiceUrl, linkFor, safePath } from '../core/deeplink';
import { Launchd, execRunner, type Runner } from '../core/launchd';
import { fetchEvents, fetchWellKnown, readToken } from '../core/probe';
import { DOWN_AFTER_MS, deriveState } from '../core/state';
import type { Descriptor, ServiceState, WellKnownResult } from '../core/types';

export const COMMAND_TIMEOUT_MS = 120_000;
export const CONTROL_TIMEOUT_MS = 40_000;
const APP_NAME = 'Fabric Dashboards';

export interface Deps {
  servicesDir: () => string;
  wellKnown: (origin: string) => Promise<WellKnownResult>;
  launchd: Launchd;
  /** `open <target>`; resolves the exit code. */
  open: (target: string) => Promise<number>;
  /** Whether the app is installed (it then owns `fabric-dashboards://`). */
  appInstalled: () => Promise<boolean>;
  run: (argv: string[], timeoutMs: number) => Promise<{ code: number | null; output: string; timedOut: boolean }>;
  events: typeof fetchEvents;
  token: typeof readToken;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  platform: NodeJS.Platform;
}

function runArgv(argv: string[], timeoutMs: number): Promise<{ code: number | null; output: string; timedOut: boolean }> {
  const [cmd, ...args] = argv.map((a, i) => (i === 0 ? expand(a) : a));
  return new Promise((resolve) => {
    execFile(cmd!, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', env: { ...process.env } }, (error, stdout, stderr) => {
      const timedOut = Boolean(error && (error as { killed?: boolean }).killed);
      const code = error ? (typeof (error as { code?: unknown }).code === 'number' ? (error as { code: number }).code : null) : 0;
      resolve({ code, output: `${stdout ?? ''}${stderr ? `\n${stderr}` : ''}`.trim(), timedOut });
    });
  });
}

export function liveDeps(runner: Runner = execRunner): Deps {
  return {
    servicesDir: () => defaultServicesDir(),
    wellKnown: (origin) => fetchWellKnown(origin),
    launchd: new Launchd(runner),
    open: async (target) => (await runner('open', [target])).code,
    appInstalled: async () => process.platform === 'darwin' && (await runner('open', ['-Ra', APP_NAME])).code === 0,
    run: runArgv,
    events: fetchEvents,
    token: readToken,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    platform: process.platform,
  };
}

export class ToolError extends Error {}

// ── reading ─────────────────────────────────────────────────────────────────────────────

export interface ServiceView {
  key: string;
  name: string;
  state: ServiceState;
  reasons: { code: string; params?: Record<string, string | number> }[];
  version: string | null;
  build: string | null;
  origin: string | null;
  dashboard: string | null;
  open_link: string;
  tiles: { label: string; value: number | string; attention?: boolean }[];
  update_available: string | null;
  commands: string[];
  problems: string[];
}

async function view(entry: DescriptorEntry, conflict: { port?: number; with: string[] } | undefined, deps: Deps): Promise<ServiceView> {
  const d = entry.descriptor;
  const probe = d && !conflict ? await deps.wellKnown(d.origin) : null;
  const managed = d?.lifecycle.manager === 'launchd' && Boolean(d.lifecycle.label);
  const launchd = managed ? { managed: true, ...(await deps.launchd.status(d!.lifecycle.label!)) } : { managed: false, loaded: false, pid: null, disabled: false };
  const { state, reasons } = deriveState({
    descriptor: d, problems: entry.problems, conflict, launchd, probe,
    // One look, not a watch: a service that does not answer now is `down`, not «starting».
    firstUnansweredAt: deps.now() - DOWN_AFTER_MS, now: deps.now(), busy: null,
  });
  const wk = probe?.kind === 'answer' ? probe.doc : null;
  const dashPath = wk?.surfaces.dashboard?.path ?? null;
  return {
    key: entry.key,
    name: d?.name ?? entry.key,
    state,
    reasons,
    version: wk?.service.version ?? null,
    build: wk?.service.build.commit ?? wk?.service.build.digest ?? null,
    origin: d?.origin ?? null,
    dashboard: d && dashPath ? `${d.origin}${dashPath}` : null,
    open_link: linkFor(entry.key, dashPath ?? undefined),
    tiles: wk?.summary ?? [],
    update_available: wk?.update?.available ?? null,
    commands: Object.keys(d?.commands ?? {}),
    problems: entry.problems,
  };
}

function entries(deps: Deps): { list: DescriptorEntry[]; conflicts: ReturnType<typeof claimConflicts> } {
  const list = readDirectory(deps.servicesDir());
  return { list, conflicts: claimConflicts(list) };
}

function find(deps: Deps, key: string): DescriptorEntry & { descriptor: Descriptor } {
  const entry = entries(deps).list.find((e) => e.key === key);
  if (!entry) throw new ToolError(`no installed service ${JSON.stringify(key)}; list_services names them`);
  if (!entry.descriptor) throw new ToolError(`the descriptor of ${key} is invalid: ${entry.problems[0] ?? 'unreadable'}`);
  return entry as DescriptorEntry & { descriptor: Descriptor };
}

export async function listServices(deps: Deps): Promise<{ services: ServiceView[]; services_dir: string }> {
  const { list, conflicts } = entries(deps);
  return { services: await Promise.all(list.map((e) => view(e, conflicts.get(e.key), deps))), services_dir: deps.servicesDir() };
}

export async function serviceStatus(deps: Deps, key: string): Promise<ServiceView> {
  const { list, conflicts } = entries(deps);
  const entry = list.find((e) => e.key === key);
  if (!entry) throw new ToolError(`no installed service ${JSON.stringify(key)}`);
  return view(entry, conflicts.get(key), deps);
}

// ── links and opening ───────────────────────────────────────────────────────────────────

export interface Target { service?: string; path?: string; url?: string }

/** The service and path an agent means, from a key + path or from the service's own URL. */
export function resolveTarget(deps: Deps, t: Target): { key: string; path?: string; http: string } {
  const known = entries(deps).list.map((e) => ({ key: e.key, descriptor: e.descriptor }));
  if (t.url && t.service) throw new ToolError('name a service or a url, not both');
  if (t.url) {
    const r = fromServiceUrl(t.url, known);
    if (!r.ok) throw new ToolError(r.reason);
    const target = r.target as { key: string; link?: string };
    const d = known.find((k) => k.key === target.key)!.descriptor!;
    return { key: target.key, path: target.link, http: `${d.origin}${target.link ?? '/'}` };
  }
  if (!t.service) throw new ToolError('open needs service (id.instance) or url');
  const entry = known.find((k) => k.key === t.service && k.descriptor);
  if (!entry) throw new ToolError(`no installed service ${JSON.stringify(t.service)}`);
  let path: string | undefined;
  if (t.path !== undefined && t.path !== '') {
    const safe = safePath(t.path);
    if (!safe) throw new ToolError('path must be a path on the service, starting with one /');
    path = safe;
  }
  return { key: entry.key, path, http: `${entry.descriptor!.origin}${path ?? '/'}` };
}

export async function link(deps: Deps, t: Target): Promise<{ service: string; open_link: string; http_url: string }> {
  const r = resolveTarget(deps, t);
  return { service: r.key, open_link: linkFor(r.key, r.path), http_url: r.http };
}

export async function open(deps: Deps, t: Target): Promise<{ opened_in: 'fabric-dashboards' | 'browser' | 'nothing'; open_link: string; http_url: string; note?: string }> {
  const r = resolveTarget(deps, t);
  const deep = linkFor(r.key, r.path);
  if (deps.platform !== 'darwin') return { opened_in: 'nothing', open_link: deep, http_url: r.http, note: 'opening is macOS-only; hand the person a link' };
  if (await deps.appInstalled()) {
    const code = await deps.open(deep);
    if (code === 0) return { opened_in: 'fabric-dashboards', open_link: deep, http_url: r.http };
  }
  const code = await deps.open(r.http);
  if (code !== 0) throw new ToolError(`open exited ${code} for ${r.http}`);
  return { opened_in: 'browser', open_link: deep, http_url: r.http, note: `${APP_NAME} is not installed; opened in the default browser` };
}

// ── administration ──────────────────────────────────────────────────────────────────────

export async function control(deps: Deps, key: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; state: ServiceState; detail: string }> {
  if (!['start', 'stop', 'restart'].includes(action)) throw new ToolError('action is start, stop or restart');
  const entry = find(deps, key);
  const d = entry.descriptor;
  if (d.lifecycle.manager !== 'launchd' || !d.lifecycle.label || !d.lifecycle.plist) {
    throw new ToolError(`${d.name} is not managed by launchd; it cannot be ${action}ed from here`);
  }
  const before = await deps.wellKnown(d.origin);
  const oldPid = before.kind === 'answer' ? before.doc.process.pid : null;
  const plist = expand(d.lifecycle.plist);
  const r = action === 'restart' ? await deps.launchd.restart(d.lifecycle.label, plist)
    : action === 'stop' ? await deps.launchd.stop(d.lifecycle.label)
    : await deps.launchd.start(d.lifecycle.label, plist);
  if (r.code !== 0) return { ok: false, state: (await serviceStatus(deps, key)).state, detail: (r.stderr || r.stdout).trim() || `launchctl exit ${r.code}` };
  const deadline = deps.now() + CONTROL_TIMEOUT_MS;
  while (deps.now() < deadline) {
    const probe = await deps.wellKnown(d.origin);
    if (action === 'stop' && probe.kind === 'no-answer') return { ok: true, state: 'stopped', detail: `${d.name} stopped and stays off across logins` };
    if (action !== 'stop' && probe.kind === 'answer' && probe.doc.service.id === d.id && probe.doc.service.instance === d.instance
      && (action !== 'restart' || probe.doc.process.pid !== oldPid)) {
      return { ok: true, state: (await serviceStatus(deps, key)).state, detail: `${d.name} answers as pid ${probe.doc.process.pid}` };
    }
    await deps.sleep(500);
  }
  return { ok: false, state: (await serviceStatus(deps, key)).state, detail: `no expected answer within ${CONTROL_TIMEOUT_MS / 1000} s` };
}

export async function command(deps: Deps, key: string, which: 'doctor' | 'update'): Promise<{ code: number | null; output: string; timed_out: boolean }> {
  if (which !== 'doctor' && which !== 'update') throw new ToolError('command is doctor or update');
  const d = find(deps, key).descriptor;
  const argv = d.commands?.[which];
  if (!argv) throw new ToolError(`${d.name} declares no ${which} command`);
  const r = await deps.run(argv, COMMAND_TIMEOUT_MS);
  return { code: r.code, output: r.output.slice(-20_000), timed_out: r.timedOut };
}

export async function activity(deps: Deps, key: string, limit = 20): Promise<{ events: { at: string; level: string; text: string; link?: string }[] }> {
  const d = find(deps, key).descriptor;
  const probe = await deps.wellKnown(d.origin);
  if (probe.kind !== 'answer') throw new ToolError(`${d.name} does not answer: ${probe.detail}`);
  let token: string;
  try {
    token = deps.token(d.auth.tokenFile);
  } catch (error) {
    throw new ToolError((error as Error).message);
  }
  const n = Math.max(1, Math.min(100, Math.floor(limit)));
  const page = await deps.events(d, probe.doc.surfaces.events.path, token, null, n);
  return { events: page.events.slice(-n).map((e) => ({ at: e.at, level: e.level, text: e.text, ...(e.link ? { link: linkFor(key, e.link) } : {}) })) };
}
