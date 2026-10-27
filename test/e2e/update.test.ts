// End to end, FD-02: SCN-021 (update a service with its declared command) and SCN-055 (when that fails, Update
// with agent starts the coding agent on the update task) walked on a real Electron.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { freePort, tmp } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const fixture = (n: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/contract', n), 'utf8'));

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

const FAKE_CLAUDE = `#!/bin/sh
printf 'fake-claude ready\\r\\nargs:[%s]\\r\\n' "$*"
while IFS= read -r line; do [ "$line" = bye ] && exit 0; done
`;
const termText = (page: Page) => page.locator('.console-term .xterm-rows').innerText().then((t) => t.replace(/\n/g, ''), () => '');

test('SCN-021, SCN-055: Update runs the declared command and says how it ended; after a failure, Update with agent takes the task', { timeout: 150_000, skip: process.platform === 'win32' && 'POSIX fake runtime and update script' }, async () => {
  const base = tmp('fd-e2e-update-');
  const services = path.join(base, 'services');
  const runtimes = path.join(base, 'bin');
  const repo = path.join(base, 'repo');
  const userData = path.join(base, 'app');
  for (const d of [services, runtimes, repo, userData]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(runtimes, 'claude'), FAKE_CLAUDE, { mode: 0o755 });
  const script = path.join(base, 'update.sh');
  fs.writeFileSync(script, '#!/bin/sh\necho "fetching 0.3.0"\necho "checksum mismatch" >&2\nexit 3\n', { mode: 0o755 });
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ consoles: { 'example-agent.default': { runtime: null, folder: repo } } }), { mode: 0o600 });
  const port = await freePort();
  const wk = { ...fixture('positive_service-well-known.json'), status: 'ready', degraded: [], process: { pid: process.pid, startedAt: new Date().toISOString() }, update: { available: '0.3.0' } };
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/.well-known/fabric-service')) { res.writeHead(200, { 'content-type': 'application/json' }); return void res.end(JSON.stringify(wk)); }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
  fs.writeFileSync(path.join(services, 'example-agent.default.json'), JSON.stringify({
    protocol: 'fabric-service/0.1', id: 'example-agent', instance: 'default', name: 'Example Agent', origin: `http://127.0.0.1:${port}`,
    auth: { tokenFile: path.join(base, 'service.token') }, lifecycle: { manager: 'none' }, paths: { data: path.join(base, 'data'), logs: [] },
    commands: { update: [script] }, installedAt: '2026-10-13T00:00:00Z', installedBy: 'test',
  }));
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, FD_TEST_RUNTIME_DIRS: runtimes, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.locator('.nav-item', { hasText: 'Example Agent' }).first().click({ timeout: 20_000 });
    const details = page.getByRole('button', { name: 'Show details' });
    if (await details.count()) await details.first().click();

    // SCN-021: Update to 0.3.0 runs the declared command (no shell) and Health shows how it ended, with its output.
    await page.getByRole('button', { name: 'Update to 0.3.0' }).first().click({ timeout: 20_000 });
    await page.getByText('Update finished with exit code 3.').first().waitFor({ timeout: 30_000 });
    await page.getByText(/checksum mismatch/).first().waitFor();

    // SCN-055: the update failed — Update with agent starts the runtime on the update task, with the failed output.
    // SCN-063 (LC-17) decides first: on a disk with less than 5 GB free the console defers the start and says why.
    const st = fs.statfsSync(repo);
    const roomy = st.bavail * st.bsize >= 5 * 1024 ** 3;
    await page.getByRole('button', { name: 'Update with coding agent' }).first().click({ timeout: 20_000 });
    // FD-92: the console is a drawer in a view of its own; Playwright sees its page as a window.
    const deadlineDrawer = Date.now() + 20_000;
    let con = app!.windows().find((p) => p.url().includes('drawer=1'));
    while (!con && Date.now() < deadlineDrawer) { await new Promise((r) => setTimeout(r, 200)); con = app!.windows().find((p) => p.url().includes('drawer=1')); }
    assert.ok(con, 'the console drawer opened');
    if (!roomy) {
      await con.getByText(/Not started: only [\d.]+ GB is free on this disk, and a session needs 5 GB\. Free some space, then start again\./).first().waitFor({ timeout: 20_000 });
      assert.doesNotMatch(await termText(con), /fake-claude ready/, 'nothing was spawned');
      return;
    }
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && !/task\.md/.test(await termText(con))) await new Promise((r) => setTimeout(r, 250));
    assert.match(await termText(con), /task\.md/, 'the runtime starts on the task');
    const pack = path.join(userData, 'consoles', 'example-agent.default', 'task.md');
    const task = fs.readFileSync(pack, 'utf8');
    assert.match(task, /^# Task: /);
    assert.match(task, /0\.3\.0/, 'the task names the version to reach');
    assert.match(task, /checksum mismatch/, 'and the failed output');
  } finally {
    await closeApp(app);
    server.close();
  }
});
