// FD-191 (SCN-101, SCN-102): New session in the Sessions mode and New agent in the agent list, end to end against the
// real app. A fake `claude` records the arguments it was started with; the dialog offers it, opens on the folder last
// chosen, starts it there without permission prompts, and the session's page and the Sessions list show it. New agent
// opens the same dialog with its own title and closes on Cancel.
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

const roomy = (dir: string) => { const st = fs.statfsSync(dir); return st.bavail * st.bsize >= 5 * 1024 ** 3; };

test('SCN-101, SCN-102: New session starts the chosen coding agent in the chosen folder; New agent opens its dialog', { timeout: 120_000, skip: (process.platform === 'win32' && 'POSIX shell fake') || (!roomy(process.env.TMPDIR ?? '/tmp') && 'a session needs 5 GB free (LC-17)') }, async () => {
  const base = tmp('fd-e2e-new-');
  const services = path.join(base, 'services');
  const bin = path.join(base, 'bin');
  const projects = path.join(base, 'my-projects');
  const userData = path.join(base, 'app');
  for (const d of [services, bin, projects, userData]) fs.mkdirSync(d, { recursive: true });
  const argsFile = path.join(base, 'args.txt');
  fs.writeFileSync(path.join(bin, 'claude'), ['#!/bin/sh', `printf '%s\\n' "$@" > '${argsFile}'`, 'echo "fake coding agent"', 'exec /bin/sleep 60'].join('\n'), { mode: 0o755 });
  // The dialog opens on the folder chosen last time.
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ newSession: { folder: projects } }));
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, FD_TEST_RUNTIME_DIRS: bin, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    // SCN-102: New agent on the agent list opens the dialog under its own title; Cancel closes it.
    await page.getByRole('heading', { level: 1, name: 'Overview' }).waitFor({ timeout: 20_000 });
    await page.getByRole('button', { name: 'New agent', exact: true }).click();
    const agentDialog = page.getByRole('dialog', { name: 'New agent' });
    await agentDialog.getByText(/asks what the new agent should do/).waitFor({ timeout: 20_000 });
    await agentDialog.getByRole('button', { name: 'Create with coding agent' }).waitFor();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '40-new-agent.png') });
    await agentDialog.getByRole('button', { name: 'Cancel' }).click();
    await agentDialog.waitFor({ state: 'detached' });
    // SCN-101: New session in the Sessions mode.
    await page.getByRole('button', { name: /^Sessions/ }).first().click();
    await page.getByRole('heading', { level: 1, name: 'All sessions' }).waitFor({ timeout: 20_000 });
    await page.getByRole('main').getByRole('button', { name: 'New session', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New session' });
    await dialog.getByRole('radio', { name: 'Claude Code' }).waitFor({ timeout: 20_000 });
    assert.equal(await dialog.getByRole('radio', { name: 'Claude Code' }).isChecked(), true, 'the only coding agent is chosen');
    await dialog.getByText('my-projects', { exact: false }).first().waitFor();
    assert.equal(await dialog.getByRole('checkbox', { name: 'Run without permission prompts' }).isChecked(), true, 'ticked by default');
    const isolated = dialog.getByRole('checkbox', { name: 'Isolated session' });
    assert.equal(await isolated.isDisabled(), true, 'no Switchboard here');
    await dialog.getByText('Needs Fabric Switchboard.').waitFor();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '41-new-session.png') });
    await dialog.getByRole('button', { name: 'Start session' }).click();
    await dialog.waitFor({ state: 'detached', timeout: 20_000 });
    // The session's page opens on it, and the coding agent runs in the folder without permission prompts.
    await page.getByRole('heading', { level: 1, name: 'my-projects' }).waitFor({ timeout: 30_000 });
    const args = await waitFor('the coding agent to start', async () => (fs.existsSync(argsFile) ? fs.readFileSync(argsFile, 'utf8') : null), 20_000);
    assert.ok(args.split('\n').includes('--dangerously-skip-permissions'), args);
    const settings = JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')) as { consoles: Record<string, { folder: string; bypass?: boolean }>; newSession: { runtime: string } };
    const own = Object.entries(settings.consoles).find(([k]) => /^session\.[0-9a-f]{12}$/.test(k));
    assert.ok(own, 'a console of its own');
    assert.equal(own[1].folder, projects);
    assert.equal(settings.newSession.runtime, 'claude-code');
    // The Sessions list shows it with the others.
    await page.locator('nav .nav-item', { hasText: 'All sessions' }).first().click();
    await page.getByRole('main').getByRole('heading', { level: 2, name: /^Running: 1$/ }).waitFor({ timeout: 20_000 });
    await page.locator('.session-card', { hasText: 'my-projects' }).first().waitFor({ timeout: 20_000 });
  } finally {
    await closeApp(app);
  }
});
