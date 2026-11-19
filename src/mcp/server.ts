// `fabric-dashboards-mcp`: the Model Context Protocol over stdio, one JSON-RPC message per line.
// Built on Node built-ins only, like the rest of the main process — the app ships no
// node_modules. Run by the app's own binary with ELECTRON_RUN_AS_NODE=1 (the packaged
// `Resources/bin/fabric-dashboards-mcp`), or by `node out/main/mcp/server.js` from a checkout.
// It listens on no port: an agent spawns it (docs/adr/0004-deep-links-and-mcp.md, SECURITY.md).
import fs from 'node:fs';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import { killOwned } from '../core/children';
import { removeMcpRegistrations } from '../core/uninstall';
import { setLoopbackConnectionCheck, setLoopbackOwnerCheck, setWindowsAclReader } from '@passioncode-ai/fabric-service-host';
import { linuxConnectionCheck, linuxLoopbackOwnerCheck, loopbackOwnerCheck, macConnectionCheck, windowsLoopbackOwnerCheck } from '../core/loopback-owner';
import { execRunner } from '../core/launchd';
import { ACTIONS_META, actionOf, decisionFor, decisionsFile, decisionUsed, recordDecision } from './actions';
import { HANDED_ENV, HANDOVER_RETRY_MS, HANDOVER_WAIT_MS, WAIT_ENV, launcherOf, liveHandover, REHAND_ENV, REHAND_EXIT, REHAND_MAX, REHAND_WINDOW_MS, startRelay, type Relay } from './handover';
import { codeFile, plistVersion, StaleWatch } from './stale';
import { appendMcpLog } from './mcp-log';
import * as tools from './tools';

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: 'fabric-dashboards', version: appVersion() };

/** FD-346: until this time an old tool name still runs its operation (sessions started before the two doors). */
export const OLD_NAMES_UNTIL = '2026-12-03T00:00:00Z';

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

import { INSTRUCTIONS, TOOLS } from './schema';
import { DOORS, EXECUTE_TOOL, gateOf, Idempotency, search, SEARCH_TOOL } from './doors';

/** FD-339: `execute`'s idempotency keys, for this server's life. */
const idempotency = new Idempotency();

export { TOOLS };

type Args = Record<string, unknown>;
type Schema = { properties?: Record<string, { type?: string; enum?: readonly string[]; minimum?: number; maximum?: number; maxLength?: number; maxItems?: number; items?: { maxLength?: number } }> };

/** T-9: an argument that is present must be what the schema declares; a wrong one is refused, never
 *  silently replaced by its default (a numeric path, a string limit, an empty service key). */
function wrongArgument(schema: Schema, args: Args): string | null {
  for (const [key, value] of Object.entries(args)) {
    const p = schema.properties?.[key];
    if (!p || value === undefined) continue;
    if (p.type === 'string' && typeof value !== 'string') return `${key} must be a string`;
    if (p.type === 'string' && key === 'service' && value === '') return 'service must be a service key, id.instance';
    if (p.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) return `${key} must be an integer`;
    if (typeof value === 'number' && ((p.minimum !== undefined && value < p.minimum) || (p.maximum !== undefined && value > p.maximum))) return `${key} must be between ${p.minimum} and ${p.maximum}`;
    if (p.enum && !p.enum.includes(value as string)) return `${key} must be one of ${p.enum.join(', ')}`;
    // S2-05 (2026-11-17 security audit): the limits the tool table advertises hold here too, not only in inner layers.
    if (p.type === 'string' && p.maxLength !== undefined && (value as string).length > p.maxLength) return `${key} must be at most ${p.maxLength} characters`;
    if (p.type === 'boolean' && typeof value !== 'boolean') return `${key} must be true or false`;
    if (p.type === 'array') {
      if (!Array.isArray(value)) return `${key} must be a list`;
      if (p.maxItems !== undefined && value.length > p.maxItems) return `${key} must have at most ${p.maxItems} items`;
      const most = p.items?.maxLength;
      if (most !== undefined && value.some((v) => typeof v !== 'string' || v.length > most)) return `${key} must hold strings of at most ${most} characters`;
    }
  }
  return null;
}
const str = (a: Args, k: string): string | undefined => (typeof a[k] === 'string' ? (a[k] as string) : undefined);

export async function call(deps: tools.Deps, name: string, args: Args, decision?: tools.RelayedDecision): Promise<unknown> {
  switch (name) {
    case 'host_status': return deps.host();
    case 'organizations': return tools.organizationsKnown(deps);
    case 'list_services': return tools.listServices(deps, Array.isArray(args.organizations) ? (args.organizations as unknown[]).filter((x): x is string => typeof x === 'string') : undefined);
    case 'service_status': return tools.serviceStatus(deps, need(args, 'service'));
    case 'link': return tools.link(deps, { service: str(args, 'service'), path: str(args, 'path'), url: str(args, 'url') });
    case 'open': {
      if (args.fallback !== undefined && args.fallback !== 'if_absent' && args.fallback !== 'never') throw new tools.ToolError('fallback must be if_absent or never');
      return tools.open(deps, { service: str(args, 'service'), path: str(args, 'path'), url: str(args, 'url') }, args.fallback as tools.Fallback | undefined);
    }
    case 'control': return tools.control(deps, need(args, 'service'), need(args, 'action') as 'start' | 'stop' | 'restart');
    case 'doctor': return tools.command(deps, need(args, 'service'), 'doctor');
    case 'update': return tools.command(deps, need(args, 'service'), 'update');
    case 'arrange': return tools.arrange(deps, need(args, 'service'), need(args, 'action') as tools.ArrangeAction);
    case 'rename': {
      if (args.name !== null && typeof args.name !== 'string') throw new tools.ToolError('name must be a string, or null for the agent\'s own name');
      return tools.rename(deps, need(args, 'service'), args.name as string | null);
    }
    case 'bugs': return tools.bugsList(deps, typeof args.limit === 'number' ? args.limit : 50);
    case 'agent_health': return tools.agentHealth(deps, typeof args.product === 'string' ? args.product : undefined);
    case 'bug_report': {
      const fp = need(args, 'fp');
      if (!/^[0-9a-f]{12}$/.test(fp)) throw new tools.ToolError('fp must be a fingerprint from bugs: 12 hex');
      return tools.bugReport(deps, fp, args.publish === true);
    }
    case 'consoles': return tools.consoles(deps);
    case 'this_machine': return tools.thisMachine(deps);
    case 'organization_join': return tools.organizationJoin(deps, typeof args.link === 'string' ? args.link : undefined, args.open === true);
    case 'sessions': {
      const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20) : undefined);
      return tools.sessions(deps, { machines: list(args.machines), groups: list(args.groups), origins: list(args.origins), ...(typeof args.query === 'string' ? { query: args.query.slice(0, 200) } : {}) });
    }
    case 'settings': return tools.settings(deps, args.patch as Record<string, unknown> | undefined);
    case 'session_action': {
      const act = need(args, 'act') as 'continue' | 'end' | 'dismiss' | 'clear-ended' | 'attach';
      const row = typeof args.row === 'string' ? args.row : undefined;
      if ((act === 'clear-ended') === Boolean(row)) throw new tools.ToolError(act === 'clear-ended' ? 'clear-ended takes no row' : `${act} needs the row`);
      return tools.sessionAction(deps, act, row, typeof args.account === 'string' ? args.account : undefined);
    }
    case 'app_update': return tools.appUpdate(deps, need(args, 'action') as 'check' | 'restart');
    case 'agent_connect': return tools.agentConnect(deps, need(args, 'link'));
    case 'console_choose': return tools.consoleChoose(deps, need(args, 'service'), { ...(typeof args.runtime === 'string' ? { runtime: args.runtime } : {}), ...(typeof args.folder === 'string' ? { folder: args.folder } : {}), ...(args.where === 'here' || args.where === 'there' ? { where: args.where } : {}), ...(args.clone === true ? { clone: true } : {}) });
    case 'app_install': return tools.appInstall(deps, need(args, 'action') as 'move-to-applications' | 'uninstall' | 'uninstall-all', need(args, 'confirm'));
    case 'console_new': return tools.consoleChannel(deps, { op: 'console.new', service: need(args, 'service'), ...(args.mode === 'continue' ? { mode: 'continue' as const } : {}) });
    case 'session_new': return tools.sessionNew(deps, {
      kind: args.kind === 'agent' ? 'agent' : args.kind === 'dashboard' ? 'dashboard' : args.kind === 'terminal' ? 'terminal' : 'session',
      ...(typeof args.runtime === 'string' ? { runtime: args.runtime } : {}), ...(typeof args.folder === 'string' ? { folder: args.folder } : {}),
      ...(typeof args.bypass === 'boolean' ? { bypass: args.bypass } : {}), ...(typeof args.isolated === 'boolean' ? { isolated: args.isolated } : {}),
      ...(typeof args.machine === 'string' ? { machine: args.machine } : {}),
    });
    case 'console_fix': return tools.consoleChannel(deps, { op: 'console.fix', service: need(args, 'service'), task: { kind: need(args, 'kind') as 'fix' | 'audit' | 'ask', output: need(args, 'findings') } });
    case 'service_context': {
      const k = str(args, 'key') || undefined;
      const s = str(args, 'service') || undefined;
      if (k && s && k !== s) throw new tools.ToolError('key and service name different services; give one');
      const key = k ?? s;
      if (!key) throw new tools.ToolError('key is required');
      return tools.serviceContext(deps, key);
    }
    case 'activity': return tools.activity(deps, need(args, 'service'), typeof args.limit === 'number' ? args.limit : 20);
    case 'connections': return tools.connections(deps, need(args, 'service'));
    // Wave 5b (FD-236 (3)): a slow read (a stuck agent, a loaded machine) ends in a typed error, never a call left open.
    case 'audit': return withDeadline(tools.auditAll(deps), AUDIT_DEADLINE_MS, 'audit');
    case 'setup_check': return tools.setupCheck(deps);
    case 'spend': return tools.spend(deps, str(args, 'service'));
    case 'spend_limit_set': return tools.spendLimitSet(deps, need(args, 'service'), {
      limitId: need(args, 'limitId'), reason: need(args, 'reason'),
      ...(typeof args.limitUsd === 'number' ? { limitUsd: args.limitUsd } : {}), ...(typeof args.enforced === 'boolean' ? { enforced: args.enforced } : {}),
    }, decision ?? null, typeof args.idempotencyKey === 'string' ? args.idempotencyKey : undefined, SERVER.version);
    case 'load': return tools.load(deps, need(args, 'service'));
    case 'access': return tools.access(deps, str(args, 'service') || undefined, SERVER.version);
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
  /** One operation through the checks every caller passes (M-2, MD-10): a whole JSON-RPC answer. */
  async function callTool(name: string, args: Args): Promise<Record<string, unknown>> {
      // M-2: an unknown tool is a protocol error, and arguments a tool does not declare are refused.
      const tool = TOOLS.find((x) => x.name === name);
      if (!tool) return fail(-32602, `unknown tool ${JSON.stringify(name)}`);
      const declared = Object.keys((tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {});
      const extra = Object.keys(args).filter((k) => !declared.includes(k));
      if (extra.length) return reply({ content: [{ type: 'text', text: `unknown argument ${JSON.stringify(extra[0])} for ${name}` }], isError: true });
      const wrong = wrongArgument(tool.inputSchema as Schema, args);
      if (wrong) return reply({ content: [{ type: 'text', text: `${wrong} for ${name}` }], isError: true });
      // FD-110 part 3 (MD-10): a relayed action records the operator's decision; an invalid one is refused, and a call
      // without one still runs as the caller's own act until the app can ask the person itself (src/mcp/actions.ts).
      const own = actionOf(name, args);
      let relayed: tools.RelayedDecision | undefined;
      if (own) {
        const meta = params._meta && typeof params._meta === 'object' ? params._meta as Record<string, unknown> : {};
        const target = typeof args.service === 'string' ? args.service : typeof args.row === 'string' ? args.row : null;
        const now = deps.now();
        const outcome = decisionFor(own, target, meta.decision, now, 'stdio');
        if (!outcome.ok) {
          const refusal = { code: outcome.code, message: outcome.message, action: own.id };
          return reply({ content: [{ type: 'text', text: JSON.stringify(refusal, null, 2) }], isError: true, structuredContent: refusal });
        }
        if (outcome.recordAs !== 'caller') {
          relayed = { by: 'operator', via: 'relayed-instruction', action: outcome.decision.action, instruction: outcome.decision.instruction, at: outcome.decision.at };
          const used = (deps.decisionUsed ?? ((d, t) => decisionUsed(decisionsFile(), d, t)))({ action: own.id, target, instruction: outcome.decision.instruction, at: outcome.decision.at }, now);
          if (used) {
            const refusal = { code: 'decision-used', message: `this decision of the operator already served an act at ${used}; a decision serves one act. Relay the operator's words for this one`, action: own.id };
            return reply({ content: [{ type: 'text', text: JSON.stringify(refusal, null, 2) }], isError: true, structuredContent: refusal });
          }
          try {
            (deps.recordDecision ?? ((row) => recordDecision(decisionsFile(), row)))({
              recordedAt: new Date(now).toISOString(), tool: name, action: own.id, target, ...outcome.recordAs,
              instruction: outcome.decision.instruction, decidedAt: outcome.decision.at,
            });
          } catch (error) {
            const refusal = { code: 'decision-not-recorded', message: `the operator's decision could not be recorded, so nothing was done: ${(error as Error).message}`, action: own.id };
            return reply({ content: [{ type: 'text', text: JSON.stringify(refusal, null, 2) }], isError: true, structuredContent: refusal });
          }
        }
      }
      try {
        const result = await call(deps, name, args, relayed);
        return reply({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (error) {
        // A refusal is a tool result the agent reads, not a protocol failure (MCP «isError»).
        const text = error instanceof tools.ToolError ? error.message : `internal error: ${(error as Error).message}`;
        return reply({ content: [{ type: 'text', text: error instanceof tools.ToolError && error.details ? JSON.stringify(error.details, null, 2) : text }], isError: true,
          ...(error instanceof tools.ToolError && error.details ? { structuredContent: error.details } : {}) });
      }
      }
  switch (method) {
    case 'initialize': {
      const asked = String(params.protocolVersion ?? '');
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
        _meta: ACTIONS_META, // FD-110 (DEC-0121 AP-1): this app's buttons and their tools; the app serves no well-known
      });
    }
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: DOORS }); // FD-339: two doors
    case 'tools/call': {
      const name = String(params.name ?? '');
      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Args;
      const refuse = (code: string, message: string) => reply({ content: [{ type: 'text', text: JSON.stringify({ code, message }, null, 2) }], isError: true, structuredContent: { code, message } });
      if (name === SEARCH_TOOL.name) {
        const wrong = wrongArgument(SEARCH_TOOL.inputSchema as Schema, args) ?? Object.keys(args).filter((k) => !['query', 'cursor', 'limit'].includes(k)).map((k) => `unknown argument ${JSON.stringify(k)}`)[0] ?? null;
        if (wrong) return refuse('invalid-arguments', `${wrong} for search`);
        const found = search(args);
        return reply({ content: [{ type: 'text', text: JSON.stringify(found, null, 2) }], structuredContent: found });
      }
      if (name === EXECUTE_TOOL.name) {
        const extra = Object.keys(args).filter((k) => !['operation', 'arguments', 'idempotencyKey'].includes(k));
        if (extra.length) return refuse('invalid-arguments', `unknown argument ${JSON.stringify(extra[0])} for execute`);
        const operation = typeof args.operation === 'string' ? args.operation : '';
        if (!TOOLS.some((t) => t.name === operation)) return refuse('unknown-operation', `no operation ${JSON.stringify(operation)}; search lists them`);
        if (args.arguments !== undefined && (typeof args.arguments !== 'object' || args.arguments === null || Array.isArray(args.arguments))) return refuse('invalid-arguments', 'arguments is an object');
        const inner = (args.arguments ?? {}) as Args;
        const key = typeof args.idempotencyKey === 'string' && args.idempotencyKey ? args.idempotencyKey : null;
        if (gateOf(operation) === 'relayed') {
          if (!key) return refuse('idempotency-required', `${operation} acts on another agent: give an idempotencyKey`);
          const seen = idempotency.check(key, operation, inner);
          if (seen.kind === 'conflict') return refuse('idempotency-conflict', 'this idempotencyKey served another call');
          if (seen.kind === 'repeat') return reply(seen.result);
          const result = await callTool(operation, inner);
          if (!(result as { result?: { isError?: boolean } }).result?.isError) idempotency.remember(key, operation, inner, (result as { result: Record<string, unknown> }).result);
          return result;
        }
        return callTool(operation, inner);
      }
      // FD-339: the old tool names were retired in 0.8.203 after one release beside the two doors. FD-346 (Fabric's
      // finding `2594a8c1`): a coding-agent session that started before then keeps the old list until it restarts, so
      // until OLD_NAMES_UNTIL an old name runs its operation again, as before the doors, unlisted, with a line naming the
      // execute call; after it, the call is refused with that door, so a client learns the new way in one answer.
      if (TOOLS.some((t) => t.name === name)) {
        const how = `call execute with {"operation": ${JSON.stringify(name)}, "arguments": {...}}`;
        if (deps.now() >= Date.parse(OLD_NAMES_UNTIL)) return refuse('retired-name', `${name} is now an operation: ${how}; search lists every operation`);
        const ran = await callTool(name, args) as { result?: { content?: unknown[] } };
        if (ran.result && Array.isArray(ran.result.content)) ran.result.content.push({ type: 'text', text: `${name} is an old name, answered until ${OLD_NAMES_UNTIL.slice(0, 10)}: ${how}.` });
        return ran;
      }
      return fail(-32602, `unknown tool ${JSON.stringify(name)}`);
    }
    default: return fail(-32601, `method not found: ${method}`);
  }
}

// #region session-lifecycle — docs: AGENTS.md#lifecycle
/** How often an idle server checks whether an update replaced its bundle (unref'd: never keeps it alive). */
export const STALE_CHECK_MS = 60_000;
export const STALE_ACTION = 'Fabric Dashboards was updated. Restart this agent session to load the new version.';
/** FD-350: what a call is told while its server waits for the installed copy to take the session. */
export const UPDATING_ACTION = 'Fabric Dashboards is installing an update and this session moves to the new version. Call again in a few seconds.';

/** The watch for the code this process was started from: Info.plist inside the app, else this file. */
function liveStaleWatch(from = __filename): StaleWatch {
  const file = codeFile(from);
  return new StaleWatch(file, () => (file.endsWith('Info.plist') ? plistVersion(file) : appVersion(path.dirname(from))));
}

export interface ServeOptions {
  /** Default: process.exit. Tests pass their own. */
  exit?: (code: number) => void;
  /** FD-347: where each event of the session is kept; default `mcp.log` beside `main.log` (none in a test run). */
  log?: ((line: string) => void) | null;
  watch?: StaleWatch | null;
  /** Exit on SIGTERM / SIGINT (default true for the real process). */
  signals?: boolean;
  /** FD-109 (4): starts the installed copy's server to take the session when this one is stale; null, or a function
   *  answering null, when nothing can take it (then the server answers stale and leaves, as before). */
  handover?: (() => ChildProcess | null) | null;
  /** FD-150: this server was handed its session by one that can start the next copy itself (REHAND_ENV); when it goes
   *  stale it exits with REHAND_EXIT, leaving its calls to be sent again, instead of answering stale. */
  rehand?: boolean;
  /** FD-350: how long a server that hands sessions over keeps trying when a hand-over fails, and how often; 0 gives up at
   *  once (a checkout, a copy that was handed a session itself). */
  waitMs?: number;
  retryMs?: number;
}

/**
 * The session loop (lifecycle LC-10). The server leaves with its session: stdin EOF or SIGTERM ends
 * every command it started (their whole process groups) and exits within a second, whatever is in
 * flight — nobody is left to read an answer. It does not keep running old code: once an update has
 * replaced the bundle and nothing is in flight, it hands the session to the installed copy's server
 * (FD-109: same connection, the new version answers) and only passes lines on; where nothing can take
 * it, a call is answered `stale` (both versions, what to do) and the process exits. An idle server
 * notices on an unref'd timer.
 */
export function serve(deps: tools.Deps = tools.liveDeps(), input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout, options: ServeOptions = {}): void {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const watch = options.watch === undefined ? liveStaleWatch() : options.watch;
  const handover = options.handover === undefined ? liveHandover(__filename) : options.handover;
  const rehand = options.rehand ?? process.env[REHAND_ENV] === '1';
  // FD-347: each event also goes to mcp.log (not from a test run, which sets NODE_TEST_CONTEXT, unless it asks).
  const keep = options.log === undefined ? (process.env.NODE_TEST_CONTEXT ? null : appendMcpLog) : options.log;
  const note = (text: string) => { process.stderr.write(`${text}\n`); keep?.(text); };
  keep?.(`fabric-dashboards-mcp ${watch?.runningVersion ?? appVersion()}: started${rehand ? ' (a fresh copy for a session handed over before)' : ''}`);
  const rehands: number[] = []; // FD-150: when each fresh copy was started after the first hand-over
  // FD-350: a failed hand-over is tried again rather than ending the session (the bundle may be mid-install, the new
  // copy slow to answer under load). Only the first server waits: a handed copy exits REHAND_EXIT to its relay.
  const envWait = Number(process.env[WAIT_ENV]);
  const waitMs = options.waitMs ?? (process.env[HANDED_ENV] === '1' || !launcherOf(__filename) ? 0 : Number.isFinite(envWait) && envWait >= 0 ? envWait : HANDOVER_WAIT_MS);
  const retryMs = options.retryMs ?? HANDOVER_RETRY_MS;
  let waitingSince: number | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let init: unknown = null; // the client's own initialize params, repeated to the server that takes the session
  let relay: Relay | null = null;
  let inFlight = 0;
  let unflushed = 0; // answers handed to stdout whose write has not completed (pipes are async on macOS)
  let leaving = false;
  const idle = () => inFlight === 0 && unflushed === 0;
  const leave = (why: string, code = 0) => {
    if (leaving) return;
    leaving = true;
    clearInterval(timer);
    if (retry) { clearTimeout(retry); retry = null; }
    const said = `fabric-dashboards-mcp ${watch?.runningVersion ?? appVersion()}: leaving (${why})`;
    process.stderr.write(`${said}\n`);
    keep?.(`${said}, exit ${code}`);
    // Up to 300 ms for calls already answering (an answer written just before EOF still lands), then
    // every owned group gets SIGTERM and SIGKILL 300 ms later. The exit is never later than 900 ms.
    const deadline = setTimeout(() => exit(code), 900);
    deadline.unref?.();
    const settled = new Promise<void>((resolve) => {
      const started = Date.now();
      const poll = () => (idle() || Date.now() - started >= 300 ? resolve() : void setTimeout(poll, 10).unref?.());
      poll();
    });
    void settled.then(() => killOwned(300)).finally(() => {
      const done = () => { clearTimeout(deadline); exit(code); };
      if (unflushed === 0) done();
      else output.write('', done); // the last answer reaches the pipe before the exit
    });
  };
  const staleAnswer = (id: unknown, s: { running: string; installed: string | null }) => {
    const details = { stale: true, running_version: s.running, installed_version: s.installed, action: STALE_ACTION };
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }], isError: true, structuredContent: details } };
  };
  // #region mcp-wait — docs: AGENTS.md#lifecycle
  const updatingAnswer = (id: unknown, s: { running: string; installed: string | null }) => {
    const details = { updating: true, running_version: s.running, installed_version: s.installed, retry_after_s: Math.max(1, Math.ceil(retryMs / 1000)), action: UPDATING_ACTION };
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }], isError: true, structuredContent: details } };
  };
  /** FD-350: the hand-over failed; keep the session, answer these calls "updating" and try again on a timer. False when
   *  this server does not wait (waitMs 0) or has waited its whole window: then it gives up as before. */
  const waitForCopy = (s: { running: string; installed: string | null }, why: string, lines: string[]): boolean => {
    if (waitMs <= 0 || leaving) return false;
    if (waitingSince === null) {
      waitingSince = Date.now();
      note(`fabric-dashboards-mcp ${s.running}: no copy took the session (${why}); trying again every ${Math.round(retryMs / 1000)} s for ${Math.round(waitMs / 60_000)} min`);
    } else if (Date.now() - waitingSince >= waitMs) return false;
    for (const q of lines) {
      let m: Message | null = null;
      try { m = JSON.parse(q) as Message; } catch { /* not an answerable call */ }
      if (m && m.id !== undefined && m.id !== null && m.method !== undefined) write(updatingAnswer(m.id, s));
    }
    if (!retry) {
      retry = setTimeout(tryAgain, retryMs);
      retry.unref?.();
    }
    return true;
  };
  const tryAgain = () => {
    retry = null;
    if (leaving || relay || waitingSince === null) return;
    const s = watch?.check() ?? { stale: true, running: appVersion(), installed: null };
    const since = waitingSince;
    if (handOver(s)) { note(`fabric-dashboards-mcp ${s.running}: an installed copy took the session after ${Math.round((Date.now() - since) / 1000)} s`); waitingSince = null; return; }
    if (Date.now() - since >= waitMs) { leave(`stale: no installed copy took the session in ${Math.round(waitMs / 60_000)} min`); return; }
    retry = setTimeout(tryAgain, retryMs);
    retry.unref?.();
  };
  // #endregion mcp-wait
  /** FD-109 (4): give the session to the installed copy's server. False when nothing can take it. `carry` are calls a
   *  previous copy took and did not answer (FD-150); they go to this one after its initialize. */
  const handOver = (s: { running: string; installed: string | null }, carry: string[] = []): boolean => {
    if (relay) return true;
    // Not held for answers still in flight or in the pipe: they reach the same output first, and JSON-RPC matches by id.
    if (leaving || !handover || init === null) return false;
    let child: ChildProcess | null;
    try { child = handover(); } catch { child = null; }
    if (!child) return false;
    clearInterval(timer);
    note(`fabric-dashboards-mcp ${s.running}: handing the session to the installed ${s.installed ?? 'copy'}`);
    const answerStale = (lines: string[]) => {
      for (const q of lines) {
        let m: Message | null = null;
        try { m = JSON.parse(q) as Message; } catch { /* not an answerable call */ }
        if (m && m.id !== undefined && m.id !== null && m.method !== undefined) write(staleAnswer(m.id, s));
      }
    };
    relay = startRelay({
      child, init, output,
      failed: (why, queued) => {
        note(`fabric-dashboards-mcp ${s.running}: hand-over failed (${why})`);
        relay = null;
        leaving = false;
        if (waitForCopy(s, why, queued)) return; // FD-350
        answerStale(queued);
        leave(`stale, and the hand-over failed: ${why}`);
      },
      done: (code) => { keep?.(`fabric-dashboards-mcp ${s.running}: the relay is over, exit ${code}`); void killOwned(300).finally(() => exit(code)); },
      // #region mcp-rehand — docs: AGENTS.md#lifecycle
      // FD-150: the copy behind the relay went stale (another update): start the copy installed now, from this process,
      // and send it the calls the old one left unanswered. A copy that keeps going stale at once ends the session.
      rehand: (pending) => {
        relay = null;
        const now = Date.now();
        while (rehands.length && now - rehands[0]! > REHAND_WINDOW_MS) rehands.shift();
        rehands.push(now);
        const next = watch?.check() ?? s;
        if (rehands.length > REHAND_MAX) {
          answerStale(pending);
          leave('stale: the installed copy kept going stale');
        } else if (!handOver(next, pending) && !waitForCopy(next, 'no copy took the session again', pending)) { // FD-350
          answerStale(pending);
          leave('stale, and no copy took the session again');
        }
      },
      // #endregion mcp-rehand
    });
    for (const line of carry) relay.send(line);
    return true;
  };
  const leaveIfStaleAndIdle = () => {
    if (inFlight !== 0 || relay) return;
    const s = watch?.check();
    if (s?.stale && !handOver(s) && !waitForCopy(s, 'no installed copy to start yet', [])) leave('stale: an update replaced the bundle', rehand ? REHAND_EXIT : 0);
  };
  const timer = setInterval(leaveIfStaleAndIdle, STALE_CHECK_MS);
  timer.unref?.();
  const write = (response: Record<string, unknown>, then?: () => void) => {
    unflushed += 1;
    output.write(`${JSON.stringify(response)}\n`, () => { unflushed -= 1; then?.(); });
  };
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    if (relay) { relay.send(line); return; }
    let message: Message;
    try {
      message = JSON.parse(line) as Message;
    } catch {
      if (!leaving) write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
      return;
    }
    // FD-85: a call is told it is stale even while the server leaves for that update (the previous call's end may have
    // seen the new bundle first); silence would leave the caller waiting on an answer that never comes.
    if (message.method === 'tools/call' && message.id !== undefined && message.id !== null && watch) {
      const s = watch.check();
      if (s.stale) {
        if (handOver(s)) { relay!.send(line); return; } // the new version answers this call
        if (rehand) { leave(`stale: running ${s.running}, the relay starts ${s.installed ?? 'the installed copy'}`, REHAND_EXIT); return; } // FD-150: sent again there
        if (waitForCopy(s, 'no installed copy to start yet', [line])) return; // FD-350: answered "updating", tried again
        write(staleAnswer(message.id, s), () => { if (inFlight === 0) leave(`stale: running ${s.running}, installed ${s.installed ?? 'unknown'}`); });
        return;
      }
    }
    if (leaving) return;
    if (message.method === 'initialize') init = message.params ?? {};
    inFlight += 1;
    void handle(deps, message)
      .then((response) => { if (response) write(response); })
      .catch((error) => { write({ jsonrpc: '2.0', id: message.id ?? null, error: { code: -32603, message: `internal error: ${(error as Error).message}` } }); })
      .finally(() => {
        inFlight -= 1;
        if (leaving || relay || inFlight !== 0 || message.method !== 'tools/call') return;
        const s = watch?.check();
        if (s?.stale && !handOver(s) && !waitForCopy(s, 'no installed copy to start yet', [])) leave('stale', rehand ? REHAND_EXIT : 0);
      });
  });
  rl.on('close', () => (relay ? relay.end() : leave('stdin closed')));
  if (options.signals ?? true) {
    process.once('SIGTERM', () => (relay ? relay.end() : leave('SIGTERM')));
    process.once('SIGINT', () => (relay ? relay.end() : leave('SIGINT')));
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
  // FD-94: the installed copy's compiled ACL reader sits beside the launcher (resources/bin), as in the app.
  const launcher = process.platform === 'win32' ? launcherOf(__filename) : null;
  const reader = launcher ? path.join(path.dirname(launcher), 'fabric-dashboards-acl.exe') : null;
  if (reader && fs.existsSync(reader)) {
    setWindowsAclReader(reader);
    setLoopbackOwnerCheck(windowsLoopbackOwnerCheck(execRunner, reader));
  }
  // FD-156, FD-159: as the app does, a token goes to 127.0.0.1 only when this user's own process listens there.
  // FD-168 (CT-254): and on the open connection itself, just before the token is written.
  if (process.platform === 'darwin' && typeof process.getuid === 'function') {
    setLoopbackOwnerCheck(loopbackOwnerCheck(execRunner, process.getuid()));
    setLoopbackConnectionCheck(macConnectionCheck(execRunner, process.getuid()));
  }
  if (process.platform === 'linux' && typeof process.getuid === 'function') {
    setLoopbackOwnerCheck(linuxLoopbackOwnerCheck((p) => fs.promises.readFile(p, 'utf8'), process.getuid()));
    setLoopbackConnectionCheck(linuxConnectionCheck((p) => fs.promises.readFile(p, 'utf8'), process.getuid()));
  }
  const code = cli(process.argv.slice(2));
  if (code === null) serve();
  else process.exitCode = code;
}

/** Wave 5b (FD-236 (3)): the whole `audit` answer in at most this long; each agent's own reads keep their deadlines. */
export const AUDIT_DEADLINE_MS = 90_000;

export function withDeadline<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const late = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new tools.ToolError(`${what} gave no answer within ${Math.round(ms / 1000)} s`, { code: 'timeout' })), ms); timer.unref?.(); });
  return Promise.race([p, late]).finally(() => { if (timer) clearTimeout(timer); });
}
