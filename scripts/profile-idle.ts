// Wave 4 (P-01): a CPU profile of the main process on this Mac's real services with the window hidden, in an
// isolated profile as measure-idle.ts runs it (notifications paused, the estate watcher off). Prints the functions
// that took the most self time and writes the .cpuprofile beside it; never prints data the agents return.
// Usage: npm run build && node --import tsx scripts/profile-idle.ts [seconds] [out-dir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const ROOT = path.resolve(__dirname, '..');
const SECONDS = Number(process.argv[2] ?? 120);
const OUT = path.resolve(process.argv[3] ?? os.tmpdir());
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-prof-'));
const appDir = path.join(base, 'app');
fs.mkdirSync(appDir, { recursive: true });
fs.writeFileSync(path.join(appDir, 'settings.json'), JSON.stringify({
  notifications: { enabled: false, perService: {}, quietHours: { enabled: false, from: '22:00', to: '08:00' }, pausedUntil: '2099-01-01T00:00:00Z' },
  estate: { enabled: false, autoSkills: false, contractClone: '' }, launchAtLoginAsked: true, resumeAfterLimit: false, setupDone: true, setupChecked: true, analyticsNoticeSeen: true, moveToApplicationsAsked: true,
}));
const services = process.env.FABRIC_SERVICES_DIR ?? path.join(os.homedir(), 'Library/Application Support/ai.passioncode.fabric/services');

type Node = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; hitCount?: number };
(async () => {
  const app = await electron.launch({ args: [ROOT, '--inspect=0'], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: appDir, LANG: 'en_US.UTF-8' } });
  try {
    await app.firstWindow();
    await new Promise((r) => setTimeout(r, 15_000)); // past ready-to-show, which shows the window
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()));
    await new Promise((r) => setTimeout(r, 30_000));
    if (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some((w) => w.isVisible()))) throw new Error('the window came back: the hidden phase would measure a shown window');
    const profile = await app.evaluate(async (_e, seconds) => {
      const inspector = (process as unknown as { getBuiltinModule(n: string): typeof import('node:inspector') }).getBuiltinModule('node:inspector');
      const s = new inspector.Session(); s.connect();
      // No named function in here: the runner's transform wraps one with a helper the app does not have.
      const calls: [string, object][] = [['Profiler.enable', {}], ['Profiler.setSamplingInterval', { interval: 1000 }], ['Profiler.start', {}]];
      const c0 = process.cpuUsage();
      for (const [m, p] of calls) await new Promise<unknown>((res, rej) => s.post(m, p, (err, r) => (err ? rej(err) : res(r))));
      await new Promise((r) => setTimeout(r, seconds * 1000));
      const { profile } = (await new Promise<unknown>((res, rej) => s.post('Profiler.stop', {}, (err, r) => (err ? rej(err) : res(r))))) as { profile: unknown };
      const c1 = process.cpuUsage(c0);
      s.disconnect();
      return { profile, cpuPercent: (100 * (c1.user + c1.system)) / 1e6 / seconds };
    }, SECONDS);
    const file = path.join(OUT, `main-${Date.now()}.cpuprofile`);
    fs.writeFileSync(file, JSON.stringify(profile.profile));
    const nodes = (profile.profile as { nodes: Node[] }).nodes;
    const total = nodes.reduce((a, n) => a + (n.hitCount ?? 0), 0);
    const self = new Map<string, number>();
    for (const n of nodes) {
      const f = n.callFrame;
      const k = `${f.functionName || '(anonymous)'} ${f.url.replace(/^.*\/out\//, 'out/').replace(/^.*node_modules\//, 'nm/')}:${f.lineNumber + 1}`;
      self.set(k, (self.get(k) ?? 0) + (n.hitCount ?? 0));
    }
    console.log(JSON.stringify({ seconds: SECONDS, mainCpuPercent: +profile.cpuPercent.toFixed(3), file }));
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`);
  } finally {
    await app.close().catch(() => undefined);
    fs.rmSync(base, { recursive: true, force: true });
  }
})();
