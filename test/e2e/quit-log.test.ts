// FD-276 (P-03): a quit leaves two lines in main.log, when it began and when the process ended, so the gap of an update
// install can be split between this app's own quit and the installer's work.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron } from 'playwright';
import { tmp, waitFor } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');

test('FD-276: a quit logs when it began and when the process ended', async () => {
  const base = tmp('fd-e2e-quit-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services, { recursive: true });
  const app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
  await app.firstWindow();
  const logs = await app.evaluate(({ app: a }) => a.getPath('logs'));
  await app.close();
  const file = path.join(logs, 'main.log');
  const lines = await waitFor('both quit lines', () => {
    const text = fs.readFileSync(file, 'utf8');
    return /quit: begins \(commands \d+, consoles \d+, continues \d+\)/.test(text) && /quit: the process ends \d+ ms after the quit began/.test(text) ? text : null;
  });
  const ms = Number(/the process ends (\d+) ms/.exec(lines)![1]);
  assert.ok(ms < 10_000, `an idle app ends within seconds of its quit (${ms} ms)`);
});
