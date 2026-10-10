// FD-37: the Windows installer on the runner that built it — run by packages.yml after dist-other.mjs:
//   node scripts/nsis-smoke.mjs release/Fabric-Dashboards-<v>-windows-<arch>-setup.exe
// It installs per user without elevation (/S), the installed MCP launcher answers `initialize`, the
// uninstaller sits where the app's own Settings → Uninstall looks for it (src/core/platform.ts
// uninstallTarget), and running it the way the app does (/S) removes the install.
import { spawnSync } from 'node:child_process';
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
console.log(`installed per user at ${dir}, the MCP launcher answered initialize, /S uninstall removed it`);
