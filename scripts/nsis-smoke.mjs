// FD-37: the Windows installer on the runner that built it — run by packages.yml after dist-other.mjs:
//   node scripts/nsis-smoke.mjs release/Fabric-Dashboards-<v>-windows-<arch>-setup.exe
// It installs per user without elevation (/S), the installed MCP launcher answers `initialize`, the
// uninstaller sits where the app's own Settings → Uninstall looks for it (src/core/platform.ts
// uninstallTarget), and running it the way the app does (/S) removes the install. FD-37 M4c: the same
// installer, run the way the app runs an update (src/core/self-update.ts NSIS_UPDATE_ARGS) over a running copy,
// installs in place and starts the app again.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function requireThat(condition, message) { if (!condition) { console.error(`::error::${message}`); process.exit(1); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(ok, ms) { const end = Date.now() + ms; while (!ok() && Date.now() < end) await sleep(500); return ok(); }

requireThat(process.platform === 'win32', 'nsis-smoke runs on Windows.');
const setup = path.resolve(process.argv[2] ?? '');
requireThat(existsSync(setup), `no installer at ${setup}`);
// A per-user NSIS install goes under %LOCALAPPDATA%\Programs; the folder is found, not assumed, and printed.
const programs = path.join(process.env.LOCALAPPDATA ?? '', 'Programs');
const installed = () => { try { return readdirSync(programs).map((d) => path.join(programs, d)).find((d) => existsSync(path.join(d, 'Fabric Dashboards.exe'))); } catch { return undefined; } };

const install = spawnSync(setup, ['/S'], { timeout: 300_000, windowsHide: true });
requireThat(install.status === 0, `the installer exited ${install.status ?? install.error}`);
const found = await until(() => Boolean(installed()), 180_000);
requireThat(found, `the installer put no app under ${programs} (it holds: ${(() => { try { return readdirSync(programs).join(', '); } catch { return 'nothing'; } })()})`);
const dir = installed();
const exe = path.join(dir, 'Fabric Dashboards.exe');
const uninstaller = path.join(dir, 'Uninstall Fabric Dashboards.exe');
const launcher = path.join(dir, 'resources', 'bin', 'fabric-dashboards-mcp.cmd');
console.log(`installed at ${dir}`);
requireThat(existsSync(uninstaller), `no uninstaller where Settings → Uninstall looks: ${uninstaller}`);

const services = mkdtempSync(path.join(os.tmpdir(), 'fd-nsis-'));
try {
  // cmd /s strips one pair of outer quotes, so the path (it has a space) is quoted twice.
  const hello = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${launcher}""`], {
    input: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n', encoding: 'utf8', timeout: 60_000,
    windowsHide: true, windowsVerbatimArguments: true, env: { ...process.env, FABRIC_SERVICES_DIR: services },
  });
  const answer = (() => { try { return JSON.parse(hello.stdout.split('\n')[0]); } catch { return null; } })();
  requireThat(Boolean(answer?.result?.serverInfo), `the installed MCP launcher did not answer: ${(hello.stderr || hello.stdout || String(hello.error)).slice(0, 400)}`);
} finally {
  rmSync(services, { recursive: true, force: true });
}

// FD-37 M4c: an update over a running copy. The app runs from the install with its own data and services
// folders; the installer gets --updated /S --force-run, as the app passes them, and must leave a new process.
const appPids = () => spawnSync('tasklist', ['/FI', 'IMAGENAME eq Fabric Dashboards.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout
  .split('\n').map((l) => /^"[^"]+","(\d+)"/.exec(l.trim())?.[1]).filter(Boolean);
const data = mkdtempSync(path.join(os.tmpdir(), 'fd-nsis-data-'));
const watched = mkdtempSync(path.join(os.tmpdir(), 'fd-nsis-svc-'));
const appEnv = { ...process.env, FABRIC_DASHBOARDS_USER_DATA: data, FABRIC_SERVICES_DIR: watched };
try {
  spawn(exe, ['--hidden'], { detached: true, stdio: 'ignore', env: appEnv, windowsHide: true }).unref();
  requireThat(await until(() => appPids().length > 0, 60_000), 'the installed app did not start');
  const before = new Set(appPids());
  const updateStarted = Date.now();
  const update = spawnSync(setup, ['--updated', '/S', '--force-run'], { timeout: 300_000, windowsHide: true, env: appEnv });
  requireThat(update.status === 0, `the installer in update mode exited ${update.status ?? update.error}`);
  const anew = await until(() => { const now = appPids(); return now.length > 0 && now.every((pid) => !before.has(pid)); }, 180_000);
  requireThat(anew, `after the update the app is not running anew (before: ${[...before].join(' ')}; now: ${appPids().join(' ') || 'none'})`);
  requireThat(existsSync(exe) && existsSync(uninstaller), 'the update left no app or no uninstaller in place');
  console.log(`the installer updated the running copy in place and started it again in ${Math.round((Date.now() - updateStarted) / 1000)} s`);
} finally {
  spawnSync('taskkill', ['/F', '/T', '/IM', 'Fabric Dashboards.exe'], { windowsHide: true });
  await until(() => appPids().length === 0, 30_000);
  rmSync(data, { recursive: true, force: true });
  rmSync(watched, { recursive: true, force: true });
}

// The NSIS uninstaller copies itself to %TEMP% and returns at once; the removal finishes after.
const remove = spawnSync(uninstaller, ['/S'], { timeout: 300_000, windowsHide: true });
requireThat(remove.status === 0, `the uninstaller exited ${remove.status ?? remove.error}`);
const removalStarted = Date.now();
if (!await until(() => !existsSync(exe), 300_000)) {
  const left = (() => { try { return readdirSync(dir).join(', '); } catch { return 'nothing'; } })();
  const running = spawnSync('tasklist', ['/FI', 'IMAGENAME eq Fabric Dashboards.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout.trim();
  requireThat(false, `the uninstaller left ${exe} after 300 s; still there: ${left}; running: ${running || 'none'}`);
}
console.log(`the uninstaller removed the app in ${Math.round((Date.now() - removalStarted) / 1000)} s`);
console.log(`installed per user at ${dir}, the MCP launcher answered initialize, an update over the running copy restarted it, /S uninstall removed it`);
