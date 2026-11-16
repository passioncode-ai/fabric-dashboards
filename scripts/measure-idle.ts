// FD-60: the app's main-process CPU on this Mac's real services, window shown on Overview and then hidden.
// An isolated profile (FABRIC_DASHBOARDS_USER_DATA): notifications paused, so no alert can reach a person;
// the estate watcher off. Reads tokens in the main process only, as the app does; prints CPU, never data.
// FD-268: the app runs without Playwright. Playwright emulates focus over CDP, so a hidden window's page still read
// `visible` and its timers asked the main process as if shown, which made the hidden phase cost more than a real one.
// Each phase is its own launch: shown as the person opens it, hidden with `--background` as at login (FD-142); the main
// process's CPU time is read with `ps`, which counts every thread of the process, as `process.cpuUsage()` did.
// Usage: npm run build && node --import tsx scripts/measure-idle.ts [seconds-per-phase]
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const SECONDS = Number(process.argv[2] ?? 180);
const WARM_UP_MS = 30_000; // first look, setup card, first usage read
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronBinary = require('electron') as unknown as string;
const services = process.env.FABRIC_SERVICES_DIR ?? path.join(os.homedir(), 'Library/Application Support/ai.passioncode.fabric/services');

/** `ps -o time=`: `[[dd-]hh:]mm:ss.cc` of user and system time, in seconds. */
function cpuSeconds(pid: number): number {
  const text = execFileSync('ps', ['-o', 'time=', '-p', String(pid)], { encoding: 'utf8' }).trim();
  const [days, rest] = text.includes('-') ? [Number(text.split('-')[0]), text.split('-')[1]!] : [0, text];
  return days * 86_400 + rest.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function phase(name: string, args: string[]): Promise<void> {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-idle-'));
  const appDir = path.join(base, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, 'settings.json'), JSON.stringify({
    notifications: { enabled: false, perService: {}, quietHours: { enabled: false, from: '22:00', to: '08:00' }, pausedUntil: '2099-01-01T00:00:00Z' },
    estate: { enabled: false, autoSkills: false, contractClone: '' }, launchAtLoginAsked: true, setupDone: true,
  }));
  const app = spawn(electronBinary, [ROOT, ...args], { env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: appDir, LANG: 'en_US.UTF-8' }, stdio: 'ignore' });
  try {
    await sleep(WARM_UP_MS);
    if (app.exitCode !== null || !app.pid) throw new Error(`the app exited with ${app.exitCode}`);
    const c0 = cpuSeconds(app.pid);
    const t0 = Date.now();
    await sleep(SECONDS * 1000);
    const cpu = cpuSeconds(app.pid) - c0;
    const seconds = (Date.now() - t0) / 1000;
    console.log(JSON.stringify({ phase: name, seconds, mainCpuPercent: +(100 * cpu / seconds).toFixed(3), load: os.loadavg().map((l) => +l.toFixed(1)) }));
  } finally {
    app.kill('SIGTERM');
    await new Promise((r) => { if (app.exitCode !== null) r(null); else { app.once('exit', r); setTimeout(() => { app.kill('SIGKILL'); r(null); }, 10_000); } });
    fs.rmSync(base, { recursive: true, force: true });
  }
}

(async () => {
  await phase('shown on Overview', []);
  await phase('hidden', ['--background']);
})();
