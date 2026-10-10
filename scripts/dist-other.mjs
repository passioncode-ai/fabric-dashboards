// Builds Fabric Dashboards for Windows (an NSIS per-user installer) and Linux (an AppImage and a .deb) —
// FD-37, ADR-0019, fabric-workspace knowledge/platforms.md PL-01..PL-04, PL-08. A release is built ONLY by
// .github/workflows/release.yml, on the native runner of each system and architecture; run by hand it is
// a debug build, never published.
//
//   node scripts/dist-other.mjs [--allow-dirty] [--stage app|installer|seal]   on Windows or Linux, this machine's architecture
//
// With no --stage it runs all three. release.yml runs them one by one on Windows and signs between them:
// the app's executable after `app`, the installer after `installer` (Azure Artifact Signing, PL-03).
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

/**
 * The .deb's dependencies: electron-builder's defaults (FpmTarget) plus the libraries Electron links that
 * those do not pull in — a clean Ubuntu 24.04 install failed on libasound.so.2 (FD-37 rehearsal). Ubuntu
 * 24.04 renamed some to `t64`; the alternative keeps Debian 12 and Ubuntu 22.04 installing.
 */
export const DEB_DEPENDS = [
  'libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils', 'libatspi2.0-0', 'libuuid1', 'libsecret-1-0',
  'libasound2t64 | libasound2', 'libgbm1', 'libdrm2', 'libxkbcommon0', 'libcups2t64 | libcups2', 'libxcomposite1', 'libxdamage1', 'libxrandr2',
];

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
    deb: { artifactName: t.artifacts[1], packageName: 'fabric-dashboards', depends: DEB_DEPENDS },
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
    // cmd /s strips one pair of outer quotes, so the path (it has a space) is quoted twice.
    const [cmd, args] = t.platform === 'win32' ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${launcher}""`]] : [launcher, []];
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

/** `--stage app|installer|seal`, or none for all three; `--allow-dirty`. */
export function parseArgs(argv) {
  const out = { stage: '', allowDirty: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--allow-dirty') out.allowDirty = true;
    else if (argv[i] === '--stage') out.stage = argv[++i] ?? '';
    else throw new Error(`Unknown argument ${argv[i]}`);
  }
  requireThat(['', 'app', 'installer', 'seal'].includes(out.stage), `--stage is app, installer or seal, not ${out.stage}.`);
  return out;
}

/** Where a staged build waits between stages (release.yml signs in between, PL-03). */
export function stagePaths(rootDir, t) {
  const dir = path.join(rootDir, 'release', `stage-${t.os}-${t.arch}`);
  return { dir, app: path.join(dir, 'app'), build: path.join(dir, 'build.json') };
}

/** What `Get-AuthenticodeSignature` says of each file: `Valid`, `NotSigned`, … (Windows only). */
export function authenticodeStatus(files) {
  const list = files.map((f) => `'${f.replace(/'/g, "''")}'`).join(',');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `@(${list}) | ForEach-Object { $s = Get-AuthenticodeSignature -LiteralPath $_; [pscustomobject]@{ file = $_; status = $s.Status.ToString(); subject = $s.SignerCertificate.Subject } } | ConvertTo-Json -Compress`],
  { encoding: 'utf8', timeout: 120_000, windowsHide: true, env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'PSMODULEPATH')) });
  let rows;
  try { rows = JSON.parse(r.stdout); } catch { throw new Error(`Get-AuthenticodeSignature did not answer: ${(r.stderr || String(r.error)).slice(0, 300)}`); }
  return (Array.isArray(rows) ? rows : [rows]).map((x) => ({ file: path.basename(x.file), status: x.status, subject: x.subject ?? null }));
}

/**
 * Whether this Windows build must be signed: release.yml sets FD_WINDOWS_SIGNING=true only where the
 * release environment's AZURE_SIGNING_ENABLED is on; anything else is an unsigned build that says so.
 */
export const signingExpected = (env = process.env) => env.FD_WINDOWS_SIGNING === 'true';

function signatures(files, t) {
  if (t.platform !== 'win32') return { status: undefined, files: [] };
  const rows = authenticodeStatus(files);
  if (signingExpected()) {
    const bad = rows.filter((x) => x.status !== 'Valid');
    requireThat(!bad.length, `Windows signing is on, but these are not validly signed: ${bad.map((x) => `${x.file} ${x.status}`).join(', ')}`);
    return { status: 'SIGNED', files: rows };
  }
  return { status: 'NOT_SIGNED', files: rows };
}

async function stageApp(t, version, pkg, allowDirty) {
  requireThat(statfsSync(root).bavail * statfsSync(root).bsize > 3 * 1024 ** 3, 'At least 3 GB of free disk space is needed.');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
  requireThat(!dirty || allowDirty, `The tree has uncommitted changes; commit them first (or --allow-dirty for a local test):\n${dirty}`);
  const electronVersion = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8')).packages?.['node_modules/electron']?.version;
  requireThat(/^\d+\.\d+\.\d+$/.test(electronVersion || ''), 'The committed lockfile must pin Electron.');
  const out = path.join(root, 'release');
  mkdirSync(out, { recursive: true });
  for (const f of [...t.artifacts, t.receipt]) rmSync(path.join(out, f), { force: true });
  const sp = stagePaths(root, t);
  rmSync(sp.dir, { recursive: true, force: true });
  mkdirSync(sp.dir, { recursive: true });
  // npm is a .cmd shim on Windows; its arguments have no spaces, so the shell is safe here.
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' });
  const temp = mkdtempSync(path.join(os.tmpdir(), 'fd-dist-'));
  try {
    const stage = path.join(temp, 'app');
    mkdirSync(stage);
    writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ name: pkg.name, productName: PRODUCT, version, main: pkg.main, license: pkg.license, author: pkg.author, description: pkg.description }, null, 2));
    cpSync(path.join(root, 'out'), path.join(stage, 'out'), { recursive: true });
    stageWorkspacePackages(root, stage);
    stageNativeModulesFor(root, stage, t.platform, t.arch);
    stageVerifierModules(root, stage);
    const bin = path.join(temp, 'bin');
    cpSync(t.launcherDir, bin, { recursive: true });
    const { packager } = await import('@electron/packager');
    const [packaged] = await packager({
      dir: stage, name: PRODUCT, executableName: t.executableName, appVersion: version, buildVersion: version,
      platform: t.platform, arch: t.arch, electronVersion, out: path.join(temp, 'out'), overwrite: true, asar: { unpack: NATIVE_UNPACK }, prune: false,
      icon: t.icon, extraResource: [path.join(root, 'build/assets'), bin],
      win32metadata: { CompanyName: 'PassionCode.ai', ProductName: PRODUCT, FileDescription: PRODUCT, OriginalFilename: t.executable, InternalName: PRODUCT },
    });
    cpSync(packaged, sp.app, { recursive: true, verbatimSymlinks: true });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  const exe = path.join(sp.app, t.executable);
  requireThat(existsSync(exe), `The packaged app has no ${t.executable}.`);
  requireThat(existsSync(path.join(sp.app, 'resources/assets/tray-ok.png')), 'The packaged app is missing its tray icons.');
  const record = {
    product: PRODUCT, version, revision, electronVersion, platform: t.platform, architecture: t.arch, builtAt: new Date().toISOString(),
    checks: {},
  };
  record.checks.fuses = `the executable reads ${[...new Set(applyFuses(exe, wantedFuses(t.platform)))].join(', ')} (scripts/fuses.mjs; ASAR integrity ${t.platform === 'linux' ? 'off on Linux, which Electron does not validate' : 'on'})`;
  Object.assign(record.checks, checks(sp.app, t, version));
  writeFileSync(sp.build, `${JSON.stringify(record, null, 2)}\n`);
  console.error(`staged ${sp.app}`);
}

function stageInstaller(t, version) {
  const sp = stagePaths(root, t);
  requireThat(existsSync(sp.build), `Nothing is staged at ${sp.dir}; run --stage app first.`);
  const record = JSON.parse(readFileSync(sp.build, 'utf8'));
  requireThat(record.version === version && record.platform === t.platform && record.architecture === t.arch, 'The staged build is for another version or system.');
  const exe = path.join(sp.app, t.executable);
  // Signing (between the stages) appends a signature; the fuses it was checked with must still be there.
  const problems = fuseProblems(readFileSync(exe), wantedFuses(t.platform));
  requireThat(!problems.length, `The staged app's fuses changed after it was checked:\n${problems.join('\n')}`);
  if (t.platform === 'win32') signatures([exe], t); // with signing on, an unsigned app never reaches the installer
  const out = path.join(root, 'release');
  const config = path.join(sp.dir, 'builder.json');
  writeFileSync(config, JSON.stringify(builderConfig(t, version, out), null, 2));
  // The CLI through Node, never a shell: the staged folder's path can hold a space.
  const flag = t.platform === 'win32' ? '--win' : '--linux';
  execFileSync(process.execPath, [path.join(root, 'node_modules/electron-builder/cli.js'), flag, `--${t.arch}`, '--prepackaged', sp.app, '--config', config, '--publish', 'never'],
    { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
  for (const f of t.artifacts) requireThat(existsSync(path.join(out, f)), `electron-builder did not make ${f}.`);
  console.error(`made ${t.artifacts.join(', ')}`);
}

function stageSeal(t) {
  const sp = stagePaths(root, t);
  requireThat(existsSync(sp.build), `Nothing is staged at ${sp.dir}; run --stage app first.`);
  const record = JSON.parse(readFileSync(sp.build, 'utf8'));
  const out = path.join(root, 'release');
  const files = t.artifacts.map((f) => path.join(out, f));
  for (const f of files) requireThat(existsSync(f), `${path.basename(f)} is missing; run --stage installer first.`);
  if (t.platform === 'win32') {
    const sig = signatures([path.join(sp.app, t.executable), ...files], t);
    record.windows_authenticode = sig.status;
    record.authenticode = sig.status === 'SIGNED'
      ? { status: 'SIGNED', files: sig.files, note: 'The app and the installer carry Azure Artifact Signing signatures; the uninstaller the installer writes does not (electron-builder makes it inside the installer).' }
      : { status: 'NOT_SIGNED', reason: 'This build was made without Windows signing (FD_WINDOWS_SIGNING is not true): a rehearsal or a local build.', files: sig.files };
  }
  record.files = Object.fromEntries(files.map((f) => [path.basename(f), sha256(f)]));
  writeFileSync(path.join(out, t.receipt), `${JSON.stringify(record, null, 2)}\n`);
  rmSync(sp.dir, { recursive: true, force: true });
  console.error(`sealed ${t.receipt}${record.windows_authenticode ? ` (${record.windows_authenticode})` : ''}`);
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = pkg.version;
  const t = target(process.platform, process.arch, version);
  if (!o.stage || o.stage === 'app') await stageApp(t, version, pkg, o.allowDirty);
  if (!o.stage || o.stage === 'installer') stageInstaller(t, version);
  if (!o.stage || o.stage === 'seal') stageSeal(t);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let finished = false;
  process.on('beforeExit', () => { if (!finished) { console.error('The build stopped before writing a receipt; nothing was produced.'); process.exit(1); } });
  main().then(() => { finished = true; }).catch((error) => { finished = true; console.error(error.message); process.exit(1); });
}
