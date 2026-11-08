// FD-175 (the operator, 2026-11-07: every action of the interface can be done by Claude Code at their request): the
// window's own buttons through the console channel, and their MCP twins.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseRequest, type ChannelRequest } from '../src/core/console-channel';
import { agentSettingsPatch, SettingsStore } from '../src/core/settings';
import { openChannel } from '../src/electron/console-channel';
import { actionOf } from '../src/mcp/actions';
import * as tools from '../src/mcp/tools';

test('FD-175: an agent changes the fields a person changes in Settings; a console folder or a Sessions record is refused, never written', () => {
  const { patch, refused } = agentSettingsPatch({ theme: 'light', language: 'ru', consoles: { 'a.default': { folder: '/x' } }, layout: { list: { groupByOrg: true, pinned: ['x'] }, console: { open: true } }, sessions: {} });
  assert.deepEqual(patch, { theme: 'light', language: 'ru', layout: { list: { groupByOrg: true } } });
  assert.deepEqual(refused.sort(), ['consoles', 'layout.console', 'layout.list.pinned', 'sessions']);
  assert.deepEqual(agentSettingsPatch('x'), { patch: {}, refused: [] });
});

test('FD-175: each window operation carries only its own field, checked strictly', () => {
  const ok = (line: object) => { const r = parseRequest(JSON.stringify({ key: 'k', ...line })); assert.ok(r.ok, JSON.stringify(r)); return (r as { request: ChannelRequest }).request; };
  const code = (line: object) => (parseRequest(JSON.stringify({ key: 'k', ...line })) as { code: string }).code;
  assert.deepEqual(ok({ op: 'settings.update', patch: { theme: 'dark' } }).patch, { theme: 'dark' });
  assert.equal(code({ op: 'settings.update', patch: [] }), 'bad-patch');
  assert.equal(code({ op: 'settings.update', patch: {}, service: 'a.default' }), 'bad-patch');
  assert.deepEqual(ok({ op: 'sessions.act', session: { act: 'continue', row: 'c:a.default:1', account: 'acc-2' } }).session, { act: 'continue', row: 'c:a.default:1', account: 'acc-2' });
  assert.deepEqual(ok({ op: 'sessions.act', session: { act: 'clear-ended' } }).session, { act: 'clear-ended' });
  assert.equal(code({ op: 'sessions.act', session: { act: 'clear-ended', row: 'x' } }), 'bad-session');
  assert.equal(code({ op: 'sessions.act', session: { act: 'end' } }), 'bad-session', 'end needs its row');
  assert.equal(code({ op: 'sessions.act', session: { act: 'end', row: 'r', account: 'a' } }), 'bad-session', 'only Continue takes an account');
  assert.equal(code({ op: 'sessions.act', session: { act: 'delete', row: 'r' } }), 'bad-session');
  assert.equal(ok({ op: 'app.update', update: 'restart' }).update, 'restart');
  assert.equal(code({ op: 'app.update', update: 'downgrade' }), 'bad-update');
  assert.equal(code({ op: 'console.new', service: 'a.default', patch: {} }), 'unknown-field', 'a console start carries no window field');
});

test('FD-175: End, Continue and Restart to update take the operator\'s words; Dismiss, Clear ended, Check and Settings do not need them', () => {
  assert.equal(actionOf('session_action', { act: 'end', row: 'r' })?.gate, 'relayed');
  assert.equal(actionOf('session_action', { act: 'continue', row: 'r' })?.gate, 'relayed');
  assert.equal(actionOf('session_action', { act: 'dismiss', row: 'r' })?.gate, 'none');
  assert.equal(actionOf('session_action', { act: 'clear-ended' })?.id, 'sessions-clear-ended');
  assert.equal(actionOf('app_update', { action: 'restart' })?.id, 'restart-to-update');
  assert.equal(actionOf('app_update', { action: 'check' })?.gate, 'none');
  assert.equal(actionOf('settings', {})?.id, 'change-settings');
});

test('FD-175: the MCP twins reach the running app through its channel; Settings reads without it; with the app closed a change says so', { skip: process.platform === 'win32' && 'a Unix socket' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-doors-'));
  const deps = { settingsFile: () => path.join(dir, 'settings.json') } as unknown as tools.Deps;
  new SettingsStore(dir).update({ theme: 'light' });
  const read = await tools.settings(deps);
  assert.equal((read.settings as { theme: string }).theme, 'light', 'read from the file, the app closed');
  assert.ok((read.changeable as string[]).includes('layout.list.groupByOrg'));
  await assert.rejects(tools.settings(deps, { theme: 'dark' }), /app-not-running/);
  const asked: ChannelRequest[] = [];
  const ch = await openChannel({ userData: dir, log: () => undefined, start: async (r) => {
    asked.push(r);
    if (r.op === 'settings.update') return { ok: true, result: { changed: Object.keys(agentSettingsPatch(r.patch).patch), refused: agentSettingsPatch(r.patch).refused } };
    if (r.op === 'sessions.act') return r.session?.row === 'gone' ? { ok: false, code: 'not-a-row' } : { ok: true, result: { act: r.session!.act, ok: true } };
    return { ok: true, result: { state: 'idle', version: null } };
  } });
  try {
    assert.deepEqual(await tools.settings(deps, { theme: 'dark', consoles: {} }), { changed: ['theme'], refused: ['consoles'] });
    assert.deepEqual(await tools.sessionAction(deps, 'end', 'c:a.default:1'), { act: 'end', ok: true });
    await assert.rejects(tools.sessionAction(deps, 'dismiss', 'gone'), /not-a-row/);
    assert.deepEqual(await tools.appUpdate(deps, 'check'), { state: 'idle', version: null });
    assert.deepEqual(asked.map((r) => r.op), ['settings.update', 'sessions.act', 'sessions.act', 'app.update']);
  } finally {
    await ch!.close();
  }
});

test('FD-175: the console\'s pickers and the install buttons each carry only their own field, checked strictly', () => {
  const ok = (line: object) => { const r = parseRequest(JSON.stringify({ key: 'k', ...line })); assert.ok(r.ok, JSON.stringify(r)); return (r as { request: ChannelRequest }).request; };
  const code = (line: object) => (parseRequest(JSON.stringify({ key: 'k', ...line })) as { code: string }).code;
  assert.deepEqual(ok({ op: 'console.choose', service: 'a.default', choice: { runtime: 'codex' } }).choice, { runtime: 'codex' });
  assert.deepEqual(ok({ op: 'console.choose', service: 'a.default', choice: { folder: '/w/agent' } }).choice, { folder: '/w/agent' });
  assert.deepEqual(ok({ op: 'console.choose', service: 'a.default', choice: { folder: 'C:\\w\\agent' } }).choice, { folder: 'C:\\w\\agent' });
  assert.equal(code({ op: 'console.choose', service: 'a.default', choice: {} }), 'bad-choice', 'one of the two at least');
  assert.equal(code({ op: 'console.choose', service: 'a.default', choice: { folder: 'w/agent' } }), 'bad-choice', 'a relative path');
  assert.equal(code({ op: 'console.choose', service: 'a.default', choice: { folder: '/w/a\u0000b' } }), 'bad-choice');
  assert.equal(code({ op: 'console.choose', service: 'a.default', choice: { runtime: 'Codex; rm' } }), 'bad-choice');
  assert.equal(code({ op: 'console.choose', service: 'a.default', choice: { runtime: 'codex', args: ['x'] } }), 'bad-choice');
  assert.equal(code({ op: 'console.choose', service: '../x', choice: { runtime: 'codex' } }), 'bad-service');
  assert.equal(code({ op: 'console.choose', service: 'a.default', choice: { runtime: 'codex' }, task: {} }), 'unknown-field');
  assert.equal(ok({ op: 'app.install', install: 'uninstall-all' }).install, 'uninstall-all');
  assert.equal(code({ op: 'app.install', install: 'reinstall' }), 'bad-install');
  assert.equal(code({ op: 'app.install', install: 'uninstall', service: 'a.default' }), 'bad-install');
  assert.equal(code({ op: 'console.new', service: 'a.default', install: 'uninstall' }), 'unknown-field', 'a console start carries no install');
});

test('FD-175: Move to Applications and Uninstall take the operator\'s words; the console\'s pickers do not need them', () => {
  assert.equal(actionOf('app_install', { action: 'move-to-applications' })?.id, 'move-to-applications');
  assert.equal(actionOf('app_install', { action: 'uninstall' })?.id, 'uninstall');
  assert.equal(actionOf('app_install', { action: 'uninstall-all' })?.id, 'uninstall');
  assert.equal(actionOf('app_install', { action: 'uninstall' })?.gate, 'relayed');
  assert.equal(actionOf('console_choose', { service: 'a.default' })?.gate, 'none');
});

test('FD-175: the pickers and the install buttons reach the running app; a mistaken uninstall call is refused before it', { skip: process.platform === 'win32' && 'a Unix socket' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-doors2-'));
  const services = path.join(dir, 'services');
  fs.mkdirSync(services);
  // A valid descriptor from the contract's fixtures, under the key the calls name.
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'contract', 'positive_service-descriptor-unmanaged.json'), 'utf8')) as Record<string, unknown>;
  fs.writeFileSync(path.join(services, 'alpha.default.json'), JSON.stringify({ ...d, id: 'alpha', instance: 'default' }));
  const deps = { settingsFile: () => path.join(dir, 'settings.json'), servicesDir: () => services } as unknown as tools.Deps;
  await assert.rejects(tools.consoleChoose(deps, 'alpha.default', { runtime: 'codex' }), /app-not-running/);
  await assert.rejects(tools.consoleChoose(deps, 'b.default', { runtime: 'codex' }), /no installed service/);
  const asked: ChannelRequest[] = [];
  const ch = await openChannel({ userData: dir, log: () => undefined, start: async (r) => {
    asked.push(r);
    if (r.op === 'console.choose') return r.choice?.runtime === 'nope' ? { ok: false, code: 'unknown-runtime', detail: 'installed here: claude-code, codex' } : { ok: true, result: { runtime: r.choice?.runtime ?? 'claude-code', folder: r.choice?.folder ?? null } };
    if (r.op === 'console.fix') return { ok: true, result: { typed: true, console: r.service, waitsForEnter: true } };
    return { ok: true, result: { uninstalling: true, deleteData: r.install === 'uninstall-all' } };
  } });
  try {
    assert.deepEqual(await tools.consoleChoose(deps, 'alpha.default', { runtime: 'codex' }), { service: 'alpha.default', runtime: 'codex', folder: null });
    await assert.rejects(tools.consoleChoose(deps, 'alpha.default', { runtime: 'nope' }), /unknown-runtime: installed here: claude-code, codex/);
    await assert.rejects(tools.consoleChoose(deps, 'alpha.default', {}), /name runtime, folder or both/);
    assert.deepEqual(await tools.consoleChannel(deps, { op: 'console.fix', service: 'alpha.default', task: { kind: 'fix', output: 'x' } }), { started: false, typed: true, console: 'alpha.default', waitsForEnter: true });
    await assert.rejects(tools.appInstall(deps, 'uninstall-all', 'uninstall'), /confirm must repeat the action: uninstall-all/);
    assert.deepEqual(await tools.appInstall(deps, 'uninstall', 'uninstall'), { uninstalling: true, deleteData: false });
    assert.deepEqual(asked.map((r) => r.op), ['console.choose', 'console.choose', 'console.fix', 'app.install'], 'the mistaken uninstall and the empty choice never reached the app');
  } finally {
    await ch!.close();
  }
});

test('FD-175: the console host saves an agent\'s choice only when the runtime is installed and the folder exists', { skip: process.platform === 'win32' && 'POSIX execute bits: the fake runtime is a shell script' }, async () => {
  const { ConsoleHost } = await import('../src/electron/console');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-choose-'));
  const bin = path.join(base, 'bin');
  const folder = path.join(base, 'agent');
  fs.mkdirSync(bin); fs.mkdirSync(folder);
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = { consoles: {} as Record<string, { runtime: string | null; folder: string | null }> };
  const updates: unknown[] = [];
  const host = new ConsoleHost({
    settings: { get: () => settings, update: (p: { consoles: typeof settings.consoles }) => { updates.push(p); Object.assign(settings.consoles, p.consoles); } } as never,
    snapshot: () => null, window: () => null, visible: () => false, log: () => {},
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: () => Promise.resolve({ code: 0, stdout: '{}', stderr: '' }),
    spawn: () => { throw new Error('nothing starts here'); },
    killGroup: () => {},
  });
  const key = 'example-agent.default';
  const unknown = await host.chooseFor(key, { runtime: 'no-such-agent' });
  assert.equal(unknown.ok, false);
  assert.equal((unknown as { reason: string }).reason, 'unknown-runtime');
  assert.match((unknown as { detail: string }).detail, /claude-code/);
  assert.equal((await host.chooseFor(key, { runtime: 'claude-code', folder: path.join(base, 'absent') }) as { reason: string }).reason, 'no-folder');
  assert.equal(updates.length, 0, 'a refused choice saves nothing, not even its valid half');
  const done = await host.chooseFor(key, { runtime: 'claude-code', folder });
  assert.deepEqual(done, { ok: true, runtime: 'claude-code', folder });
  assert.deepEqual(settings.consoles[key], { runtime: 'claude-code', folder });
});

test('FD-182: the Setup console is a console an agent starts too; any other key still has to be an installed service', { skip: process.platform === 'win32' && 'a Unix socket' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-setup-door-'));
  const services = path.join(dir, 'services');
  fs.mkdirSync(services);
  const deps = { settingsFile: () => path.join(dir, 'settings.json'), servicesDir: () => services } as unknown as tools.Deps;
  await assert.rejects(tools.consoleChannel(deps, { op: 'console.new', service: 'fabric-dashboards.setup' }), /app-not-running/, 'not refused as an unknown service');
  await assert.rejects(tools.consoleChannel(deps, { op: 'console.new', service: 'b.default' }), /no installed service/);
  const asked: ChannelRequest[] = [];
  const ch = await openChannel({ userData: dir, log: () => undefined, start: async (r) => { asked.push(r); return { ok: true, consoleKey: r.service }; } });
  try {
    assert.deepEqual(await tools.consoleChannel(deps, { op: 'console.new', service: 'fabric-dashboards.setup' }), { started: true, console: 'fabric-dashboards.setup' });
    assert.deepEqual(asked.map((r) => [r.op, r.service]), [['console.new', 'fabric-dashboards.setup']]);
  } finally {
    await ch!.close();
  }
});
