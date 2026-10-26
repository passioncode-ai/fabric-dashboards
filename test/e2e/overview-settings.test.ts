// End to end, FD-02: Overview and Settings scenarios walked on a real Electron — SCN-041 (the strip at a
// glance), SCN-006 (needs attention), SCN-057 (sort the agents list) and SCN-024 (settings apply at once and
// survive a restart).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
    await page.getByRole('button', { name: /Sample Service: Ready/ }).first().waitFor({ timeout: 20_000 });

    // SCN-041: the strip reads the whole estate before any card.
    for (const label of ['agents ready', 'not answering or in conflict', 'need attention', 'spent today', 'spent in 30 days']) {
      await page.getByText(label, { exact: true }).first().waitFor();
    }

    // SCN-006: a service that stops answering is listed under Needs attention with its reason.
    await page.getByRole('button', { name: /Alpha Silent: Not answering/ }).first().waitFor({ timeout: 60_000 });
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

// SCN-070 (FD-65): Check setup runs the pinned, read-only doctor (a fixture stands in for npx here: it refuses any other
// arguments), lists what needs the person — failures first, grouped by area, each with its fix — and Repair with my
// coding agent opens the Setup console beside Overview.
test('SCN-070: Check setup lists what needs the person and hands the repair to the coding agent', { timeout: 120_000, skip: process.platform === 'win32' && 'POSIX fake npx' }, async () => {
  const base = tmp('fd-e2e-doctor-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8', FD_TEST_DOCTOR: path.join(ROOT, 'test/fixtures/doctor/fake-npx.sh') } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Settings' }).first().click({ timeout: 20_000 });
    await page.getByRole('heading', { name: 'Setup', exact: true }).waitFor();
    const group = page.locator('section[aria-labelledby="g-setup"]');
    await group.getByRole('button', { name: 'Check setup' }).click();
    await group.getByText(/Failing: 1 · Warnings: 1 · OK: 1 · checked at/).waitFor({ timeout: 30_000 });
    const items = await group.locator('.setup-check-area li').allInnerTexts();
    assert.equal(items.length, 2, JSON.stringify(items));
    assert.match(items[0]!, /Failing.*points at a missing file/s, 'the failure first');
    assert.match(items[1]!, /Warning.*0\.17\.0 is out/s);
    await group.getByText('claude mcp add --scope user fabric-dashboards', { exact: false }).waitFor();
    assert.deepEqual(await group.locator('.setup-check-area h3').allInnerTexts(), ['MCP servers', 'Apps'], 'the area with a failure comes first');
    await group.getByRole('button', { name: 'Fix with my coding agent' }).click();
    // FD-92: the Setup console is the drawer, a view of its own over the content area.
    const end = Date.now() + 10_000;
    let con = app!.windows().find((p) => p.url().includes('drawer=1'));
    while (!con && Date.now() < end) { await new Promise((r) => setTimeout(r, 200)); con = app!.windows().find((p) => p.url().includes('drawer=1')); }
    assert.ok(con, 'the console drawer opened');
    await con.getByRole('region', { name: 'Console' }).waitFor({ timeout: 10_000 });
  } finally {
    await closeApp(app);
  }
});

// SCN-051: the estate watcher on a real clone. A local clone of the contract is named in Settings, its record of the
// remote's main is moved three commits back, and the app — 5 s after the change — reads the remote, fetches only
// (never pull, reset or rebase), and says the clone is up to date with the commits fetched. The local main is left
// where it was. Needs the network and this Mac's access to the contract repository.
const CONTRACT = path.join(process.env.HOME ?? '', 'DATA', 'fabric-agent-contract');
const haveContract = fs.existsSync(path.join(CONTRACT, '.git'));
test('SCN-051: the app watches the contract clone — fetches only, never moves its main', { timeout: 180_000, skip: !haveContract && 'no contract clone on this Mac' }, async () => {
  const base = tmp('fd-e2e-estate-');
  const services = path.join(base, 'services');
  const clone = path.join(base, 'fabric-agent-contract');
  fs.mkdirSync(services);
  const git = (...a: string[]) => { const r = spawnSync('git', ['-C', clone, ...a], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  assert.equal(spawnSync('git', ['clone', '--quiet', CONTRACT, clone]).status, 0);
  git('remote', 'set-url', 'origin', spawnSync('git', ['-C', CONTRACT, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).stdout.trim());
  git('reset', '--quiet', '--hard', 'HEAD~3'); // the local main three commits back: a pull would move it, a fetch must not
  const localMain = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', localMain); // and the clone "has not fetched" the last three commits
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Settings' }).first().click({ timeout: 20_000 });
    await page.getByText('Contract: no clone named in Settings').waitFor();
    const field = page.getByPlaceholder('~/DATA/fabric-agent-contract');
    await field.fill(clone);
    await field.press('Enter');
    await page.getByText(/Contract: up to date: main at [0-9a-f]{7}.* · new commits fetched/).waitFor({ timeout: 90_000 });
    assert.equal(git('rev-parse', 'HEAD'), localMain, 'the local main is never moved — fetch only');
    assert.notEqual(git('rev-parse', 'refs/remotes/origin/main'), localMain, 'the remote main was fetched');
    await page.getByText(/^Skills: /).first().waitFor();
  } finally {
    await closeApp(app);
  }
});
