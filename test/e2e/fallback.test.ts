// FD-117 (SCN-088): Settings → Coding agents, end to end against the real app. Switchboard is a Node fake that keeps
// its default agent, machine chain, OpenRouter model and Hermes model in a state file, so every write the section
// makes is read back as Switchboard would answer it; its journal shows the exact commands.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { tmp, waitFor } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

/** A Switchboard fake: the state lives in `state.json`; `codex` as the default is refused, as a turned-off agent is. */
export function fakeSwitchboard(bin: string, state: string, journal: string): void {
  const agents = [
    ['claude-code', 'Claude Code', false], ['codex', 'Codex CLI', false], ['kimi-code', 'Kimi Code CLI', true], ['hermes', 'Hermes Agent', true], ['opencode', 'OpenCode', true],
  ].map(([id, name, openrouter]) => ({ id, name, installed: true, enabled: true, switchable: true, openrouter }));
  fs.writeFileSync(state, JSON.stringify({ default: 'claude-code', chain: [{ agent: 'claude-code' }, { agent: 'kimi-code', key: 'proj/prod/KIMI' }, { agent: 'hermes' }], model: 'xiaomi/mimo-v2.6-pro', hermes: 'moonshotai/kimi-k2' }));
  const src = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2).filter((a) => a !== '--json');
fs.appendFileSync(${JSON.stringify(journal)}, args.join(' ') + '\\n');
const st = JSON.parse(fs.readFileSync(${JSON.stringify(state)}, 'utf8'));
const out = (data) => { process.stdout.write(JSON.stringify({ ok: true, data })); process.exit(0); };
const save = () => fs.writeFileSync(${JSON.stringify(state)}, JSON.stringify(st));
const cmd = args.join(' ');
const scope = args.indexOf('--scope');
const rest = scope >= 0 ? args.slice(scope + 2) : args.slice(2);
if (cmd === 'chain list') out({ chains: [...(st.chain.length ? [{ executors: st.chain, scope: { kind: 'machine' } }] : []), { executors: [{ agent: 'codex' }, { agent: 'hermes' }], scope: { kind: 'project', pool: 'ng' } }] });
if (cmd === 'agents status') out({ default: st.default, agents: ${JSON.stringify(agents)}, recommended_models: [{ id: 'xiaomi/mimo-v2.6-pro', name: 'MiMo V2.6 Pro' }, { id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5' }] });
if (cmd === 'agents openrouter list') out({ keys: [{ model: st.model, pool: null }], projects: [{ name: 'NG Business', pool: 'ng' }] });
if (cmd === 'agents hermes') out({ configured: true, installed: true, provider: 'openrouter', model: st.hermes });
if (cmd === 'accounts list') out({ accounts: [], routes: {} });
if (args[0] === 'agents' && args[1] === 'default') {
  if (args[2] === 'codex') { process.stdout.write(JSON.stringify({ ok: false, error: 'codex is turned off for taking over work' })); process.exit(1); }
  st.default = args[2] === 'auto' ? null : args[2]; save(); out({});
}
if (args[0] === 'chain' && args[1] === 'set') { st.chain = rest.map((a) => { const [agent, key] = a.split('#'); return key ? { agent, key } : { agent }; }); save(); out({}); }
if (args[0] === 'chain' && args[1] === 'clear') { st.chain = []; save(); out({}); }
if (cmd.startsWith('agents openrouter model ')) { st.model = args[3]; save(); out({}); }
if (args[0] === 'agents' && args[1] === 'hermes' && args[2] === 'set') { st.hermes = args[args.indexOf('--model') + 1]; save(); out({}); }
process.exit(1);
`;
  fs.writeFileSync(path.join(bin, 'switchboard'), src, { mode: 0o755 });
}

test('FD-117 SCN-088: the default and fallback coding agents and their models are read and changed through Switchboard', { timeout: 180_000, skip: process.platform === 'win32' && 'a shebang fake' }, async () => {
  const base = tmp('fd-e2e-fallback-');
  const services = path.join(base, 'services');
  const bin = path.join(base, 'bin');
  const userData = path.join(base, 'app');
  const state = path.join(base, 'state.json');
  const journal = path.join(base, 'journal.txt');
  for (const d of [services, bin, userData]) fs.mkdirSync(d, { recursive: true });
  fakeSwitchboard(bin, state, journal);
  const writes = () => fs.readFileSync(journal, 'utf8').split('\n').filter((l) => /^(chain (set|clear)|agents (default|openrouter model|hermes set))/.test(l));
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, FD_TEST_RUNTIME_DIRS: bin, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Settings' }).first().click({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Coding agents' }).click();
    const sec = page.getByRole('region', { name: 'Coding agents' });

    // Step 1: the default agent, three levels in order with their models and the pinned key, the group's own order.
    await sec.getByRole('combobox', { name: 'Default coding agent' }).waitFor({ timeout: 20_000 });
    assert.equal(await sec.getByRole('combobox', { name: 'Default coding agent' }).inputValue(), 'claude-code');
    assert.deepEqual(await Promise.all([1, 2, 3].map((n) => sec.getByRole('combobox', { name: `Level ${n}` }).inputValue())), ['claude-code', 'kimi-code', 'hermes']);
    await sec.getByText("on its account's model · key proj/prod/KIMI").waitFor();
    await sec.getByText('on moonshotai/kimi-k2 through OpenRouter').waitFor();
    await sec.getByText('NG Business: Codex CLI → Hermes Agent').waitFor();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '40-coding-agents.png') });

    // Step 2: another default agent is saved and read back; a refused one keeps what Switchboard holds and says why.
    await sec.getByRole('combobox', { name: 'Default coding agent' }).selectOption('');
    await sec.getByRole('status').filter({ hasText: 'Saving' }).waitFor({ state: 'detached' });
    assert.equal(await sec.getByRole('combobox', { name: 'Default coding agent' }).inputValue(), '');
    await sec.getByRole('combobox', { name: 'Default coding agent' }).selectOption('codex');
    await sec.getByRole('alert').filter({ hasText: 'Switchboard did not change it: codex is turned off for taking over work' }).waitFor();
    assert.equal(await sec.getByRole('combobox', { name: 'Default coding agent' }).inputValue(), '', 'the screen shows what Switchboard holds');

    // Step 3: move level 3 up, then replace level 1, add a level and remove one; each writes the whole order, pins kept.
    await sec.getByRole('button', { name: 'Move level 3 up' }).click();
    const level = (n: number) => sec.getByRole('combobox', { name: `Level ${n}` });
    await waitFor('level 2 reads hermes', async () => (await level(2).inputValue()) === 'hermes');
    await level(1).selectOption('codex');
    await waitFor('level 1 reads codex', async () => (await level(1).inputValue()) === 'codex');
    await sec.getByRole('button', { name: 'Add level' }).click();
    await sec.getByRole('combobox', { name: 'Level 4' }).waitFor();
    await sec.getByRole('button', { name: 'Remove level 4' }).click();
    await sec.getByRole('combobox', { name: 'Level 4' }).waitFor({ state: 'detached' });
    assert.deepEqual(writes().filter((l) => l.startsWith('chain')), [
      'chain set --scope machine claude-code hermes kimi-code#proj/prod/KIMI',
      'chain set --scope machine codex hermes kimi-code#proj/prod/KIMI',
      'chain set --scope machine codex hermes kimi-code#proj/prod/KIMI claude-code',
      'chain set --scope machine codex hermes kimi-code#proj/prod/KIMI',
    ]);

    // Step 4: the OpenRouter model and Hermes's model; every level on that model shows the new one.
    await sec.getByRole('combobox', { name: 'Hermes model' }).selectOption('anthropic/claude-haiku-5.5');
    await sec.getByText('on anthropic/claude-haiku-5.5 through OpenRouter').waitFor();
    await sec.getByRole('combobox', { name: 'OpenRouter model' }).selectOption('anthropic/claude-haiku-5.5');
    await waitFor('the OpenRouter model written', async () => writes().includes('agents openrouter model anthropic/claude-haiku-5.5'));
    assert.ok(writes().includes('agents hermes set --provider openrouter --model anthropic/claude-haiku-5.5'));
    await sec.getByRole('status').filter({ hasText: 'Saving' }).waitFor({ state: 'detached' });

    // Alt path: no level left clears the machine chain and says what that means.
    for (let n = 3; n >= 1; n--) {
      await sec.getByRole('button', { name: `Remove level ${n}` }).click();
      await sec.getByRole('combobox', { name: `Level ${n}` }).waitFor({ state: 'detached' });
    }
    await sec.getByText('No order is set: when a coding agent reaches its limit, its work waits.').waitFor();
    assert.equal(writes().at(-1), 'chain clear --scope machine');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '41-coding-agents-empty.png') });
  } finally {
    await closeApp(app);
  }
});
