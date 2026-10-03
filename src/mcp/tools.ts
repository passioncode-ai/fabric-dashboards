// The Fabric Dashboards MCP tools: what an agent on this Mac may ask of the services the app
// watches — see them, open one (or one page of one) in the app, and the operator's small set of
// administration: start, stop, restart through launchd, run the descriptor's doctor or update,
// read the recent activity. docs/adr/0004-deep-links-and-mcp.md.
//
// Same rules as the app: launchd is the only supervisor (ADR-0002); a token is read here and
// never returned; a command is only ever the descriptor's own argument array.
//
// Reading — descriptors, claim conflicts, launchd status, the health probe, the state — is one
// look through @passioncode-ai/fabric-service-host, the same code Fabric's registry reads with.
import { execFile } from 'node:child_process';
import { discoverHost, type HostStatus } from './host';
import {
  APP_NAME, expand, lookAtServices, readDirectory, servicesDir as defaultServicesDir,
  type Descriptor, type DescriptorEntry, type ServiceLook, type ServiceState, type WellKnownResult, authHeaders, REMOTE_TIMEOUT_MS, type WellKnownOptions,
} from '@passioncode-ai/fabric-service-host';
import { fromServiceUrl, isServiceKey, linkFor, safePath } from '../core/deeplink';
import { Launchd, execRunner, type Runner } from '../core/launchd';
import { fetchEvents, fetchWellKnown, PROBE_TIMEOUT_MS, readToken } from '../core/probe';

export const COMMAND_TIMEOUT_MS = 120_000;
export const CONTROL_TIMEOUT_MS = 40_000;

export interface Deps {
  servicesDir: () => string;
  /** The health probe; a remote placement (DEC-0019) passes its token header in `options`. */
  wellKnown: (origin: string, options?: WellKnownOptions) => Promise<WellKnownResult>;
  launchd: Launchd;
  /** An explicit app path prevents dispatch to another handler; never use open -n. */
  open: (target: string, application?: string) => Promise<number>;
  host: () => Promise<HostStatus>;
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
    wellKnown: (origin, options) => fetchWellKnown(origin, options?.headers ? REMOTE_TIMEOUT_MS : PROBE_TIMEOUT_MS, options),
    launchd: new Launchd(runner),
    // The packaged MCP runs Electron as Node. LaunchServices inherits this flag
    // on a cold launch: open exits 0 while the GUI exits without making a window.
    // Strip it only in the dispatch child; never mutate the serving MCP process.
    open: async (target, application) => (await runner('/usr/bin/env', ['-u', 'ELECTRON_RUN_AS_NODE', '/usr/bin/open', ...(application ? ['-a', application, target] : [target])])).code,
    host: () => discoverHost(runner),
    run: runArgv,
    events: fetchEvents,
    token: readToken,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    platform: process.platform,
  };
}

export class ToolError extends Error {
  constructor(message: string, readonly details?: Record<string, unknown>) { super(message); }
}

// ── reading ─────────────────────────────────────────────────────────────────────────────

export interface ServiceView {
  key: string;
  name: string;
  /** DEC-0019: `local` or `remote` (an online agent or dashboard at an https origin). */
  placement: 'local' | 'remote';
  state: ServiceState;
  reasons: { code: string; params?: Record<string, string | number> }[];
  version: string | null;
  build: string | null;
  origin: string | null;
  dashboard: string | null;
  open_link: string | null;
  tiles: { label: string; value: number | string; attention?: boolean }[];
  update_available: string | null;
  commands: string[];
  problems: string[];
}

function view(s: ServiceLook): ServiceView {
  const d = s.descriptor;
  const wk = s.wellKnown;
  const dashPath = wk?.surfaces.dashboard?.path ?? null;
  return {
    key: s.key,
    name: d?.name ?? s.key,
    placement: d?.placement === 'remote' ? 'remote' : 'local',
    state: s.state,
    reasons: s.reasons,
    version: wk?.service.version ?? null,
    build: wk?.service.build.commit ?? wk?.service.build.digest ?? null,
    origin: d?.origin ?? null,
    dashboard: d && dashPath ? `${d.origin}${dashPath}` : null,
    // A descriptor that cannot be read names no service a link could open.
    open_link: d && isServiceKey(s.key) ? linkFor(s.key, dashPath && safePath(dashPath) ? dashPath : undefined) : null,
    tiles: wk?.summary ?? [],
    update_available: wk?.update?.available ?? null,
    commands: Object.keys(d?.commands ?? {}),
    problems: s.problems,
  };
}

/** One look, as the package reads it; an unreadable services directory is the tool's error. */
async function look(deps: Deps, only?: string[]): Promise<ServiceLook[]> {
  const out = await lookAtServices({ servicesDir: deps.servicesDir(), wellKnown: deps.wellKnown, launchd: deps.launchd, now: deps.now, only, token: deps.token });
  if (out.error) throw new ToolError(`cannot read the services directory ${out.servicesDir}: ${out.error}`);
  return out.services;
}

function entries(deps: Deps): DescriptorEntry[] {
  return readDirectory(deps.servicesDir());
}

function find(deps: Deps, key: string): DescriptorEntry & { descriptor: Descriptor } {
  const entry = entries(deps).find((e) => e.key === key);
  if (!entry) throw new ToolError(`no installed service ${JSON.stringify(key)}; list_services names them`);
  if (!entry.descriptor) throw new ToolError(`the descriptor of ${key} is invalid: ${entry.problems[0] ?? 'unreadable'}`);
  return entry as DescriptorEntry & { descriptor: Descriptor };
}

export async function listServices(deps: Deps): Promise<{ services: ServiceView[]; services_dir: string }> {
  return { services: (await look(deps)).map(view), services_dir: deps.servicesDir() };
}

export async function serviceStatus(deps: Deps, key: string): Promise<ServiceView> {
  const [one] = await look(deps, [key]);
  if (!one) throw new ToolError(`no installed service ${JSON.stringify(key)}`);
  return view(one);
}

// ── links and opening ───────────────────────────────────────────────────────────────────

export interface Target { service?: string; path?: string; url?: string }

/** The service and path an agent means, from a key + path or from the service's own URL. */
export function resolveTarget(deps: Deps, t: Target): { key: string; path?: string; http: string } {
  const known = entries(deps).map((e) => ({ key: e.key, descriptor: e.descriptor }));
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

/**
 * The page a path-less target means is the service's dashboard, not its origin root: an online
 * service often serves its panel under a path (`/panel/`) and answers 404 at `/`. The app already
 * opens the dashboard surface for a path-less open_link; http_url (diagnostics, browser fallback)
 * follows it here. One probe; a service that does not answer keeps the root.
 */
async function withDashboard(deps: Deps, r: { key: string; path?: string; http: string }): Promise<{ key: string; path?: string; http: string }> {
  if (r.path !== undefined) return r;
  const d = entries(deps).find((e) => e.key === r.key)?.descriptor;
  if (!d) return r;
  try {
    const answer = await probe(deps, d);
    const dash = answer.kind === 'answer' ? answer.doc.surfaces.dashboard?.path : undefined;
    const safe = dash ? safePath(dash) : null;
    return safe ? { ...r, http: `${d.origin}${safe}` } : r;
  } catch {
    return r;
  }
}

export async function link(deps: Deps, t: Target): Promise<{ service: string; open_link: string; http_url: string }> {
  const r = await withDashboard(deps, resolveTarget(deps, t));
  return { service: r.key, open_link: linkFor(r.key, r.path), http_url: r.http };
}

// #region strict-dashboard-open — docs: docs/runs/2026-10-01-dashboard-links/README.md#host-routing
export type Fallback = 'if_absent' | 'never';
export async function open(deps: Deps, t: Target, fallback: Fallback = 'if_absent'): Promise<{
  opened_in: 'fabric-dashboards' | 'browser' | 'nothing'; open_link: string; http_url: string;
  status: 'accepted_by_os' | 'unsupported'; note?: string;
}> {
  if (fallback !== 'if_absent' && fallback !== 'never') throw new ToolError('fallback must be if_absent or never');
  const r = await withDashboard(deps, resolveTarget(deps, t));
  const links = { open_link: linkFor(r.key, r.path), http_url: r.http };
  if (deps.platform !== 'darwin') return { ...links, opened_in: 'nothing', status: 'unsupported', note: 'opening is macOS-only; hand the person a link' };
  const fail = (code: string): never => {
    throw new ToolError(code, { ...links, opened_in: 'nothing', status: code });
  };
  let host: HostStatus;
  try { host = await deps.host(); } catch { return fail('host_unknown'); }
  if (host.state === 'available') {
    if (!host.application) return fail('host_unknown');
    let code: number;
    try { code = await deps.open(links.open_link, host.application.path); } catch { return fail('open_failed'); }
    if (code !== 0) return fail('open_failed');
    return { ...links, opened_in: 'fabric-dashboards', status: 'accepted_by_os' };
  }
  if (host.state !== 'not_installed') return fail(`host_${host.state}`);
  if (fallback === 'never') return fail('host_not_installed');
  let code: number;
  try { code = await deps.open(r.http); } catch { return fail('browser_open_failed'); }
  if (code !== 0) return fail('browser_open_failed');
  return { ...links, opened_in: 'browser', status: 'accepted_by_os', note: `${APP_NAME} is not installed; opened in the default browser` };
}
// #endregion strict-dashboard-open

// ── administration ──────────────────────────────────────────────────────────────────────

/** One health probe of `d`, with its token when it is a remote placement (DEC-0019). */
async function probe(deps: Deps, d: Descriptor): Promise<WellKnownResult> {
  if (d.placement !== 'remote') return deps.wellKnown(d.origin);
  let token: string;
  try {
    token = deps.token(d.auth.tokenFile);
  } catch (error) {
    throw new ToolError((error as Error).message);
  }
  return deps.wellKnown(d.origin, { headers: authHeaders(d, token) });
}

export async function control(deps: Deps, key: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; state: ServiceState; detail: string }> {
  if (!['start', 'stop', 'restart'].includes(action)) throw new ToolError('action is start, stop or restart');
  const entry = find(deps, key);
  const d = entry.descriptor;
  if (d.placement === 'remote') throw new ToolError(`${d.name} runs online and is supervised by its platform; it cannot be ${action}ed from here`);
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
  const answer = await probe(deps, d);
  if (answer.kind !== 'answer') throw new ToolError(`${d.name} does not answer: ${answer.detail}`);
  let token: string;
  try {
    token = deps.token(d.auth.tokenFile);
  } catch (error) {
    throw new ToolError((error as Error).message);
  }
  const n = Math.max(1, Math.min(100, Math.floor(limit)));
  const page = await deps.events(d, answer.doc.surfaces.events.path, token, null, n);
  return { events: page.events.slice(-n).map((e) => ({ at: e.at, level: e.level, text: e.text, ...(e.link && safePath(e.link) ? { link: linkFor(key, e.link) } : {}) })) };
}
