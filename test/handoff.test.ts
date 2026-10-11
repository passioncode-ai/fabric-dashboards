// FD-39 / ADR-0020: a console starts knowing the Fabric agent it was opened for.
import assert from 'node:assert/strict';
import test from 'node:test';
import { brief, contextMarkdown, firstPrompt, fixTask, handoffArgs, handoffContext, mcpConfig, taskMarkdown, updateTask } from '../src/core/handoff';
import type { ActivityItem, ServiceSnapshot } from '../src/core/types';

const SECRET_PATH = '/Users/me/.config/runner/service.token';

function snap(over: Partial<ServiceSnapshot> = {}): ServiceSnapshot {
  return {
    key: 'runner.dev', descriptorPath: '/x/runner.dev.json',
    descriptor: {
      protocol: 'fabric-service/0.1', id: 'runner', instance: 'dev', name: 'Runner', summary: 'Runs things', origin: 'http://127.0.0.1:47301',
      auth: { tokenFile: SECRET_PATH, header: 'X-Runner-Token' }, lifecycle: { manager: 'launchd', label: 'ai.example.runner' },
      paths: { data: '~/runner', logs: ['~/runner/log.txt'] }, commands: { update: ['~/runner/bin/update'] }, source: { repository: 'https://github.com/example/runner' },
      installedAt: '2026-10-01T00:00:00Z', installedBy: 'test',
    },
    problems: [], state: 'down', reasons: [{ code: 'reason.down' }],
    wellKnown: null, launchd: { managed: true, loaded: true, pid: null, disabled: false },
    firstUnansweredAt: '2026-10-10T10:00:00Z', lastAnswerAt: '2026-10-10T09:55:00Z', busy: null,
    lastAction: null, latestEvent: null, feedError: null,
    ...over,
  } as ServiceSnapshot;
}

const ev = (at: string, level: ActivityItem['level'], text: string, serviceKey = 'runner.dev'): ActivityItem =>
  ({ id: at, at, kind: 'x', level, text, serviceKey, serviceName: 'Runner', source: 'service' });

test('FD-39 REQ-001: the context names the agent, its state and why, its repository and folder — and never its token', () => {
  const c = handoffContext(snap(), [], '/Users/me/DATA/runner');
  assert.equal(c.key, 'runner.dev');
  assert.equal(c.state, 'down');
  assert.equal(c.reasons.length, 1);
  assert.ok(c.reasons[0]!.length > 0 && !c.reasons[0]!.startsWith('reason.'), 'reasons are sentences, not codes');
  assert.equal(c.repository, 'https://github.com/example/runner');
  assert.equal(c.folder, '/Users/me/DATA/runner');
  assert.equal(c.canUpdate, true);
  assert.equal((c.descriptor as Record<string, unknown>).auth, undefined, 'the auth block is left out');
  const md = contextMarkdown(c, '2026-10-10T12:00:00Z');
  assert.ok(!md.includes(SECRET_PATH), 'the token file path never reaches the agent');
  assert.ok(!md.includes('X-Runner-Token'), 'nor the header that carries it');
  for (const s of ['# Runner (runner.dev)', '**State:** down', 'https://github.com/example/runner', '/Users/me/DATA/runner', 'service_context', '"id": "runner"']) assert.ok(md.includes(s), s);
});

test('FD-39 REQ-001: recent events are this agent\'s, newest first, and warnings survive a flood of info rows', () => {
  const rows = [
    ev('2026-10-10T09:00:00Z', 'error', 'database locked'),
    ...Array.from({ length: 50 }, (_, i) => ev(`2026-10-10T10:${String(i).padStart(2, '0')}:00Z`, 'info', `tick ${i}`)),
    ev('2026-10-10T11:00:00Z', 'info', 'other agent', 'other.default'),
  ];
  const c = handoffContext(snap(), rows, null, 'en', 20);
  assert.equal(c.events.length, 20);
  assert.ok(c.events.some((e) => e.text === 'database locked'), 'the error is kept');
  assert.ok(!c.events.some((e) => e.text === 'other agent'), 'only this agent');
  assert.deepEqual([...c.events].sort((a, b) => (a.at < b.at ? 1 : -1)), c.events, 'newest first');
});

test('FD-39 REQ-002: Claude gets the MCP config and the brief before its first turn; nothing bare follows --mcp-config', () => {
  const server = { command: '/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp', args: [] };
  const a = handoffArgs('claude-code', { mcp: '/data/consoles/runner.dev/mcp.json', mcpServer: server, brief: 'B', prompt: 'P' });
  assert.deepEqual(a.before, ['--mcp-config=/data/consoles/runner.dev/mcp.json', '--append-system-prompt', 'B']);
  assert.deepEqual(a.after, ['P']);
  assert.ok(!a.before.includes('--mcp-config'), 'the joined form: nothing after it can be read as another config (Switchboard SB-94, measured on the CLI)');
  const none = handoffArgs('claude-code', { mcp: 'm', mcpServer: server, brief: 'B', prompt: null });
  assert.deepEqual(none.after, [], 'no task: the agent waits for the person');
});

test('FD-39 REQ-002: Codex gets the MCP server as -c overrides before its subcommand, and a first prompt; Gemini gets -i; others the env path only', () => {
  const server = { command: '/x/electron', args: ['/x/out/main/mcp/server.js'], env: { ELECTRON_RUN_AS_NODE: '1' } };
  const c = handoffArgs('codex', { mcp: 'm', mcpServer: server, brief: 'B', prompt: 'P' });
  assert.deepEqual(c.before, ['-c', 'mcp_servers.fabric-dashboards.command="/x/electron"', '-c', 'mcp_servers.fabric-dashboards.args=["/x/out/main/mcp/server.js"]', '-c', 'mcp_servers.fabric-dashboards.env.ELECTRON_RUN_AS_NODE="1"']);
  assert.deepEqual(c.after, ['P']);
  assert.deepEqual(handoffArgs('gemini-cli', { mcp: 'm', mcpServer: server, brief: 'B', prompt: 'P' }).after, ['-i', 'P']);
  assert.deepEqual(handoffArgs('aider', { mcp: 'm', mcpServer: server, brief: 'B', prompt: 'P' }), { before: [], after: [], env: {} });
});

test('FD-39 REQ-003: every argument fits Switchboard\'s in-place limits (≤ 1024 characters, ≤ 16 after --)', () => {
  const long = snap({ descriptor: { ...snap().descriptor!, name: 'N'.repeat(2000) } });
  const c = handoffContext(long, [], null);
  const files = { context: `/Users/${'u'.repeat(60)}/Library/Application Support/Fabric Dashboards/consoles/runner.dev/context.md`, task: `/Users/${'u'.repeat(60)}/Library/Application Support/Fabric Dashboards/consoles/runner.dev/task.md` };
  const b = brief(c, files);
  assert.ok(b.length <= 1000, `brief ${b.length}`);
  const a = handoffArgs('claude-code', { mcp: files.context, mcpServer: { command: 'x', args: [] }, brief: b, prompt: firstPrompt(files) });
  const all = [...a.before, '--continue', ...a.after];
  assert.ok(all.length <= 16);
  for (const arg of all) assert.ok(arg.length <= 1024, `${arg.length}: ${arg.slice(0, 40)}`);
});

test('FD-39 REQ-005/006: a fix task names the problem and what fixed means; an update task says how to update', () => {
  const c = handoffContext(snap(), [], null);
  const fix = fixTask(c);
  assert.equal(fix.kind, 'fix');
  assert.match(fix.title, /Runner is down/);
  assert.match(fix.body, /service_status/);
  assert.match(fix.body, /hidden prompt/);
  assert.match(taskMarkdown(fix), /^# Task: Runner is down/);
  const withCmd = updateTask({ ...c, updateAvailable: '2.0.0', version: '1.0.0' }, null);
  assert.match(withCmd.title, /Update Runner to 2\.0\.0/);
  assert.match(withCmd.body, /MCP tool `update`/);
  const failed = updateTask({ ...c, updateAvailable: '2.0.0' }, 'npm ERR! 404');
  assert.match(failed.body, /npm ERR! 404/);
  const noCmd = updateTask({ ...c, canUpdate: false }, null);
  assert.match(noCmd.body, /no `update` command/);
});

test('FD-39 REQ-001: mcp.json starts this app\'s MCP server, with its env when it runs as Node', () => {
  const j = JSON.parse(mcpConfig({ command: '/x/electron', args: ['/x/server.js'], env: { ELECTRON_RUN_AS_NODE: '1' } }));
  assert.deepEqual(j, { mcpServers: { 'fabric-dashboards': { type: 'stdio', command: '/x/electron', args: ['/x/server.js'], env: { ELECTRON_RUN_AS_NODE: '1' } } } });
  assert.equal(JSON.parse(mcpConfig({ command: '/l', args: [] })).mcpServers['fabric-dashboards'].env, undefined);
});

test('FD-39 REQ-001: the pack is written whole, owner-only, outside the repository, and an old task does not linger', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { tmp } = await import('./helpers');
  const { writePack } = await import('../src/core/handoff');
  const dir = path.join(tmp('fd-pack-'), 'consoles', 'runner.dev');
  const first = writePack(dir, { context: 'C', task: 'T', mcp: '{}' });
  assert.equal(fs.readFileSync(first.context, 'utf8'), 'C');
  assert.equal(fs.readFileSync(first.task!, 'utf8'), 'T');
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
    for (const f of [first.context, first.task!, first.mcp]) assert.equal(fs.statSync(f).mode & 0o777, 0o600, f);
  }
  const second = writePack(dir, { context: 'C2', task: null, mcp: '{}' });
  assert.equal(second.task, null);
  assert.equal(fs.existsSync(path.join(dir, 'task.md')), false, 'a plain start after a Fix start carries no stale task');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['context.md', 'mcp.json'], 'no temporary file left');
});

test('FD-39 REQ-003 (Switchboard SB-94): a bound folder carries the pack after --, each argument an option or its value, no bare value after --mcp-config', async () => {
  const { planStart } = await import('../src/core/consoles');
  const runtime = { id: 'claude-code', name: 'Claude Code', binary: 'claude', provider: 'claude' as const, continueArgs: ['--continue'], path: '/bin/claude' };
  const h = handoffArgs('claude-code', { mcp: '/d/mcp.json', mcpServer: { command: 'x', args: [] }, brief: 'B', prompt: null });
  const p = planStart({ runtime, mode: 'continue', folder: '/w', binding: { kind: 'project', name: 'P', pool: 'p' }, switchboard: '/bin/switchboard', inPlace: true, handoff: h });
  assert.equal(p.kind, 'run');
  const argv = (p as { argv: string[] }).argv;
  const after = argv.slice(argv.indexOf('--') + 1);
  assert.deepEqual(after, ['--mcp-config=/d/mcp.json', '--append-system-prompt', 'B', '--continue']);
  const codex = { ...runtime, id: 'codex', binary: 'codex', provider: 'codex' as const, continueArgs: ['resume', '--last'] };
  const hc = handoffArgs('codex', { mcp: 'm', mcpServer: { command: 'x', args: [] }, brief: 'B', prompt: 'P' });
  const pc = planStart({ runtime: codex, mode: 'continue', folder: '/w', binding: { kind: 'none' }, switchboard: null, inPlace: false, handoff: hc });
  assert.deepEqual((pc as { argv: string[] }).argv.slice(1), ['-c', 'mcp_servers.fabric-dashboards.command="x"', '-c', 'mcp_servers.fabric-dashboards.args=[]', 'resume', '--last', 'P'], 'Codex options come before its subcommand');
});

test('FD-39 REQ-001/002/005: a console start writes the pack and carries it — Claude with a fix task gets the MCP config, the brief and the task as its first prompt', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { tmp } = await import('./helpers');
  const { prepareHandoff } = await import('../src/core/handoff');
  const dir = path.join(tmp('fd-prep-'), 'runner.dev');
  const r = prepareHandoff({ snapshot: snap(), activity: [ev('2026-10-10T09:00:00Z', 'error', 'database locked')], folder: '/w/runner', runtimeId: 'claude-code', dir,
    server: { command: '/x/electron', args: ['/x/server.js'], env: { ELECTRON_RUN_AS_NODE: '1' } }, task: { kind: 'fix' }, now: () => new Date('2026-10-10T12:00:00Z') });
  assert.equal(r.env.FABRIC_DASHBOARDS_CONTEXT, path.join(dir, 'context.md'));
  assert.equal(r.env.FABRIC_DASHBOARDS_TASK, path.join(dir, 'task.md'));
  assert.equal(r.handoff.before[0], `--mcp-config=${path.join(dir, 'mcp.json')}`);
  assert.match(r.handoff.before[2]!, /Runner.*runner\.dev.*context\.md.*task\.md/s, 'the brief names the agent, the context and the task');
  assert.match(r.handoff.after[0]!, /task\.md.*then do the task/, 'a fix starts working at once');
  assert.match(fs.readFileSync(r.files.context, 'utf8'), /database locked/);
  assert.match(fs.readFileSync(r.files.task!, 'utf8'), /^# Task: Runner is down/);
  const plain = prepareHandoff({ snapshot: snap(), activity: [], folder: '/w/runner', runtimeId: 'claude-code', dir, server: { command: 'x', args: [] } });
  assert.deepEqual(plain.handoff.after, [], 'a plain start: Claude waits for the person');
  assert.equal(plain.env.FABRIC_DASHBOARDS_TASK, undefined);
});

test('FD-39 SCN-054/055: Fix is offered where something is wrong; Update with agent where the agent\'s own command cannot apply the update', async () => {
  const { offersFix, offersAgentUpdate } = await import('../src/core/offers');
  for (const state of ['down', 'duplicate', 'foreign', 'conflict', 'invalid', 'degraded'] as const) assert.equal(offersFix({ state, problems: [], lastAction: null }), true, state);
  assert.equal(offersFix({ state: 'ready', problems: [], lastAction: null }), false);
  assert.equal(offersFix({ state: 'ready', problems: ['bad path'], lastAction: null }), true, 'a descriptor problem');
  assert.equal(offersFix({ state: 'stopped', problems: [], lastAction: { action: 'start', ok: false, reason: { code: 'x' }, at: '' } }), true, 'a failed action');
  const update = { wellKnown: { update: { available: '2.0.0' } }, descriptor: { commands: { update: ['/x'] } } } as unknown as Parameters<typeof offersAgentUpdate>[0];
  assert.equal(offersAgentUpdate(update, false), false, 'its own command runs first');
  assert.equal(offersAgentUpdate(update, true), true, 'after it failed');
  assert.equal(offersAgentUpdate({ ...update, descriptor: { commands: {} } } as typeof update, false), true, 'no command at all');
  assert.equal(offersAgentUpdate({ ...update, wellKnown: { update: null } } as unknown as typeof update, true), false, 'no update, nothing to offer');
});
