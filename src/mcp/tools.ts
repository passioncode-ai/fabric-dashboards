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
import { supervises } from '../core/platform';
import fs from 'node:fs';
import { discoverHost, type HostStatus } from './host';
import {
  APP_NAME, expand, lookAtServices, readDirectory, servicesDir as defaultServicesDir,
  type Descriptor, type DescriptorEntry, type ServiceLook, type ServiceState, type WellKnownResult, authHeaders, portOf, RemoteTokenLatch, REMOTE_TIMEOUT_MS, type WellKnownOptions,
} from '@passioncode-ai/fabric-service-host';
import { runOwned } from '../core/children';
import { fromServiceUrl, isServiceKey, linkFor, safePath } from '../core/deeplink';
import { displayName } from '../core/names';
import { Launchd, execRunner, type Runner } from '../core/launchd';
import { fetchEvents, fetchUsage, fetchWellKnown, PROBE_TIMEOUT_MS, readTokenAsync } from '../core/probe';
import { readSpend, type SpendEntry } from '../core/spend';
import { productIdOf } from '../core/products';

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
  run: (argv: string[], timeoutMs: number) => Promise<{ code: number | null; output: string; timedOut: boolean; started?: boolean; signal?: string | null }>;
  events: typeof fetchEvents;
  usage: typeof fetchUsage;
  token: (tokenFile: string) => string | Promise<string>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  platform: NodeJS.Platform;
  /** Whether a file exists (the launchd plist before start/restart). Default: fs.existsSync. */
  exists?: (path: string) => boolean;
  /** S-2 for this server: one latch for the process's lifetime (T-4). Default: created on first use. */
  latch?: RemoteTokenLatch;
}

const latchOf = (deps: Deps): RemoteTokenLatch => (deps.latch ??= new RemoteTokenLatch());

/** T-1: an answer is this service's only when it names this service; another program's document
 *  gets no token, and its paths are never used. */
const answersAs = (d: Descriptor, a: WellKnownResult): boolean =>
  a.kind === 'answer' && a.doc.service.id === d.id && a.doc.service.instance === d.instance;

/** A descriptor's own argv, in its own process group, without ELECTRON_RUN_AS_NODE or NODE_OPTIONS
 *  (this process runs Electron as Node); killed with its group on timeout or session end (LC-10). */
function runArgv(argv: string[], timeoutMs: number): ReturnType<Deps['run']> {
  const [cmd, ...args] = argv.map((a, i) => (i === 0 ? expand(a) : a));
  return runOwned(cmd!, args, { timeoutMs });
}

export function liveDeps(runner: Runner = execRunner): Deps {
  return {
    servicesDir: () => defaultServicesDir(),
    wellKnown: (origin, options) => fetchWellKnown(origin, portOf(origin) === null ? REMOTE_TIMEOUT_MS : PROBE_TIMEOUT_MS, options),
    launchd: new Launchd(runner),
    // The packaged MCP runs Electron as Node. LaunchServices inherits this flag
    // on a cold launch: open exits 0 while the GUI exits without making a window.
    // Strip it only in the dispatch child; never mutate the serving MCP process.
    open: async (target, application) => (await runner('/usr/bin/env', ['-u', 'ELECTRON_RUN_AS_NODE', '/usr/bin/open', ...(application ? ['-a', application, target] : [target])])).code,
    host: () => discoverHost(runner),
    run: runArgv,
    events: fetchEvents,
    usage: fetchUsage,
    token: readTokenAsync,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    platform: process.platform,
    latch: new RemoteTokenLatch(),
  };
}

export class ToolError extends Error {
  constructor(message: string, readonly details?: Record<string, unknown>) { super(message); }
}

// ── reading ─────────────────────────────────────────────────────────────────────────────

export interface ServiceView {
  key: string;
  /** ADR-0012: the product this service belongs to — its `id`; every instance of one id is one product. */
  product: string;
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
    product: productIdOf(s.key),
    name: d ? displayName(d.name, d.instance) : s.key, // M2-1: two instances never read alike (ADR-0010)
    placement: d?.placement === 'remote' ? 'remote' : 'local',
    state: s.state,
    reasons: s.reasons,
    version: wk?.service.version ?? null,
    build: wk?.service.build.commit ?? wk?.service.build.digest ?? null,
    origin: d?.origin ?? null,
    // S-4: only a path on the origin; `${origin}@evil/` would name another host.
    dashboard: d && dashPath && safePath(dashPath) ? new URL(dashPath, d.origin).toString() : null,
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
  const out = await lookAtServices({ servicesDir: deps.servicesDir(), wellKnown: deps.wellKnown, launchd: deps.launchd, now: deps.now, only, token: deps.token, latch: latchOf(deps) });
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
  if (!t.service) throw new ToolError('give service (id.instance) or url'); // M2-2: link and open share this
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
    const dash = answer.kind === 'answer' && answersAs(d, answer) ? answer.doc.surfaces.dashboard?.path : undefined;
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
    token = await deps.token(d.auth.tokenFile);
  } catch (error) {
    throw new ToolError((error as Error).message);
  }
  return latchOf(deps).probe(d, (withToken) => deps.wellKnown(d.origin, withToken ? { headers: authHeaders(d, token) } : undefined));
}

export async function control(deps: Deps, key: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; state: ServiceState; detail: string }> {
  if (!['start', 'stop', 'restart'].includes(action)) throw new ToolError('action is start, stop or restart');
  const entry = find(deps, key);
  const d = entry.descriptor;
  if (d.placement === 'remote') throw new ToolError(`${d.name} runs online and is supervised by its platform; it cannot be ${action}ed from here`);
  // ADR-0019 §7: launchd is macOS's; elsewhere the service is shown, never controlled, and the agent is told why.
  if (d.lifecycle.manager === 'launchd' && !supervises(deps.platform, d.lifecycle.manager)) {
    throw new ToolError(`${d.name} is supervised by launchd, which this system does not have; start and stop it on the system that runs it`);
  }
  if (d.lifecycle.manager !== 'launchd' || !d.lifecycle.label || !d.lifecycle.plist) {
    throw new ToolError(`${d.name} is not managed by launchd; it cannot be ${action}ed from here`);
  }
  const before = await deps.wellKnown(d.origin);
  const oldPid = before.kind === 'answer' ? before.doc.process.pid : null;
  const plist = expand(d.lifecycle.plist);
  // M-3: the same refusal as the app — a missing plist is said at once, not retried by bootstrap.
  if (action !== 'stop' && !(deps.exists ?? fs.existsSync)(plist)) throw new ToolError(`${d.name}: the launchd plist is missing at ${plist}; reinstall the service`);
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

export async function command(deps: Deps, key: string, which: 'doctor' | 'update'): Promise<{ code: number | null; output: string; timed_out: boolean; signal?: string }> {
  if (which !== 'doctor' && which !== 'update') throw new ToolError('command is doctor or update');
  const d = find(deps, key).descriptor;
  const argv = d.commands?.[which];
  if (!argv) throw new ToolError(`${d.name} declares no ${which} command`);
  const r = await deps.run(argv, COMMAND_TIMEOUT_MS);
  // M2-3: a command that never started is a refusal an agent reads as one, not a result with code null.
  // T-6: only a command that never started is a refusal; one ended by a signal returns its output and the signal.
  if (r.code === null && !r.timedOut && !r.signal && r.started !== true) throw new ToolError(`${d.name}: the ${which} command could not run: ${r.output.trim().split('\n').pop() ?? ''}`);
  return { code: r.code, output: r.output.slice(-20_000), timed_out: r.timedOut, ...(r.signal ? { signal: r.signal } : {}) };
}

export async function activity(deps: Deps, key: string, limit = 20): Promise<{ events: { at: string; level: string; text: string; link?: string }[] }> {
  const d = find(deps, key).descriptor;
  const answer = await probe(deps, d);
  if (answer.kind !== 'answer') throw new ToolError(`${d.name} does not answer: ${answer.detail}`);
  if (!answersAs(d, answer)) throw new ToolError(`${d.name}: another program answers on its address (as ${answer.doc.service.id}.${answer.doc.service.instance}); its activity is not read and no token is sent`);
  let token: string;
  try {
    token = await deps.token(d.auth.tokenFile);
  } catch (error) {
    throw new ToolError((error as Error).message);
  }
  const n = Math.max(1, Math.min(100, Math.floor(limit)));
  let page: Awaited<ReturnType<Deps['events']>>;
  try {
    page = await deps.events(d, answer.doc.surfaces.events.path, token, null, n);
  } catch (error) {
    throw new ToolError(`${d.name}: the events feed could not be read: ${(error as Error).message}`); // M-2: a refusal, not "internal error"
  }
  const linkOf = (path: string) => { try { return linkFor(key, path); } catch { return undefined; } };
  return { events: page.events.slice(-n).map((e) => { const link = e.link && safePath(e.link) ? linkOf(e.link) : undefined; return { at: e.at, level: e.level, text: e.text, ...(link ? { link } : {}) }; }) };
}

/** What each agent spent, from its own usage report (contract DEC-0021, ADR-0013); one service or all.
 *  A cost of null is unknown, never $0; `partial` marks a lower bound. */
export async function spend(deps: Deps, key?: string): Promise<{ services: (SpendEntry & { product: string })[] }> {
  const looks = await look(deps, key ? [find(deps, key).key] : undefined);
  const entries = await readSpend(looks, { token: deps.token, fetchUsage: deps.usage, now: deps.now });
  // P-3 (D-1 for MCP): this server keeps no memory of what a service declared, so a service that
  // does not answer, or whose address another program answers, has unknown spend — an error, never
  // "not reporting", so an agent never adds it up as $0.
  const unknown = new Map(looks.filter((l) => l.descriptor && !l.wellKnown && !['invalid', 'conflict'].includes(l.state)).map((l) => [l.key, l.state]));
  return {
    services: entries.map((e) => {
      const state = unknown.get(e.key);
      const out: SpendEntry = e.kind === 'none' && state
        ? state === 'foreign'
          ? { key: e.key, kind: 'error', error: 'another program answers on its address, so its spend is unknown', reason: { code: 'spend.err.foreign' } }
          : { key: e.key, kind: 'error', error: `it does not answer now (${state}), so its spend is unknown`, reason: { code: 'spend.err.notAnswering' } }
        : e;
      return { ...out, product: productIdOf(e.key) };
    }),
  };
}

