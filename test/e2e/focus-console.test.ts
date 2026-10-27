// ADR-0017 end to end (SCN-046…049), FD-92: the one-line header, the sidebar rail, and an agent console that drops
// down over the dashboard, driven against the real app with a scripted runtime standing in for Claude Code.
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
/** FD-92: the console drawer is a view of its own over the content area; Playwright sees its page as a window. */
async function drawerOf(app: ElectronApplication): Promise<Page> {
  return waitFor('the console drawer\'s page', async () => app.windows().find((p) => p.url().includes('drawer=1')) ?? null) as Promise<Page>;
}
/** The window's child views, bottom first: a dashboard and, over it, the drawer. */
const childBounds = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) =>
  (BrowserWindow.getAllWindows()[0]!.contentView as unknown as { children: { getBounds(): { x: number; y: number; width: number; height: number } }[] }).children.map((c) => c.getBounds()));

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
    const before = await waitFor('the dashboard view', async () => { const w = await viewWidth(); return w > 0 ? w : 0; });
    await shot(page, '20-compact-header');

    // SCN-048 (FD-92): the console drops down from under the bar, over the dashboard; the dashboard keeps its size.
    const dash = (await childBounds(app))[0]!;
    await page.getByRole('button', { name: 'Console' }).click();
    const con = await drawerOf(app);
    await con.getByRole('region', { name: 'Console' }).waitFor();
    await waitFor('the drawer over the dashboard', async () => {
      const kids = await childBounds(app);
      return kids.length === 2 && JSON.stringify(kids[0]) === JSON.stringify(dash) && kids[1]!.y <= dash.y && kids[1]!.height < dash.height;
    });
    assert.ok((await viewWidth()) >= before, 'the dashboard was not narrowed');
    // Its bottom edge sets the height, remembered; the page always shows under it.
    const edge = con.locator('.console-edge');
    const h0 = Number(await edge.getAttribute('aria-valuenow'));
    await edge.focus();
    for (let i = 0; i < 3; i++) await con.keyboard.press('ArrowDown');
    await waitFor('the drawer to grow', async () => Number(await edge.getAttribute('aria-valuenow')) === h0 + 72);
    await waitFor('the height to be remembered', async () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).layout?.console?.height === h0 + 72);
    for (let i = 0; i < 60; i++) await con.keyboard.press('ArrowDown');
    await waitFor('the drawer to stop above the bottom', async () => Number(await edge.getAttribute('aria-valuenow')) === Number(await edge.getAttribute('aria-valuemax')));
    for (let i = 0; i < 60; i++) await con.keyboard.press('ArrowUp');
    await waitFor('the drawer at its smallest', async () => Number(await edge.getAttribute('aria-valuenow')) === 180);
    for (let i = 0; i < 6; i++) await con.keyboard.press('ArrowDown');

    await shot(page, '21a-console-idle');
    // SCN-049: the runtime runs in the chosen folder; input reaches it; Continue passes its resume flag.
    await con.getByRole('button', { name: 'New session' }).click();
    if (!roomy(repo)) { await deferred(con); return; }
    await waitFor('the runtime to start', async () => (await termText(con)).includes(`fake-claude ready in ${fs.realpathSync(repo)}`) || (await termText(con)).includes(`fake-claude ready in ${repo}`));
    // FD-39 SCN-053 (ADR-0020): the runtime starts holding the agent's context — its MCP and a brief naming it.
    const pack = path.join(userData, 'consoles', 'sample.default');
    await waitFor('the context pack to reach the runtime', async () => { const x = await termText(con); return x.includes('ctx:[present]') && x.includes(`args:[--mcp-config=${pack}/mcp.json --append-system-prompt You are working on a Fabric agent, opened from Fabric Dashboards. Call the fabric-dashboards tool service_context with key sample.default`); });
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
    assert.ok((await termText(con)).includes(`path:[${runtimes}]`), 'review R-1: the session runs on the PATH the runtimes were found on');
    await con.locator('.console-term').click();
    await con.keyboard.type('hello');
    await con.keyboard.press('Enter');
    await waitFor('the echo', async () => (await termText(con)).includes('you said: hello'));
    await shot(page, '21-console-running');

    // FD-92: collapsed while running (from the drawer, or the bar's Console button): the session goes on, the dashboard
    // shows whole again, and what it printed comes back.
    await con.getByRole('button', { name: 'Collapse console' }).click();
    await waitFor('the drawer to fold', async () => (await childBounds(app)).length === 1);
    await page.getByRole('button', { name: 'Console' }).click();
    await waitFor('the drawer back', async () => (await childBounds(app)).length === 2);
    await waitFor('the replay', async () => (await termText(con)).includes('you said: hello'));

    await con.locator('.console-term').click();
    await con.keyboard.type('bye');
    await con.keyboard.press('Enter');
    await con.getByText('The session exited with code 0.').waitFor({ timeout: 15_000 });
    await con.getByRole('button', { name: 'Continue last' }).click();
    await waitFor('the resumed runtime', async () => /--continue\]/.test(await termText(con)));

    // FD-92: the bar's Console button folds it and the session goes on; the red cross asks first, ends the session
    // and folds the console.
    await page.getByRole('button', { name: 'Console' }).click();
    await waitFor('the drawer to fold from the bar', async () => (await childBounds(app)).length === 1);
    await page.getByRole('button', { name: 'Console' }).click();
    await waitFor('the resumed runtime still there', async () => /--continue\]/.test(await termText(con)));
    await con.getByRole('button', { name: 'Close console' }).click();
    await con.getByRole('group', { name: 'End this session and close the console?' }).getByRole('button', { name: 'Close console' }).click();
    await waitFor('the console to close', async () => (await childBounds(app)).length === 1);
    await page.getByRole('button', { name: 'Console' }).click();
    await con.getByText('Stopped.').waitFor({ timeout: 15_000 });

    // FD-39 SCN-054: the agent stops answering; "Fix with coding agent" starts the runtime with the context and the task.
    await stopProcess(proc);
    await page.getByRole('button', { name: 'Fix with coding agent' }).first().waitFor({ timeout: 60_000 });
    await shot(page, '24-fix-with-agent');
    await page.getByRole('button', { name: 'Fix with coding agent' }).first().click();
    await waitFor('the runtime to start on the task', async () => /Do the task in [^\]]*task\.md\.\]/.test(await termText(con)));
    assert.match(fs.readFileSync(path.join(pack, 'task.md'), 'utf8'), /^# Task: Sample Service is (down|stopped)/);
    await con.locator('.console-term').click();
    await con.keyboard.type('bye');
    await con.keyboard.press('Enter');
    await con.getByText('The session exited with code 0.').waitFor({ timeout: 15_000 });

    // FD-81 SCN-074: the auditor hands the same agent's findings to the coding agent picked in its row.
    await page.getByRole('button', { name: /^Agent map/ }).first().click();
    const auditRow = page.locator('.audit-group', { hasText: 'Sample Service' });
    await auditRow.getByRole('combobox').waitFor();
    assert.equal(await auditRow.getByRole('combobox').inputValue(), 'claude-code', 'the runtime chosen for this agent');
    await shot(page, '24a-auditor');
    await auditRow.getByRole('button', { name: 'Fix with coding agent' }).click();
    await waitFor('the audit task to be written', () => /^# Task: Audit findings for Sample Service/.test(fs.readFileSync(path.join(pack, 'task.md'), 'utf8')));
    assert.match(fs.readFileSync(path.join(pack, 'task.md'), 'utf8'), /the Fabric Dashboards auditor found/);
    await page.getByRole('heading', { level: 1, name: 'Sample Service' }).waitFor();
    await waitFor('the runtime to start on the audit task', async () => /Do the task in [^\]]*task\.md\.\]/.test(await termText(con)) && !(await termText(con)).includes('The session exited with code 0.'));
    await con.locator('.console-term').click();
    await con.keyboard.type('bye');
    await con.keyboard.press('Enter');
    await waitFor('the second session to end', async () => (await con.getByText('The session exited with code 0.').count()) > 0);

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
    // Seen 2026-10-27: a menu wider than the room left of its button started off the window. It fits the sidebar.
    const menuBox = (await page.getByRole('menu', { name: 'Sample Service' }).boundingBox())!;
    const row = (await page.locator('.nav-row').filter({ hasText: 'Sample Service' }).boundingBox())!;
    assert.ok(menuBox.x >= 8 && menuBox.x + menuBox.width <= row.x + row.width + 1, `the row menu stays over the sidebar (menu ${menuBox.x}..${menuBox.x + menuBox.width}, row ends at ${row.x + row.width})`);
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
    // FD-129 (UX-23): in the rail a right-click opens the same row menu beside the row; Escape gives focus back to it.
    await page.locator('.nav-row .nav-item', { hasText: 'Sample Service' }).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Unpin Sample Service' }).waitFor();
    const railMenu = (await page.getByRole('menu', { name: 'Sample Service' }).boundingBox())!;
    assert.ok(railMenu.x >= (await page.locator('.sidebar').boundingBox())!.width, 'the rail menu opens beside the rail');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('menu').count(), 0);

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

    // FD-121 SCN-072: in the open fold the eye brings a hidden agent back with one press.
    await rowMenu();
    await page.getByRole('menuitem', { name: 'Hide' }).click();
    await page.getByRole('button', { name: 'Show Sample Service again' }).click();
    await page.locator('.nav-section', { hasText: 'Services' }).waitFor();
    await waitFor('the eye to show the agent again', async () => list().hidden.length === 0);

    // FD-121 SCN-087: the sidebar's edge follows the pointer and is kept; double-click and Home bring back 240 px.
    const sideEdge = page.getByRole('separator', { name: 'Sidebar width' });
    const sideBox = (await sideEdge.boundingBox())!;
    await page.mouse.move(sideBox.x + sideBox.width / 2, sideBox.y + 200);
    await page.mouse.down();
    await page.mouse.move(320, sideBox.y + 220, { steps: 8 });
    await page.mouse.up();
    const width = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).layout.sidebarWidth;
    await waitFor('the dragged width to be saved', async () => width() === 320);
    assert.equal(Math.round((await page.locator('nav.sidebar').boundingBox())!.width), 320, 'the sidebar is as wide as dragged');
    await shot(page, '27-sidebar-width');
    await sideEdge.dblclick();
    await waitFor('double-click to return to 240', async () => width() === 240);
    await sideEdge.focus();
    await page.keyboard.press('ArrowRight');
    await waitFor('the arrow to widen by a step', async () => width() === 256);
    await page.keyboard.press('Home');
    await waitFor('Home to return to 240', async () => width() === 240);
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
    const con = await drawerOf(app);
    await con.getByRole('region', { name: 'Console' }).waitFor({ timeout: 10_000 }); // it opened by itself, and runs nothing until the click
    assert.equal(await page.getByRole('button', { name: 'Set up with my coding agent' }).count(), 0, 'the console is already open');
    await con.getByRole('button', { name: 'New session' }).click();
    if (!roomy(home)) { await deferred(con); return; }
    const pack = path.join(userData, 'consoles', 'fabric-dashboards.setup');
    await waitFor('the agent to start on setup.md', async () => { const x = await termText(con); return x.includes(`fake-claude ready in ${home}`) && x.includes(`${pack}/setup.md and run the setup with me, step by step.]`) && x.includes('--mcp-config'); });
    assert.match(fs.readFileSync(path.join(pack, 'setup.md'), 'utf8'), /claude mcp add --scope user fabric-dashboards -e ELECTRON_RUN_AS_NODE=1 -- /);
    await shot(page, '25-setup');
    await con.locator('.console-term').click();
    await con.keyboard.type('bye');
    await con.keyboard.press('Enter');
    await con.getByText('The session exited with code 0.').waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    await page.getByRole('heading', { name: 'Set up Fabric with your coding agent' }).waitFor({ state: 'detached' });
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).setupDone, true, 'hidden for good');
    // Settings keeps the setup reachable; a setup that ran before continues where it was.
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('heading', { name: 'Setup', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Set up with my coding agent' }).click();
    await page.getByRole('heading', { name: 'Set up Fabric with your coding agent' }).waitFor();
    await con.getByRole('button', { name: 'Collapse console' }).click(); // the card offers Continue once the console is folded
    await page.getByRole('button', { name: 'Continue setup' }).click();
    await waitFor('the setup to continue', async () => { const x = await termText(con); return x.includes('--continue') && x.includes('setup.md and run the setup with me'); });
  } finally {
    await closeApp(app);
  }
});

test('FD-113 UX-13 (SCN-058 alt path): with no coding agent installed the setup card lists each install command with Copy', { timeout: 60_000 }, async () => {
  const base = tmp('fd-e2e-noruntime-');
  const services = path.join(base, 'services');
  const runtimes = path.join(base, 'bin'); // found nothing: no coding agent on this machine
  const home = path.join(base, 'home');
  const userData = path.join(base, 'app');
  for (const d of [services, runtimes, home, userData]) fs.mkdirSync(d, { recursive: true });
  let app: ElectronApplication | null = null;
  try {
    const env = { ...process.env, HOME: home, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, FD_TEST_RUNTIME_DIRS: runtimes, LANG: 'en_US.UTF-8' };
    app = await electron.launch({ args: [ROOT], env });
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: 'Set up Fabric with your coding agent' }).waitFor({ timeout: 20_000 });
    await page.getByText(/No coding agent is installed yet/).waitFor({ timeout: 15_000 });
    await page.getByText('curl -fsSL https://claude.ai/install.sh | bash').waitFor();
    await page.getByText('npm install -g @openai/codex').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Set up with my coding agent' }).count(), 0, 'nothing to start until one is installed');
    await page.getByRole('button', { name: 'Copy the command that installs Codex' }).click();
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'npm install -g @openai/codex', 'Copy puts the command on the clipboard');
    await page.getByRole('button', { name: 'Copy the command that installs Codex' }).getByText('Copied').waitFor();
    await shot(page, '25a-setup-no-runtime');
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
    const con = await drawerOf(app);
    if (!roomy(repo)) { await deferred(con); return; }
    await waitFor('the resumed session with its context', async () => { const x = await termText(con); return x.includes('ctx:[present]') && /--continue\]/.test(x); });
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8'));
    assert.ok(Date.now() - Date.parse(saved.lastVisitAt) < 120_000, 'this visit is the next one\'s baseline');
    assert.deepEqual(saved.knownServices, ['sample.default']);
    assert.equal(saved.lastService, 'sample.default');
    await con.locator('.console-term').click();
    await con.keyboard.type('bye');
    await con.keyboard.press('Enter');
    await con.getByText('The session exited with code 0.').waitFor({ timeout: 15_000 });
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});
