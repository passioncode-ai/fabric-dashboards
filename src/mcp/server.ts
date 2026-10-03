// `fabric-dashboards-mcp`: the Model Context Protocol over stdio, one JSON-RPC message per line.
// Built on Node built-ins only, like the rest of the main process — the app ships no
// node_modules. Run by the app's own binary with ELECTRON_RUN_AS_NODE=1 (the packaged
// `Resources/bin/fabric-dashboards-mcp`), or by `node out/main/mcp/server.js` from a checkout.
// It listens on no port: an agent spawns it (docs/adr/0004-deep-links-and-mcp.md, SECURITY.md).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
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
    description: 'Every installed service, local and online: placement, state (ready, degraded, down, stopped…), version, dashboard URL, a fabric-dashboards:// link, tiles, pending update.',
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
    description: 'Run the service\'s own doctor command (its descriptor declares it) and return its output.',
    inputSchema: { type: 'object', properties: { service: serviceArg }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'update',
    description: 'Run the service\'s own update command (list_services shows update_available). Restarts the service onto the new code.',
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

export function serve(deps: tools.Deps = tools.liveDeps(), input = process.stdin, output = process.stdout): void {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let message: Message;
    try {
      message = JSON.parse(line) as Message;
    } catch {
      output.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })}\n`);
      return;
    }
    void handle(deps, message).then((response) => {
      if (response) output.write(`${JSON.stringify(response)}\n`);
    });
  });
}

if (require.main === module) serve();
