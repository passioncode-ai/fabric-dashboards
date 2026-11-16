// FD-277 (SCN-118): a session that runs in two processes shows on the Sessions page, and Close the quiet copy asks
// Switchboard to close one; the app's window, against a fake Switchboard that answers `attention` and `close-copy`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { tmp, waitFor } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const ID = '8fa1b537-4952-4856-a40a-31a2ffed77c3';

test('SCN-118: a session running twice shows a warning; Close the quiet copy closes one and the warning goes', { skip: process.platform === 'win32' && 'the fake switchboard is a shell script' }, async () => {
  const base = tmp('fd-e2e-dup-');
  const services = path.join(base, 'services');
  const bin = path.join(base, 'bin');
  const closed = path.join(base, 'closed');
  const journal = path.join(base, 'journal.txt');
  for (const d of [services, bin]) fs.mkdirSync(d, { recursive: true });
  const attention = (twice: boolean) => JSON.stringify({ ok: true, data: { count: twice ? 1 : 0, items: twice ? [{ reason: 'session_duplicate', session_id: ID, label: 'notes-repo', pids: [38550, 84681] }] : [] } });
  fs.writeFileSync(path.join(bin, 'switchboard'), [
    '#!/bin/sh',
    `echo "$*" >> '${journal}'`,
    'case "$*" in',
    '  "sessions --help") printf \'Commands:\\n  end         End a session\\n  close-copy  Close the quiet one of two processes\\n\' ;;',
    `  "--json attention") if [ -f '${closed}' ]; then printf '%s' '${attention(false)}'; else printf '%s' '${attention(true)}'; fi ;;`,
    `  "--json sessions close-copy ${ID}") touch '${closed}'; printf '%s' '${JSON.stringify({ ok: true, data: { session_id: ID, closed_pid: 38550, kept_pids: [84681] } })}' ;;`,
    '  "--json sessions --all") printf \'{"ok":true,"data":{"sessions":[]}}\' ;;',
    '  "--json handovers") printf \'{"ok":true,"data":{"enabled":true,"handovers":[]}}\' ;;',
    '  "--json recovery") printf \'{"ok":true,"data":{"sessions":[]}}\' ;;',
    '  *) exit 1 ;;',
    'esac',
  ].join('\n'), { mode: 0o755 });
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), FD_TEST_RUNTIME_DIRS: bin, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: /^Sessions/ }).first().click();
    await page.getByRole('heading', { level: 1, name: 'All sessions' }).waitFor({ timeout: 30_000 });
    const notice = page.locator('.session-duplicate');
    await notice.getByText('notes-repo: one session runs in two processes').waitFor({ timeout: 30_000 });
    await notice.getByRole('button', { name: 'Close the quiet copy' }).click();
    await notice.getByText('Closed the copy with process 38550').waitFor({ timeout: 20_000 });
    assert.ok(fs.readFileSync(journal, 'utf8').includes(`--json sessions close-copy ${ID}`), 'Switchboard was asked for that session');
    // The list is read again at once after the act: the session runs once, so the warning goes.
    await waitFor('the warning to go', async () => (await page.locator('.session-duplicate').count()) === 0, 20_000);
  } finally {
    if (app) await Promise.race([app.close().catch(() => undefined), new Promise((r) => setTimeout(r, 10_000))]);
  }
});
