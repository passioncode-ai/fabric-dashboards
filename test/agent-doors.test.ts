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
