// FD-103, review round 1 R1-E1 (SCN-080, SCN-085): a synthetic Switchboard hand-over, end to end against the real app.
// The app takes it in a console of its own and sends one notification, without switching the mode; clicking the
// notification opens the session's page with its console under the header; Esc then Tab leaves the terminal for the
// window; End (asked first) and Remove take it out of the list. Switchboard is a shell fake that offers the hand-over
// only once the test has replaced the system notification with a recorder.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { tmp, waitFor } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;
const HO = 'ho-00000000c0de';

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

const roomy = (dir: string) => { const st = fs.statfsSync(dir); return st.bavail * st.bsize >= 5 * 1024 ** 3; };

test('SCN-085, SCN-080: a hand-over is announced once, its notification opens its page, Esc then Tab leaves the terminal', { timeout: 180_000, skip: process.platform === 'win32' && 'POSIX shell fake' }, async () => {
  const base = tmp('fd-e2e-ses-');
  const services = path.join(base, 'services');
  const bin = path.join(base, 'bin');
  const repo = path.join(base, 'handover-repo');
  const flag = path.join(base, 'offer');
  const journal = path.join(base, 'journal.txt');
  for (const d of [services, bin, repo]) fs.mkdirSync(d, { recursive: true });
  const offered = new Date(Date.now() + 10 * 60_000).toISOString();
  const handovers = (on: boolean) => JSON.stringify({ ok: true, data: { enabled: true, handovers: on ? [{ id: HO, workflow: 'nightly', agent: 'claude-code', account_label: 'claude4', dir: repo, offered_until: offered }] : [] } });
  fs.writeFileSync(path.join(bin, 'switchboard'), [
    '#!/bin/sh',
    `echo "$*" >> '${journal}'`,
    'case "$*" in',
    `  "--json handovers") if [ -f '${flag}' ]; then printf '%s' '${handovers(true)}'; else printf '%s' '${handovers(false)}'; fi ;;`,
    '  "--json sessions --all") printf \'{"ok":true,"data":{"sessions":[]}}\' ;;',
    '  "--json recovery") printf \'{"ok":true,"data":{"sessions":[]}}\' ;;',
    // The hand-over itself: Switchboard runs the handed-over session in the console that took it.
    `  "handovers run ${HO}") printf 'handed over session ready\\r\\n'; while IFS= read -r line; do printf 'you said: %s\\r\\n' "$line"; done ;;`,
    '  *) exit 1 ;;',
    'esac',
  ].join('\n'), { mode: 0o755 });
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), FD_TEST_RUNTIME_DIRS: bin, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: /^Agents/ }).first().waitFor({ timeout: 30_000 });
    // The system notification is recorded instead of shown; its click is the test's to send.
    await app.evaluate(({ Notification }) => {
      const g = globalThis as unknown as { __fdNotices: { title: string; body: string }[]; __fdLast: unknown };
      g.__fdNotices = [];
      // Anonymous: a named function gets a naming helper the main process lacks.
      Notification.prototype.show = function (this: Electron.Notification) { g.__fdNotices.push({ title: this.title, body: this.body }); g.__fdLast = this; };
    });
    assert.equal(await page.getByRole('button', { name: /^Agents/ }).first().getAttribute('aria-pressed'), 'true');
    fs.writeFileSync(flag, '');

    if (!roomy(repo)) {
      // LC-17 (SCN-063): under 5 GB free the hand-over is left to Switchboard's Terminal and listed with why.
      await page.getByRole('button', { name: /^Sessions/ }).first().click();
      await page.getByText(/This Mac cannot carry another session now/).first().waitFor({ timeout: 60_000 });
      return;
    }
    const notices = await waitFor('the hand-over notification', async () => {
      const n = await app!.evaluate(() => (globalThis as unknown as { __fdNotices: { title: string; body: string }[] }).__fdNotices);
      return n.length ? n : null;
    }, 60_000) as { title: string; body: string }[];
    assert.deepEqual(notices, [{ title: 'Sessions', body: 'Switchboard handed over a session: handover-repo continues on Claude Code' }], 'one notification, once');
    assert.equal(fs.readFileSync(journal, 'utf8').split('\n').filter((l) => l === `handovers run ${HO}`).length, 1, 'taken once');
    // SCN-077: a new hand-over never switches the mode by itself; the switch's badge would count it if it needed you.
    assert.equal(await page.getByRole('button', { name: /^Agents/ }).first().getAttribute('aria-pressed'), 'true');

    // SCN-085 step 2: the notification opens the session's page in the Sessions mode.
    await app.evaluate(() => (globalThis as unknown as { __fdLast: { emit: (e: string) => void } }).__fdLast.emit('click'));
    await page.getByRole('heading', { level: 1, name: 'handover-repo' }).waitFor({ timeout: 20_000 });
    assert.equal(await page.getByRole('button', { name: /^Sessions/ }).first().getAttribute('aria-pressed'), 'true');
    await page.locator('.session-head').getByText('Handed over by Switchboard', { exact: false }).waitFor();
    // SCN-080: the console fills the page under the header (the drawer's page in its full form).
    const drawer = await waitFor('the session page\'s console', async () => app!.windows().find((p) => p.url().includes('drawer=1')) ?? null) as Page;
    await drawer.locator('.console-page').waitFor({ timeout: 20_000 });
    await waitFor('the handed-over session\'s output', async () => /handed over session ready/.test(await drawer.locator('.console-term .xterm-rows').innerText().catch(() => '')) || null, 20_000);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '31-session-page.png') });

    // VIS-05 (SCN-080 step 4): Esc reaches the coding agent; a Tab right after it leaves the terminal for the window.
    await drawer.locator('.console-term').click();
    await drawer.keyboard.press('Escape');
    await drawer.keyboard.press('Tab');
    await waitFor('focus in the window\'s sidebar', async () => (await page.evaluate(() => Boolean(document.hasFocus() && document.activeElement?.closest('.sidebar')))) || null, 10_000);

    // SCN-081: End asks first; the ended session offers Continue and Remove; Remove takes it out of the list.
    await page.locator('.session-head').getByRole('button', { name: 'End' }).click();
    await page.getByRole('button', { name: 'End session' }).click();
    await page.locator('.session-head').getByText('Ended by you').waitFor({ timeout: 20_000 });
    await page.locator('.session-head').getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('heading', { level: 1, name: 'All sessions' }).waitFor({ timeout: 20_000 });
    assert.equal(await page.locator('.session-card', { hasText: 'handover-repo' }).count(), 0, 'gone from the list');
  } finally {
    await closeApp(app);
  }
});
