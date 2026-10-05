// `fabric-dashboards-mcp`: the Model Context Protocol over stdio, one JSON-RPC message per line.
// Built on Node built-ins only, like the rest of the main process — the app ships no
// node_modules. Run by the app's own binary with ELECTRON_RUN_AS_NODE=1 (the packaged
// `Resources/bin/fabric-dashboards-mcp`), or by `node out/main/mcp/server.js` from a checkout.
// It listens on no port: an agent spawns it (docs/adr/0004-deep-links-and-mcp.md, SECURITY.md).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { killOwned } from '../core/children';
import { removeMcpRegistrations } from '../core/uninstall';
import { codeFile, plistVersion, StaleWatch } from './stale';
import * as tools from './tools';

export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: 'fabric-dashboards', version: appVersion() };

/** The app's version, from the package.json above this file — in the checkout or inside app.asar. */
export function appVersion(from = __dirname): string {
  for (let dir = from; ; dir = path.dirname(dir)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name?: string; version?: string };
      if (pkg.name === 'fabric-dashboards' && pkg.version) return pkg.version;
    } catch { /* not here; keep climbing */ }
    if (path.dirname(dir) === dir) return '0.0.0';
  }
}

const INSTRUCTIONS = [
  'Fabric Dashboards watches the agent services of this Mac (fabric-service/0.1): local ones and',
  'online ones registered here (placement remote, an https origin supervised by its platform).',
  'Hand a person a link to what you started: `link` or `open` turn a service key (id.instance)',
  'and a path, or the service\'s own URL, into a fabric-dashboards:// link that',
  'opens that page inside the app, signed in. Return open_link as the primary dashboard link;',
  'http_url is for diagnostics or a confirmed-absent browser fallback. Never hand-build links',
  'or start another server/browser to show a registered dashboard. `host_status` checks this Mac.',
  '`open` uses the installed host; an installed host failure never falls back to the browser.',
  'Use fallback=never to forbid browser fallback even when absent. accepted_by_os is not page_ready.',
  'Links open on the device receiving them; remote chats need an addressed local open action.',
  '`control`, `doctor` and `update` are the operator\'s administration —',
  'say what you are about to do before calling them.',
].join(' ');

const serviceArg = { type: 'string', description: 'The service key, id.instance, as list_services names it' };
const pathArg = { type: 'string', description: 'A path on the service, starting with one / (for example /dashboard/job_1)' };
const urlArg = { type: 'string', description: 'The service\'s own URL — http://127.0.0.1:<port>/… for a local service, its registered https origin for an online one — instead of service + path' };

export const TOOLS = [
  {
    name: 'host_status',
    description: 'Read this machine’s Fabric Dashboards installation, version and protocol handler without opening anything. Unknown is not absent.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_services',
    description: 'Every installed service, local and online: its product (every instance of one id is one product), placement, state (ready, degraded, down, stopped…), version, dashboard URL, a fabric-dashboards:// link, tiles, pending update.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'service_status',
    description: 'One service\'s state and reasons, read now.',
    inputSchema: { type: 'object', properties: { service: serviceArg }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'link',
    description: 'Resolve a dashboard page. Give open_link as the primary action; http_url is diagnostic or confirmed-absent fallback. Opens nothing.',
    inputSchema: { type: 'object', properties: { service: serviceArg, path: pathArg, url: urlArg }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'open',
    description: 'Open in the existing Fabric Dashboards host. Browser fallback only for confirmed absence with if_absent; never after an installed host fails. The receipt proves OS dispatch, not page readiness.',
    inputSchema: { type: 'object', properties: { service: serviceArg, path: pathArg, url: urlArg, fallback: { type: 'string', enum: ['if_absent', 'never'], default: 'if_absent' } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'control',
    description: 'Start, stop or restart a local service through launchd, and wait for the expected answer. Stop keeps it off across logins. An online service is supervised by its platform and is refused.',
    inputSchema: {
      type: 'object',
      properties: { service: serviceArg, action: { type: 'string', enum: ['start', 'stop', 'restart'] } },
      required: ['service', 'action'], additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'doctor',
    description: 'Run the service\'s own doctor command (its descriptor declares it) and return its output. It runs a program the service ships: announce it first.',
    inputSchema: { type: 'object', properties: { service: serviceArg }, required: ['service'], additionalProperties: false },
    // M-1: it executes the descriptor's program, so a client must not auto-approve it as read-only.
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'update',
    description: 'Run the service\'s own update command (list_services shows update_available) and return its output. What the command does — install, restart — is the service\'s; call service_status afterwards to see the result.',
    inputSchema: { type: 'object', properties: { service: serviceArg }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'activity',
    description: 'The service\'s recent events as sentences, newest last; each with a link when it points at a page.',
    inputSchema: {
      type: 'object',
      properties: { service: serviceArg, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      required: ['service'], additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'spend',
    description: 'What each agent spent, from its own usage report (Fabric Agent Contract DEC-0021): today, the last 7 and 30 UTC days, per model, and its budget. costUsd null means unknown, never $0; partial: true means a lower bound. One service, or every one.',
    inputSchema: {
      type: 'object',
      properties: { service: { ...serviceArg, description: 'One service key (id.instance); omit for every service' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
] as const;

type Args = Record<string, unknown>;
const str = (a: Args, k: string): string | undefined => (typeof a[k] === 'string' ? (a[k] as string) : undefined);

export async function call(deps: tools.Deps, name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'host_status': return deps.host();
    case 'list_services': return tools.listServices(deps);
    case 'service_status': return tools.serviceStatus(deps, need(args, 'service'));
    case 'link': return tools.link(deps, { service: str(args, 'service'), path: str(args, 'path'), url: str(args, 'url') });
    case 'open': {
      if (args.fallback !== undefined && args.fallback !== 'if_absent' && args.fallback !== 'never') throw new tools.ToolError('fallback must be if_absent or never');
      return tools.open(deps, { service: str(args, 'service'), path: str(args, 'path'), url: str(args, 'url') }, args.fallback as tools.Fallback | undefined);
    }
    case 'control': return tools.control(deps, need(args, 'service'), need(args, 'action') as 'start' | 'stop' | 'restart');
    case 'doctor': return tools.command(deps, need(args, 'service'), 'doctor');
    case 'update': return tools.command(deps, need(args, 'service'), 'update');
    case 'activity': return tools.activity(deps, need(args, 'service'), typeof args.limit === 'number' ? args.limit : 20);
    case 'spend': return tools.spend(deps, str(args, 'service'));
    default: throw new tools.ToolError(`unknown tool ${JSON.stringify(name)}`);
  }
}

function need(args: Args, key: string): string {
  const value = str(args, key);
  if (!value) throw new tools.ToolError(`${key} is required`);
  return value;
}

interface Message { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

/** One request → its response (null for a notification). Pure over `deps`, so tests drive it. */
export async function handle(deps: tools.Deps, message: Message): Promise<Record<string, unknown> | null> {
  const { id, method, params = {} } = message;
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const fail = (code: number, text: string) => ({ jsonrpc: '2.0', id, error: { code, message: text } });
  if (id === undefined || id === null) return null; // a notification (initialized, cancelled…)
  switch (method) {
    case 'initialize': {
      const asked = String(params.protocolVersion ?? '');
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: TOOLS });
    case 'tools/call': {
      const name = String(params.name ?? '');
      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Args;
      // M-2: an unknown tool is a protocol error, and arguments a tool does not declare are refused.
      const tool = TOOLS.find((x) => x.name === name);
      if (!tool) return fail(-32602, `unknown tool ${JSON.stringify(name)}`);
      const declared = Object.keys((tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {});
      const extra = Object.keys(args).filter((k) => !declared.includes(k));
      if (extra.length) return reply({ content: [{ type: 'text', text: `unknown argument ${JSON.stringify(extra[0])} for ${name}` }], isError: true });
      try {
        const result = await call(deps, name, args);
        return reply({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (error) {
        // A refusal is a tool result the agent reads, not a protocol failure (MCP «isError»).
        const text = error instanceof tools.ToolError ? error.message : `internal error: ${(error as Error).message}`;
        return reply({ content: [{ type: 'text', text: error instanceof tools.ToolError && error.details ? JSON.stringify(error.details, null, 2) : text }], isError: true,
          ...(error instanceof tools.ToolError && error.details ? { structuredContent: error.details } : {}) });
      }
    }
    default: return fail(-32601, `method not found: ${method}`);
  }
}

// #region session-lifecycle — docs: AGENTS.md#lifecycle
/** How often an idle server checks whether an update replaced its bundle (unref'd: never keeps it alive). */
export const STALE_CHECK_MS = 60_000;
export const STALE_ACTION = 'Fabric Dashboards was updated. Restart this agent session to load the new version.';

/** The watch for the code this process was started from: Info.plist inside the app, else this file. */
export function liveStaleWatch(from = __filename): StaleWatch {
  const file = codeFile(from);
  return new StaleWatch(file, () => (file.endsWith('Info.plist') ? plistVersion(file) : appVersion(path.dirname(from))));
}

export interface ServeOptions {
  /** Default: process.exit. Tests pass their own. */
  exit?: (code: number) => void;
  watch?: StaleWatch | null;
  /** Exit on SIGTERM / SIGINT (default true for the real process). */
  signals?: boolean;
}

/**
 * The session loop (lifecycle LC-10). The server leaves with its session: stdin EOF or SIGTERM ends
 * every command it started (their whole process groups) and exits within a second, whatever is in
 * flight — nobody is left to read an answer. It leaves with its code: once an update has replaced
 * the bundle, a call is answered `stale` (both versions, what to do) and the process exits when
 * nothing is in flight; an idle server notices on an unref'd timer.
 */
export function serve(deps: tools.Deps = tools.liveDeps(), input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout, options: ServeOptions = {}): void {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const watch = options.watch === undefined ? liveStaleWatch() : options.watch;
  let inFlight = 0;
  let unflushed = 0; // answers handed to stdout whose write has not completed (pipes are async on macOS)
  let leaving = false;
  const idle = () => inFlight === 0 && unflushed === 0;
  const leave = (why: string) => {
    if (leaving) return;
    leaving = true;
    clearInterval(timer);
    process.stderr.write(`fabric-dashboards-mcp ${watch?.runningVersion ?? appVersion()}: leaving (${why})\n`);
    // Up to 300 ms for calls already answering (an answer written just before EOF still lands), then
    // every owned group gets SIGTERM and SIGKILL 300 ms later. The exit is never later than 900 ms.
    const deadline = setTimeout(() => exit(0), 900);
    deadline.unref?.();
    const settled = new Promise<void>((resolve) => {
      const started = Date.now();
      const poll = () => (idle() || Date.now() - started >= 300 ? resolve() : void setTimeout(poll, 10).unref?.());
      poll();
    });
    void settled.then(() => killOwned(300)).finally(() => {
      const done = () => { clearTimeout(deadline); exit(0); };
      if (unflushed === 0) done();
      else output.write('', done); // the last answer reaches the pipe before the exit
    });
  };
  const leaveIfStaleAndIdle = () => {
    if (inFlight === 0 && watch?.check().stale) leave('stale: an update replaced the bundle');
  };
  const timer = setInterval(leaveIfStaleAndIdle, STALE_CHECK_MS);
  timer.unref?.();
  const write = (response: Record<string, unknown>, then?: () => void) => {
    unflushed += 1;
    output.write(`${JSON.stringify(response)}\n`, () => { unflushed -= 1; then?.(); });
  };
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim() || leaving) return;
    let message: Message;
    try {
      message = JSON.parse(line) as Message;
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
      return;
    }
    if (message.method === 'tools/call' && message.id !== undefined && message.id !== null && watch) {
      const s = watch.check();
      if (s.stale) {
        const details = { stale: true, running_version: s.running, installed_version: s.installed, action: STALE_ACTION };
        write({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }], isError: true, structuredContent: details } },
          () => { if (inFlight === 0) leave(`stale: running ${s.running}, installed ${s.installed ?? 'unknown'}`); });
        return;
      }
    }
    inFlight += 1;
    void handle(deps, message)
      .then((response) => { if (response) write(response); })
      .catch((error) => { write({ jsonrpc: '2.0', id: message.id ?? null, error: { code: -32603, message: `internal error: ${(error as Error).message}` } }); })
      .finally(() => {
        inFlight -= 1;
        if (!leaving && inFlight === 0 && message.method === 'tools/call' && watch?.check().stale) leave('stale');
      });
  });
  rl.on('close', () => leave('stdin closed'));
  if (options.signals ?? true) {
    process.once('SIGTERM', () => leave('SIGTERM'));
    process.once('SIGINT', () => leave('SIGINT'));
  }
}

/** `fabric-dashboards-mcp --unregister`: remove this server from Claude Code's ~/.claude.json (LC-14). */
export function cli(argv: string[], out: (text: string) => void = (t) => process.stdout.write(t)): number | null {
  if (!argv.includes('--unregister')) return null;
  try {
    const r = removeMcpRegistrations();
    out(`${JSON.stringify({ ok: true, file: r.file, removed: r.removed })}\n`);
    return 0;
  } catch (error) {
    out(`${JSON.stringify({ ok: false, error: (error as Error).message })}\n`);
    return 1;
  }
}
// #endregion session-lifecycle

if (require.main === module) {
  const code = cli(process.argv.slice(2));
  if (code === null) serve();
  else process.exitCode = code;
}
