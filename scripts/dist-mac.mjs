// Builds the installable macOS app the way Fabric Inbox does: a universal
// Fabric Dashboards.app signed with Developer ID and the hardened runtime,
// notarized and stapled, in a drag-to-install disk image — plus the signed zip
// and update-feed.json that the app's own updater reads (SCN-022).
//
// A release is built ONLY by .github/workflows/release.yml, in the protected `release`
// environment (passioncode-ai/.github release-signing). It runs the build in three stages so
// the organization's notarize action can notarize and staple the app between them:
//
//   --stage app     --identity NAME   package, sign and check the app (release/stage/)
//                                     … the workflow notarizes and staples the app …
//   --stage package --identity NAME   the update zip and the signed image, from the stapled app
//                                     … the workflow notarizes and staples the image …
//   --stage seal                      measure what will ship, write update-feed.json + receipt
//
// Run on a Mac by hand, every stage runs in one go. That is a debug build, never published:
//
//   npm run dist                               signed with the one Developer ID identity found
//   npm run dist -- --notary-profile NAME      notarized and stapled too (a keychain profile)
//   npm run dist -- --unsigned                 local test build, not for sharing
//
// Only a clean, committed tree is built, so the artifacts match one commit. A
// receipt with hashes and the signing/notarization state is written beside them.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statfsSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyReleaseFuses, verifyReleaseFuses } from './fuses.mjs';

export const BUNDLE_ID = 'ai.passioncode.fabric-dashboards';
export const PRODUCT = 'Fabric Dashboards';
export const REPO = 'passioncode-ai/fabric-dashboards';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requireThat(condition, message) { if (!condition) throw new Error(message); }

/** ADR-0017: the finished bundle's own Node loads node-pty from app.asar and runs a command on a PTY. */
export function ptyCheck(app) {
  const probeDir = mkdtempSync(path.join(os.tmpdir(), 'fd-pty-'));
  try {
    const module = path.join(app, 'Contents/Resources/app.asar/node_modules/node-pty');
    const probe = path.join(probeDir, 'probe.js');
    writeFileSync(probe, `const p = require(${JSON.stringify(module)}).spawn('/bin/echo', ['pty-ok'], { name: 'xterm-256color', cols: 40, rows: 5, cwd: '/', env: { PATH: '/bin:/usr/bin' } });
let out = ''; p.onData((d) => { out += d; }); p.onExit((e) => { process.stdout.write(JSON.stringify({ out, code: e.exitCode })); process.exit(0); });`);
    const r = spawnSync(path.join(app, `Contents/MacOS/${PRODUCT}`), [probe], { encoding: 'utf8', timeout: 20_000, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
    const answer = (() => { try { return JSON.parse(r.stdout); } catch { return null; } })();
    requireThat(answer && answer.code === 0 && /pty-ok/.test(answer.out), `The packaged console PTY did not run: ${(r.stderr || r.stdout || String(r.error)).slice(0, 300)}`);
    return 'node-pty spawns /bin/echo from app.asar (spawn-helper unpacked and executable)';
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
}

// #region stage-workspace-packages — docs: packages/service-host/README.md#inside-the-app
/**
 * The app's one runtime dependency is this repository's own workspace package
 * @passioncode-ai/fabric-service-host (packages/service-host): its built dist, its shared test
 * vectors and its package.json go into the stage's node_modules, so `require` inside app.asar
 * finds it the way it does in a checkout. Nothing from the registry is shipped.
 */
export function stageWorkspacePackages(from, stage) {
  const pkgDir = path.join(from, 'packages/service-host');
  const manifest = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  requireThat(existsSync(path.join(pkgDir, 'dist/index.js')), `${manifest.name} is not built; npm run build:host first.`);
  const target = path.join(stage, 'node_modules', ...manifest.name.split('/'));
  mkdirSync(target, { recursive: true });
  writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: manifest.name, version: manifest.version, license: manifest.license, main: manifest.main, types: manifest.types, exports: manifest.exports }, null, 2));
  for (const part of ['dist', 'test-vectors']) cpSync(path.join(pkgDir, part), path.join(target, part), { recursive: true });
  return target;
}
// #endregion stage-workspace-packages

// #region stage-native-modules — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
/**
 * ADR-0017: the agent console's PTY (`node-pty`, N-API — no rebuild per Electron). Staged with its
 * runtime files only: `lib/` without tests and maps, the macOS prebuilds for both architectures
 * (the universal app carries both), its manifest and licence. `spawn-helper` gets its executable
 * bit here — node-pty 1.1.0 ships it 0644 and never sets it — before anything is signed. The
 * packager unpacks the module from app.asar (NATIVE_UNPACK) so the helper can be executed.
 */
export const NATIVE_UNPACK = '**/node_modules/node-pty/**';
export const NATIVE_BOTH_ARCHS = '**/node_modules/node-pty/prebuilds/darwin-*/*';
export function stageNativeModules(from, stage) {
  const src = path.join(from, 'node_modules/node-pty');
  requireThat(existsSync(path.join(src, 'package.json')), 'node-pty is not installed; run npm ci first.');
  const target = path.join(stage, 'node_modules/node-pty');
  mkdirSync(target, { recursive: true });
  const manifest = JSON.parse(readFileSync(path.join(src, 'package.json'), 'utf8'));
  writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: manifest.name, version: manifest.version, license: manifest.license, main: manifest.main, types: manifest.types }, null, 2));
  cpSync(path.join(src, 'LICENSE'), path.join(target, 'LICENSE'));
  cpSync(path.join(src, 'lib'), path.join(target, 'lib'), { recursive: true, filter: (f) => !/\.test\.js(\.map)?$|\.map$/.test(f) });
  for (const arch of ['arm64', 'x64']) {
    const dir = path.join(src, 'prebuilds', `darwin-${arch}`);
    requireThat(existsSync(path.join(dir, 'pty.node')) && existsSync(path.join(dir, 'spawn-helper')), `node-pty has no prebuild for darwin-${arch}.`);
    cpSync(dir, path.join(target, 'prebuilds', `darwin-${arch}`), { recursive: true });
    chmodSync(path.join(target, 'prebuilds', `darwin-${arch}`, 'spawn-helper'), 0o755);
  }
  return target;
}
// #endregion stage-native-modules
function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 ** 2, stdio: ['pipe', 'pipe', 'pipe'], ...options });
}
function tryRun(command, args) {
  try { return { ok: true, out: execFileSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 ** 2, stdio: ['pipe', 'pipe', 'pipe'] }) }; }
  catch (error) { return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() }; }
}
const both = (command, args) => { const r = spawnSync(command, args, { cwd: root, encoding: 'utf8' }); return `${r.stdout ?? ''}${r.stderr ?? ''}`; };
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** spctl and codesign speak on stderr: keep both streams and the verdict. */
function assess(command, args) {
  const r = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() || String(r.error ?? '') };
}

const STAGES = ['app', 'package', 'seal'];

export function parseArgs(argv) {
  const args = { unsigned: false, notaryProfile: '', identity: '', allowDirty: false, stage: '' };
  const takesValue = { '--notary-profile': 'notaryProfile', '--identity': 'identity', '--stage': 'stage' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--unsigned') args.unsigned = true;
    else if (a === '--allow-dirty') args.allowDirty = true;
    else if (Object.hasOwn(takesValue, a)) {
      requireThat(argv[i + 1] && !argv[i + 1].startsWith('--'), `Give a value for ${a}.`);
      args[takesValue[a]] = argv[++i];
    } else throw new Error(`Unknown argument ${a}. Use --stage app|package|seal, --identity NAME, --notary-profile NAME, --unsigned or --allow-dirty.`);
  }
  requireThat(!(args.unsigned && (args.notaryProfile || args.identity || args.stage)), '--unsigned cannot be combined with signing options.');
  requireThat(!args.stage || STAGES.includes(args.stage), 'A stage is app, package or seal.');
  requireThat(!(args.stage && args.notaryProfile), "A staged build is notarized by its caller (the release workflow's notarize action); drop --notary-profile.");
  requireThat(!['app', 'package'].includes(args.stage) || args.identity, `--stage ${args.stage} signs: name the identity with --identity.`);
  requireThat(!args.notaryProfile || /^[A-Za-z0-9._-]{1,64}$/.test(args.notaryProfile), 'A notary profile name has letters, digits, dot, dash or underscore.');
  return args;
}

/** The single valid Developer ID Application identity, or the named one. */
export function pickIdentity(findIdentityOutput, wanted = '') {
  const listed = [...findIdentityOutput.matchAll(/^\s*\d+\) ([A-F0-9]{40}) "([^"\n]+)"\s*$/gm)].map((m) => ({ hash: m[1], name: m[2] }));
  // One certificate is listed once per keychain that holds it; it is still one identity.
  const all = [...new Map(listed.map((i) => [i.hash, i])).values()];
  const developerId = all.filter((i) => i.name.startsWith('Developer ID Application: '));
  const matching = wanted ? developerId.filter((i) => i.name === wanted) : developerId;
  requireThat(!(wanted && matching.length > 1), `"${wanted}" names ${matching.length} different certificates here; remove the stale one.`);
  requireThat(matching.length === 1, wanted
    ? `The identity "${wanted}" is not a valid Developer ID Application identity here.`
    : `Expected exactly one Developer ID Application identity, found ${developerId.length}; name one with --identity.`);
  return matching[0];
}

// #region release-retention — docs: AGENTS.md#build-output-and-retention
const RELEASE_BINARY = /^Fabric-Dashboards-(\d+)\.(\d+)\.(\d+)(-unsigned)?(\.dmg|-mac\.zip)$/;
/**
 * LC-15: a build leaves the current release and the one before it (for rollback), no more. Only
 * the disk images and update zips this script names are pruned, by version order; receipts (small
 * JSON) and anything else in the directory stay. Returns the file names it removed.
 */
// #region usage-descriptions — docs: docs/RUNBOOK.md#usage-descriptions
/** FD-06, LC-07: the `NS…UsageDescription` purpose strings Electron's template carries (camera,
 *  microphone, Bluetooth, …). The app asks for none of these, so a shipped string would only
 *  describe a permission it never requests. Returns the keys to remove. */
export function usageDescriptionKeys(plist) {
  return Object.keys(plist ?? {}).filter((key) => /^NS[A-Za-z]+UsageDescription$/.test(key));
}

/** Remove those keys from the app's Info.plist and every helper's, before anything is signed. */
export function stripUsageDescriptions(app) {
  const plists = [path.join(app, 'Contents/Info.plist')];
  const frameworks = path.join(app, 'Contents/Frameworks');
  for (const name of readdirSync(frameworks)) {
    const helper = path.join(frameworks, name, 'Contents/Info.plist');
    if (name.endsWith('.app') && existsSync(helper)) plists.push(helper);
  }
  for (const file of plists) {
    for (const key of usageDescriptionKeys(JSON.parse(run('plutil', ['-convert', 'json', '-o', '-', file])))) run('plutil', ['-remove', key, file]);
    requireThat(usageDescriptionKeys(JSON.parse(run('plutil', ['-convert', 'json', '-o', '-', file]))).length === 0, `${file} still carries a usage description.`);
  }
  return plists.length;
}
// #endregion usage-descriptions

export function pruneReleases(dir, keep = 2) {
  if (!existsSync(dir)) return [];
  const binaries = readdirSync(dir).map((name) => ({ name, m: RELEASE_BINARY.exec(name) })).filter((x) => x.m);
  const versionOf = (m) => [Number(m[1]), Number(m[2]), Number(m[3])];
  const key = (v) => v.join('.');
  const versions = [...new Map(binaries.map((b) => [key(versionOf(b.m)), versionOf(b.m)])).values()]
    .sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
  const kept = new Set(versions.slice(0, keep).map(key));
  const removed = [];
  for (const b of binaries) {
    if (kept.has(key(versionOf(b.m)))) continue;
    rmSync(path.join(dir, b.name), { force: true });
    removed.push(b.name);
  }
  return removed;
}

const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
/** A bundle this build made and is about to delete must not stay registered with LaunchServices,
 *  or a stale copy could answer an `open`. Best effort: a missing tool is not a failed build. */
export function unregisterBundle(app) {
  if (existsSync(app) && existsSync(LSREGISTER)) spawnSync(LSREGISTER, ['-u', app], { stdio: 'ignore', timeout: 30_000 });
}
// #endregion release-retention

/** The Squirrel.Mac JSON feed (serverType "json") the app's autoUpdater reads. */
export function updateFeed(version, zipName, notes, date = new Date().toISOString()) {
  const url = `https://github.com/${REPO}/releases/download/v${version}/${zipName}`;
  return { currentRelease: version, releases: [{ version, updateTo: { version, name: version, notes, pub_date: date, url } }] };
}

function changelogSection(version) {
  const text = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const m = new RegExp(`^## ${version.replace(/\./g, '\\.')}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm').exec(text);
  return m ? m[1].trim() : '';
}

// #region staged-release — docs: docs/RUNBOOK.md#release
/** Where each stage reads and writes. release.yml names `app` and `dmg` literally. */
export function stagePaths(base, version, unsigned = false) {
  const out = path.join(base, 'release');
  const stage = path.join(out, 'stage');
  const name = `Fabric-Dashboards-${version}${unsigned ? '-unsigned' : ''}`;
  return {
    out, stage, app: path.join(stage, `${PRODUCT}.app`), record: path.join(stage, 'build.json'),
    dmg: path.join(out, `${name}.dmg`), zip: path.join(out, `${name}-mac.zip`),
    feed: path.join(out, 'update-feed.json'), receipt: path.join(out, `${name}.receipt.json`),
  };
}

/**
 * `notarytool submit --wait --output-format json` prints {id, status, message}. Its exit code
 * does not say whether Apple accepted, so the status is read: only "Accepted" passes.
 */
export function notaryVerdict(text) {
  let d;
  try { d = JSON.parse(text); } catch { return { accepted: false, status: 'unreadable', id: '' }; }
  const status = d && typeof d.status === 'string' && d.status ? d.status : 'unreadable';
  const id = d && typeof d.id === 'string' ? d.id : '';
  return { accepted: status === 'Accepted', status, id };
}

/**
 * What the receipt says about signing, notarization and Gatekeeper, from measurements of the
 * finished files. A build that was meant to be notarized (by a profile or by the release
 * workflow) must have the ticket stapled on the app, on the app inside the update zip and on
 * the image, and Gatekeeper must accept the app and the image; anything else is a problem
 * that stops the seal. A signed build nobody notarized is recorded as such and is not a failure.
 */
export function assessRelease(record, m) {
  if (record.signing === 'unsigned') return { signing: 'unsigned', notarization: 'not requested', gatekeeper: 'not assessed', checks: {}, problems: [] };
  const problems = [];
  const lines = (r) => r.out.split('\n').map((l) => l.trim()).filter(Boolean);
  const source = (r) => lines(r).find((l) => l.startsWith('source=')) ?? lines(r)[0] ?? 'no answer';
  const verdict = (r) => `${r.ok ? 'accepted' : 'not accepted'}, ${source(r)}`;
  const checks = {
    imageSignature: m.imageSignature ? 'valid' : 'invalid',
    appGatekeeper: `spctl --type execute: ${verdict(m.appGatekeeper)}`,
    imageGatekeeper: `spctl --type open --context context:primary-signature: ${verdict(m.imageGatekeeper)}`,
  };
  if (!m.appSignature) problems.push('The app failed strict signature verification.');
  if (!m.imageSignature) problems.push('The image signature does not verify.');
  const staples = [['app', m.appStaple], ['update zip', m.zipStaple], ['image', m.imageStaple]];
  checks.staples = staples.map(([n, ok]) => `${n}: ${ok ? 'stapled' : 'not stapled'}`).join('; ');
  const assessed = [['app', m.appGatekeeper], ['image', m.imageGatekeeper]];
  const gatekeeper = assessed.every(([, r]) => r.ok) ? 'accepted' : `not accepted: ${assessed.filter(([, r]) => !r.ok).map(([n, r]) => `${n} ${source(r)}`).join('; ')}`;
  let notarization = 'not requested';
  if (record.notarizedBy !== 'none') {
    const by = record.notarizedBy === 'caller' ? "the release workflow's notarize action" : `notarytool, keychain ${record.notarizedBy}`;
    for (const [n, ok] of staples) if (!ok) problems.push(`The ${n} is not stapled: its notarization (${by}) did not complete.`);
    for (const [n, r] of assessed) if (!r.ok) problems.push(`The ${n} is not accepted by Gatekeeper: ${source(r)}.`);
    notarization = staples.every(([, ok]) => ok) ? `accepted and stapled: app, update zip, image (${by})` : `incomplete (${by})`;
  }
  return { signing: record.signing, notarization, gatekeeper, checks, problems };
}

/** Local debug path only: notarize with a keychain profile, read Apple's status, staple. */
function notarizeWithProfile(file, profile) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'fd-notary-'));
  try {
    let upload = file;
    if (file.endsWith('.app')) {
      upload = path.join(temp, 'upload.zip');
      run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', file, upload]);
    }
    const r = spawnSync('xcrun', ['notarytool', 'submit', upload, '--keychain-profile', profile, '--wait', '--timeout', '45m', '--output-format', 'json'],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 ** 2, timeout: 50 * 60 * 1000 });
    const v = notaryVerdict(r.stdout ?? '');
    if (!v.accepted) {
      const log = v.id ? both('xcrun', ['notarytool', 'log', v.id, '--keychain-profile', profile]) : `${r.stderr ?? ''}`;
      throw new Error(`Apple answered ${v.status} for ${path.basename(file)}${v.id ? ` (submission ${v.id})` : ''}:\n${log.slice(0, 4000)}`);
    }
    run('xcrun', ['stapler', 'staple', file]);
    return v.id;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function context(args) {
  requireThat(process.platform === 'darwin', 'A macOS build is made on macOS.');
  requireThat(statfsSync(root).bavail * statfsSync(root).bsize > 3 * 1024 ** 3, 'At least 3 GB of free disk space is needed.');
  const revision = run('git', ['rev-parse', 'HEAD']).trim();
  const dirty = run('git', ['status', '--porcelain', '--untracked-files=no']).trim();
  requireThat(!dirty || args.allowDirty, `The tree has uncommitted changes; commit them first (or --allow-dirty for a local test):\n${dirty}`);
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = pkg.version;
  requireThat(/^\d+\.\d+\.\d+$/.test(version), 'package.json needs a version like 1.2.3.');
  const electronVersion = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8')).packages?.['node_modules/electron']?.version;
  requireThat(/^\d+\.\d+\.\d+$/.test(electronVersion || ''), 'The committed lockfile must pin Electron.');
  requireThat(changelogSection(version), `CHANGELOG.md has no section for ${version}.`);
  return { args, pkg, version, revision, electronVersion, paths: stagePaths(root, version, args.unsigned) };
}

const signingIdentity = (wanted) => pickIdentity(run('security', ['find-identity', '-v', '-p', 'codesigning']), wanted);

function readRecord(ctx) {
  const { paths } = ctx;
  requireThat(existsSync(paths.record) && existsSync(paths.app), `No staged app in ${path.relative(root, paths.stage)}; run --stage app first.`);
  const record = JSON.parse(readFileSync(paths.record, 'utf8'));
  requireThat(record.revision === ctx.revision && record.version === ctx.version,
    `The staged app is ${record.version} from ${record.revision}; this tree is ${ctx.version} from ${ctx.revision}. Rebuild it with --stage app.`);
  return record;
}
const writeRecord = (ctx, record) => writeFileSync(ctx.paths.record, JSON.stringify(record, null, 2) + '\n');

/** Stage 1: package the universal app, sign it with the hardened runtime and check it. */
async function stageApp(ctx, identity, notarizedBy) {
  const { paths, pkg, version, electronVersion } = ctx;
  unregisterBundle(paths.app);
  rmSync(paths.stage, { recursive: true, force: true });
  for (const f of [paths.dmg, paths.zip, paths.feed, paths.receipt]) rmSync(f, { force: true });
  mkdirSync(paths.stage, { recursive: true });
  run('npm', ['run', 'build'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const record = {
    product: PRODUCT, version, revision: ctx.revision, electronVersion, architectures: ['arm64', 'x86_64'], builtAt: new Date().toISOString(),
    signing: identity ? identity.name : 'unsigned', notarizedBy: identity ? notarizedBy : 'none', checks: {},
  };
  const temp = mkdtempSync(path.join(os.tmpdir(), 'fd-dist-'));
  try {
    // The renderer and preload are bundled; the main process uses Electron, Node built-ins and
    // one package of this repository's own, staged into node_modules (stageWorkspacePackages).
    const stage = path.join(temp, 'app');
    mkdirSync(stage);
    writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ name: pkg.name, productName: PRODUCT, version, main: pkg.main, license: pkg.license, author: pkg.author }, null, 2));
    cpSync(path.join(root, 'out'), path.join(stage, 'out'), { recursive: true });
    stageWorkspacePackages(root, stage);
    stageNativeModules(root, stage);
    const { packager } = await import('@electron/packager');
    const [appDir] = await packager({
      dir: stage, name: PRODUCT, executableName: PRODUCT, appVersion: version, buildVersion: version,
      appBundleId: BUNDLE_ID, appCategoryType: 'public.app-category.developer-tools', icon: path.join(root, 'build/icon.icns'),
      platform: 'darwin', arch: 'universal', electronVersion, out: path.join(temp, 'out'), overwrite: true, asar: { unpack: NATIVE_UNPACK }, prune: false,
      // Both builds carry both architectures' node-pty prebuilds, byte for byte: nothing to lipo.
      osxUniversal: { x64ArchFiles: NATIVE_BOTH_ARCHS },
      extraResource: [path.join(root, 'build/assets'), path.join(root, 'build/bin')],
      extendInfo: { NSHumanReadableCopyright: `${PRODUCT} — PassionCode.ai`, NSRequiresAquaSystemAppearance: false, LSMinimumSystemVersion: '13.0', LSUIElement: false },
      // `fabric-dashboards://` opens a service page here (docs/adr/0004-deep-links-and-mcp.md).
      protocols: [{ name: PRODUCT, schemes: ['fabric-dashboards'] }],
    });
    // ditto keeps the bundle's symlinks, modes and extended attributes.
    run('/usr/bin/ditto', [path.join(appDir, `${PRODUCT}.app`), paths.app]);
  } finally {
    unregisterBundle(path.join(temp, 'out', `${PRODUCT}-darwin-universal`, `${PRODUCT}.app`));
    rmSync(temp, { recursive: true, force: true });
  }
  const app = paths.app;
  requireThat(existsSync(path.join(app, 'Contents/Resources/assets/trayTemplate.png')), 'The packaged app is missing its menu bar icons.');
  const mcp = path.join(app, 'Contents/Resources/bin/fabric-dashboards-mcp');
  requireThat(existsSync(mcp) && (statSync(mcp).mode & 0o111) !== 0, 'The packaged app is missing its executable MCP launcher.');
  // LC-13: hardened fuses, set before any signature (a changed byte voids one) and read back
  // from the finished binary below. An unsigned build re-seals the framework ad hoc, the way the
  // packager does after writing the asar integrity digest, so Apple Silicon still loads it.
  record.checks.usageDescriptions = `none in ${stripUsageDescriptions(app)} Info.plist files (FD-06)`;
  applyReleaseFuses(app);
  if (!identity) {
    run('codesign', ['--sign', '-', '--force', '--deep', '--preserve-metadata=entitlements,requirements,flags,runtime',
      path.join(app, 'Contents/Frameworks/Electron Framework.framework')]);
  }
  // Signed AFTER packaging, on the finished universal bundle: signing inside the packager
  // raced its own temporary directories (2026-09-28, ENOENT).
  if (identity) {
    const { sign } = await import('@electron/osx-sign'); // 2.x: sign() returns a promise
    await sign({ app, identity: identity.hash, optionsForFile: () => ({ hardenedRuntime: true, entitlements: path.join(root, 'build/entitlements.mac.plist') }) });
    requireThat(tryRun('codesign', ['--verify', '--deep', '--strict', app]).ok, 'The signed app failed strict signature verification.');
    record.checks.appSignature = 'codesign --verify --deep --strict: valid';
    record.checks.hardenedRuntime = /flags=0x10000\(runtime\)/.test(both('codesign', ['-dv', '--verbose=2', app])) ? 'present' : 'missing';
    requireThat(record.checks.hardenedRuntime === 'present', 'The app was signed without the hardened runtime; notarization would refuse it.');
  }
  record.checks.architectures = run('lipo', ['-archs', path.join(app, `Contents/MacOS/${PRODUCT}`)]).trim();
  record.checks.fuses = `every slice reads ${[...new Set(verifyReleaseFuses(app))].join(', ')} (scripts/fuses.mjs WANTED_FUSES)`;
  // The MCP launcher answers `initialize` from inside the finished, signed bundle.
  const probeDir = mkdtempSync(path.join(os.tmpdir(), 'fd-mcp-'));
  try {
    const hello = spawnSync(mcp, [], { input: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n', encoding: 'utf8', timeout: 20_000, env: { ...process.env, FABRIC_SERVICES_DIR: probeDir } });
    const answer = (() => { try { return JSON.parse(hello.stdout.split('\n')[0]); } catch { return null; } })();
    requireThat(answer?.result?.serverInfo?.version === version, `The packaged MCP launcher did not answer initialize: ${(hello.stderr || hello.stdout || String(hello.error)).slice(0, 300)}`);
    record.checks.mcpLauncher = `Contents/Resources/bin/fabric-dashboards-mcp answers initialize as ${answer.result.serverInfo.name} ${version}`;
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
  record.checks.pty = ptyCheck(app);
  writeRecord(ctx, record);
  console.error(`app: ${path.relative(root, app)} (${record.signing})`);
}

/** Stage 2: the update zip and the disk image, both made from the (stapled) app; the image signed. */
function stagePackage(ctx, identity) {
  const { paths } = ctx;
  const record = readRecord(ctx);
  const app = paths.app;
  if (record.signing !== 'unsigned') {
    requireThat(identity && identity.name === record.signing, `The image is signed by the identity that signed the app (${record.signing}).`);
  }
  if (record.notarizedBy !== 'none') {
    requireThat(tryRun('xcrun', ['stapler', 'validate', app]).ok,
      'The app is not stapled yet: notarize and staple it first, so the update zip and the image carry the ticket.');
  }
  for (const f of [paths.dmg, paths.zip, paths.feed, paths.receipt]) rmSync(f, { force: true });
  // The update zip keeps the app's signature and staple: ditto, never zip(1).
  run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, paths.zip]);
  const temp = mkdtempSync(path.join(os.tmpdir(), 'fd-dmg-'));
  try {
    const settings = path.join(temp, 'dmg-settings.py');
    writeFileSync(settings, [
      `files = [${JSON.stringify(app)}]`, "symlinks = {'Applications': '/Applications'}",
      `icon_locations = {${JSON.stringify(`${PRODUCT}.app`)}: (140, 160), 'Applications': (400, 160)}`,
      'window_rect = ((200, 120), (540, 340))', "default_view = 'icon-view'", 'icon_size = 112', 'text_size = 13',
      'show_status_bar = False', 'show_tab_view = False', 'show_toolbar = False', 'show_pathbar = False', 'show_sidebar = False',
      "format = 'UDZO'", "filesystem = 'HFS+'", '',
    ].join('\n'));
    const built = tryRun('uvx', ['--from', 'dmgbuild==1.6.7', 'dmgbuild', '-s', settings, PRODUCT, paths.dmg]);
    if (built.ok) record.checks.windowLayout = 'icon view, app beside Applications (dmgbuild 1.6.7)';
    else {
      record.checks.windowLayout = `default view: dmgbuild unavailable (${built.out.split('\n').pop()?.slice(0, 160)}); the image still installs by drag`;
      const dmgStage = path.join(temp, 'stage');
      mkdirSync(dmgStage);
      run('/usr/bin/ditto', [app, path.join(dmgStage, `${PRODUCT}.app`)]);
      symlinkSync('/Applications', path.join(dmgStage, 'Applications'));
      run('hdiutil', ['create', '-volname', PRODUCT, '-srcfolder', dmgStage, '-fs', 'HFS+', '-format', 'UDZO', '-imagekey', 'zlib-level=9', '-ov', paths.dmg]);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  requireThat(existsSync(paths.dmg), 'No disk image was produced.');
  if (identity) run('codesign', ['--sign', identity.hash, '--timestamp', paths.dmg]);
  record.packagedAt = new Date().toISOString();
  writeRecord(ctx, record);
  console.error(`image: ${path.relative(root, paths.dmg)}; update zip: ${path.relative(root, paths.zip)}`);
}

/** Stage 3: measure what will ship — app, the app inside the update zip, image — then the feed and receipt. */
function stageSeal(ctx) {
  const { paths, version } = ctx;
  const record = readRecord(ctx);
  requireThat(existsSync(paths.zip) && existsSync(paths.dmg), 'No update zip or image; run --stage package first.');
  const m = {};
  if (record.signing !== 'unsigned') {
    const temp = mkdtempSync(path.join(os.tmpdir(), 'fd-seal-'));
    try {
      // The updater installs what is inside the zip, so that copy is the one measured.
      run('/usr/bin/ditto', ['-x', '-k', paths.zip, temp]);
      const zipped = path.join(temp, `${PRODUCT}.app`);
      requireThat(tryRun('codesign', ['--verify', '--deep', '--strict', zipped]).ok, 'The app inside the update zip fails strict signature verification.');
      m.zipStaple = tryRun('xcrun', ['stapler', 'validate', zipped]).ok;
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
    m.appSignature = tryRun('codesign', ['--verify', '--deep', '--strict', paths.app]).ok;
    m.imageSignature = tryRun('codesign', ['--verify', '--strict', paths.dmg]).ok;
    m.appStaple = tryRun('xcrun', ['stapler', 'validate', paths.app]).ok;
    m.imageStaple = tryRun('xcrun', ['stapler', 'validate', paths.dmg]).ok;
    m.appGatekeeper = assess('spctl', ['--assess', '--type', 'execute', '-vv', paths.app]);
    m.imageGatekeeper = assess('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '-vv', paths.dmg]);
  }
  const verdict = assessRelease(record, m);
  requireThat(verdict.problems.length === 0, `Not releasable:\n- ${verdict.problems.join('\n- ')}`);
  const receipt = {
    product: PRODUCT, version, revision: record.revision, electronVersion: record.electronVersion, architectures: record.architectures, builtAt: record.builtAt,
    image: path.basename(paths.dmg), updateZip: path.basename(paths.zip),
    signing: verdict.signing, notarization: verdict.notarization, gatekeeper: verdict.gatekeeper,
    checks: { ...record.checks, ...verdict.checks },
    zipSha256: sha256(paths.zip), sha256: sha256(paths.dmg), bytes: statSync(paths.dmg).size,
  };
  receipt.pruned = pruneReleases(paths.out, 2); // LC-15: this release and the previous one stay
  writeFileSync(paths.feed, JSON.stringify(updateFeed(version, path.basename(paths.zip), changelogSection(version)), null, 2) + '\n');
  writeFileSync(paths.receipt, JSON.stringify(receipt, null, 2) + '\n');
  unregisterBundle(paths.app);
  rmSync(paths.stage, { recursive: true, force: true });
  console.log(JSON.stringify(receipt, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ctx = context(args);
  if (args.stage === 'app') return stageApp(ctx, signingIdentity(args.identity), 'caller');
  if (args.stage === 'package') return stagePackage(ctx, signingIdentity(args.identity));
  if (args.stage === 'seal') return stageSeal(ctx);
  // By hand, on a Mac: every stage in one go. A debug build — never published (RUNBOOK).
  const identity = args.unsigned ? null : signingIdentity(args.identity);
  if (args.notaryProfile) {
    requireThat(tryRun('xcrun', ['notarytool', 'history', '--keychain-profile', args.notaryProfile]).ok,
      `The notary profile "${args.notaryProfile}" is not in this Mac's keychain. Create it once: xcrun notarytool store-credentials ${args.notaryProfile} --team-id <TEAM>.`);
  }
  await stageApp(ctx, identity, args.notaryProfile ? `profile ${args.notaryProfile}` : 'none');
  if (args.notaryProfile) notarizeWithProfile(ctx.paths.app, args.notaryProfile);
  stagePackage(ctx, identity);
  if (args.notaryProfile) notarizeWithProfile(ctx.paths.dmg, args.notaryProfile);
  stageSeal(ctx);
}
// #endregion staged-release

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let finished = false;
  // A promise that never settles lets Node drain its loop and exit 0 with nothing
  // built — a failure reported as success. Refuse that exit.
  process.on('beforeExit', () => { if (!finished) { console.error('The build stopped before writing a receipt; nothing was produced.'); process.exit(1); } });
  main().then(() => { finished = true; }).catch((error) => { finished = true; console.error(error.message); process.exit(1); });
}
