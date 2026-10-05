// Product screenshots for the README and the website, from the real app against the kit's sample
// service (test/fixtures/sample-service) under neutral names — never the operator's own agents.
// Five agents answer (one degraded) and one stopped answering, so Overview shows the strip, Needs
// attention and the cards; the second shot is one agent's embedded dashboard with its toolbar.
//
//   npm run build && node --import tsx scripts/screenshots.ts [out-dir]   (default docs/images)
//
// The embedded dashboard is a separate WebContentsView, so a page screenshot misses it: the
// window shot is the renderer's capture with the view's own capture laid over it at its bounds.
import fs from 'node:fs';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import electronBinary from 'electron';
import sharp from 'sharp';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../test/helpers';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/images'));
const AGENTS = [
  { id: 'docs-writer', name: 'Docs Writer', serve: true, degraded: '' },
  { id: 'release-bot', name: 'Release Bot', serve: true, degraded: '' },
  { id: 'support-desk', name: 'Support Desk', serve: true, degraded: 'the mail provider answers slowly' },
  { id: 'research-notes', name: 'Research Notes', serve: true, degraded: '' },
  { id: 'calendar-helper', name: 'Calendar Helper', serve: true, degraded: '' },
  { id: 'data-sync', name: 'Data Sync', serve: true, degraded: '', stops: true }, // answers, then stops: Needs attention
];
const SIZE = { width: 1440, height: 760 };

async function capture(app: ElectronApplication, file: string): Promise<void> {
  const shots = await app.evaluate(async ({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.isVisible())!;
    const base = (await win.webContents.capturePage()).toPNG().toString('base64');
    const layers: { png: string; x: number; y: number }[] = [];
    for (const child of win.contentView.children) {
      const wc = (child as unknown as { webContents?: Electron.WebContents }).webContents;
      if (!wc || !child.getVisible?.()) continue;
      const b = child.getBounds();
      if (!b.width || !b.height) continue;
      layers.push({ png: (await wc.capturePage()).toPNG().toString('base64'), x: b.x, y: b.y });
    }
    return { base, layers, scale: screen.getDisplayMatching(win.getBounds()).scaleFactor };
  });
  const scale = shots.scale;
  await sharp(Buffer.from(shots.base, 'base64'))
    .composite(shots.layers.map((l) => ({ input: Buffer.from(l.png, 'base64'), left: Math.round(l.x * scale), top: Math.round(l.y * scale) })))
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`wrote ${path.relative(ROOT, file)}`);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const base = tmp('fd-shots-');
  const services = path.join(base, 'services');
  const running: ChildProcess[] = [];
  let stopping: ChildProcess | null = null;
  let app: ElectronApplication | null = null;
  try {
    for (const a of AGENTS) {
      const port = await freePort();
      const data = path.join(base, a.id);
      if (a.serve) {
        const p = serve(port, data, ['--id', a.id, '--name', a.name, ...(a.degraded ? ['--degraded', a.degraded] : [])]);
        running.push(p);
        if ('stops' in a) stopping = p;
        await waitAnswering(port);
      }
      register(port, data, services, ['--id', a.id, '--name', a.name]);
    }
    // The first-run question is answered, as on any machine that has used the app for a day.
    const userData = path.join(base, 'app');
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ launchAtLogin: true, launchAtLoginAsked: true, moveToApplicationsAsked: true }));
    app = await electron.launch({
      executablePath: electronBinary as unknown as string,
      args: [ROOT],
      env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, LANG: 'en_US.UTF-8' },
    });
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }, size) => { const w = BrowserWindow.getAllWindows()[0]!; w.setContentSize(size.width, size.height); w.center(); }, SIZE);
    for (const a of AGENTS.filter((x) => x.serve)) await page.getByRole('button', { name: new RegExp(`${a.name} — (Ready|Degraded)`) }).first().waitFor({ timeout: 30_000 });
    // Data Sync stops after its first answer; a missed probe is not an outage, a quarter-minute of silence is.
    await Promise.race([stopProcess(stopping!), new Promise((r) => setTimeout(() => { stopping!.kill('SIGKILL'); r(undefined); }, 5_000))]);
    running.splice(running.indexOf(stopping!), 1);
    await page.getByRole('button', { name: /Data Sync — Not answering|Data Sync — Down/ }).first().waitFor({ timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 1500)); // spend strip and activity settle
    await capture(app, path.join(OUT, 'overview.png'));

    await page.getByRole('button', { name: /Docs Writer — Ready/ }).first().click();
    await page.getByRole('heading', { name: 'Docs Writer' }).waitFor();
    await page.getByRole('button', { name: 'Copy address' }).waitFor({ timeout: 20_000 });
    await new Promise((r) => setTimeout(r, 2500)); // the dashboard signs in and paints
    await capture(app, path.join(OUT, 'service-dashboard.png'));
  } finally {
    // Closing must not hang the script: the app's quit is bounded (LC-01), this bound is ours.
    if (app) await Promise.race([app.close().catch(() => undefined), new Promise((r) => setTimeout(r, 10_000))]);
    // A sample that does not leave on SIGTERM within 5 s is killed: the script never hangs on cleanup.
    await Promise.all(running.map((p) => Promise.race([stopProcess(p), new Promise((r) => setTimeout(() => { p.kill('SIGKILL'); r(undefined); }, 5_000))])));
  }
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
