import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { Launchd, type RunResult } from '../src/core/launchd';
import type { Descriptor, ServiceEvent, WellKnown, WellKnownResult } from '../src/core/types';
import { handle, TOOLS } from '../src/mcp/server';
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

test('open goes to the app when it is installed, to the browser when not, and nowhere off macOS', async () => {
  const inApp = world();
  assert.equal((await tools.open(inApp.deps, { service: KEY, path: '/dashboard/job_1' })).opened_in, 'fabric-dashboards');
  assert.deepEqual(inApp.calls.open, ['fabric-dashboards://service/example-agent.default?path=%2Fdashboard%2Fjob_1']);

  const browser = world({ installed: false });
  const r = await tools.open(browser.deps, { service: KEY, path: '/dashboard/job_1' });
  assert.equal(r.opened_in, 'browser');
  assert.deepEqual(browser.calls.open, ['http://127.0.0.1:47195/dashboard/job_1']);

  const linux = world({ platform: 'linux' });
  assert.equal((await tools.open(linux.deps, { service: KEY })).opened_in, 'nothing');
  assert.deepEqual(linux.calls.open, []);
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
  await assert.rejects(tools.command(deps, KEY, 'update'), /update command could not run: spawn \/nonexistent\/x ENOENT/);
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
