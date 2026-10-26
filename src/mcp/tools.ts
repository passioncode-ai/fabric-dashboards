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
  APP_NAME, dashboardMinWidth, expand, lookAtServices, readDirectory, servicesDir as defaultServicesDir,
  type Descriptor, type DescriptorEntry, type ServiceLook, type ServiceState, type WellKnownResult, authHeaders, portOf, RemoteTokenLatch, REMOTE_TIMEOUT_MS, type WellKnownOptions,
} from '@passioncode-ai/fabric-service-host';
import { runOwned } from '../core/children';
import { fromServiceUrl, isServiceKey, linkFor, safePath } from '../core/deeplink';
import { displayName } from '../core/names';
import { Launchd, execRunner, type Runner } from '../core/launchd';
import { fetchEvents, fetchLoad, fetchUsage, fetchWellKnown, PROBE_TIMEOUT_MS, readTokenAsync } from '../core/probe';
import { readLoad, type LoadEntry } from '../core/load';
import { readSpend, type SpendEntry } from '../core/spend';
import { categoryOf, groupProducts, productIdOf, type Category } from '../core/products';
import { buildGraph, chainState, stateOfService, worstOf, type ConnectionGraph } from '../core/connections';
import { audit as runAudit, type Finding } from '../core/audit';
import { estateMap, type EstateMap } from '../core/estate-map';
import { doctorArgv, doctorResult, DOCTOR_TIMEOUT_MS, type SetupCheckResult } from '../core/doctor';
import { merge as mergeSettings } from '../core/settings';
import { places } from '../core/platform';
import type { ListLayout, ServiceSnapshot } from '../core/types';
import os from 'node:os';
import path from 'node:path';
import { t as tr } from '../core/i18n';
import { continuedOf, liveAgents, recoveryOf, transcriptOf, verdictOf } from '../core/recovery';
import { findSwitchboard } from '../core/switchboard';
import { searchDirs } from '../core/runtimes';
import type { StopView } from '../core/types';

export const COMMAND_TIMEOUT_MS = 120_000;
import { CONTROL_TIMEOUT_MS, controlService } from '../core/control';
export { CONTROL_TIMEOUT_MS };

export interface Deps {
  /** FD-110 part 3: where a relayed operator decision is recorded; the live one appends to decisions.jsonl beside the log. */
  recordDecision?: (row: Record<string, unknown>) => void;
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
  /** FD-93: the load report's read (default fetchLoad). */
  load?: typeof fetchLoad;
  token: (tokenFile: string) => string | Promise<string>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  platform: NodeJS.Platform;
  /** Whether a file exists (the launchd plist before start/restart). Default: fs.existsSync. */
  exists?: (path: string) => boolean;
  /** S-2 for this server: one latch for the process's lifetime (T-4). Default: created on first use. */
  latch?: RemoteTokenLatch;
  /** FD-81: runs the launcher's read-only doctor (Check setup); default: the owned runner with this process's PATH. */
  setupRun?: (command: string, args: string[]) => Promise<{ code: number | null; output: string; timedOut: boolean; started?: boolean; stdout?: string; stderr?: string }>;
  /** FD-78: the person's kinds and hidden agents, read from the app's settings; null when there are none to read. */
  listLayout?: () => Pick<ListLayout, 'hidden' | 'kinds'> | null;
  /** FD-83: where Switchboard is (default: found on PATH and the installers' folders) and how its CLI, lsof and ps
   *  run (default: the plain runner). Tests pass both. */
  switchboard?: () => string | null;
  cli?: Runner;
  /** FD-84: whose transcripts a stopped session is looked for in (default the user's home). */
  home?: string;
}

/** FD-78: the app's settings file on this platform (read only; the app owns it). */
export function appSettingsFile(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  const dir = env.FABRIC_DASHBOARDS_USER_DATA || places(platform, env, home)?.userData || path.join(home, 'Library', 'Application Support', APP_NAME);
  return path.join(dir, 'settings.json');
}

/** The list choices the person made in the app, never written here; an unreadable file is "none". */
export function readListLayout(file: string): Pick<ListLayout, 'hidden' | 'kinds'> | null {
  try {
    const list = mergeSettings(JSON.parse(fs.readFileSync(file, 'utf8'))).layout.list;
    return { hidden: list.hidden, kinds: list.kinds };
  } catch {
    return null;
  }
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
    load: fetchLoad,
    token: readTokenAsync,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    platform: process.platform,
    latch: new RemoteTokenLatch(),
    listLayout: () => readListLayout(appSettingsFile()),
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
  /** DEC-0036 ED-9: the dashboard's declared floor in CSS pixels; null for a legacy dashboard (the host gives it 480). */
  dashboard_min_width: number | null;
  open_link: string | null;
  tiles: { label: string; value: number | string; attention?: boolean }[];
  update_available: string | null;
  commands: string[];
  problems: string[];
  /** FD-78: how the app lists its product: `local`, `online` or `service` (no dashboard of its own, or the person's
   *  choice), and whether the person hid it (still watched and alerting). */
  category: Category;
  hidden: boolean;
}

function view(s: ServiceLook, list?: { category: Category; hidden: boolean }): ServiceView {
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
    dashboard_min_width: dashboardMinWidth(wk),
    // A descriptor that cannot be read names no service a link could open.
    open_link: d && isServiceKey(s.key) ? linkFor(s.key, dashPath && safePath(dashPath) ? dashPath : undefined) : null,
    tiles: wk?.summary ?? [],
    update_available: wk?.update?.available ?? null,
    commands: Object.keys(d?.commands ?? {}),
    problems: s.problems,
    category: list?.category ?? (d?.placement === 'remote' ? 'online' : 'local'),
    hidden: list?.hidden ?? false,
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

/** FD-78: each look's section and hidden flag, as the app's list shows them (the person's choices win). */
function listing(looks: readonly ServiceLook[], layout: Pick<ListLayout, 'hidden' | 'kinds'> | null): (key: string) => { category: Category; hidden: boolean } {
  const products = groupProducts(looks.map(asSnapshot));
  return (key) => {
    const p = products.find((x) => x.members.some((m) => m.key === key))!;
    return { category: categoryOf(p, layout?.kinds), hidden: Boolean(layout?.hidden.includes(p.id)) };
  };
}

/** A look carries what product grouping reads; the fields only the app's monitor keeps are empty. */
const asSnapshot = (l: ServiceLook): ServiceSnapshot => ({ ...l, descriptorPath: l.path, dashboardMinWidth: null, firstUnansweredAt: null, lastAnswerAt: null, busy: null, lastAction: null, latestEvent: null, feedError: null } as unknown as ServiceSnapshot);

export async function listServices(deps: Deps): Promise<{ services: ServiceView[]; services_dir: string }> {
  const looks = await look(deps);
  const of = listing(looks, deps.listLayout?.() ?? null);
  return { services: looks.map((l) => view(l, of(l.key))), services_dir: deps.servicesDir() };
}

export async function serviceStatus(deps: Deps, key: string): Promise<ServiceView> {
  const looks = await look(deps);
  const one = looks.find((l) => l.key === key);
  if (!one) throw new ToolError(`no installed service ${JSON.stringify(key)}`);
  return view(one, listing(looks, deps.listLayout?.() ?? null)(key));
}

/** FD-78: what one agent is connected to, as its Connections tab shows it: who uses it, what it offers, what it uses
 *  (declared under extensions/connections/0.1, plus its spend report's models, its runner and the parts it reports),
 *  with the chain through the agents it reaches and the worst state anywhere in it. */
export async function connections(deps: Deps, key: string): Promise<ConnectionGraph & { key: string; state: ServiceState; worst: string }> {
  find(deps, key);
  const looks = await look(deps);
  const me = looks.find((l) => l.key === key);
  if (!me) throw new ToolError(`no installed service ${JSON.stringify(key)}`);
  let models: { provider: string; model: string; calls: number }[] = [];
  if (me.wellKnown?.surfaces.usage) {
    const [e] = await readSpend([me], { token: deps.token, fetchUsage: deps.usage, now: deps.now });
    if (e?.kind === 'report') models = e.summary.models.map((m) => ({ provider: m.provider, model: m.model, calls: m.calls }));
  }
  const g = buildGraph(me, looks, models);
  return { key, state: me.state, worst: worstOf(stateOfService(me.state), chainState(g.uses)), ...g };
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
/** FD-109 (operator 2026-10-24, Q-06): an agent page opens in this app or not at all; a browser only when the caller
 *  asks for `if_absent` and the host is confirmed `not_installed`. */
export async function open(deps: Deps, t: Target, fallback: Fallback = 'never'): Promise<{
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
  const before = d.placement === 'remote' ? null : await deps.wellKnown(d.origin);
  // FD-20: the sequence is src/core/control.ts's, shared with the app; here it becomes a result or a refusal.
  const out = await controlService(d, action, {
    platform: deps.platform, launchd: deps.launchd, wellKnown: (origin) => deps.wellKnown(origin), exists: deps.exists,
    now: deps.now, sleep: deps.sleep, pollMs: 500,
  }, { oldPid: before?.kind === 'answer' ? before.doc.process.pid : null });
  switch (out.kind) {
    case 'refused':
      if (out.why === 'remote') throw new ToolError(`${d.name} runs online and is supervised by its platform; it cannot be ${action}ed from here`);
      // ADR-0019 §7: launchd is macOS's; elsewhere the service is shown, never controlled, and the agent is told why.
      if (out.why === 'unsupervised-here') throw new ToolError(`${d.name} is supervised by launchd, which this system does not have; start and stop it on the system that runs it`);
      if (out.why === 'plist-missing') throw new ToolError(`${d.name}: the launchd plist is missing at ${out.plist}; reinstall the service`);
      throw new ToolError(`${d.name} is not managed by launchd; it cannot be ${action}ed from here`);
    case 'launchctl-failed':
      return { ok: false, state: (await serviceStatus(deps, key)).state, detail: out.detail };
    case 'stopped':
      return { ok: true, state: 'stopped', detail: `${d.name} stopped and stays off across logins` };
    case 'answered':
      return { ok: true, state: (await serviceStatus(deps, key)).state, detail: `${d.name} answers as pid ${out.pid}` };
    case 'stray-holds':
      return { ok: false, state: (await serviceStatus(deps, key)).state, detail: `${d.name}: a stray copy (pid ${out.pid}) still holds port ${out.port}` };
    case 'still-answering':
      return { ok: false, state: (await serviceStatus(deps, key)).state, detail: `${d.name} still answers ${CONTROL_TIMEOUT_MS / 1000} s after stop` };
    default:
      return { ok: false, state: (await serviceStatus(deps, key)).state, detail: `no expected answer within ${CONTROL_TIMEOUT_MS / 1000} s` };
  }
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

// #region agent-handoff — docs: docs/adr/0020-agents-first-handoff-and-setup.md#decision
/** FD-39 (ADR-0020): everything a coding agent needs about one service, read now — the live twin of the
 *  console's context.md. The descriptor's auth block is left out: the token is never the agent's to read. */
export async function serviceContext(deps: Deps, key: string): Promise<Record<string, unknown>> {
  const k = find(deps, key).key;
  const [l] = await look(deps, [k]);
  if (!l) throw new ToolError(`no service ${k}`);
  const d = l.descriptor;
  let descriptor: Record<string, unknown> | null = null;
  if (d) { const { auth: _auth, ...rest } = d as unknown as Record<string, unknown>; descriptor = rest; }
  let events: { at: string; level: string; text: string; link?: string }[] = [];
  let eventsError: string | null = null;
  try { events = (await activity(deps, k, 20)).events; } catch (error) { eventsError = (error as Error).message; }
  const v = view(l);
  return {
    key: k, name: v.name, summary: d?.summary ?? null, placement: v.placement, state: l.state,
    reasons: l.reasons.map((r) => tr('en', r.code, r.params)), problems: l.problems,
    version: v.version, update_available: v.update_available, can_update: Boolean(d?.commands?.update?.length),
    origin: v.origin, repository: d?.source?.repository ?? null, dashboard: v.dashboard, open_link: v.open_link,
    descriptor, events, events_error: eventsError,
    rules: CONSOLE_RULES,
  };
}

/** FD-47 (DEC-0042 SH-6): the rules for a console session live here, in the first call's answer, and nowhere
 *  in the preamble, so a session never works from a stale copy. */
export const CONSOLE_RULES: readonly string[] = [
  'Do the work yourself: run the commands, edit the files, check the result. The person watches the result in Fabric Dashboards.',
  'Ask the person only for a decision that is theirs, a sign-in in their browser, a consent, or a secret.',
  'A secret is typed by the person into a hidden prompt. Never print it, put it in an argument or a file you show, or ask for it in the chat.',
  'Confirm a fix with service_status before you say it is done.',
];
// #endregion agent-handoff

/** FD-81 (MCP parity with Settings → Check setup, SCN-070): the PassionCode launcher's read-only doctor at its pinned
 *  version, never `--fix`; `npx` from this process's PATH. The same parse as the app's. */
export async function setupCheck(deps: Deps): Promise<SetupCheckResult> {
  const sep = deps.platform === 'win32' ? ';' : ':';
  const name = deps.platform === 'win32' ? 'npx.cmd' : 'npx';
  const npx = (process.env.PATH ?? '').split(sep).filter(Boolean).map((d) => path.join(d, name)).find((f) => (deps.exists ?? fs.existsSync)(f));
  if (!npx && !deps.setupRun) return { kind: 'no-node' };
  const [cmd, args] = doctorArgv(npx ?? 'npx');
  const run = deps.setupRun ?? ((c: string, a: string[]) => runOwned(c, a, { timeoutMs: DOCTOR_TIMEOUT_MS }));
  return doctorResult(await run(cmd, args));
}

/** FD-81: the auditor over every installed agent, as the app's Connections map shows it: each finding with the agent
 *  to fix, its severity and the sentence the app shows (English), the declaring coverage, and the map's edges.
 *  Spending limits come from each agent's own usage report, read now. */
export async function auditAll(deps: Deps): Promise<{ findings: (Finding & { name: string; text: string })[]; counts: Record<string, number>; coverage: { agents: number; declaring: number }; edges: EstateMap['edges']; missing: string[]; limitStops: Awaited<ReturnType<typeof limitStops>> }> {
  const looks = await look(deps);
  const spendEntries = await readSpend(looks, { token: deps.token, fetchUsage: deps.usage, now: deps.now });
  const limits = Object.fromEntries(spendEntries.flatMap((e) => (e.kind === 'report' ? [[e.key, e.summary.limits]] : [])));
  const a = runAudit(looks, limits);
  const names = new Map(looks.map((l) => [l.key, l.descriptor ? displayName(l.descriptor.name, l.descriptor.instance) : l.key]));
  const map = estateMap(looks);
  return {
    findings: a.findings.map((f) => ({ ...f, name: names.get(f.key) ?? f.key, text: tr('en', f.reason.code, f.reason.params) })),
    counts: a.counts, coverage: a.coverage, edges: map.edges, missing: map.nodes.filter((n) => n.missing).map((n) => n.name),
    // FD-83: the Connections page lists these under the auditor; a read that fails says why, never an empty list.
    limitStops: await limitStops(deps).catch((error: Error) => ({ available: false, why: error.message, stops: [] })),
  };
}

// #region limit-recovery — docs: docs/ux/scenarios.md#scn-075-a-session-stopped-on-a-limit-continues-by-itself
/** FD-83: the coding sessions Switchboard holds as stopped on a usage limit and not yet continued, each with what the
 *  app would do with it (`resume`) or why it waits for a person. Read-only: this server never claims or starts one. */
export async function limitStops(deps: Deps, now = deps.now()): Promise<{ available: boolean; why?: string; stops: StopView[] }> {
  const sb = deps.switchboard ? deps.switchboard() : findSwitchboard(searchDirs((process.env.PATH ?? '').split(path.delimiter).filter(Boolean)));
  if (!sb) return { available: false, why: 'Switchboard is not installed', stops: [] };
  const run = deps.cli ?? execRunner;
  const r = await recoveryOf(run, sb);
  if ('unavailable' in r) return { available: false, why: r.unavailable === 'old' ? 'this Switchboard cannot list stopped sessions yet' : r.detail, stops: [] };
  const pending = r.stops; // parseRecovery keeps only open stops (R1-S2): a cancelled one is never "waiting"
  const live = pending.some((s) => s.ready) ? await liveAgents(run, deps.platform).catch(() => null) : null;
  const exists = (dir: string) => { try { return fs.statSync(dir).isDirectory(); } catch { return false; } };
  const home = deps.home ?? os.homedir();
  const continued = continuedOf(pending, home, now); // FIX-5: a stop whose session went on is not listed
  return { available: true, stops: pending.map((s) => ({ event: s.event, session: s.session, dir: s.dir, provider: s.provider, stoppedAt: s.stoppedAt, attempt: s.attempt, probeAt: s.probeAt, verdict: verdictOf(s, live, now, exists, (x) => transcriptOf(x, home), continued) })).filter((s) => s.verdict !== 'continued') };
}
// #endregion limit-recovery

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

// #region load-mcp — docs: docs/ux/scenarios.md#scn-076-see-how-busy-an-agent-is
/** FD-93: how busy one agent is, from its own load report (contract DEC-0104), as its Load tab shows it. A service that
 *  does not answer has unknown load: an error, never "not reporting" (as P-3 for spend). */
export async function load(deps: Deps, key: string): Promise<LoadEntry & { product: string }> {
  const [one] = await look(deps, [find(deps, key).key]);
  if (!one) throw new ToolError(`no installed service ${JSON.stringify(key)}`);
  if (one.descriptor && !one.wellKnown && !['invalid', 'conflict'].includes(one.state)) {
    const error = one.state === 'foreign' ? 'another program answers on its address, so its load is unknown' : `it does not answer now (${one.state}), so its load is unknown`;
    return { key: one.key, kind: 'error', declaration: null, error, reason: { code: 'load.err.unreachable', params: { error } }, product: productIdOf(one.key) };
  }
  const entry = await readLoad(one, { token: deps.token, fetchLoad: deps.load ?? fetchLoad, now: deps.now });
  return { ...entry, product: productIdOf(one.key) };
}
// #endregion load-mcp
