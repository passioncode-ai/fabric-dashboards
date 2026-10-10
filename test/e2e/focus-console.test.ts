// ADR-0017 end to end (SCN-046…049): the one-line header, the sidebar rail, and an agent console
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

    // SCN-049: the runtime runs in the chosen folder; input reaches it; Continue passes its resume flag.
    await page.getByRole('button', { name: 'New session' }).click();
    await waitFor('the runtime to start', async () => (await termText(page)).includes(`fake-claude ready in ${fs.realpathSync(repo)}`) || (await termText(page)).includes(`fake-claude ready in ${repo}`));
    // FD-39 SCN-053 (ADR-0020): the runtime starts holding the agent's context — its MCP and a brief naming it.
    const pack = path.join(userData, 'consoles', 'sample.default');
    await waitFor('the context pack to reach the runtime', async () => { const x = await termText(page); return x.includes('ctx:[present]') && x.includes(`args:[--mcp-config ${pack}/mcp.json --append-system-prompt You are working on the Fabric agent "Sample Service" (sample.default)`); });
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

    // FD-39 SCN-056: pin the agent to the top; a Pinned section holds it, and the choice is remembered.
    await page.locator('.nav-row').filter({ hasText: 'Sample Service' }).hover();
    await page.getByRole('button', { name: 'Pin Sample Service to the top' }).click();
    await page.locator('.nav-section', { hasText: 'Pinned' }).waitFor();
    await page.getByRole('button', { name: 'Unpin Sample Service' }).waitFor();
    await shot(page, '23-pinned');

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
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});
