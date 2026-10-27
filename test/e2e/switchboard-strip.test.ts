// FD-43, FD-51 (SCN-064, SCN-065 step 2): what Switchboard runs in an agent's folder, end to end against the real app.
// Switchboard is a shell fake that lists three sessions: one running in the agent's folder whose pool has moved it to
// another account after a limit, one ended there, and one running elsewhere. The console's strip shows only the first,
// with its account, mode and start, and the move; the list is read again while the console is on screen and no more
// once it is folded away.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering, waitFor } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

async function drawerOf(app: ElectronApplication): Promise<Page> {
  return waitFor('the console drawer\'s page', async () => app.windows().find((p) => p.url().includes('drawer=1')) ?? null) as Promise<Page>;
}

test('SCN-064, SCN-065: the console shows what Switchboard runs in its folder, and a move after a limit', { timeout: 180_000, skip: process.platform === 'win32' && 'POSIX shell fake' }, async () => {
  const base = tmp('fd-e2e-sbstrip-');
  const services = path.join(base, 'services');
  const bin = path.join(base, 'bin');
  const repo = path.join(base, 'sample-repo');
  const elsewhere = path.join(base, 'other-repo');
  const userData = path.join(base, 'app');
  const journal = path.join(base, 'journal.txt');
  for (const d of [services, bin, repo, elsewhere, userData]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const at = Math.floor(Date.now() / 1000) - 600;
  const session = (dir: string, state: string, id: string) => ({ state, mode: 'managed', provider: 'claude', pool: 'default', account_id: 'acc-a', label: 'claude4', launched_at: at, working_directory: dir, id });
  const ok = (data: unknown) => `'${JSON.stringify({ ok: true, data })}'`;
  fs.writeFileSync(path.join(bin, 'switchboard'), [
    '#!/bin/sh',
    `echo "$*" >> '${journal}'`,
    'case "$*" in',
    `  "--json sessions") printf '%s' ${ok({ sessions: [session(repo, 'running', 's1'), session(repo, 'ended', 's2'), session(elsewhere, 'running', 's3')] })} ;;`,
    // The pool now routes Claude Code to another account: Switchboard moved the running session after a limit.
    `  "--json accounts list") printf '%s' ${ok({ routes: { 'claude:default': 'acc-b' }, accounts: [{ id: 'acc-a', label: 'claude4' }, { id: 'acc-b', label: 'claude5' }] })} ;;`,
    `  "--json project show --path "*) printf '%s' ${ok({ project: null, rules: [] })} ;;`,
    `  "--json handovers") printf '%s' ${ok({ enabled: false, handovers: [] })} ;;`,
    `  "--json sessions --all"|"--json recovery") printf '%s' ${ok({ sessions: [] })} ;;`,
    '  *) exit 1 ;;',
    'esac',
  ].join('\n'), { mode: 0o755 });
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ consoles: { 'sample.default': { runtime: 'claude-code', folder: repo } } }), { mode: 0o600 });
  const reads = () => (fs.existsSync(journal) ? fs.readFileSync(journal, 'utf8') : '').split('\n').filter((l) => l === '--json sessions').length;
  const port = await freePort();
  const proc = serve(port, path.join(base, 'data'), ['--name', 'Sample Service']);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, path.join(base, 'data'), services);
    app = await electron.launch({ args: [ROOT, 'fabric-dashboards://service/sample.default'], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, FD_TEST_RUNTIME_DIRS: bin, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.getByRole('heading', { level: 1, name: 'Sample Service' }).waitFor({ timeout: 20_000 });
    assert.equal(reads(), 0, 'nothing is read while no console is on screen');

    // SCN-064 step 1: under the folder line, the session that runs in this folder, with its account, mode and start.
    await page.getByRole('button', { name: 'Console' }).click();
    const con = await drawerOf(app);
    const region = con.getByRole('region', { name: 'Console' });
    await region.getByText('Switchboard: running').waitFor({ timeout: 20_000 });
    await region.getByText(/^claude4 · managed · since \d{1,2}:\d{2}/).waitFor();
    // SCN-065 step 2: the pool moved it to another account after a limit; the agent goes on.
    await region.getByText('Switchboard moved this session to claude5 after a limit; the agent goes on.').waitFor();
    assert.equal(await region.getByText('Switchboard: running').count(), 1, 'the session in another folder is not this agent\'s');
    assert.equal(await region.getByText('Switchboard: ended').count(), 0, 'an ended session is not shown');
    if (SHOTS) await con.screenshot({ path: path.join(SHOTS, '31-switchboard-strip.png') });

    // SCN-064 step 2: read again every 15 seconds while the console is on screen, and no more once it is folded.
    const first = reads();
    await waitFor('a second read 15 s later', async () => reads() > first, 25_000);
    await region.getByRole('button', { name: 'Collapse console' }).click();
    // FD-92: a folded drawer is detached from the window; its page stays loaded but is no longer on screen.
    const views = () => app!.evaluate(({ BrowserWindow }) => (BrowserWindow.getAllWindows()[0]!.contentView as unknown as { children: unknown[] }).children.length);
    await waitFor('the drawer folded away', async () => (await views()) === 1);
    const folded = reads();
    await new Promise((r) => setTimeout(r, 20_000));
    assert.ok(reads() <= folded + 1, `no reads while folded (at most one already in flight): ${folded} then ${reads()}`);
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});
