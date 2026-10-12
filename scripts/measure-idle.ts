// FD-60: the app's main-process CPU on this Mac's real services, window shown on Overview and then hidden.
// An isolated profile (FABRIC_DASHBOARDS_USER_DATA): notifications paused, so no alert can reach a person;
// the estate watcher off. Reads tokens in the main process only, as the app does; prints CPU, never data.
// Usage: npm run build && node --import tsx scripts/measure-idle.ts [seconds-per-phase]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const ROOT = path.resolve(__dirname, '..');
const SECONDS = Number(process.argv[2] ?? 180);
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-idle-'));
const appDir = path.join(base, 'app');
fs.mkdirSync(appDir, { recursive: true });
fs.writeFileSync(path.join(appDir, 'settings.json'), JSON.stringify({
  notifications: { enabled: false, perService: {}, quietHours: { enabled: false, from: '22:00', to: '08:00' }, pausedUntil: '2099-01-01T00:00:00Z' },
  estate: { enabled: false, autoSkills: false, contractClone: '' }, launchAtLoginAsked: true,
}));
const services = process.env.FABRIC_SERVICES_DIR ?? path.join(os.homedir(), 'Library/Application Support/ai.passioncode.fabric/services');

(async () => {
  const app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: appDir, LANG: 'en_US.UTF-8' } });
  try {
    await app.firstWindow();
    await new Promise((r) => setTimeout(r, 30_000)); // first look, setup card, first usage read
    const phase = async (name: string) => {
      const c0 = await app.evaluate(() => process.cpuUsage());
      const t0 = Date.now();
      await new Promise((r) => setTimeout(r, SECONDS * 1000));
      const c1 = await app.evaluate(() => process.cpuUsage());
      const cpu = (c1.user - c0.user + c1.system - c0.system) / 1e6;
      console.log(JSON.stringify({ phase: name, seconds: (Date.now() - t0) / 1000, mainCpuPercent: +(100 * cpu / ((Date.now() - t0) / 1000)).toFixed(3) }));
    };
    await phase('shown on Overview');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()));
    await new Promise((r) => setTimeout(r, 10_000));
    await phase('hidden');
  } finally {
    await app.close().catch(() => undefined);
    fs.rmSync(base, { recursive: true, force: true });
  }
})();
