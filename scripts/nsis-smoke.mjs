// FD-37: the Windows installer on the runner that built it — run by packages.yml after dist-other.mjs:
//   node scripts/nsis-smoke.mjs release/Fabric-Dashboards-<v>-windows-<arch>-setup.exe
// It installs per user without elevation (/S), the installed MCP launcher answers `initialize`, the
// uninstaller sits where the app's own Settings → Uninstall looks for it (src/core/platform.ts
// uninstallTarget), and running it the way the app does (/S) removes the install. FD-37 M4c: the same
// installer, run the way the app runs an update — the waiter of src/core/self-update.ts nsisUpdateCommand, after
// the app exits — installs in place and starts the app again.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

// A failed check throws, so every `finally` below cleans up; the top level reports it and exits 1.
function requireThat(condition, message) { if (!condition) throw new Error(message); }
for (const event of ['unhandledRejection', 'uncaughtException']) process.on(event, (error) => { console.error(`::error::${error?.message ?? error}`); process.exit(1); });
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

// FD-37 M4c: an update the way the app runs one. The app runs from the install with its own data and services
// folders. The waiter the app builds (nsisUpdateCommand, from the compiled out/) waits for its main process; the
// app then exits; the waiter checks the installer's hash and runs it with --updated /S --force-run, which installs
// in place and starts the app again. Only this run's processes are stopped, and a survivor fails the check.
const { nsisUpdateCommand } = createRequire(import.meta.url)(path.resolve('out/main/core/self-update.js'));
const appPids = () => spawnSync('tasklist', ['/FI', 'IMAGENAME eq Fabric Dashboards.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout
  .split('\n').map((l) => /^"[^"]+","(\d+)"/.exec(l.trim())?.[1]).filter(Boolean);
const stable = async (ms) => { let last = ''; let since = Date.now(); const end = Date.now() + 60_000; while (Date.now() < end) { const now = appPids().sort().join(' '); if (now !== last) { last = now; since = Date.now(); } else if (now && Date.now() - since >= ms) return now.split(' '); await sleep(500); } return appPids(); };
const stop = (pids) => { for (const pid of pids) spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { windowsHide: true }); };
// FD-95: a process of the old copy that outlives the update or taskkill is named with its parent and command line, so
// the failure says whether it is an Electron helper (`--type=`), crashpad or the main process. Only on a failure path:
// Windows PowerShell takes up to a minute to start on windows-11-arm (FD-94).
const described = (pids) => {
  const ids = pids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return 'none';
  const env = { ...process.env }; delete env.PSModulePath; // a Windows PowerShell under pwsh, as windowsPowerShellEnv
  const filter = ids.map((id) => `ProcessId=${id}`).join(' OR ');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Get-CimInstance Win32_Process -Filter '${filter}' | ForEach-Object { "$($_.ProcessId) (parent $($_.ParentProcessId)): $($_.CommandLine)" }`],
  { encoding: 'utf8', timeout: 120_000, windowsHide: true, env });
  const lines = (r.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => (l.length > 400 ? `${l.slice(0, 400)}…` : l));
  return lines.length ? lines.join('; ') : `${ids.join(' ')} (command lines unread: ${String(r.error ?? r.stderr ?? '').trim().slice(0, 200) || 'gone'})`;
};
const data = mkdtempSync(path.join(os.tmpdir(), 'fd-nsis-data-'));
const watched = mkdtempSync(path.join(os.tmpdir(), 'fd-nsis-svc-'));
const appEnv = { ...process.env, FABRIC_DASHBOARDS_USER_DATA: data, FABRIC_SERVICES_DIR: watched };
const started = new Set();
try {
  const app = spawn(exe, ['--hidden'], { detached: true, stdio: 'ignore', env: appEnv, windowsHide: true });
  app.unref();
  const before = await stable(5_000);
  before.forEach((pid) => started.add(pid));
  requireThat(before.includes(String(app.pid)), `the installed app did not start (pid ${app.pid}; running: ${before.join(' ') || 'none'})`);
  const sha = createHash('sha256').update(readFileSync(setup)).digest('hex');
  const cmd = nsisUpdateCommand(setup, sha, app.pid, 60);
  const psEnv = { ...appEnv }; delete psEnv.PSModulePath; // as windowsPowerShellEnv: a Windows PowerShell under pwsh
  const waiter = spawn(cmd.file, cmd.args, { stdio: 'ignore', windowsHide: true, env: psEnv });
  const waited = new Promise((resolve) => waiter.once('exit', (code) => resolve(code)));
  await sleep(3_000);
  const updateStarted = Date.now();
  spawnSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], { windowsHide: true }); // the app quits
  const code = await Promise.race([waited, sleep(180_000).then(() => 'timeout')]);
  requireThat(code === 0, `the waiter ended ${code} (2: the hash changed; 3: the app was still running)`);
  // The installer runs on its own after the waiter (Start-Process returns at once): 12 s on windows-latest, 486 s on
  // windows-11-arm (run 38166001899), whose 7-Zip decoding is slow.
  const anew = await until(() => { const now = appPids(); return now.length > 0 && now.every((pid) => !before.includes(pid)); }, 900_000);
  appPids().forEach((pid) => started.add(pid));
  requireThat(anew, `after the update the app is not running anew (before: ${before.join(' ')}; now: ${appPids().join(' ') || 'none'}; still running from before: ${described(appPids().filter((pid) => before.includes(pid)))})`);
  requireThat(existsSync(exe) && existsSync(uninstaller), 'the update left no app or no uninstaller in place');
  console.log(`the waiter ran the installer after the app exited; it installed in place and started the app again in ${Math.round((Date.now() - updateStarted) / 1000)} s`);
} finally {
  stop([...started]);
  const survivors = await until(() => appPids().every((pid) => !started.has(pid)), 30_000);
  rmSync(data, { recursive: true, force: true });
  rmSync(watched, { recursive: true, force: true });
  requireThat(survivors, `processes of this run survived taskkill: ${described(appPids().filter((pid) => started.has(pid)))}`);
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
console.log(`installed per user at ${dir}, the MCP launcher answered initialize, an update after the app exited restarted it, /S uninstall removed it`);
