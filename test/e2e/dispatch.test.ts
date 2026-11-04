// FD-137 (SCN-092), end to end against the real app: Switchboard (a shell fake) lists a session Fabric started for a board
// request in the sample agent's folder. The agent's Activity tab lists it under Board requests with its request, how it
// ended and how long it ran; Open session opens its page, whose launch fold, unfolded, says Fabric started it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

test('SCN-092: an agent lists the board requests Fabric started a session for in its folder, and opens one', { timeout: 120_000, skip: process.platform === 'win32' && 'POSIX shell fake' }, async () => {
  const base = tmp('fd-e2e-dsp-');
  const services = path.join(base, 'services');
  const bin = path.join(base, 'bin');
  const repo = path.join(base, 'sample-repo');
  const userData = path.join(base, 'app');
  for (const d of [services, bin, repo, userData]) fs.mkdirSync(d, { recursive: true });
  const at = Math.floor(Date.now() / 1000) - 600;
  const session = {
    account_id: 'acc-1', home: '/sb/homes/a', label: 'claude4', mode: 'managed', pool: 'default', provider: 'claude', agent: 'claude-code', state: 'ended', in_place: true,
    working_directory: repo, launched_at: at, started_at: at,
    launch_id: '0b8f6c1e-1f2a-4c3d-9e8f-0123456789ab',
    launched_by: { surface: 'fabric', dispatch: { id: 'dsp_01JC2X', request: '45bf7553-8ae0-4e23-93ef-8c3acefddf91', thread: 'a9672312-701c-46fe-80ca-4c1384999344', project: '4a313b30-b944-483d-84d7-1b3bdd2967fa', workflow: 'wf_0123456789abcdef' } },
    ended: { kind: 'exited', exit_code: 0, at: at + 7 * 60 },
  };
  const all = JSON.stringify({ ok: true, data: { sessions: [session] } });
  fs.writeFileSync(path.join(bin, 'switchboard'), [
    '#!/bin/sh',
    'case "$*" in',
    '  "--json handovers") printf \'{"ok":true,"data":{"enabled":true,"handovers":[]}}\' ;;',
    `  "--json sessions --all") printf '%s' '${all}' ;;`,
    '  "--json recovery") printf \'{"ok":true,"data":{"sessions":[]}}\' ;;',
    '  *) exit 1 ;;',
    'esac',
  ].join('\n'), { mode: 0o755 });
  // The agent's console folder, as chosen before: the folder its board requests run in.
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ consoles: { 'sample.default': { runtime: null, folder: repo } } }), { mode: 0o600 });
  const port = await freePort();
  const proc = serve(port, path.join(base, 'data'), ['--name', 'Sample Service']);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, path.join(base, 'data'), services);
    app = await electron.launch({ args: [ROOT, 'fabric-dashboards://service/sample.default'], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, FD_TEST_RUNTIME_DIRS: bin, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.getByRole('heading', { level: 1, name: 'Sample Service' }).waitFor({ timeout: 20_000 });
    await page.getByRole('tab', { name: 'Activity' }).click();
    const section = page.locator('section.dispatches');
    await section.getByRole('heading', { name: 'Board requests' }).waitFor({ timeout: 60_000 });
    const line = section.locator('li').first();
    assert.match(await line.innerText(), /45bf7553 · thread a9672312/);
    assert.match(await line.innerText(), /exited with code 0, .* · 7 min/);
    assert.equal(await section.locator('li').count(), 1);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'scn-092-agent.png') });

    await line.getByRole('button', { name: 'Open session' }).click();
    await page.locator('details.session-chain > summary').first().click();
    await page.getByText('by Fabric, for a board request no session took').first().waitFor({ timeout: 20_000 });
    // The header and the sidebar say who started it as the fold does.
    await page.getByText(/^Started by Fabric, /).first().waitFor({ timeout: 5_000 });
    await page.getByText('claude4 · board request').first().waitFor({ timeout: 5_000 });
    assert.equal(await page.getByRole('button', { name: /^Sessions/ }).first().getAttribute('aria-pressed'), 'true');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'scn-092-session.png') });
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});
