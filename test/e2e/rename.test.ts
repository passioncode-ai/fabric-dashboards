// End to end, FD-135 (SCN-090): an agent renamed from its row menu. A fake `gh` (FD_TEST_GH) stands for GitHub and keeps
// the one file in a folder: the dialog says where the name goes, Save commits it and the sidebar shows it at once, and
// Use its own name takes it out again. An agent whose descriptor names no repository says why before anything is asked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');

/** A `gh` that answers the calls the app makes: `api graphql` and `api repos/…/contents/.fabric/names.json` with GET, PUT or DELETE. */
function fakeGh(dir: string): { bin: string; file: string; log: string } {
  const file = path.join(dir, 'names.json');
  const log = path.join(dir, 'gh.log');
  const bin = path.join(dir, 'gh');
  fs.writeFileSync(bin, `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
const file = ${JSON.stringify(file)};
const has = fs.existsSync(file);
const field = (n) => { const i = args.findIndex((a, j) => args[j - 1] === '-f' && a.startsWith(n + '=')); return i < 0 ? undefined : args[i].slice(n.length + 1); };
if (args[1] === 'graphql') { process.stdout.write(JSON.stringify({ data: { r0: { object: has ? { text: fs.readFileSync(file, 'utf8') } : null } } })); process.exit(0); }
const x = args.indexOf('-X'); const method = x < 0 ? 'GET' : args[x + 1];
if (method === 'GET') {
  if (!has) { process.stdout.write(JSON.stringify({ message: 'Not Found', status: '404' })); process.stderr.write('gh: Not Found (HTTP 404)\\n'); process.exit(1); }
  process.stdout.write(JSON.stringify({ sha: 's1', content: Buffer.from(fs.readFileSync(file)).toString('base64') })); process.exit(0);
}
if (method === 'DELETE') fs.rmSync(file); else fs.writeFileSync(file, Buffer.from(field('content'), 'base64'));
process.stdout.write(JSON.stringify({ commit: { sha: 'c' + Date.now() } }));
`, { mode: 0o755 });
  return { bin, file, log };
}

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

test('SCN-090: an agent renamed from its row menu shows the name at once; its own name comes back; no repository, no rename', { timeout: 180_000 }, async () => {
  const base = tmp('fd-e2e-rename-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const gh = fakeGh(base);
  const port = await freePort();
  const data = path.join(base, 'sample');
  fs.mkdirSync(data);
  const sample = serve(port, data);
  // An agent that names no repository: its dialog says why, and nothing is asked of GitHub.
  const silentPort = await freePort();
  fs.writeFileSync(path.join(services, 'no-repo.default.json'), JSON.stringify({
    protocol: 'fabric-service/0.1', id: 'no-repo', instance: 'default', name: 'No Repo Agent', origin: `http://127.0.0.1:${silentPort}`,
    auth: { tokenFile: path.join(base, 'no-repo.token') }, lifecycle: { manager: 'launchd', label: 'ai.passioncode.fabric-dashboards.test.no-repo', plist: path.join(base, 'no-repo.plist') },
    paths: { data: path.join(base, 'no-repo'), logs: [] }, installedAt: '2026-11-03T00:00:00Z', installedBy: 'test',
  }));
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, data, services);
    const file = path.join(services, 'sample.default.json');
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...d, source: { repository: 'https://github.com/example/sample-agent' } }));
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), FD_TEST_GH: gh.bin, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    const row = (name: string) => page.locator('.nav-item', { hasText: name }).first();
    await row('Sample Service').waitFor({ timeout: 30_000 });

    // Steps 1-3: Rename… says where the name goes; Save commits it and the sidebar shows it at once.
    await row('Sample Service').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rename agent' });
    await dialog.waitFor();
    await dialog.getByText("Saved in the agent's repository on GitHub (example/sample-agent), so each of your Macs shows it.").waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Save' }).isDisabled(), true, 'the same name saves nothing');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('  Agent of experiments ');
    await dialog.getByRole('textbox', { name: 'Name' }).press('Enter');
    await row('Agent of experiments').waitFor({ timeout: 15_000 });
    assert.equal(await dialog.count(), 0, 'the dialog closes once GitHub took the name');
    assert.deepEqual(JSON.parse(fs.readFileSync(gh.file, 'utf8')), { schema: 'fabric-names/1', names: { 'sample.default': 'Agent of experiments' } });
    assert.ok(fs.readFileSync(gh.log, 'utf8').includes('repos/example/sample-agent/contents/.fabric/names.json'));

    // Step 4: the agent's own name is one click away, and taking the name out removes the file.
    await row('Agent of experiments').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename…' }).click();
    await dialog.getByText('Its own name: Sample Service').waitFor();
    await dialog.getByRole('button', { name: 'Use its own name' }).click();
    await row('Sample Service').waitFor({ timeout: 15_000 });
    assert.equal(fs.existsSync(gh.file), false, 'the last name gone, the file goes');

    // No repository: the field is off and the dialog says why; Escape closes it.
    const writesAsked = () => fs.readFileSync(gh.log, 'utf8').split('\n').filter((l) => l && !l.includes('graphql')).length;
    const before = writesAsked();
    await row('No Repo Agent').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename…' }).click();
    await dialog.getByText('The agent does not name its repository, so the name has nowhere to go.').waitFor();
    assert.equal(await dialog.getByRole('textbox', { name: 'Name' }).isDisabled(), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(writesAsked(), before, 'nothing was asked of GitHub for it');
  } finally {
    await closeApp(app);
    await stopProcess(sample);
  }
});
