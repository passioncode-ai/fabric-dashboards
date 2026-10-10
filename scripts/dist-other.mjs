// Builds Fabric Dashboards for Windows (an NSIS per-user installer) and Linux (an AppImage and a .deb) —
// FD-37, ADR-0019, fabric-workspace knowledge/platforms.md PL-01..PL-04, PL-08. A release is built ONLY by
// .github/workflows/release.yml, on the native runner of each system and architecture; run by hand it is
// a debug build, never published.
//
//   node scripts/dist-other.mjs [--allow-dirty]     on Windows or Linux, for this machine's architecture
//
// Stages, each checked: the app directory (@electron/packager, the same staging as macOS: this
// repository's service-host package, node-pty for this system, the openpgp verifier, the MCP launcher),
// the release fuses written into the executable and read back, three checks run by the finished binary
// itself (the MCP launcher answers `initialize`, node-pty spawns a command, the update verifier checks a
// real release's signature), then the installers from the checked directory (electron-builder
// --prepackaged), and a receipt with every file's SHA-256. Windows ships `windows_authenticode:
// NOT_SIGNED` until the organization's Azure certificate profile exists (PL-03): every file is still
// covered by the release's GPG-signed SHA256SUMS and its Sigstore attestations.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statfsSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLE_ID, NATIVE_UNPACK, PRODUCT, stageVerifierModules, stageWorkspacePackages } from './dist-mac.mjs';
import { fuseProblems, readFuseWires, setFuses, WANTED_FUSES, FUSES } from './fuses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function requireThat(condition, message) { if (!condition) throw new Error(message); }
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** What the build makes on `platform`/`arch`: the executable's name, the icon, the launcher, the artifacts. */
export function target(platform, arch, version) {
  requireThat(platform === 'win32' || platform === 'linux', `dist-other builds Windows and Linux, not ${platform}.`);
  requireThat(arch === 'x64' || arch === 'arm64', `dist-other builds x64 and arm64, not ${arch}.`);
  const windows = platform === 'win32';
  const os_ = windows ? 'windows' : 'linux';
  return {
    platform, arch, os: os_,
    executable: windows ? `${PRODUCT}.exe` : 'fabric-dashboards',
    executableName: windows ? PRODUCT : 'fabric-dashboards',
    icon: path.join(root, windows ? 'build/icon.ico' : 'build/icon.png'),
    launcherDir: path.join(root, windows ? 'build/bin-win' : 'build/bin-linux'),
    launcher: windows ? 'fabric-dashboards-mcp.cmd' : 'fabric-dashboards-mcp',
    artifacts: windows
      ? [`Fabric-Dashboards-${version}-windows-${arch}-setup.exe`]
      : [`Fabric-Dashboards-${version}-linux-${arch}.AppImage`, `Fabric-Dashboards-${version}-linux-${arch}.deb`],
    receipt: `Fabric-Dashboards-${version}-${os_}-${arch}.receipt.json`,
  };
}

/**
 * The release fuses per system (LC-13, scripts/fuses.mjs). ASAR integrity is validated by Electron on macOS
 * and Windows only (docs/tutorial/asar-integrity.md, Electron ≥ 30 on Windows): on Linux the fuse is off,
 * a declared exception (AGENTS.md ## Lifecycle, Fuses), rather than a switch that promises a check Electron
 * does not make there.
 */
export function wantedFuses(platform) {
  return platform === 'linux' ? { ...WANTED_FUSES, EnableEmbeddedAsarIntegrityValidation: false } : { ...WANTED_FUSES };
}

/** The node-pty files a system's build carries (ADR-0017): Windows the prebuilt conpty set without debug
 *  symbols; Linux the module built from source for this machine (`npm ci` runs node-gyp — N-API, so the
 *  same binary loads in Electron). Relative to node_modules/node-pty. */
export function nativeFiles(from, platform, arch) {
  if (platform === 'win32') {
    const dir = path.join('prebuilds', `win32-${arch}`);
    const walk = (rel) => readdirSync(path.join(from, rel), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(rel, e.name)) : [path.join(rel, e.name)]));
    requireThat(existsSync(path.join(from, dir, 'pty.node')), `node-pty has no prebuild for win32-${arch}.`);
    return walk(dir).filter((f) => !f.endsWith('.pdb'));
  }
  const built = path.join('build', 'Release', 'pty.node');
  requireThat(existsSync(path.join(from, built)), 'node-pty was not built for this machine (build/Release/pty.node); npm ci builds it with node-gyp (python3, make, g++).');
  return [built];
}

/** node-pty staged with its runtime files only, for this system (the macOS staging is dist-mac.mjs's). */
export function stageNativeModulesFor(from, stage, platform, arch) {
  const src = path.join(from, 'node_modules/node-pty');
  requireThat(existsSync(path.join(src, 'package.json')), 'node-pty is not installed; run npm ci first.');
  const out = path.join(stage, 'node_modules/node-pty');
  mkdirSync(out, { recursive: true });
  const manifest = JSON.parse(readFileSync(path.join(src, 'package.json'), 'utf8'));
  writeFileSync(path.join(out, 'package.json'), JSON.stringify({ name: manifest.name, version: manifest.version, license: manifest.license, main: manifest.main, types: manifest.types }, null, 2));
  cpSync(path.join(src, 'LICENSE'), path.join(out, 'LICENSE'));
  cpSync(path.join(src, 'lib'), path.join(out, 'lib'), { recursive: true, filter: (f) => !/\.test\.js(\.map)?$|\.map$/.test(f) });
  for (const rel of nativeFiles(src, platform, arch)) {
    mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    cpSync(path.join(src, rel), path.join(out, rel));
  }
  return out;
}

/** electron-builder's configuration for the installers, from the packaged directory (PL-02). */
export function builderConfig(t, version, out) {
  const protocols = [{ name: PRODUCT, schemes: ['fabric-dashboards'] }];
  const common = { appId: BUNDLE_ID, productName: PRODUCT, directories: { output: out }, publish: null, npmRebuild: false, protocols, extraMetadata: { version } };
  if (t.platform === 'win32') {
    return {
      ...common,
      win: { target: [{ target: 'nsis', arch: [t.arch] }], icon: t.icon, signAndEditExecutable: false },
      // Per-user, one click, no elevation (PL-02); the app's data stays on uninstall — the app's own
      // Settings → Uninstall decides that (ADR-0015, ADR-0019).
      nsis: { oneClick: true, perMachine: false, deleteAppDataOnUninstall: false, artifactName: t.artifacts[0], uninstallDisplayName: PRODUCT, shortcutName: PRODUCT },
    };
  }
  return {
    ...common,
    linux: {
      target: [{ target: 'AppImage', arch: [t.arch] }, { target: 'deb', arch: [t.arch] }],
      icon: t.icon, category: 'Development', executableName: t.executableName,
      synopsis: 'Every local agent service, watched and opened in one window',
      maintainer: 'PassionCode.ai <https://passioncode.ai/>',
      // `fabric-dashboards://` opens a service page here (ADR-0004; PL-07: the .desktop file's MimeType).
      desktop: { entry: { MimeType: 'x-scheme-handler/fabric-dashboards;', StartupWMClass: 'fabric-dashboards' } },
    },
    appImage: { artifactName: t.artifacts[0] },
    deb: { artifactName: t.artifacts[1], packageName: 'fabric-dashboards' },
  };
}

/** Set the fuses in the executable (the wire lives in it on Windows and Linux) and read them back. */
export function applyFuses(exe, wanted) {
  writeFileSync(exe, setFuses(readFileSync(exe), wanted));
  const buffer = readFileSync(exe);
  const problems = fuseProblems(buffer, wanted);
  requireThat(!problems.length, `The built app has the wrong fuses:\n${problems.join('\n')}`);
  return readFuseWires(buffer).map((w) => FUSES.slice(0, Object.keys(w.fuses).length).map((n) => (w.fuses[n] === 'removed' ? 'r' : w.fuses[n] ? '1' : '0')).join(''));
}

/** Run the finished executable as Node on a probe script; returns its parsed JSON answer or throws with its words. */
function asNode(exe, script, what, timeout = 30_000) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'fd-probe-'));
  try {
    const probe = path.join(dir, 'probe.js');
    writeFileSync(probe, script);
    const r = spawnSync(exe, [probe], { encoding: 'utf8', timeout, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true });
    try { return JSON.parse(r.stdout); } catch { throw new Error(`${what}: ${(r.stderr || r.stdout || String(r.error)).slice(0, 400)}`); }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checks(appDir, t, version) {
  const exe = path.join(appDir, t.executable);
  const asar = path.join(appDir, 'resources', 'app.asar');
  const out = {};
  // The MCP launcher answers initialize from the finished directory.
  const launcher = path.join(appDir, 'resources', 'bin', t.launcher);
  requireThat(existsSync(launcher), 'The packaged app is missing its MCP launcher.');
  const services = mkdtempSync(path.join(os.tmpdir(), 'fd-mcp-'));
  try {
    const [cmd, args] = t.platform === 'win32' ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${launcher}"`]] : [launcher, []];
    const hello = spawnSync(cmd, args, { input: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n', encoding: 'utf8', timeout: 30_000, windowsHide: true, windowsVerbatimArguments: t.platform === 'win32', env: { ...process.env, FABRIC_SERVICES_DIR: services } });
    const answer = (() => { try { return JSON.parse(hello.stdout.split('\n')[0]); } catch { return null; } })();
    requireThat(answer?.result?.serverInfo?.version === version, `The packaged MCP launcher did not answer initialize: ${(hello.stderr || hello.stdout || String(hello.error)).slice(0, 400)}`);
    out.mcpLauncher = `resources/bin/${t.launcher} answers initialize as ${answer.result.serverInfo.name} ${version}`;
  } finally {
    rmSync(services, { recursive: true, force: true });
  }
  // ADR-0017: node-pty loads from app.asar(.unpacked) and runs a command on a pseudo-terminal.
  const [file, fargs] = t.platform === 'win32' ? ['cmd.exe', ['/c', 'echo pty-ok']] : ['/bin/echo', ['pty-ok']];
  const pty = asNode(exe, `const p = require(${JSON.stringify(path.join(asar, 'node_modules/node-pty'))}).spawn(${JSON.stringify(file)}, ${JSON.stringify(fargs)}, { name: 'xterm-256color', cols: 40, rows: 5, cwd: ${JSON.stringify(os.tmpdir())}, env: process.env });
let out = ''; p.onData((d) => { out += d; }); p.onExit((e) => { process.stdout.write(JSON.stringify({ out, code: e.exitCode })); process.exit(0); });`, 'The packaged console PTY did not run');
  requireThat(pty.code === 0 && /pty-ok/.test(pty.out), `The packaged console PTY did not run: ${JSON.stringify(pty).slice(0, 300)}`);
  out.pty = `node-pty spawns ${file} from app.asar`;
  // LC-16: the update verifier checks a real release's signature and refuses one changed byte.
  const fixtures = path.join(root, 'test/fixtures/release-0.6.0');
  const gpg = asNode(exe, `const fs = require('node:fs'); const v = require(${JSON.stringify(path.join(asar, 'out/main/core/release-verify.js'))});
const sums = fs.readFileSync(${JSON.stringify(path.join(fixtures, 'SHA256SUMS'))}); const asc = fs.readFileSync(${JSON.stringify(path.join(fixtures, 'SHA256SUMS.asc'))}, 'utf8');
const bad = Buffer.from(sums); bad[0] = bad[0] ^ 1;
Promise.all([v.sumsSignedByRelease(sums, asc), v.sumsSignedByRelease(bad, asc)]).then(([good, tampered]) => { process.stdout.write(JSON.stringify({ good: good.ok, tampered: tampered.ok })); });`, 'The packaged update verifier did not run');
  requireThat(gpg.good === true && gpg.tampered === false, `The packaged update verifier did not check signatures: ${JSON.stringify(gpg)}`);
  out.updateVerifier = 'openpgp in app.asar accepts v0.6.0 SHA256SUMS signed by the organization key and refuses one changed byte';
  return out;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const platform = process.platform;
  const arch = process.arch;
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = pkg.version;
  const t = target(platform, arch, version);
  requireThat(statfsSync(root).bavail * statfsSync(root).bsize > 3 * 1024 ** 3, 'At least 3 GB of free disk space is needed.');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
  requireThat(!dirty || args.has('--allow-dirty'), `The tree has uncommitted changes; commit them first (or --allow-dirty for a local test):\n${dirty}`);
  const electronVersion = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8')).packages?.['node_modules/electron']?.version;
  requireThat(/^\d+\.\d+\.\d+$/.test(electronVersion || ''), 'The committed lockfile must pin Electron.');
  const out = path.join(root, 'release');
  mkdirSync(out, { recursive: true });
  for (const f of [...t.artifacts, t.receipt]) rmSync(path.join(out, f), { force: true });
  // npm is a .cmd shim on Windows; its arguments have no spaces, so the shell is safe here.
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' });
  const temp = mkdtempSync(path.join(os.tmpdir(), 'fd-dist-'));
  try {
    const stage = path.join(temp, 'app');
    mkdirSync(stage);
    writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ name: pkg.name, productName: PRODUCT, version, main: pkg.main, license: pkg.license, author: pkg.author, description: pkg.description }, null, 2));
    cpSync(path.join(root, 'out'), path.join(stage, 'out'), { recursive: true });
    stageWorkspacePackages(root, stage);
    stageNativeModulesFor(root, stage, platform, arch);
    stageVerifierModules(root, stage);
    const bin = path.join(temp, 'bin');
    cpSync(t.launcherDir, bin, { recursive: true });
    const { packager } = await import('@electron/packager');
    const [appDir] = await packager({
      dir: stage, name: PRODUCT, executableName: t.executableName, appVersion: version, buildVersion: version,
      platform, arch, electronVersion, out: path.join(temp, 'out'), overwrite: true, asar: { unpack: NATIVE_UNPACK }, prune: false,
      icon: t.icon, extraResource: [path.join(root, 'build/assets'), bin],
      win32metadata: { CompanyName: 'PassionCode.ai', ProductName: PRODUCT, FileDescription: PRODUCT, OriginalFilename: t.executable, InternalName: PRODUCT },
    });
    const exe = path.join(appDir, t.executable);
    requireThat(existsSync(exe), `The packaged app has no ${t.executable}.`);
    requireThat(existsSync(path.join(appDir, 'resources/assets/tray-ok.png')), 'The packaged app is missing its tray icons.');
    const record = {
      product: PRODUCT, version, revision, electronVersion, platform, architecture: arch, builtAt: new Date().toISOString(),
      windows_authenticode: platform === 'win32' ? 'NOT_SIGNED' : undefined,
      authenticode: platform === 'win32' ? { status: 'NOT_SIGNED', reason: 'Windows signing (Azure Artifact Signing) waits for the certificate profile — platforms.md PL-03.' } : undefined,
      checks: {},
    };
    record.checks.fuses = `the executable reads ${[...new Set(applyFuses(exe, wantedFuses(platform)))].join(', ')} (scripts/fuses.mjs; ASAR integrity ${platform === 'linux' ? 'off on Linux, which Electron does not validate' : 'on'})`;
    Object.assign(record.checks, checks(appDir, t, version));
    // The installers, from the checked directory.
    const config = path.join(temp, 'builder.json');
    writeFileSync(config, JSON.stringify(builderConfig(t, version, out), null, 2));
    // The CLI through Node, never a shell: the packaged folder's name has a space ("Fabric Dashboards-win32-x64").
    const flag = platform === 'win32' ? '--win' : '--linux';
    execFileSync(process.execPath, [path.join(root, 'node_modules/electron-builder/cli.js'), flag, `--${arch}`, '--prepackaged', appDir, '--config', config, '--publish', 'never'],
      { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
    record.files = Object.fromEntries(t.artifacts.map((f) => {
      const file = path.join(out, f);
      requireThat(existsSync(file), `electron-builder did not make ${f}.`);
      return [f, sha256(file)];
    }));
    writeFileSync(path.join(out, t.receipt), `${JSON.stringify(record, null, 2)}\n`);
    console.error(`made ${t.artifacts.join(', ')} and ${t.receipt}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let finished = false;
  process.on('beforeExit', () => { if (!finished) { console.error('The build stopped before writing a receipt; nothing was produced.'); process.exit(1); } });
  main().then(() => { finished = true; }).catch((error) => { finished = true; console.error(error.message); process.exit(1); });
}
