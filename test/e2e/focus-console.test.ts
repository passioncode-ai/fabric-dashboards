// ADR-0017 end to end (SCN-046…049, SCN-060): the one-line header, the sidebar rail, and an agent console
// beside the dashboard, driven against the real app with a scripted runtime standing in for Claude Code.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering, waitFor } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

/** A stand-in runtime: says where it runs and with which arguments, echoes lines, exits on "bye". */
const FAKE_CLAUDE = `#!/bin/sh
printf 'fake-claude ready in %s path:[%s]\\r\\n' "$PWD" "$PATH"
[ -f "$FABRIC_DASHBOARDS_CONTEXT" ] && printf 'ctx:[present]\\r\\n'
printf 'args:[%s]\\r\\n' "$*"
while IFS= read -r line; do
  [ "$line" = bye ] && exit 0
  printf 'you said: %s\\r\\n' "$line"
done
`;

/** The terminal's text with its rows joined: a narrow console wraps long lines across rows. */
const termText = (page: Page) => page.locator('.console-term .xterm-rows').innerText().then((t) => t.replace(/\n/g, ''), () => '');

// SCN-063 (LC-17, FD-49): with less than 5 GB free on the folder's disk the console defers every start and says
// why. The steps that need a running runtime are then walked only where there is room, as update.test.ts does;
// on a short disk each test proves the deferral instead.
const roomy = (dir: string) => { const st = fs.statfsSync(dir); return st.bavail * st.bsize >= 5 * 1024 ** 3; };
async function deferred(page: Page): Promise<void> {
  await page.getByText(/Not started: only [\d.]+ GB is free on this disk, and a session needs 5 GB\. Free some space, then start again\./).first().waitFor({ timeout: 20_000 });
  assert.doesNotMatch(await termText(page), /fake-claude ready/, 'nothing was spawned');
}

test('ADR-0017: a one-line header, a folding sidebar, and an agent console beside the dashboard', { timeout: 180_000 }, async () => {
  const base = tmp('fd-e2e-focus-');
  const services = path.join(base, 'services');
  const runtimes = path.join(base, 'bin');
  const repo = path.join(base, 'sample-repo');
  const userData = path.join(base, 'app');
  for (const d of [services, runtimes, repo, userData]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(runtimes, 'claude'), FAKE_CLAUDE, { mode: 0o755 });
  // The folder chosen for this service before (SCN-049 "Other…"): the dialog is not part of the walk.
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ consoles: { 'sample.default': { runtime: null, folder: repo } } }), { mode: 0o600 });
  const port = await freePort();
  const proc = serve(port, path.join(base, 'data'), ['--name', 'Sample Service']);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, path.join(base, 'data'), services);
    const env = { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, FD_TEST_RUNTIME_DIRS: runtimes, LANG: 'en_US.UTF-8' };
    app = await electron.launch({ args: [ROOT, 'fabric-dashboards://service/sample.default'], env });
    const page = await app.firstWindow();
    await page.getByRole('heading', { level: 1, name: 'Sample Service' }).waitFor({ timeout: 20_000 });

    // SCN-046: one line by default; the full card opens and closes on demand.
    const head = page.locator('.svc-head');
    assert.ok((await head.boundingBox())!.height < 64, 'the header is one line');
    assert.equal(await page.getByRole('button', { name: 'Show data folder' }).count(), 0, 'the card is folded away');
    await page.getByRole('button', { name: 'Show details' }).click();
    await page.getByRole('button', { name: 'Show data folder' }).waitFor();
    assert.ok((await head.boundingBox())!.height > 100, 'the full card is open');
    await page.getByRole('button', { name: 'Hide details' }).click();
    await page.getByRole('button', { name: 'Show data folder' }).waitFor({ state: 'detached' });

    // The embedded dashboard's native view follows the space the panels leave (REQ-11).
    const viewWidth = () => app!.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]!;
      const kids = (w.contentView as unknown as { children: { getBounds(): { width: number } }[] }).children;
      return kids.length ? kids[kids.length - 1]!.getBounds().width : 0;
    });
    const hostWidth = () => page.locator('.dash-host').evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const before = await waitFor('the dashboard view', async () => { const w = await viewWidth(); return w > 0 ? w : 0; });
    await shot(page, '20-compact-header');

    // SCN-048: the console opens beside the dashboard; the view narrows to match.
    await page.getByRole('button', { name: 'Console' }).click();
    const panel = page.getByRole('complementary', { name: 'Console' });
    await panel.waitFor();
    await waitFor('the view to narrow', async () => { const v = await viewWidth(); const h = await hostWidth(); return v < before && Math.abs(v - h) <= 2 ? v : 0; });

    // SCN-060 (DEC-0036 ED-7): the console's edge stops where the dashboard keeps its 480 px floor; a
    // narrower window narrows the console first, and a wider one gives back the width dragged to.
    const setWindowWidth = (width: number) => app!.evaluate(({ BrowserWindow }, w) => { const win = BrowserWindow.getAllWindows()[0]!; win.setSize(w, win.getSize()[1]!); }, width);
    const splitWidth = () => page.locator('.svc-split').evaluate((el) => el.getBoundingClientRect().width);
    const edge = page.locator('.console-edge');
    const valueOf = async (name: 'aria-valuenow' | 'aria-valuemax') => Number(await edge.getAttribute(name));
    await setWindowWidth(1400);
    await waitFor('the window to widen', async () => (await splitWidth()) > 1100);
    await edge.focus();
    for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowLeft');
    const max = Math.floor((await splitWidth()) - 480);
    assert.equal(await valueOf('aria-valuemax'), max, 'the separator says where it stops');
    await waitFor('the console to stop at the floor', async () => (await valueOf('aria-valuenow')) === max);
    await waitFor('the dashboard view to keep 480 px', async () => { const v = await viewWidth(); return v >= 480 && v <= 482 && Math.abs(v - await hostWidth()) <= 2; });
    await shot(page, '25-console-at-the-floor');
    await setWindowWidth(1100);
    await waitFor('the console to give way first', async () => (await valueOf('aria-valuenow')) === Math.floor((await splitWidth()) - 480));
    assert.ok((await hostWidth()) >= 480, 'the dashboard keeps its floor in a narrower window');
    await setWindowWidth(1400);
    await waitFor('the remembered width to come back', async () => (await valueOf('aria-valuenow')) === max);
    // SCN-060 alt paths: the left arrow key at the floor changes nothing; in the smallest window with the full sidebar
    // the console keeps its 320 px and the dashboard gets what is left; a wider window gives back the remembered width.
    await page.keyboard.press('ArrowLeft');
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(await valueOf('aria-valuenow'), max, 'the left arrow key at the floor changes nothing');
    await setWindowWidth(960);
    await waitFor('the console to keep its 320 px', async () => Math.round(await panel.evaluate((el) => el.getBoundingClientRect().width)) === 320);
    assert.ok((await hostWidth()) < 480 && (await hostWidth()) > 0, 'the dashboard gets what is left, laid out by the page');
    await setWindowWidth(1400);
    await waitFor('the remembered width to come back again', async () => (await valueOf('aria-valuenow')) === max);
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight'); // back to a narrow console for the steps below

    await shot(page, '21a-console-idle');
    // SCN-049: the runtime runs in the chosen folder; input reaches it; Continue passes its resume flag.
    await page.getByRole('button', { name: 'New session' }).click();
    if (!roomy(repo)) { await deferred(page); return; }
    await waitFor('the runtime to start', async () => (await termText(page)).includes(`fake-claude ready in ${fs.realpathSync(repo)}`) || (await termText(page)).includes(`fake-claude ready in ${repo}`));
    // FD-39 SCN-053 (ADR-0020): the runtime starts holding the agent's context — its MCP and a brief naming it.
    const pack = path.join(userData, 'consoles', 'sample.default');
    await waitFor('the context pack to reach the runtime', async () => { const x = await termText(page); return x.includes('ctx:[present]') && x.includes(`args:[--mcp-config=${pack}/mcp.json --append-system-prompt You are working on a Fabric agent, opened from Fabric Dashboards. Call the fabric-dashboards tool service_context with key sample.default`); });
    // FD-47 (DEC-0042): the same folder carries the contract's manifest, which Fabric reads the same way.
    const manifest = JSON.parse(fs.readFileSync(path.join(pack, 'handoff.json'), 'utf8')) as { format: string; firstCall: { arguments: { key: string } }; launch: { runtime: string } };
    assert.equal(manifest.format, 'session-handoff/1');
    assert.equal(manifest.firstCall.arguments.key, 'sample.default');
    assert.equal(manifest.launch.runtime, 'claude-code');
    const context = fs.readFileSync(path.join(pack, 'context.md'), 'utf8');
    assert.match(context, /# Sample Service \(sample\.default\)/);
    assert.match(context, /\*\*State:\*\* (ready|degraded)/);
    assert.ok(!context.includes('tokenFile'), 'the token file is never in the context');
    assert.equal(fs.statSync(path.join(pack, 'context.md')).mode & 0o777, 0o600);
    assert.ok((await termText(page)).includes(`path:[${runtimes}]`), 'review R-1: the session runs on the PATH the runtimes were found on');
    await page.locator('.console-term').click();
    await page.keyboard.type('hello');
    await page.keyboard.press('Enter');
    await waitFor('the echo', async () => (await termText(page)).includes('you said: hello'));
    await shot(page, '21-console-running');

    // Folded while running: the session goes on, and what it printed comes back.
    await page.getByRole('button', { name: 'Hide console' }).first().click();
    await panel.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Console' }).click();
    await waitFor('the replay', async () => (await termText(page)).includes('you said: hello'));

    await page.locator('.console-term').click();
    await page.keyboard.type('bye');
    await page.keyboard.press('Enter');
    await page.getByText('Exited (code 0).').waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Continue last' }).click();
    await waitFor('the resumed runtime', async () => /--continue\]/.test(await termText(page)));

    // Stop asks first, then ends the session.
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByRole('group', { name: 'Stop this session?' }).getByRole('button', { name: 'Stop' }).click();
    await page.getByText('Stopped.').waitFor({ timeout: 15_000 });

    // FD-39 SCN-054: the agent stops answering; "Fix with agent" starts the runtime with the context and the task.
    await stopProcess(proc);
    await page.getByRole('button', { name: 'Fix with agent' }).first().waitFor({ timeout: 60_000 });
    await shot(page, '24-fix-with-agent');
    await page.getByRole('button', { name: 'Fix with agent' }).first().click();
    await waitFor('the runtime to start on the task', async () => /Do the task in [^\]]*task\.md\.\]/.test(await termText(page)));
    assert.match(fs.readFileSync(path.join(pack, 'task.md'), 'utf8'), /^# Task: Sample Service is (down|stopped)/);
    await page.locator('.console-term').click();
    await page.keyboard.type('bye');
    await page.keyboard.press('Enter');
    await page.getByText('Exited (code 0).').waitFor({ timeout: 15_000 });

    // FD-39 SCN-056: pin the agent to the top; a Pinned section holds it, and the choice is remembered.
    // FD-78: the row's actions live in one small menu.
    const rowMenu = async () => {
      await page.locator('.nav-row').filter({ hasText: 'Sample Service' }).hover();
      await page.getByRole('button', { name: 'Actions for Sample Service' }).click();
    };
    await rowMenu();
    await shot(page, '23a-row-menu');
    const item = (await page.getByRole('menuitem', { name: 'Pin Sample Service to the top' }).boundingBox())!;
    assert.ok(item.x >= 0 && item.y >= 0 && item.x + item.width <= 1440, 'the row menu opens on screen, beside its row');
    await page.getByRole('menuitem', { name: 'Pin Sample Service to the top' }).click();
    await page.locator('.nav-section', { hasText: 'Pinned' }).waitFor();
    await rowMenu();
    await page.getByRole('menuitem', { name: 'Unpin Sample Service' }).waitFor();
    await page.keyboard.press('Escape');
    await shot(page, '23-pinned');

    // FD-78 SCN-073: the Connections tab says what the agent offers and what the app sees of what it uses.
    await page.getByRole('tab', { name: 'Connections' }).click();
    await page.getByRole('heading', { name: 'Used by' }).waitFor();
    await page.getByText('does not declare its connections yet').waitFor();
    await shot(page, '25-connections');

    // SCN-047: the sidebar folds into a rail; entries keep their names for a screen reader.
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await page.locator('.app.rail').waitFor();
    assert.ok((await page.locator('.sidebar').boundingBox())!.width <= 80, 'the rail is narrow');
    await page.getByRole('button', { name: /Sample Service/ }).first().waitFor();
    await shot(page, '22-rail-and-console');

    // Remembered (Settings.layout, Settings.consoles).
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8'));
    assert.equal(saved.layout.sidebar, 'collapsed');
    assert.equal(saved.layout.header, 'compact');
    assert.equal(saved.layout.console.open, true);
    assert.equal(saved.consoles['sample.default'].runtime, 'claude-code');
    assert.equal(saved.consoles['sample.default'].folder, repo);
    assert.deepEqual(saved.layout.list.pinned, ['sample'], 'SCN-056: the pin is remembered');

    // FD-78 SCN-071/072: shown as a service, then hidden in the folded section; it stays watched, and shows again.
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await page.locator('.app:not(.rail)').waitFor();
    await rowMenu();
    await page.getByRole('menuitem', { name: 'Unpin Sample Service' }).click();
    await rowMenu();
    await page.getByRole('menuitem', { name: 'Show as a service' }).click();
    await page.locator('.nav-section', { hasText: 'Services' }).waitFor();
    await rowMenu();
    await page.getByRole('menuitem', { name: 'Hide' }).click();
    const fold = page.getByRole('button', { name: /Hidden: 1/ });
    await fold.waitFor();
    assert.equal(await fold.getAttribute('aria-expanded'), 'false', 'hidden agents are folded');
    await fold.click();
    await rowMenu();
    await page.getByRole('menuitem', { name: 'Show again' }).click();
    await page.locator('.nav-section', { hasText: 'Services' }).waitFor();
    await shot(page, '26-categories');
    const list = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).layout.list;
    await waitFor('the list choices to be saved', async () => list().hidden.length === 0 && list().kinds.sample === 'service');
    assert.deepEqual([list().hidden, list().kinds, list().pinned], [[], { sample: 'service' }, []]);
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});

test('FD-39 SCN-058: a first launch opens the setup beside Overview; the coding agent starts on setup.md with one click', { timeout: 120_000 }, async () => {
  const base = tmp('fd-e2e-setup-');
  const services = path.join(base, 'services');
  const runtimes = path.join(base, 'bin');
  const home = path.join(base, 'home');
  const userData = path.join(base, 'app');
  for (const d of [services, runtimes, home, userData]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(runtimes, 'claude'), FAKE_CLAUDE, { mode: 0o755 });
  let app: ElectronApplication | null = null;
  try {
    // HOME is a fresh one: nothing registered, no skills — the checklist must show every step open.
    const env = { ...process.env, HOME: home, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, FD_TEST_RUNTIME_DIRS: runtimes, LANG: 'en_US.UTF-8' };
    app = await electron.launch({ args: [ROOT], env });
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: 'Set up Fabric with your coding agent' }).waitFor({ timeout: 20_000 });
    assert.equal(await page.locator('.checklist li.done').count(), 0, 'nothing is set up yet');
    const panel = page.getByRole('complementary', { name: 'Console' });
    await panel.waitFor({ timeout: 10_000 }); // it opened by itself, and runs nothing until the click
    assert.equal(await page.getByRole('button', { name: 'Set up with my coding agent' }).count(), 0, 'the console is already open');
    await page.getByRole('button', { name: 'New session' }).click();
    if (!roomy(home)) { await deferred(page); return; }
    const pack = path.join(userData, 'consoles', 'fabric-dashboards.setup');
    await waitFor('the agent to start on setup.md', async () => { const x = await termText(page); return x.includes(`fake-claude ready in ${home}`) && x.includes(`${pack}/setup.md and run the setup with me, step by step.]`) && x.includes('--mcp-config'); });
    assert.match(fs.readFileSync(path.join(pack, 'setup.md'), 'utf8'), /claude mcp add --scope user fabric-dashboards -e ELECTRON_RUN_AS_NODE=1 -- /);
    await shot(page, '25-setup');
    await page.locator('.console-term').click();
    await page.keyboard.type('bye');
    await page.keyboard.press('Enter');
    await page.getByText('Exited (code 0).').waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    await page.getByRole('heading', { name: 'Set up Fabric with your coding agent' }).waitFor({ state: 'detached' });
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).setupDone, true, 'hidden for good');
    // Settings keeps the setup reachable; a setup that ran before continues where it was.
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('heading', { name: 'Setup', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Set up with my coding agent' }).click();
    await page.getByRole('heading', { name: 'Set up Fabric with your coding agent' }).waitFor();
    await page.getByRole('button', { name: 'Hide console' }).first().click(); // the card offers Continue once the console is closed
    await page.getByRole('button', { name: 'Continue setup' }).click();
    await waitFor('the setup to continue', async () => { const x = await termText(page); return x.includes('--continue') && x.includes('setup.md and run the setup with me'); });
  } finally {
    await closeApp(app);
  }
});

test('FD-39 SCN-059: a later visit opens on what changed, and Continue resumes the agent\'s console with fresh context', { timeout: 120_000 }, async () => {
  const base = tmp('fd-e2e-visit-');
  const services = path.join(base, 'services');
  const runtimes = path.join(base, 'bin');
  const repo = path.join(base, 'sample-repo');
  const userData = path.join(base, 'app');
  for (const d of [services, runtimes, repo, userData]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(runtimes, 'claude'), FAKE_CLAUDE, { mode: 0o755 });
  // The previous visit: a day ago, before Sample Service was installed; its console was used since.
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({
    setupDone: true, launchAtLoginAsked: true, lastVisitAt: new Date(Date.now() - 86_400_000).toISOString(), knownServices: ['gone.default'],
    lastService: 'sample.default', consoles: { 'sample.default': { runtime: 'claude-code', folder: repo } },
  }), { mode: 0o600 });
  const port = await freePort();
  const proc = serve(port, path.join(base, 'data'), ['--name', 'Sample Service']);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, path.join(base, 'data'), services);
    const env = { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, FD_TEST_RUNTIME_DIRS: runtimes, LANG: 'en_US.UTF-8' };
    app = await electron.launch({ args: [ROOT], env });
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: 'Since you were last here' }).waitFor({ timeout: 20_000 });
    await page.getByText('New: Sample Service').waitFor();
    await page.getByText('Gone: gone.default').waitFor();
    await shot(page, '26-since-last-visit');
    await page.getByRole('button', { name: 'Continue with Sample Service' }).click();
    if (!roomy(repo)) { await deferred(page); return; }
    await waitFor('the resumed session with its context', async () => { const x = await termText(page); return x.includes('ctx:[present]') && /--continue\]/.test(x); });
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8'));
    assert.ok(Date.now() - Date.parse(saved.lastVisitAt) < 120_000, 'this visit is the next one\'s baseline');
    assert.deepEqual(saved.knownServices, ['sample.default']);
    assert.equal(saved.lastService, 'sample.default');
    await page.locator('.console-term').click();
    await page.keyboard.type('bye');
    await page.keyboard.press('Enter');
    await page.getByText('Exited (code 0).').waitFor({ timeout: 15_000 });
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});
