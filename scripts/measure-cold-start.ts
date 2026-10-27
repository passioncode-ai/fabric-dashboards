// FD-130: how long the built app takes from launch to its first window and to a live service's card, N launches
// in a row against one sample service, each in its own profile. The first launch after `npm run build` is the cold
// one the e2e suite's first test pays. Prints timings and the load average, never data.
// Usage: npm run build && node --import tsx scripts/measure-cold-start.ts [launches]
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../test/helpers';

const ROOT = path.resolve(__dirname, '..');
const RUNS = Number(process.argv[2] ?? 4);

(async () => {
  const base = tmp('fd-cold-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'svc');
  const port = await freePort();
  const proc = serve(port, data, ['--name', 'Sample Service']);
  try {
    await waitAnswering(port);
    register(port, data, services);
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      const app = await electron.launch({
        args: [ROOT],
        env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, `app${i}`), LANG: 'en_US.UTF-8', FD_TEST_FABRIC: 'present' },
      });
      try {
        const page = await app.firstWindow();
        const t1 = performance.now();
        await page.getByRole('button', { name: /Sample Service: Ready/ }).waitFor({ timeout: 120_000 });
        const t2 = performance.now();
        console.log(JSON.stringify({ launch: i + 1, firstWindowMs: Math.round(t1 - t0), readyCardMs: Math.round(t2 - t0), load1: Number(os.loadavg()[0].toFixed(1)) }));
      } finally {
        await app.close();
      }
    }
  } finally {
    await stopProcess(proc);
  }
})();
