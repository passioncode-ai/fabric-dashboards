import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Launchd, type RunResult } from '../src/core/launchd';
import type { Descriptor, ServiceEvent, WellKnown, WellKnownResult } from '../src/core/types';
import { handle, serve, TOOLS } from '../src/mcp/server';
import type { StaleWatch } from '../src/mcp/stale';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { HANDOVER_ID, launcherOf } from '../src/mcp/handover';
import * as tools from '../src/mcp/tools';
import { tmp } from './helpers';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const DESCRIPTOR = fixture('positive_service-descriptor.json') as Descriptor;
const WELL_KNOWN = fixture('positive_service-well-known.json') as WellKnown;
const SECRET = 'tok-never-returned-7f3a';

interface World {
  deps: tools.Deps;
  calls: { launchctl: string[][]; open: string[]; run: string[][] };
  answers: WellKnownResult[];
}

function world(opts: { installed?: boolean; platform?: NodeJS.Platform; loaded?: boolean; answers?: WellKnownResult[]; descriptor?: Partial<Descriptor> } = {}): World {
  const dir = tmp('fd-mcp-');
  const d = { ...DESCRIPTOR, ...opts.descriptor };
  fs.writeFileSync(path.join(dir, `${d.id}.${d.instance}.json`), JSON.stringify(d));
  const calls = { launchctl: [] as string[][], open: [] as string[], run: [] as string[][] };
  const answers = opts.answers ?? [];
  const runner = async (command: string, args: string[]): Promise<RunResult> => {
    calls.launchctl.push([command, ...args]);
    if (args[0] === 'print') return opts.loaded === false ? { code: 113, stdout: '', stderr: 'Could not find service' } : { code: 0, stdout: 'pid = 51234\n', stderr: '' };
    if (args[0] === 'print-disabled') return { code: 0, stdout: '', stderr: '' };
    return { code: 0, stdout: '', stderr: '' };
  };
  let clock = 0;
  const deps: tools.Deps = {
    servicesDir: () => dir,
    wellKnown: async () => answers.length > 1 ? answers.shift()! : answers[0] ?? { kind: 'answer', doc: WELL_KNOWN, ms: 3 },
    launchd: new Launchd(runner, 501),
    open: async (target) => { calls.open.push(target); return 0; },
    host: async () => ({ state: opts.installed === false ? 'not_installed' : 'available', observed_at: '2026-10-01T00:00:00Z',
      application: opts.installed === false ? null : { id: 'ai.passioncode.fabric-dashboards', version: '0.3.1', path: '/Applications/Fabric Dashboards.app' } }),
    run: async (argv) => { calls.run.push(argv); return { code: 0, output: 'all good', timedOut: false }; },
    events: async (_d, eventsPath, token) => {
      assert.equal(eventsPath, '/fabric/v1/events');
      assert.equal(token, SECRET);
      const events: ServiceEvent[] = [
        { id: 'e1', at: '2026-09-29T10:00:00Z', kind: 'job.started', level: 'info', text: 'Job job_1 started', link: '/dashboard/job_1' },
        { id: 'e2', at: '2026-09-29T10:01:00Z', kind: 'job.done', level: 'notice', text: 'Job job_1 delivered' },
      ];
      return { events, cursor: null };
    },
    usage: async (_d, usagePath, token) => {
      assert.equal(usagePath, '/fabric/v1/usage');
      assert.equal(token, SECRET);
      return fixture('positive_service-usage.json');
    },
    token: () => SECRET,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    exists: () => true,
    platform: opts.platform ?? 'darwin',
  };
  return { deps, calls, answers };
}

const KEY = 'example-agent.default';

test('list_services shows the state, the dashboard and a deep link, and no token', async () => {
  const { deps } = world();
  const out = await tools.listServices(deps);
  assert.equal(out.services.length, 1);
  const s = out.services[0]!;
  assert.equal(s.key, KEY);
  assert.equal(s.product, 'example-agent', 'ADR-0012: the product is the id');
  assert.equal(s.state, 'degraded');
  assert.equal(s.version, '0.2.0');
  assert.equal(s.build, '8b80be9');
  assert.equal(s.dashboard, 'http://127.0.0.1:47195/dashboard');
  assert.equal(s.open_link, 'fabric-dashboards://service/example-agent.default?path=%2Fdashboard');
  assert.deepEqual(s.commands, ['doctor']);
  assert.equal(JSON.stringify(out).includes(SECRET), false);
});

test('DEC-0036 ED-9: list_services gives the dashboard\'s declared floor, null for a legacy or invalid declaration', async () => {
  assert.equal((await tools.listServices(world().deps)).services[0]!.dashboard_min_width, null);
  const declaring = (minWidth: unknown): WellKnownResult => ({ kind: 'answer', ms: 1, doc: { ...WELL_KNOWN, extensions: { 'https://fabric.passioncode.ai/agent-contract/extensions/dashboard/0.1': { minWidth } } } });
  assert.equal((await tools.listServices(world({ answers: [declaring(720)] }).deps)).services[0]!.dashboard_min_width, 720);
  assert.equal((await tools.listServices(world({ answers: [declaring(2000)] }).deps)).services[0]!.dashboard_min_width, null);
});

test('a service that does not answer is down, not starting', async () => {
  const { deps } = world({ answers: [{ kind: 'no-answer', detail: 'ECONNREFUSED' }] });
  assert.equal((await tools.serviceStatus(deps, KEY)).state, 'down');
  await assert.rejects(tools.serviceStatus(deps, 'nobody.default'), /no installed service/);
});

test('link turns a service URL or a key and path into the deep link, and opens nothing', async () => {
  const { deps, calls } = world();
  assert.deepEqual(await tools.link(deps, { url: 'http://127.0.0.1:47195/dashboard/job_1?tab=log' }), {
    service: KEY,
    open_link: 'fabric-dashboards://service/example-agent.default?path=%2Fdashboard%2Fjob_1%3Ftab%3Dlog',
    http_url: 'http://127.0.0.1:47195/dashboard/job_1?tab=log',
  });
  assert.equal((await tools.link(deps, { service: KEY, path: '/dashboard/job_2' })).http_url, 'http://127.0.0.1:47195/dashboard/job_2');
  await assert.rejects(tools.link(deps, { service: KEY, path: '//evil.example' }), /path must be/);
  await assert.rejects(tools.link(deps, { url: 'https://evil.example/' }), /local service/);
  await assert.rejects(tools.link(deps, {}), /service \(id.instance\) or url/);
  assert.deepEqual(calls.open, []);
});

test('open goes to the app when it is installed, to the browser when not and asked, and nowhere off macOS', async () => {
  const inApp = world();
  assert.equal((await tools.open(inApp.deps, { service: KEY, path: '/dashboard/job_1' })).opened_in, 'fabric-dashboards');
  assert.deepEqual(inApp.calls.open, ['fabric-dashboards://service/example-agent.default?path=%2Fdashboard%2Fjob_1']);

  const browser = world({ installed: false });
  const r = await tools.open(browser.deps, { service: KEY, path: '/dashboard/job_1' }, 'if_absent');
  assert.equal(r.opened_in, 'browser');
  assert.deepEqual(browser.calls.open, ['http://127.0.0.1:47195/dashboard/job_1']);

  const linux = world({ platform: 'linux' });
  assert.equal((await tools.open(linux.deps, { service: KEY })).opened_in, 'nothing');
  assert.deepEqual(linux.calls.open, []);
});

test('FD-109: open never falls back to a browser unless the caller asks for it, and the MCP schema says so', async () => {
  const absent = world({ installed: false });
  await assert.rejects(tools.open(absent.deps, { service: KEY }), /host_not_installed/);
  const out = await handle(absent.deps, { id: 1, method: 'tools/call', params: { name: 'open', arguments: { service: KEY } } });
  const result = out!.result as { isError: boolean; structuredContent: { status: string; opened_in: string; open_link: string } };
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.status, 'host_not_installed');
  assert.equal(result.structuredContent.opened_in, 'nothing');
  assert.equal(result.structuredContent.open_link, 'fabric-dashboards://service/example-agent.default');
  assert.deepEqual(absent.calls.open, []);
  const list = await handle(absent.deps, { id: 2, method: 'tools/list' });
  const openTool = (list!.result as { tools: { name: string; inputSchema: { properties: { fallback: { default: string } } } }[] }).tools.find((t) => t.name === 'open')!;
  assert.equal(openTool.inputSchema.properties.fallback.default, 'never');
});

test('FD-109: a page on a loopback port no descriptor names is refused with the step that registers it, never opened', async () => {
  const { deps, calls } = world({ installed: false });
  for (const url of ['http://127.0.0.1:9999/orders?id=1', 'https://agent.example.org/panel/']) {
    await assert.rejects(tools.open(deps, { url }, 'if_absent'), /register its agent with Fabric/);
    await assert.rejects(tools.link(deps, { url }), /register its agent with Fabric/);
  }
  assert.deepEqual(calls.open, []);
});

test('installed host open failure must not fall back to HTTP', async () => {
  const { deps, calls } = world();
  deps.open = async (target) => { calls.open.push(target); return 1; };
  await assert.rejects(tools.open(deps, { service: KEY }), /open_failed/);
  assert.deepEqual(calls.open, ['fabric-dashboards://service/example-agent.default']);
});

test('restart goes through launchd and waits for a new pid', async () => {
  const oldDoc = { kind: 'answer', doc: WELL_KNOWN, ms: 1 } as const;
  const newDoc = { kind: 'answer', doc: { ...WELL_KNOWN, process: { ...WELL_KNOWN.process, pid: 60000 } }, ms: 1 } as const;
  const { deps, calls } = world({ answers: [oldDoc, oldDoc, oldDoc, newDoc] });
  const r = await tools.control(deps, KEY, 'restart');
  assert.equal(r.ok, true);
  assert.match(r.detail, /pid 60000/);
  assert.ok(calls.launchctl.some((c) => c.join(' ') === 'launchctl kickstart -k gui/501/com.example.example-agent'));
});

test('stop disables the job and confirms nothing answers', async () => {
  const { deps, calls } = world({ loaded: false, answers: [{ kind: 'answer', doc: WELL_KNOWN, ms: 1 }, { kind: 'no-answer', detail: 'ECONNREFUSED' }] });
  const r = await tools.control(deps, KEY, 'stop');
  assert.deepEqual([r.ok, r.state], [true, 'stopped']);
  assert.ok(calls.launchctl.some((c) => c.join(' ') === 'launchctl disable gui/501/com.example.example-agent'));
});

test('control reports a timeout honestly and refuses a service launchd does not manage', async () => {
  const { deps } = world({ answers: [{ kind: 'answer', doc: WELL_KNOWN, ms: 1 }] });
  const r = await tools.control(deps, KEY, 'restart'); // the pid never changes
  assert.equal(r.ok, false);
  assert.match(r.detail, /within 40 s/);

  const unmanaged = world({ descriptor: { lifecycle: { manager: 'none' } } });
  await assert.rejects(tools.control(unmanaged.deps, KEY, 'stop'), /not managed by launchd/);
  await assert.rejects(tools.control(deps, KEY, 'reboot' as 'stop'), /start, stop or restart/);
});

test('doctor runs only the descriptor argv; an undeclared update is refused', async () => {
  const { deps, calls } = world();
  assert.deepEqual(await tools.command(deps, KEY, 'doctor'), { code: 0, output: 'all good', timed_out: false });
  assert.deepEqual(calls.run, [DESCRIPTOR.commands!.doctor]);
  await assert.rejects(tools.command(deps, KEY, 'update'), /declares no update command/);
});

test('activity reads the events with the local token, never returns it, and turns links into deep links', async () => {
  const { deps } = world();
  const out = await tools.activity(deps, KEY, 5);
  assert.equal(out.events.length, 2);
  assert.equal(out.events[0]!.link, 'fabric-dashboards://service/example-agent.default?path=%2Fdashboard%2Fjob_1');
  assert.equal(out.events[1]!.link, undefined);
  assert.equal(JSON.stringify(out).includes(SECRET), false);

  const down = world({ answers: [{ kind: 'no-answer', detail: 'ECONNREFUSED' }] });
  await assert.rejects(tools.activity(down.deps, KEY), /does not answer/);
});

test('the protocol: initialize, tools/list, a call, a refusal as isError, notifications get nothing', async () => {
  const { deps } = world();
  const init = await handle(deps, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal((init!.result as { protocolVersion: string }).protocolVersion, '2025-03-26');
  const unknownVersion = await handle(deps, { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal((unknownVersion!.result as { protocolVersion: string }).protocolVersion, '2025-06-18');

  const list = await handle(deps, { jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.deepEqual((list!.result as { tools: { name: string }[] }).tools.map((t) => t.name), TOOLS.map((t) => t.name));

  const ok = await handle(deps, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'link', arguments: { service: KEY } } });
  assert.equal((ok!.result as { structuredContent: { service: string } }).structuredContent.service, KEY);

  const refused = await handle(deps, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'control', arguments: { service: KEY } } });
  assert.deepEqual(refused!.result, { content: [{ type: 'text', text: 'action is required' }], isError: true });

  // M-2: an unknown tool is a JSON-RPC error (-32602); an undeclared argument is refused.
  const unknownTool = await handle(deps, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'rm_rf' } });
  assert.deepEqual(unknownTool!.error, { code: -32602, message: 'unknown tool "rm_rf"' });
  const extra = await handle(deps, { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'link', arguments: { service: KEY, evil: 1 } } });
  assert.deepEqual(extra!.result, { content: [{ type: 'text', text: 'unknown argument "evil" for link' }], isError: true });
  const doctor = TOOLS.find((x) => x.name === 'doctor')!;
  assert.equal((doctor.annotations as { readOnlyHint: boolean }).readOnlyHint, false, 'M-1: doctor runs a program; never auto-approved as read-only');

  assert.equal(await handle(deps, { jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.deepEqual((await handle(deps, { jsonrpc: '2.0', id: 7, method: 'nope' }))!.error, { code: -32601, message: 'method not found: nope' });
});

test('the server speaks newline-delimited JSON-RPC over stdio', async () => {
  const dir = tmp('fd-mcp-stdio-');
  const child = spawn(process.execPath, ['--import', 'tsx', path.join(__dirname, '../src/mcp/server.ts')], {
    env: { ...process.env, FABRIC_SERVICES_DIR: dir }, stdio: ['pipe', 'pipe', 'inherit'],
  });
  const lines: string[] = [];
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += String(chunk);
    let i: number;
    while ((i = buffer.indexOf('\n')) >= 0) { lines.push(buffer.slice(0, i)); buffer = buffer.slice(i + 1); }
  });
  child.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}\n');
  child.stdin.write('not json\n');
  child.stdin.write('{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_services","arguments":{}}}\n');
  const deadline = Date.now() + 15_000;
  while (lines.length < 3 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  child.kill();
  const replies = lines.map((l) => JSON.parse(l) as { id: number | null; result?: { serverInfo?: { name: string }; structuredContent?: { services: unknown[]; services_dir: string } }; error?: { code: number } });
  const byId = new Map(replies.map((r) => [r.id, r]));
  assert.equal(byId.get(1)!.result!.serverInfo!.name, 'fabric-dashboards');
  assert.equal((byId.get(1)!.result!.serverInfo as { version: string }).version, JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version);
  assert.equal(byId.get(null)!.error!.code, -32700);
  assert.deepEqual(byId.get(2)!.result!.structuredContent, { services: [], services_dir: dir });
});

test('an unreadable descriptor is listed with its problem and no link to open', async () => {
  const { deps } = world();
  fs.writeFileSync(path.join(deps.servicesDir(), 'Not_A_Key.json'), '{');
  const out = await tools.listServices(deps);
  const bad = out.services.find((s) => s.key === 'Not_A_Key')!;
  assert.equal(bad.state, 'invalid');
  assert.equal(bad.open_link, null, 'a link to it would only be refused');
  assert.match(bad.problems[0]!, /JSON/);
  assert.equal(out.services.find((s) => s.key === KEY)!.open_link, 'fabric-dashboards://service/example-agent.default?path=%2Fdashboard');
});

test('an event link that is not a path on the service gets no deep link, and the rest still come back', async () => {
  const { deps } = world();
  deps.events = async () => ({ cursor: null, events: [
    { id: 'e1', at: '2026-09-29T10:00:00Z', kind: 'x', level: 'info', text: 'odd', link: '/a\\b' },
    { id: 'e2', at: '2026-09-29T10:01:00Z', kind: 'x', level: 'info', text: 'fine', link: '/dashboard/job_2' },
  ] });
  const out = await tools.activity(deps, KEY, 5);
  assert.equal(out.events[0]!.link, undefined);
  assert.equal(out.events[1]!.link, 'fabric-dashboards://service/example-agent.default?path=%2Fdashboard%2Fjob_2');
});


test('host errors and never policy refuse before any browser open, including MCP bypass arguments', async () => {
  for (const state of ['unknown', 'incompatible', 'handler_mismatch', 'unsupported'] as const) {
    const { deps, calls } = world();
    deps.host = async () => ({ state, application: null, observed_at: '2026-10-01T00:00:00Z' });
    const out = await handle(deps, { id: 1, method: 'tools/call', params: { name: 'open', arguments: { service: KEY } } });
    const result = out!.result as { isError: boolean; structuredContent: { status: string; opened_in: string } };
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.status, `host_${state}`);
    assert.equal(result.structuredContent.opened_in, 'nothing');
    assert.deepEqual(calls.open, []);
  }
  const { deps, calls } = world({ installed: false });
  for (const fallback of ['never', 'always', 1, null]) {
    const out = await handle(deps, { id: 1, method: 'tools/call', params: { name: 'open', arguments: { service: KEY, fallback } } });
    assert.equal((out!.result as { isError: boolean }).isError, true);
  }
  assert.deepEqual(calls.open, []);
  deps.host = async () => { throw new Error('timeout'); };
  await assert.rejects(tools.open(deps, { service: KEY }), /host_unknown/);
  assert.deepEqual(calls.open, []);
});

test('open reports only OS acceptance; invalid targets are rejected before discovery/effects', async () => {
  const { deps, calls } = world();
  let discoveries = 0;
  const host = deps.host;
  deps.host = async () => { discoveries++; return host(); };
  const opened = await tools.open(deps, { service: KEY, path: '/dashboard?tab=jobs#details' }, 'never');
  assert.equal(opened.status, 'accepted_by_os');
  assert.equal(opened.opened_in, 'fabric-dashboards');
  assert.equal(opened.open_link, 'fabric-dashboards://service/example-agent.default?path=%2Fdashboard%3Ftab%3Djobs%23details');
  await assert.rejects(tools.open(deps, { service: KEY, path: '//elsewhere.example/' }));
  await assert.rejects(tools.open(deps, { service: 'missing.default' }));
  assert.equal(discoveries, 1);
  assert.equal(calls.open.length, 1);
  assert.deepEqual(calls.run, []);
  assert.deepEqual(calls.launchctl, []);
});

test('spend reads each service\'s own usage report and sums it; a service without one says so', async () => {
  const usageWk = fixture('positive_service-well-known-usage.json') as WellKnown;
  const { deps } = world({ answers: [{ kind: 'answer', doc: usageWk, ms: 3 }] });
  deps.now = () => Date.parse('2026-10-04T12:00:00Z');
  const out = await tools.spend(deps);
  assert.equal(out.services.length, 1);
  const e = out.services[0]!;
  assert.equal(e.product, 'example-agent');
  assert.equal(e.kind, 'report');
  if (e.kind !== 'report') return;
  assert.equal(e.summary.today.costUsd, 0.31);
  assert.equal(e.summary.today.partial, true, 'unpriced calls make a lower bound, not a zero');
  assert.equal(JSON.stringify(out).includes(SECRET), false);
  const plain = world();
  assert.equal((await tools.spend(plain.deps, KEY)).services[0]!.kind, 'none', 'no surfaces.usage: nothing to read');
  await assert.rejects(tools.spend(plain.deps, 'nobody.default'), /no installed service/);
});


test('M-3: start or restart with a missing plist is refused at once, as in the app', async () => {
  const { deps } = world();
  await assert.rejects(tools.control({ ...deps, exists: () => false }, KEY, 'restart'), /plist is missing/);
});

test('P-3: MCP spend of a service that does not answer is unknown (an error), never "not reporting"', async () => {
  const { deps } = world({ answers: [{ kind: 'no-answer', detail: 'connection refused' }] });
  const e = (await tools.spend(deps, KEY)).services[0]!;
  assert.equal(e.kind, 'error');
  assert.match((e as { error: string }).error, /spend is unknown/);
});

/** A command path that is absolute on this system and does not exist (FD-37). */
const MISSING = process.platform === 'win32' ? 'C:\\nonexistent\\x' : '/nonexistent/x';

test('M2-1…M2-3: instances are named apart, link without a target says what to give, a command that cannot start is a refusal', async () => {
  const preview = world({ descriptor: { instance: 'preview' }, answers: [{ kind: 'answer', doc: { ...WELL_KNOWN, service: { ...WELL_KNOWN.service, instance: 'preview' } }, ms: 3 }] });
  assert.equal((await tools.listServices(preview.deps)).services[0]!.name, 'Example Agent · preview');
  const { deps } = world({ descriptor: { commands: { update: [MISSING] } } });
  await assert.rejects(tools.link(deps, {}), /give service \(id\.instance\) or url/);
  deps.run = async () => ({ code: null, output: `spawn ${MISSING} ENOENT`, timedOut: false });
  await assert.rejects(tools.command(deps, KEY, 'update'), new RegExp(`update command could not run: spawn ${MISSING.replace(/[\\/]/g, '\\$&')} ENOENT`));
});

// ── third review pass T-1, T-4 ────────────────────────────────────────────────────────────

test('T-1: activity and dashboard links never use another program that answers on the port', async () => {
  const squatter: WellKnownResult = { kind: 'answer', ms: 2, doc: { ...WELL_KNOWN, service: { ...WELL_KNOWN.service, id: 'evil' }, surfaces: { ...WELL_KNOWN.surfaces, events: { path: '/steal' }, dashboard: { path: '/evil' } } } as WellKnown };
  const w = world({ answers: [squatter] });
  let fed = false;
  w.deps.events = async () => { fed = true; return { events: [], cursor: null }; };
  await assert.rejects(tools.activity(w.deps, KEY), /another program answers on its address/);
  assert.equal(fed, false, 'the token never goes to the squatter\'s events path');
  const l = await tools.link(w.deps, { service: KEY });
  assert.equal(l.http_url, `${DESCRIPTOR.origin}/`, 'the squatter\'s dashboard path is not used');
});

test('T-4: a remote origin that answered without the protocol gets no token on later calls', async () => {
  const remote = fixture('positive_service-descriptor-remote.json') as Descriptor;
  const w = world({ descriptor: remote });
  const sent: boolean[] = [];
  w.deps.wellKnown = async (_o, options) => { sent.push(Boolean(options?.headers)); return { kind: 'not-protocol', detail: 'HTTP 404 on /.well-known/fabric-service' }; };
  for (let i = 0; i < 3; i += 1) assert.equal((await tools.listServices(w.deps)).services[0]!.state, 'foreign');
  await assert.rejects(tools.activity(w.deps, `${remote.id}.${remote.instance}`));
  assert.deepEqual(sent, [true, false, false, false], 'only the first probe carried the token');
});

test('T-7: a stopped agent has unknown spend, never "not reporting"', async () => {
  const w = world({ loaded: false, answers: [{ kind: 'no-answer', detail: 'ECONNREFUSED' }] });
  const out = await tools.spend(w.deps, KEY);
  assert.equal(out.services[0]!.kind, 'error');
});

test('T-9: an argument of the wrong type is refused, never replaced by its default', async () => {
  const { deps } = world();
  for (const [name, args, text] of [
    ['link', { service: KEY, path: 123 }, /path must be a string/],
    ['activity', { service: KEY, limit: '5' }, /limit must be an integer/],
    ['activity', { service: KEY, limit: 500 }, /limit must be between 1 and 100/],
    ['spend', { service: 42 }, /service must be a string/],
    ['spend', { service: '' }, /service must be a service key/],
    ['open', { service: KEY, fallback: 'always' }, /fallback must be one of/],
  ] as const) {
    const r = await handle(deps, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) as { result: { isError?: boolean; content: { text: string }[] } };
    assert.equal(r.result.isError, true, `${name} ${JSON.stringify(args)}`);
    assert.match(r.result.content[0]!.text, text);
  }
});

// A descriptor's command must start with an absolute executable, and '/x/update' is not absolute on Windows (release run 38105334997 failed there on it).
const UPDATE_CMD = process.platform === 'win32' ? 'C:\\x\\update' : '/x/update';

test('FD-39 REQ-004: service_context hands a coding agent the live picture — state, reasons as sentences, repository, events — never the auth block', async () => {
  const { deps } = world({ descriptor: { source: { repository: 'https://github.com/example/agent' }, commands: { update: [UPDATE_CMD] } } });
  const c = await tools.serviceContext(deps, KEY);
  assert.equal(c.key, KEY);
  assert.equal(c.state, (await tools.serviceStatus(deps, KEY)).state, 'the same state service_status reads');
  assert.equal(c.repository, 'https://github.com/example/agent');
  assert.equal(c.can_update, true);
  assert.equal((c.descriptor as Record<string, unknown>).auth, undefined, 'the token file is not the agent\'s to read');
  assert.ok(!JSON.stringify(c).includes(SECRET), 'nor the token');
  assert.deepEqual((c.events as { text: string }[]).map((e) => e.text), ['Job job_1 started', 'Job job_1 delivered']);
  assert.equal(c.events_error, null);
  for (const r of c.reasons as string[]) assert.doesNotMatch(r, /^reason\./, 'sentences, not codes');
  const down = world({ answers: [{ kind: 'no-answer', detail: 'connection refused', cause: 'network' }] });
  const d = await tools.serviceContext(down.deps, KEY);
  assert.ok(!['ready', 'degraded'].includes(String(d.state)));
  assert.match(String(d.events_error), /does not answer/, 'a service that does not answer still gets its context, and says why there are no events');
  assert.ok(TOOLS.some((x) => x.name === 'service_context'));
});

test('FD-47 DEC-0042 SH-7: service_context takes the key a session handoff\'s first call passes, and returns the console\'s rules (SH-6)', async () => {
  const { deps } = world();
  const r = await handle(deps, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'service_context', arguments: { key: KEY } } }) as { result: { isError?: boolean; content: { text: string }[] } };
  assert.notEqual(r.result.isError, true, r.result.content[0]!.text);
  const c = JSON.parse(r.result.content[0]!.text) as { key: string; rules: string[] };
  assert.equal(c.key, KEY);
  assert.ok(c.rules.length >= 3 && c.rules.some((x) => /secret/i.test(x)), 'the rules live in the answer, not in the preamble');
  const old = await handle(deps, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'service_context', arguments: { service: KEY } } }) as { result: { isError?: boolean } };
  assert.notEqual(old.result.isError, true, 'service still works for older callers');
  const none = await handle(deps, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'service_context', arguments: {} } }) as { result: { isError?: boolean; content: { text: string }[] } };
  assert.equal(none.result.isError, true);
  assert.match(none.result.content[0]!.text, /key is required/);
  const both = await handle(deps, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'service_context', arguments: { key: KEY, service: 'other.default' } } }) as { result: { isError?: boolean; content: { text: string }[] } };
  assert.equal(both.result.isError, true, 'two different services is a mistake, not a choice');
  assert.match(both.result.content[0]!.text, /name different services/);
  const empty = await handle(deps, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'service_context', arguments: { key: '', service: KEY } } }) as { result: { isError?: boolean } };
  assert.notEqual(empty.result.isError, true, 'an empty key is no key: service is used');
});

test('every tool\'s input schema is one a model API accepts: an object with no anyOf, oneOf, allOf, not or enum at its top level (Claude Code drops such a tool silently)', () => {
  for (const t of TOOLS) {
    const s = t.inputSchema as Record<string, unknown>;
    assert.equal(s.type, 'object', t.name);
    for (const k of ['anyOf', 'oneOf', 'allOf', 'not', 'enum']) assert.ok(!(k in s), `${t.name} has ${k} at the top of its input schema`);
  }
});

// ── FD-78: how the app lists a service, and its connections ────────────────────────────────

test('FD-112: an instance\'s category is its product\'s section, as the app lists it; placement says where that instance runs', async () => {
  const w = world();
  const dir = w.deps.servicesDir();
  fs.writeFileSync(path.join(dir, 'example-agent.cloud.json'), JSON.stringify({
    protocol: 'fabric-service/0.1', id: 'example-agent', instance: 'cloud', name: 'Example Agent', placement: 'remote',
    origin: 'https://agent.example.com', auth: { tokenFile: '~/.never-read.token' }, lifecycle: { manager: 'none' },
    installedAt: '2026-10-02T18:00:00Z', installedBy: 'test',
  }));
  const services = (await tools.listServices(w.deps)).services;
  const local = services.find((x) => x.key === KEY)!;
  const cloud = services.find((x) => x.key === 'example-agent.cloud')!;
  assert.deepEqual([local.category, local.placement], ['local', 'local']);
  assert.deepEqual([cloud.category, cloud.placement], ['local', 'remote'], 'listed under its product, which runs on this Mac; placement remote');
});

test('FD-78: list_services says how the app lists each product, with the person\'s choices read from its settings', async () => {
  const w = world();
  const plain = (await tools.listServices(w.deps)).services[0]!;
  assert.deepEqual([plain.category, plain.hidden], ['local', false], 'a product with a dashboard on this Mac, nothing chosen');
  w.deps.listLayout = () => ({ hidden: ['example-agent'], kinds: { 'example-agent': 'service' } });
  const chosen = (await tools.listServices(w.deps)).services[0]!;
  assert.deepEqual([chosen.category, chosen.hidden], ['service', true]);
  assert.deepEqual([(await tools.serviceStatus(w.deps, KEY)).category], ['service']);
  const dir = tmp('fd-mcp-layout-');
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ layout: { list: { hidden: ['a', 'Bad!'], kinds: { a: 'service', b: 'x' } } } }));
  assert.deepEqual(tools.readListLayout(path.join(dir, 'settings.json')), { hidden: ['a'], kinds: { a: 'service' } });
  assert.equal(tools.readListLayout(path.join(dir, 'missing.json')), null, 'no settings: nothing chosen');
  assert.equal(tools.appSettingsFile('darwin', { FABRIC_DASHBOARDS_USER_DATA: '/x/app' }, '/h'), path.join('/x/app', 'settings.json'));
  assert.equal(tools.appSettingsFile('darwin', {}, '/h'), path.join('/h', 'Library', 'Application Support', 'Fabric Dashboards', 'settings.json'));
});

test('FD-78: connections answers the agent\'s graph with its spend report\'s models; an unknown key is refused', async () => {
  const usageWk = fixture('positive_service-well-known-usage.json') as WellKnown;
  const { deps } = world({ answers: [{ kind: 'answer', doc: usageWk, ms: 3 }] });
  deps.now = () => Date.parse('2026-10-04T12:00:00Z');
  const g = await tools.connections(deps, KEY);
  assert.equal(g.key, KEY);
  assert.equal(g.declared, false);
  assert.deepEqual(g.uses.filter((n) => n.source === 'usage').map((n) => n.label).sort(), ['claude-sonnet-5-5', 'google/gemini-3-flash', 'llama-4-8b'], 'the models of its usage report');
  assert.deepEqual(g.offers.surfaces, ['dashboard', 'mcp', 'events', 'usage']);
  await assert.rejects(tools.connections(deps, 'nobody.default'), /no installed service/);
  assert.ok(TOOLS.some((x) => x.name === 'connections' && x.annotations.readOnlyHint));
});

// ── FD-81: the auditor and Check setup through MCP ────────────────────────────────────────────

test('FD-81: audit answers the findings with the app\'s English sentence, the coverage and the map\'s edges', async () => {
  const { deps } = world();
  const a = await tools.auditAll(deps);
  assert.deepEqual(a.coverage, { agents: 1, declaring: 0 });
  assert.ok(a.findings.length > 0, 'the fixture reports a degraded part');
  for (const f of a.findings) {
    assert.equal(f.key, KEY);
    assert.ok(f.text && !f.text.startsWith('audit.'), `a sentence, not a code: ${f.text}`);
  }
  assert.deepEqual(a.edges, []);
  assert.ok(TOOLS.some((x) => x.name === 'audit' && x.annotations.readOnlyHint));
});

test('FD-81: setup_check runs the pinned read-only doctor and parses its report; no Node is said as such', async () => {
  const w = world();
  const ran: string[][] = [];
  w.deps.setupRun = async (cmd, args) => { ran.push([cmd, ...args]); return { code: 0, output: '', timedOut: false, stdout: JSON.stringify({ version: '0.2.2', ok: true, summary: { ok: 1, warn: 0, fail: 0, info: 0 }, checks: [{ id: 'node', area: 'prerequisites', product: null, state: 'ok', detail: 'Node 22', fix: null }] }) }; };
  const r = await tools.setupCheck(w.deps);
  assert.equal(r.kind, 'report');
  assert.ok(ran[0]!.join(' ').includes('@passioncode-ai/passioncode@'), 'the pinned launcher');
  assert.ok(!ran[0]!.includes('--fix'), 'never a repair');
  const t = TOOLS.find((x) => x.name === 'setup_check')!;
  assert.equal(t.annotations.readOnlyHint, false, 'it runs a program from npm: never auto-approved as read-only');
});

test('FD-85: a call that arrives while the server leaves for an update is answered stale, never left without an answer', async () => {
  // The race the nightly run met on ubuntu-24.04-arm: the first call's end already saw the new bundle and began to
  // leave, and the next call was dropped. Checks: 1 = call 1 arrives, 2 = call 1 ends (stale: leave), 3 = call 2.
  let checks = 0;
  const watch = { runningVersion: '1.0.0', check: () => { checks += 1; return { stale: checks >= 2, running: '1.0.0', installed: '1.1.0' }; } } as unknown as StaleWatch;
  const input = new PassThrough();
  const output = new PassThrough();
  const lines: { id: number; result?: { isError?: boolean; structuredContent?: { stale?: boolean } } }[] = [];
  let buffer = '';
  output.on('data', (chunk) => { buffer += String(chunk); let i: number; while ((i = buffer.indexOf('\n')) >= 0) { lines.push(JSON.parse(buffer.slice(0, i))); buffer = buffer.slice(i + 1); } });
  let exited: number | null = null;
  serve(world().deps, input, output, { exit: (code) => { exited = code; }, watch, signals: false });
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_services', arguments: {} } })}\n`);
  const until = async (ok: () => boolean) => { const end = Date.now() + 5000; while (!ok()) { assert.ok(Date.now() < end, 'in time'); await new Promise((r) => setTimeout(r, 5)); } };
  await until(() => lines.some((l) => l.id === 1) && checks >= 2);
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_services', arguments: {} } })}\n`);
  await until(() => lines.some((l) => l.id === 2));
  const two = lines.find((l) => l.id === 2)!;
  assert.equal(two.result!.isError, true);
  assert.equal(two.result!.structuredContent!.stale, true);
  await until(() => exited !== null);
  assert.equal(exited, 0, 'it still leaves');
});

// ── FD-109 (4): a stale server hands its session to the installed copy's server ─────────────

/** A stand-in for the new copy's server: answers initialize and tools/call as version 1.1.0, records what it read. */
function newServer(opts: { answers?: boolean } = {}) {
  const child = new EventEmitter() as ChildProcess & EventEmitter;
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  Object.assign(child, { stdin, stdout, kill: () => { child.emit('exit', null, 'SIGKILL'); return true; } });
  const read: Record<string, unknown>[] = [];
  let buffer = '';
  stdin.on('data', (chunk) => {
    buffer += String(chunk);
    let i: number;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const m = JSON.parse(buffer.slice(0, i)) as { id?: unknown; method?: string };
      buffer = buffer.slice(i + 1);
      read.push(m);
      if (opts.answers === false || m.id === undefined) continue;
      const result = m.method === 'initialize' ? { serverInfo: { name: 'fabric-dashboards', version: '1.1.0' } } : { content: [], answeredBy: '1.1.0' };
      stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: m.id, result })}\n`);
    }
  });
  stdin.on('finish', () => setImmediate(() => child.emit('exit', 0, null)));
  return { child, read };
}

function session(handover: () => ChildProcess | null, staleFrom = 2) {
  let checks = 0;
  const watch = { runningVersion: '1.0.0', check: () => { checks += 1; return { stale: checks >= staleFrom, running: '1.0.0', installed: '1.1.0' }; } } as unknown as StaleWatch;
  const input = new PassThrough();
  const output = new PassThrough();
  const lines: { id: unknown; result?: { isError?: boolean; answeredBy?: string; structuredContent?: { stale?: boolean }; serverInfo?: unknown } }[] = [];
  let buffer = '';
  output.on('data', (chunk) => { buffer += String(chunk); let i: number; while ((i = buffer.indexOf('\n')) >= 0) { lines.push(JSON.parse(buffer.slice(0, i))); buffer = buffer.slice(i + 1); } });
  let exited: number | null = null;
  serve(world().deps, input, output, { exit: (code) => { exited = code; }, watch, signals: false, handover });
  const send = (m: unknown) => input.write(`${JSON.stringify(m)}\n`);
  const until = async (ok: () => boolean) => { const end = Date.now() + 5000; while (!ok()) { assert.ok(Date.now() < end, 'in time'); await new Promise((r) => setTimeout(r, 5)); } };
  return { input, lines, send, until, exited: () => exited };
}

test('FD-109: after an update the stale server hands the session to the new copy, which answers the call; the client never sees stale', async () => {
  const fresh = newServer();
  let started = 0;
  const s = session(() => { started += 1; return fresh.child; }, 3);
  s.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'claude-code' } } });
  s.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  s.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_services', arguments: {} } });
  await s.until(() => s.lines.some((l) => l.id === 2));
  assert.equal(s.lines.find((l) => l.id === 2)!.result!.isError, undefined, 'the old code answers while it is current');
  s.send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_services', arguments: {} } });
  await s.until(() => s.lines.some((l) => l.id === 3));
  assert.equal(started, 1);
  assert.equal(s.lines.find((l) => l.id === 3)!.result!.answeredBy, '1.1.0', 'the new version answered');
  assert.ok(!s.lines.some((l) => l.id === HANDOVER_ID), 'the repeated initialize stays between the servers');
  assert.deepEqual(fresh.read.slice(0, 2).map((m) => (m as { method?: string }).method), ['initialize', 'notifications/initialized']);
  assert.deepEqual((fresh.read[0] as { params?: unknown }).params, { protocolVersion: '2025-06-18', clientInfo: { name: 'claude-code' } }, 'the client\'s own initialize');
  s.send({ jsonrpc: '2.0', id: 4, method: 'ping' });
  await s.until(() => s.lines.some((l) => l.id === 4));
  assert.equal(s.exited(), null, 'it keeps the session');
  s.input.end();
  await s.until(() => s.exited() !== null);
  assert.equal(s.exited(), 0, 'the client leaving ends both');
});

test('FD-109: an answer of the old code still in the pipe does not stop the hand-over', async () => {
  const fresh = newServer();
  const s = session(() => fresh.child, 1);
  s.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  s.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_services', arguments: {} } }); // right behind, unflushed
  await s.until(() => s.lines.some((l) => l.id === 2));
  assert.equal(s.lines.find((l) => l.id === 2)!.result!.answeredBy, '1.1.0');
  await s.until(() => s.lines.some((l) => l.id === 1)); // JSON-RPC matches by id; the old answer still arrives
});

test('FD-109: a hand-over the new copy does not take answers the waiting call stale and leaves, as before', async () => {
  const silent = newServer({ answers: false });
  const s = session(() => { setTimeout(() => silent.child.emit('exit', 1, null), 20); return silent.child; }, 1);
  s.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  s.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_services', arguments: {} } });
  await s.until(() => s.lines.some((l) => l.id === 2));
  assert.equal(s.lines.find((l) => l.id === 2)!.result!.structuredContent!.stale, true);
  await s.until(() => s.exited() !== null);
  assert.equal(s.exited(), 0);
});

test('FD-109: no hand-over without a launcher or before the client initialized; the launcher sits beside app.asar on every system', async () => {
  const s = session(() => null, 1);
  s.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  s.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_services', arguments: {} } });
  await s.until(() => s.lines.some((l) => l.id === 2));
  assert.equal(s.lines.find((l) => l.id === 2)!.result!.structuredContent!.stale, true);
  let asked = 0;
  const t = session(() => { asked += 1; return null; }, 1);
  t.send({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'list_services', arguments: {} } });
  await t.until(() => t.lines.some((l) => l.id === 9));
  assert.equal(asked, 0, 'a session that never initialized has nothing to repeat');
  assert.equal(launcherOf('/Applications/Fabric Dashboards.app/Contents/Resources/app.asar/out/main/mcp/server.js', 'darwin'), '/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp');
  assert.equal(launcherOf('C:\\Program Files\\Fabric Dashboards\\resources\\app.asar\\out\\main\\mcp\\server.js', 'win32'), 'C:\\Program Files\\Fabric Dashboards\\resources\\bin\\fabric-dashboards-mcp.cmd');
  assert.equal(launcherOf('/opt/Fabric Dashboards/resources/app.asar/out/main/mcp/server.js', 'linux'), '/opt/Fabric Dashboards/resources/bin/fabric-dashboards-mcp');
  assert.equal(launcherOf('/srv/checkout/fabric-dashboards/out/main/mcp/server.js', 'darwin'), null, 'a checkout has no installed copy to hand to');
});

// ── FD-93: how busy an agent is (DEC-0104) ───────────────────────────────────────────────────

test('FD-93: load reads the declared report with the token and answers its sums; no load declared answers none', async () => {
  const LOAD_KEY = 'https://fabric.passioncode.ai/agent-contract/extensions/load/0.1';
  const declaration = fixture('positive_service-load-extension.json');
  const wk = { ...WELL_KNOWN, extensions: { [LOAD_KEY]: declaration } } as WellKnown;
  const { deps } = world({ answers: [{ kind: 'answer', doc: wk, ms: 3 }] });
  deps.now = () => Date.parse('2026-10-22T11:06:00Z');
  let asked = '';
  deps.load = async (_d, loadPath, token) => { asked = loadPath; assert.equal(token, SECRET); return fixture('positive_service-load.json'); };
  const out = await tools.load(deps, KEY);
  assert.equal(asked, '/fabric/v1/load');
  assert.equal(out.kind, 'report');
  if (out.kind !== 'report') return;
  assert.deepEqual(out.declaration.limits, { concurrency: 4, perCaller: 2, queueMax: 50 });
  assert.deepEqual(out.summary.contexts.map((c) => c.context), ['personal', 'org:org_7kq2m4xw']);
  assert.ok(!JSON.stringify(out).includes(SECRET), 'never the token');
  const plain = world();
  assert.equal((await tools.load(plain.deps, KEY)).kind, 'none');
  await assert.rejects(tools.load(plain.deps, 'nobody.default'), /no installed service|not a service key|unknown/);
  assert.ok(TOOLS.some((x) => x.name === 'load' && x.annotations.readOnlyHint));
});

test('FD-93: a wrong declaration is reported and never read; a report that fails its checks is an error with the reason', async () => {
  const LOAD_KEY = 'https://fabric.passioncode.ai/agent-contract/extensions/load/0.1';
  const bad = fixture('semantic_service-well-known-load-invalid.json').input as WellKnown;
  const w = world({ answers: [{ kind: 'answer', doc: bad, ms: 3 }] });
  w.deps.load = async () => { throw new Error('must not be read'); };
  const invalid = await tools.load(w.deps, KEY);
  assert.equal(invalid.kind, 'invalid');
  if (invalid.kind === 'invalid') assert.ok(invalid.errors.some((e) => e.startsWith('/path')));
  const wk = { ...WELL_KNOWN, extensions: { [LOAD_KEY]: fixture('positive_service-load-extension.json') } } as WellKnown;
  const g = world({ answers: [{ kind: 'answer', doc: wk, ms: 3 }] });
  g.deps.load = async () => { const { UsageError } = await import('../src/core/probe'); throw new UsageError('the load report is malformed: x', { code: 'load.err.malformed', params: { problem: 'x' } }); };
  const err = await tools.load(g.deps, KEY);
  assert.equal(err.kind, 'error');
  if (err.kind === 'error') { assert.equal(err.reason.code, 'load.err.malformed'); assert.equal(err.declaration?.path, '/fabric/v1/load'); }
  const down = world({ answers: [{ kind: 'down', error: 'ECONNREFUSED', ms: 2 } as unknown as WellKnownResult] });
  const unknown = await tools.load(down.deps, KEY);
  assert.equal(unknown.kind, 'error', 'a service that does not answer has unknown load, never none');
});

// ── FD-110 part 3: this app's own actions (DEC-0121) and the operator's relayed decision (MD-10) ─────────────────────

test('FD-110: initialize declares this app\'s buttons; each has its tool on this surface, so the auditor finds nothing', async () => {
  const { actionsOf, ACTIONS_EXTENSION } = await import('@passioncode-ai/fabric-service-host/actions');
  const out = await handle(world().deps, { id: 1, method: 'initialize', params: {} });
  const meta = (out!.result as { _meta: Record<string, unknown> })._meta;
  const view = actionsOf({ surfaces: { mcp: { capabilities: TOOLS.map((t) => t.name) } }, extensions: meta });
  assert.equal(view.declared, true);
  assert.deepEqual(view.findings, []);
  assert.deepEqual(view.actions.filter((a) => a.gate === 'relayed').map((a) => a.id), ['start', 'stop', 'restart', 'update', 'new-session', 'fix-with-coding-agent']);
  assert.ok(ACTIONS_EXTENSION in meta);
});

test('FD-110 (MD-10): control without a decision still runs as the caller\'s act; a valid decision is recorded as the operator\'s', async () => {
  const at = new Date(Date.now() - 60_000).toISOString();
  const rows: Record<string, unknown>[] = [];
  const w = world();
  w.deps.now = () => Date.now();
  w.deps.recordDecision = (row) => rows.push(row);
  const plain = await handle(w.deps, { id: 1, method: 'tools/call', params: { name: 'control', arguments: { service: KEY, action: 'start' } } });
  assert.notEqual((plain!.result as { structuredContent?: { code?: string } }).structuredContent?.code, 'decision-invalid');
  assert.deepEqual(rows, [], 'nothing to record for the caller\'s own act');
  const ran = w.calls.launchctl.length;
  assert.ok(ran > 0, 'it ran');
  const decision = { by: 'operator', via: 'relayed-instruction', action: 'start', target: KEY, instruction: 'Agent: Start example-agent? Operator: yes', at };
  await handle(w.deps, { id: 2, method: 'tools/call', params: { name: 'control', arguments: { service: KEY, action: 'start' }, _meta: { decision } } });
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0], recordedAt: undefined }, { recordedAt: undefined, tool: 'control', action: 'start', target: KEY, by: 'operator', via: 'relayed-instruction', caller: 'stdio', instruction: decision.instruction, decidedAt: at });
  assert.ok(w.calls.launchctl.length > ran, 'and ran');
});

test('FD-110 (AP-2): an invalid decision, or one that cannot be recorded, is refused and nothing runs', async () => {
  const now = Date.now();
  const good = { by: 'operator', via: 'relayed-instruction', action: 'stop', instruction: 'stop it', at: new Date(now - 1000).toISOString() };
  const bad: [Record<string, unknown>, RegExp][] = [
    [{ ...good, action: 'restart' }, /for restart, not stop/],
    [{ ...good, target: 'other.default' }, /names other\.default/],
    [{ ...good, at: new Date(now - 25 * 3600_000).toISOString() }, /more than 24 hours/],
    [{ ...good, at: new Date(now + 5 * 60_000).toISOString() }, /future/],
    [{ ...good, by: 'agent' }, /operator/],
    [{ ...good, extra: 1 }, /carries extra/],
    [{ ...good, instruction: '' }, /instruction/],
  ];
  for (const [decision, why] of bad) {
    const w = world();
    w.deps.now = () => now;
    const out = await handle(w.deps, { id: 1, method: 'tools/call', params: { name: 'control', arguments: { service: KEY, action: 'stop' }, _meta: { decision } } });
    const r = out!.result as { isError: boolean; structuredContent: { code: string; message: string } };
    assert.equal(r.isError, true);
    assert.equal(r.structuredContent.code, 'decision-invalid');
    assert.match(r.structuredContent.message, why);
    assert.deepEqual(w.calls.launchctl, [], 'nothing ran');
  }
  const w = world();
  w.deps.now = () => now;
  w.deps.recordDecision = () => { throw new Error('disk full'); };
  const out = await handle(w.deps, { id: 1, method: 'tools/call', params: { name: 'update', arguments: { service: KEY }, _meta: { decision: { ...good, action: 'update' } } } });
  assert.equal((out!.result as { structuredContent: { code: string } }).structuredContent.code, 'decision-not-recorded');
  assert.deepEqual(w.calls.run, [], 'an act whose decision is not on record does not happen');
});

test('FD-110: the decisions file sits beside the app\'s log on every system', async () => {
  const { decisionsFile } = await import('../src/mcp/actions');
  assert.equal(decisionsFile('darwin', {}, '/h'), '/h/Library/Logs/Fabric Dashboards/decisions.jsonl', 'POSIX separators whatever system runs the test');
  assert.match(decisionsFile('linux', {}, '/home/x'), /fabric-dashboards[\\/]decisions\.jsonl$/);
  assert.match(decisionsFile('win32', { LOCALAPPDATA: 'C:\\L' }, 'C:\\Users\\x'), /Logs\\decisions\.jsonl$/);
});

// ── ADR-0025 (FD-120): the console's buttons through the app's channel ────────────────────────────────────────────

test('ADR-0025: console_new and console_fix reach the running app through its channel; with the app closed they say so and start nothing', { skip: process.platform === 'win32' && 'a Unix socket' }, async () => {
  const { openChannel } = await import('../src/electron/console-channel');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-chan-mcp-'));
  const w = world();
  w.deps.settingsFile = () => path.join(dir, 'settings.json');
  const closed = await handle(w.deps, { id: 1, method: 'tools/call', params: { name: 'console_new', arguments: { service: KEY } } });
  assert.equal((closed!.result as { isError: boolean }).isError, true);
  assert.match((closed!.result as { content: { text: string }[] }).content[0]!.text, /app-not-running/);
  const asked: unknown[] = [];
  const ch = await openChannel({ userData: dir, log: () => undefined, start: async (r) => { asked.push({ op: r.op, service: r.service, task: r.task }); return r.service === KEY ? { ok: true, consoleKey: r.service } : { ok: false, code: 'no-folder' }; } });
  try {
    const out = await handle(w.deps, { id: 2, method: 'tools/call', params: { name: 'console_fix', arguments: { service: KEY, kind: 'audit', findings: 'It relies on Relay, which does not answer.' } } });
    assert.deepEqual((out!.result as { structuredContent: unknown }).structuredContent, { started: true, console: KEY });
    assert.deepEqual(asked, [{ op: 'console.fix', service: KEY, task: { kind: 'audit', output: 'It relies on Relay, which does not answer.' } }]);
    const bad = await handle(w.deps, { id: 3, method: 'tools/call', params: { name: 'console_new', arguments: { service: KEY }, _meta: { decision: { by: 'operator', via: 'relayed-instruction', action: 'start', instruction: 'x', at: new Date().toISOString() } } } });
    assert.equal((bad!.result as { structuredContent: { code: string } }).structuredContent.code, 'decision-invalid', 'a decision for another action starts nothing');
    assert.equal(asked.length, 1);
  } finally {
    await ch!.close();
  }
});

test('FD-122: arrange writes the row menu\'s choices to the app\'s settings, once, and says the agent\'s list state', async () => {
  const w = world();
  const userData = tmp('fd-arrange-');
  const file = path.join(userData, 'settings.json');
  w.deps.settingsFile = () => file;
  const product = 'example-agent';
  const hidden = await tools.arrange(w.deps, KEY, 'hide');
  assert.deepEqual([hidden.product, hidden.hidden, hidden.changed], [product, true, true]);
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8')).layout.list;
  assert.deepEqual(read().hidden, [product]);
  assert.equal((await tools.arrange(w.deps, KEY, 'hide')).changed, false, 'a choice that holds changes nothing');
  assert.equal((await tools.arrange(w.deps, KEY, 'show')).hidden, false);
  assert.deepEqual((await tools.arrange(w.deps, KEY, 'pin')).pinned, true);
  assert.deepEqual(read().pinned, [product]);
  const asService = await tools.arrange(w.deps, KEY, 'as-service');
  assert.equal(asService.category, 'service');
  assert.equal((await tools.arrange(w.deps, KEY, 'as-agent')).category, 'local');
  assert.deepEqual(read().kinds, {}, 'choosing what the app guesses removes the choice');
  await assert.rejects(tools.arrange(w.deps, 'nobody.default', 'hide'), /no installed service/);
  await assert.rejects(tools.arrange(w.deps, KEY, 'delete' as never), /action must be one of/);
  w.deps.settingsFile = () => path.join(userData, 'never', 'settings.json');
  await assert.rejects(tools.arrange(w.deps, KEY, 'hide'), /open it once/);
});

test('FD-122: arrange is declared as six actions with no gate; the tool is listed', async () => {
  const { OWN_ACTIONS, actionOf } = await import('../src/mcp/actions');
  const ids = OWN_ACTIONS.filter((a) => a.tool === 'arrange').map((a) => `${a.id}:${a.gate}`);
  assert.deepEqual(ids, ['pin:none', 'unpin:none', 'hide:none', 'show:none', 'as-service:none', 'as-agent:none']);
  assert.equal(actionOf('arrange', { action: 'hide' })?.id, 'hide');
  assert.equal(actionOf('arrange', { action: 'nope' }), null);
  assert.ok(TOOLS.some((t) => t.name === 'arrange'));
});
