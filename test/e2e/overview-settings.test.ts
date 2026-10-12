// End to end, FD-02: Overview and Settings scenarios walked on a real Electron — SCN-041 (the strip at a
// glance), SCN-006 (needs attention), SCN-057 (sort the agents list) and SCN-024 (settings apply at once and
// survive a restart).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

/** The agents in the sidebar list, in the order shown. */
async function listed(page: Page): Promise<string[]> {
  const texts = await page.locator('.nav-item').allInnerTexts();
  return texts.map((t) => ['Alpha Silent', 'Sample Service'].find((n) => t.includes(n))).filter((n): n is string => Boolean(n));
}

test('SCN-041, SCN-006, SCN-057, SCN-024: the strip, needs attention, the list\'s sort and settings that survive a restart', { timeout: 180_000 }, async () => {
  const base = tmp('fd-e2e-ov-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'data');
  const appDir = path.join(base, 'app');
  fs.mkdirSync(services); fs.mkdirSync(data);
  const port = await freePort();
  const silent = await freePort(); // nothing listens here: a service that does not answer
  const proc = serve(port, data, ['--name', 'Sample Service']);
  let app: ElectronApplication | null = null;
  const env = { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: appDir, LANG: 'en_US.UTF-8' };
  try {
    await waitAnswering(port);
    register(port, data, services);
    fs.writeFileSync(path.join(services, 'alpha-silent.default.json'), JSON.stringify({
      protocol: 'fabric-service/0.1', id: 'alpha-silent', instance: 'default', name: 'Alpha Silent', origin: `http://127.0.0.1:${silent}`,
      auth: { tokenFile: path.join(base, 'none.token') }, lifecycle: { manager: 'none' }, paths: { data: path.join(base, 'a'), logs: [] },
      installedAt: '2026-10-13T00:00:00Z', installedBy: 'test',
    }));
    app = await electron.launch({ args: [ROOT], env });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: /Sample Service — Ready/ }).first().waitFor({ timeout: 20_000 });

    // SCN-041: the strip reads the whole estate before any card.
    for (const label of ['agents ready', 'not answering or in conflict', 'need attention', 'spent today', 'spent in 30 days']) {
      await page.getByText(label, { exact: true }).first().waitFor();
    }

    // SCN-006: a service that stops answering is listed under Needs attention with its reason.
    await page.getByRole('button', { name: /Alpha Silent — Not answering/ }).first().waitFor({ timeout: 60_000 });
    await page.locator(':text-is("Needs attention"):visible').first().waitFor();
    await page.getByText(/Not answering since/).first().waitFor();

    // SCN-057: Needs attention first puts the silent one on top; By name keeps the alphabet; the choice is kept.
    const sort = page.getByRole('combobox', { name: 'Sort' });
    await sort.selectOption('status');
    await page.waitForTimeout(300);
    assert.match((await listed(page))[0] ?? '', /Alpha Silent/, 'the agent that needs attention comes first');
    await sort.selectOption('name');
    await page.waitForTimeout(300);
    const byName = await listed(page);
    assert.deepEqual([...byName].sort((a, b) => a.localeCompare(b)), byName, 'alphabetical');

    // SCN-024: settings apply at once and are kept across a restart.
    await page.getByRole('button', { name: 'Settings' }).first().click();
    for (const label of ['Open at login', 'Unattributed listeners', 'Uninstall']) await page.getByText(label).first().waitFor();
    await page.getByRole('combobox', { name: /Theme/ }).selectOption('light');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await closeApp(app);
    app = await electron.launch({ args: [ROOT], env });
    const again = await app.firstWindow();
    await again.waitForFunction(() => document.documentElement.dataset.theme === 'light', undefined, { timeout: 20_000 });
    assert.equal(JSON.parse(fs.readFileSync(path.join(appDir, 'settings.json'), 'utf8')).layout.list.sort, 'name', 'the sort is remembered');
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});
