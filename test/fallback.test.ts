// FD-117 (SCN-088): the default and fallback coding agents, read from and written to Switchboard through its CLI.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Runner } from '@passioncode-ai/fabric-service-host';
import { chainArgv, MAX_LEVELS, modelOf, readFallback, writeFallback, type FallbackState } from '../src/core/fallback';

const ok = (data: unknown) => ({ code: 0, stdout: JSON.stringify({ ok: true, data }), stderr: '' });
const agent = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, installed: true, enabled: true, switchable: true, openrouter: false, ...extra });
const STATUS = {
  default: 'claude-code',
  agents: [agent('claude-code', 'Claude Code'), agent('codex', 'Codex CLI'), agent('kimi-code', 'Kimi Code CLI'), agent('hermes', 'Hermes Agent', { openrouter: true }),
    agent('opencode', 'OpenCode', { openrouter: true, enabled: false }), agent('goose', 'Goose', { switchable: false }), agent('aider', 'Aider', { installed: false })],
  recommended_models: [{ id: 'xiaomi/mimo-v2.6-pro', name: 'MiMo V2.6 Pro' }, { id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5' }],
};
const CHAINS = {
  chains: [
    { executors: [{ agent: 'claude-code' }, { agent: 'kimi-code', key: 'proj/prod/KIMI' }, { agent: 'codex', account_id: 'acc-1' }], scope: { kind: 'machine' } },
    { executors: [{ agent: 'codex' }, { agent: 'hermes' }], scope: { kind: 'project', pool: 'ng-business' } },
    { executors: [{ agent: 'codex' }], scope: { kind: 'workflow', workflow: 'wf_0123456789abcdef' } },
  ],
};
const KEYS = { keys: [{ model: 'xiaomi/mimo-v2.6-pro', pool: null }], projects: [{ name: 'NG Business', pool: 'ng-business' }] };
const HERMES = { configured: true, installed: true, model: 'moonshotai/kimi-k2', provider: 'openrouter' };
const ACCOUNTS = { accounts: [{ id: 'acc-1', label: 'Work Codex' }], routes: {} };

function fakeRun(answers: Record<string, ReturnType<typeof ok>>, calls: string[][] = []): Runner {
  return async (_cmd, args) => {
    calls.push(args);
    const key = args.filter((a) => a !== '--json').join(' ');
    return answers[key] ?? { code: 2, stdout: '', stderr: `error: unrecognized subcommand '${args[1]}'` };
  };
}
const ALL = { 'chain list': ok(CHAINS), 'agents status': ok(STATUS), 'agents openrouter list': ok(KEYS), 'agents hermes': ok(HERMES), 'accounts list': ok(ACCOUNTS) };

test('FD-117: the default agent, the machine order with pins, the other scopes and the models are read', async () => {
  const r = await readFallback(fakeRun(ALL), '/sb');
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  assert.equal(r.default, 'claude-code');
  assert.deepEqual(r.levels, [{ agent: 'claude-code' }, { agent: 'kimi-code', key: 'proj/prod/KIMI' }, { agent: 'codex', account: 'acc-1', accountLabel: 'Work Codex' }]);
  assert.deepEqual(r.agents.filter((a) => a.offered).map((a) => a.id), ['claude-code', 'codex', 'kimi-code', 'hermes'], 'installed, enabled and able to take over work');
  assert.equal(r.agents.find((a) => a.id === 'opencode')?.offered, false, 'turned off in Switchboard: listed, not offered');
  assert.equal(r.agents.some((a) => a.id === 'aider'), false, 'not installed: not listed');
  assert.deepEqual(r.others, [{ name: 'NG Business', agents: ['Codex CLI', 'Hermes Agent'] }]);
  assert.equal(r.workflows, 1);
  assert.deepEqual(r.openrouter, { model: 'xiaomi/mimo-v2.6-pro', models: [{ id: 'xiaomi/mimo-v2.6-pro', name: 'MiMo V2.6 Pro' }, { id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5' }] });
  assert.deepEqual(r.hermes, { model: 'moonshotai/kimi-k2', error: null });
});

test('FD-117: each level says the model it works on', async () => {
  const r = await readFallback(fakeRun(ALL), '/sb') as FallbackState & { kind: 'ok' };
  assert.deepEqual(modelOf('claude-code', r), { kind: 'account' });
  assert.deepEqual(modelOf('kimi-code', r), { kind: 'account' });
  assert.deepEqual(modelOf('hermes', r), { kind: 'openrouter', model: 'moonshotai/kimi-k2' });
  assert.deepEqual(modelOf('opencode', r), { kind: 'openrouter', model: 'xiaomi/mimo-v2.6-pro' });
  const silent = await readFallback(fakeRun({ ...ALL, 'agents hermes': ok({ configured: false, installed: true, error: 'Hermes did not answer. Run hermes config check, then try again.' }) }), '/sb') as FallbackState & { kind: 'ok' };
  assert.deepEqual(silent.hermes, { model: null, error: 'Hermes did not answer. Run hermes config check, then try again.' });
  assert.deepEqual(modelOf('hermes', silent), { kind: 'openrouter', model: 'xiaomi/mimo-v2.6-pro' }, 'Hermes off OpenRouter or silent: the key\'s model');
  const nokey = await readFallback(fakeRun({ ...ALL, 'agents openrouter list': ok({ keys: [], projects: [] }), 'agents hermes': ok({ configured: true, model: 'x', provider: 'anthropic' }) }), '/sb') as FallbackState & { kind: 'ok' };
  assert.equal(nokey.openrouter.model, null);
  assert.deepEqual(modelOf('hermes', nokey), { kind: 'unknown' });
});

test('FD-117: no order, no Switchboard command, a silent Switchboard each read as what they are', async () => {
  const empty = await readFallback(fakeRun({ ...ALL, 'chain list': ok({ chains: [] }) }), '/sb');
  assert.equal(empty.kind === 'ok' && empty.levels.length, 0);
  assert.deepEqual(await readFallback(fakeRun({ ...ALL, 'chain list': { code: 2, stdout: '', stderr: "error: unrecognized subcommand 'chain'" } }), '/sb'), { kind: 'old' });
  const down = await readFallback(fakeRun({ ...ALL, 'chain list': { code: 1, stdout: JSON.stringify({ ok: false, error: 'the app data could not be read' }), stderr: '' } }), '/sb');
  assert.deepEqual(down, { kind: 'error', detail: 'the app data could not be read' });
  const noHermes = await readFallback(fakeRun({ ...ALL, 'agents status': ok({ ...STATUS, agents: STATUS.agents.filter((a) => a.id !== 'hermes') }) }), '/sb') as FallbackState & { kind: 'ok' };
  assert.equal(noHermes.hermes, null, 'Hermes not installed: not asked, no Hermes model choice');
});

test('FD-117: the order is written whole with its pins, and an empty one clears the machine chain', () => {
  assert.deepEqual(chainArgv([{ agent: 'claude-code' }, { agent: 'kimi-code', key: 'proj/prod/KIMI' }, { agent: 'codex', account: 'acc-1' }]),
    ['--json', 'chain', 'set', '--scope', 'machine', 'claude-code', 'kimi-code#proj/prod/KIMI', 'codex@acc-1']);
  assert.deepEqual(chainArgv([]), ['--json', 'chain', 'clear', '--scope', 'machine']);
});

test('FD-117: writes go through Switchboard, refuse what it would not take, and pass its sentence back', async () => {
  const calls: string[][] = [];
  const run = fakeRun({ 'agents default auto': ok({}), 'agents default codex': ok({}), 'agents openrouter model anthropic/claude-haiku-5.5': ok({}),
    'agents hermes set --provider openrouter --model moonshotai/kimi-k2': ok({}), 'chain set --scope machine codex hermes': ok({}) }, calls);
  assert.deepEqual(await writeFallback(run, '/sb', { default: null }), { ok: true });
  assert.deepEqual(await writeFallback(run, '/sb', { default: 'codex' }), { ok: true });
  assert.deepEqual(await writeFallback(run, '/sb', { openrouterModel: 'anthropic/claude-haiku-5.5' }), { ok: true });
  assert.deepEqual(await writeFallback(run, '/sb', { hermesModel: 'moonshotai/kimi-k2' }), { ok: true });
  assert.deepEqual(await writeFallback(run, '/sb', { levels: [{ agent: 'codex' }, { agent: 'hermes' }] }), { ok: true });
  assert.equal(calls.length, 5);
  const before = calls.length;
  for (const bad of [{ default: '--help' }, { levels: Array.from({ length: MAX_LEVELS + 1 }, () => ({ agent: 'codex' })) }, { levels: [{ agent: 'codex; rm' }] },
    { openrouterModel: 'a model' }, { hermesModel: '' }, { levels: [{ agent: 'codex', account: '-x' }] }] as const) {
    const r = await writeFallback(run, '/sb', bad as never);
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
  assert.equal(calls.length, before, 'nothing malformed reaches Switchboard');
  const refused = await writeFallback(fakeRun({ 'agents default codex': { code: 1, stdout: JSON.stringify({ ok: false, error: 'codex is turned off for taking over work' }), stderr: '' } }), '/sb', { default: 'codex' });
  assert.deepEqual(refused, { ok: false, detail: 'codex is turned off for taking over work' });
});
