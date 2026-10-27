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
    // The notice is sent once the console is started; the PTY's own process writes the journal a moment later.
    const runs = () => fs.readFileSync(journal, 'utf8').split('\n').filter((l) => l === `handovers run ${HO}`).length;
    await waitFor('the hand-over to run', async () => runs() > 0 || null, 15_000);
    assert.equal(runs(), 1, 'taken once');
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

// FD-111: the rest of the Sessions mode on the running app, against a fake Switchboard that lists one running session,
// one ended in the last day, one limit stop waiting for an account and one hand-over whose offer lapsed (SCN-077 to SCN-079,
// SCN-082 to SCN-084, SCN-086).
test('SCN-077, SCN-078, SCN-079, SCN-082, SCN-083, SCN-084, SCN-086: the Sessions mode lists, groups and explains every session', { timeout: 120_000, skip: process.platform === 'win32' && 'POSIX shell fake' }, async () => {
  const base = tmp('fd-e2e-ses2-');
  const services = path.join(base, 'services');
  const bin = path.join(base, 'bin');
  const [running, ended, stopped] = ['running-repo', 'ended-repo', 'stopped-repo'].map((n) => path.join(base, n));
  for (const d of [services, bin, running!, ended!, stopped!]) fs.mkdirSync(d, { recursive: true });
  const now = Math.floor(Date.now() / 1000);
  const record = (dir: string, state: string, launched: number) => ({ working_directory: dir, home: path.join(base, 'home'), provider: 'claude', agent: 'claude-code', pool: 'default', mode: 'managed', label: 'claude4', account_id: 'acc-1', in_place: false, launched_at: launched, started_at: launched, state });
  const sessions = JSON.stringify({ ok: true, data: { sessions: [record(running!, 'running', now - 1800), record(ended!, 'ended', now - 7200)] } });
  const recovery = JSON.stringify({ ok: true, data: { sessions: [{ ready: false, reason: 'no_account', candidates: [], probe_at: null, stop: { event: 'ev-stopped-1', session: '0b2c3d4e-0000-4000-8000-00000000c0de', directory: stopped, provider: 'claude', state: 'waiting', kind: 'limit', stopped_at: now - 600, attempt: 1, account: 'acc-1' } }] } });
  // SCN-082: a hand-over whose offer lapsed before the app saw it needs the person.
  const lapsed = JSON.stringify({ ok: true, data: { enabled: true, handovers: [{ id: 'ho-00000000beef', workflow: 'nightly', agent: 'claude-code', account_label: 'claude4', dir: running, offered_until: new Date(Date.now() - 60_000).toISOString() }] } });
  fs.writeFileSync(path.join(bin, 'switchboard'), [
    '#!/bin/sh',
    'case "$*" in',
    `  "--json handovers") printf '%s' '${lapsed}' ;;`,
    `  "--json sessions --all") printf '%s' '${sessions}' ;;`,
    `  "--json recovery") printf '%s' '${recovery}' ;;`,
    '  *) exit 1 ;;',
    'esac',
  ].join('\n'), { mode: 0o755 });
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), FD_TEST_RUNTIME_DIRS: bin, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    // SCN-077: the switch moves between Agents and Sessions.
    await page.getByRole('button', { name: /^Sessions/ }).first().click();
    assert.equal(await page.getByRole('button', { name: /^Sessions/ }).first().getAttribute('aria-pressed'), 'true');
    await page.getByRole('heading', { level: 1, name: 'All sessions' }).waitFor({ timeout: 20_000 });
    // SCN-079: the page explains itself once; Got it hides it for good.
    const note = page.locator('.sessions-note');
    await note.getByText(/Here are the coding agents' sessions on this/).waitFor({ timeout: 20_000 });
    // SCN-078 and SCN-083: one list, grouped, the stop saying what it waits for.
    for (const g of [/^Needs you: 1$/, /^Running: 1$/, /^Waiting for a limit reset: 1$/, /Ended in the last 24 hours: 1$/]) await page.getByRole('main').getByRole('heading', { level: 2, name: g }).waitFor({ timeout: 30_000 });
    // The ended group comes folded; opening it shows the session that ended.
    await page.getByRole('main').getByRole('button', { name: /Ended in the last 24 hours: 1/ }).click();
    const endedCard = page.locator('.session-card', { hasText: 'ended-repo' }).first();
    await endedCard.waitFor();
    await page.locator('.session-card', { hasText: 'running-repo' }).first().waitFor();
    await page.locator('.session-card', { hasText: 'stopped-repo' }).getByText(/No account in its group can take it|Waits for an account with capacity/).first().waitFor();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '32-all-sessions.png') });
    // SCN-084: an ended session offers Continue and Remove; Remove takes it out of the list.
    await endedCard.getByRole('button', { name: /^Continue/ }).first().waitFor();
    await endedCard.getByRole('button', { name: /^Remove/ }).first().click();
    await waitFor('the ended session to leave the list', async () => (await page.locator('.session-card', { hasText: 'ended-repo' }).count()) === 0 || null, 15_000);
    await note.getByRole('button', { name: 'Hide this explanation' }).click();
    await note.waitFor({ state: 'detached' });
    await waitFor('the note to be remembered', async () => JSON.parse(fs.readFileSync(path.join(base, 'app', 'settings.json'), 'utf8')).sessionsNoteSeen === true);
    // SCN-077: Agents again, and back to Sessions where it was.
    await page.getByRole('button', { name: /^Agents/ }).first().click();
    await page.getByRole('heading', { level: 1, name: 'Overview' }).waitFor();
    await page.getByRole('button', { name: /^Sessions/ }).first().click();
    await page.getByRole('heading', { level: 1, name: 'All sessions' }).waitFor();
    assert.equal(await page.locator('.sessions-note').count(), 0, 'the explanation stays hidden');
    // SCN-086: Settings has its Sessions section with both switches.
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await page.getByRole('heading', { level: 2, name: 'Sessions' }).waitFor({ timeout: 20_000 });
    await page.getByText('Open sessions handed over by Switchboard here').first().waitFor();
    await page.getByText('Continue sessions after a limit reset').first().waitFor();
  } finally {
    await closeApp(app);
  }
});
