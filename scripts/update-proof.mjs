// FD-37 M4 end-to-end proof (ADR-0019 amendments M4b and M4c): a copy of an older release, installed the way a
// person installs it, updates itself to the latest release with nobody touching it. Run by update-proof.yml on a
// native runner after a release:
//   node scripts/update-proof.mjs <from-version> <to-version>
// Linux: the AppImage of <from> runs hidden under Xvfb; it must replace its own file with <to>'s AppImage (the
// same SHA-256 as the release's SHA256SUMS) and start again as <to>. Windows: <from>'s installer is installed per
// user; the app runs hidden; it must run <to>'s installer through its waiter and start again as <to>. Each copy has
// its own data folder, and the proof is read from its own log: `update_install installed from=<from> to=<to>`.
// FD_PROOF_FROM_DIR: take the <from> copy from this folder (a debug build of the current code, built with <from>'s
// version number by update-proof.yml `build`), so a fix is proven before it is released.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [from, to] = process.argv.slice(2);
function requireThat(condition, message) { if (!condition) throw new Error(message); }
for (const event of ['unhandledRejection', 'uncaughtException']) process.on(event, (error) => { console.error(`::error::${error?.message ?? error}`); process.exit(1); });
requireThat(/^\d+\.\d+\.\d+$/.test(from ?? '') && /^\d+\.\d+\.\d+$/.test(to ?? ''), 'usage: update-proof.mjs <from-version> <to-version>');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const work = mkdtempSync(path.join(os.tmpdir(), 'fd-update-proof-'));
const data = path.join(work, 'data');
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const fromDir = process.env.FD_PROOF_FROM_DIR ? path.resolve(process.env.FD_PROOF_FROM_DIR) : null;
const fromFile = (name) => (fromDir ? path.join(fromDir, name) : path.join(download(from, name), name));
const download = (version, pattern) => { gh(['release', 'download', `v${version}`, '-R', 'passioncode-ai/fabric-dashboards', '-p', pattern, '-D', path.join(work, version), '--clobber']); return path.join(work, version); };
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const sums = (version) => Object.fromEntries(readFileSync(path.join(download(version, 'SHA256SUMS'), 'SHA256SUMS'), 'utf8').trim().split('\n').map((l) => l.split(/\s+/)).map(([h, n]) => [n.replace(/^\*/, ''), h]));
const logText = () => { try { return readFileSync(path.join(data, 'logs', 'main.log'), 'utf8'); } catch { return ''; } };
const installed = new RegExp(`update_install installed from=${from.replace(/\./g, '\\.')} to=${to.replace(/\./g, '\\.')}`);
// The latest release is the feed: the proof is only meaningful when <to> is it.
const latest = gh(['release', 'view', '-R', 'passioncode-ai/fabric-dashboards', '--json', 'tagName', '-q', '.tagName']).trim();
requireThat(latest === `v${to}`, `the latest release is ${latest}, not v${to}`);
// ADR-0015: 90 s to the first check, the download, then 10 hidden minutes before the install; Windows arm64's
// installer alone takes up to ~8 minutes (FD-37 M4c measurement).
const deadline = Date.now() + 40 * 60_000;
const env = { ...process.env, FABRIC_DASHBOARDS_USER_DATA: data, FABRIC_SERVICES_DIR: path.join(work, 'services') };

async function waitFor(label, ok) {
  while (Date.now() < deadline) { if (ok()) return; await sleep(15_000); }
  const tail = logText().split('\n').filter((l) => /update_|auto_update|alerts:/.test(l)).slice(-15).join('\n');
  throw new Error(`${label} did not happen within 40 minutes; the app's update lines:\n${tail || '(none)'}`);
}

if (process.platform === 'linux') {
  const name = (v) => `Fabric-Dashboards-${v}-linux-${arch}.AppImage`;
  const image = path.join(work, 'Fabric Dashboards.AppImage');
  execFileSync('cp', [fromFile(name(from)), image]);
  chmodSync(image, 0o755);
  const expected = sums(to)[name(to)];
  requireThat(Boolean(expected), `SHA256SUMS of ${to} names no ${name(to)}`);
  // A display that outlives the app, as a desktop session does: `xvfb-run` would stop its X server when the first
  // copy exits and leave the restarted one nowhere to open. --no-sandbox because Ubuntu 24.04 confines user
  // namespaces, which an AppImage's Chromium needs (no setuid helper is possible inside a read-only image).
  if (!process.env.DISPLAY) {
    spawn('Xvfb', [':99', '-screen', '0', '1280x800x24', '-nolisten', 'tcp'], { stdio: 'ignore', detached: true }).unref();
    env.DISPLAY = ':99';
    await sleep(2_000);
  }
  const app = spawn(image, ['--hidden', '--no-sandbox'], { env, stdio: 'ignore', detached: true });
  app.unref();
  // What runs around the restart, for the record (the relaunch is the step a desktop session cannot show).
  const watchRestart = async () => {
    while (!/update_install started/.test(logText())) await sleep(5_000);
    for (let i = 0; i < 12; i += 1) {
      const ps = spawnSync('ps', ['-eo', 'pid,ppid,stat,args'], { encoding: 'utf8' }).stdout.split('\n').filter((l) => /Fabric|fabric-dashboards|AppRun|mount_/i.test(l) && !/update-proof/.test(l));
      console.log(`[restart +${i * 10}s]\n${ps.join('\n') || '(no app process)'}`);
      if (installed.test(logText())) break;
      await sleep(10_000);
    }
  };
  void watchRestart();
  await waitFor(`${name(from)} replacing itself with ${name(to)}`, () => existsSync(image) && statSync(image).size > 0 && sha256(image) === expected);
  console.log(`the AppImage replaced its own file with ${name(to)} (sha256 ${expected.slice(0, 12)}, as SHA256SUMS)`);
  await waitFor(`the restart as ${to}`, () => installed.test(logText()));
  console.log(`it started again as ${to}: ${logText().match(installed)[0]}`);
  try { process.kill(-app.pid, 'SIGTERM'); } catch { /* gone */ }
} else if (process.platform === 'win32') {
  const name = `Fabric-Dashboards-${from}-windows-${arch}-setup.exe`;
  const setup = fromFile(name);
  const install = spawnSync(setup, ['/S'], { timeout: 600_000, windowsHide: true });
  requireThat(install.status === 0, `the ${from} installer exited ${install.status ?? install.error}`);
  const programs = path.join(process.env.LOCALAPPDATA ?? '', 'Programs');
  const dir = readdirSync(programs).map((d) => path.join(programs, d)).find((d) => existsSync(path.join(d, 'Fabric Dashboards.exe')));
  requireThat(Boolean(dir), `no install under ${programs}`);
  const exe = path.join(dir, 'Fabric Dashboards.exe');
  const version = () => { try { return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Item -LiteralPath '${exe.replace(/'/g, "''")}').VersionInfo.ProductVersion`], { encoding: 'utf8', windowsHide: true }).trim(); } catch { return ''; } };
  requireThat(version().startsWith(from), `the installed app is ${version()}, not ${from}`);
  spawn(exe, ['--hidden'], { env, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  await waitFor(`the install of ${to} over ${from}`, () => version().startsWith(to));
  console.log(`the app ran ${to}'s installer through its waiter: ${exe} is ${version()}`);
  // The installer starts the app again through Explorer, with the signed-in user's own environment: it then logs
  // where Windows copies do by default (src/core/platform.ts places: %LOCALAPPDATA%\Fabric Dashboards\Logs).
  const defaultLog = path.join(process.env.LOCALAPPDATA ?? '', 'Fabric Dashboards', 'Logs', 'main.log');
  await waitFor(`the restart as ${to}`, () => installed.test(logText()) || (() => { try { return installed.test(readFileSync(defaultLog, 'utf8')); } catch { return false; } })());
  console.log(`it started again as ${to}`);
  spawnSync('taskkill', ['/F', '/T', '/IM', 'Fabric Dashboards.exe'], { windowsHide: true });
} else {
  throw new Error('update-proof runs on Linux or Windows; macOS updates are proven by every release (ADR-0015)');
}
console.log(`FD-37 M4: ${process.platform}-${arch} updated itself from ${from} to ${to}`);
