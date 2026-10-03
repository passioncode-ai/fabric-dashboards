// Builds the installable macOS app the way Fabric Inbox does: a universal
// Fabric Dashboards.app signed with Developer ID and the hardened runtime,
// notarized and stapled, in a drag-to-install disk image — plus the signed zip
// and update-feed.json that the app's own updater reads (SCN-022).
//
//   npm run dist                               signed with the one Developer ID identity found
//   npm run dist -- --notary-profile NAME      notarized and stapled too
//   npm run dist -- --unsigned                 local test build, not for sharing
//
// Only a clean, committed tree is built, so the artifacts match one commit. A
// receipt with hashes and the signing/notarization state is written beside them.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statfsSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyReleaseFuses, verifyReleaseFuses } from './fuses.mjs';

export const BUNDLE_ID = 'ai.passioncode.fabric-dashboards';
export const PRODUCT = 'Fabric Dashboards';
export const REPO = 'passioncode-ai/fabric-dashboards';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requireThat(condition, message) { if (!condition) throw new Error(message); }

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
function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 ** 2, stdio: ['pipe', 'pipe', 'pipe'], ...options });
}
function tryRun(command, args) {
  try { return { ok: true, out: execFileSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 ** 2, stdio: ['pipe', 'pipe', 'pipe'] }) }; }
  catch (error) { return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() }; }
}
const both = (command, args) => { const r = spawnSync(command, args, { cwd: root, encoding: 'utf8' }); return `${r.stdout ?? ''}${r.stderr ?? ''}`; };
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

export function parseArgs(argv) {
  const args = { unsigned: false, notaryProfile: '', identity: '', allowDirty: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--unsigned') args.unsigned = true;
    else if (a === '--allow-dirty') args.allowDirty = true;
    else if (a === '--notary-profile' || a === '--identity') {
      requireThat(argv[i + 1] && !argv[i + 1].startsWith('--'), `Give a value for ${a}.`);
      args[a === '--identity' ? 'identity' : 'notaryProfile'] = argv[++i];
    } else throw new Error(`Unknown argument ${a}. Use --notary-profile NAME, --identity NAME, --unsigned or --allow-dirty.`);
  }
  requireThat(!(args.unsigned && (args.notaryProfile || args.identity)), '--unsigned cannot be combined with signing options.');
  requireThat(!args.notaryProfile || /^[A-Za-z0-9._-]{1,64}$/.test(args.notaryProfile), 'A notary profile name has letters, digits, dot, dash or underscore.');
  return args;
}

/** The single valid Developer ID Application identity, or the named one. */
export function pickIdentity(findIdentityOutput, wanted = '') {
  const all = [...findIdentityOutput.matchAll(/^\s*\d+\) ([A-F0-9]{40}) "([^"\n]+)"\s*$/gm)].map((m) => ({ hash: m[1], name: m[2] }));
  const developerId = all.filter((i) => i.name.startsWith('Developer ID Application: '));
  const matching = wanted ? developerId.filter((i) => i.name === wanted) : developerId;
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
function unregisterBundle(app) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
  const notes = changelogSection(version);
  requireThat(notes, `CHANGELOG.md has no section for ${version}.`);

  const identity = args.unsigned ? null : pickIdentity(run('security', ['find-identity', '-v', '-p', 'codesigning']), args.identity);
  if (args.notaryProfile) {
    requireThat(tryRun('xcrun', ['notarytool', 'history', '--keychain-profile', args.notaryProfile]).ok,
      `The notary profile "${args.notaryProfile}" is not in this Mac's keychain. Create it once: xcrun notarytool store-credentials ${args.notaryProfile} --team-id <TEAM>.`);
  }

  run('npm', ['run', 'build'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const out = path.join(root, 'release');
  mkdirSync(out, { recursive: true });
  const base = `Fabric-Dashboards-${version}${args.unsigned ? '-unsigned' : ''}`;
  const dmg = path.join(out, `${base}.dmg`);
  const zip = path.join(out, `${base}-mac.zip`);
  rmSync(dmg, { force: true });
  rmSync(zip, { force: true });
  const temp = mkdtempSync(path.join(os.tmpdir(), 'fd-dist-'));
  try {
    // The renderer and preload are bundled; the main process uses Electron, Node built-ins and
    // one package of this repository's own, staged into node_modules (stageWorkspacePackages).
    const stage = path.join(temp, 'app');
    mkdirSync(stage);
    writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ name: pkg.name, productName: PRODUCT, version, main: pkg.main, license: pkg.license, author: pkg.author }, null, 2));
    cpSync(path.join(root, 'out'), path.join(stage, 'out'), { recursive: true });
    stageWorkspacePackages(root, stage);
    const { packager } = await import('@electron/packager');
    const [appDir] = await packager({
      dir: stage, name: PRODUCT, executableName: PRODUCT, appVersion: version, buildVersion: version,
      appBundleId: BUNDLE_ID, appCategoryType: 'public.app-category.developer-tools', icon: path.join(root, 'build/icon.icns'),
      platform: 'darwin', arch: 'universal', electronVersion, out: path.join(temp, 'out'), overwrite: true, asar: true, prune: false,
      extraResource: [path.join(root, 'build/assets'), path.join(root, 'build/bin')],
      extendInfo: { NSHumanReadableCopyright: `${PRODUCT} — PassionCode.ai`, NSRequiresAquaSystemAppearance: false, LSMinimumSystemVersion: '13.0', LSUIElement: false },
      // `fabric-dashboards://` opens a service page here (docs/adr/0004-deep-links-and-mcp.md).
      protocols: [{ name: PRODUCT, schemes: ['fabric-dashboards'] }],
    });
    const app = path.join(appDir, `${PRODUCT}.app`);
    requireThat(existsSync(path.join(app, 'Contents/Resources/assets/trayTemplate.png')), 'The packaged app is missing its menu bar icons.');
    const mcp = path.join(app, 'Contents/Resources/bin/fabric-dashboards-mcp');
    requireThat(existsSync(mcp) && (statSync(mcp).mode & 0o111) !== 0, 'The packaged app is missing its executable MCP launcher.');
    // LC-13: hardened fuses, set before any signature (a changed byte voids one) and read back
    // from the finished binary below. An unsigned build re-seals the framework ad hoc, the way the
    // packager does after writing the asar integrity digest, so Apple Silicon still loads it.
    applyReleaseFuses(app);
    if (!identity) {
      run('codesign', ['--sign', '-', '--force', '--deep', '--preserve-metadata=entitlements,requirements,flags,runtime',
        path.join(app, 'Contents/Frameworks/Electron Framework.framework')]);
    }
    // Signed and notarized AFTER packaging, on the finished universal bundle: signing
    // inside the packager raced its own temporary directories (2026-09-28, ENOENT).
    if (identity) {
      const { sign } = await import('@electron/osx-sign'); // 2.x: sign() returns a promise
      await sign({ app, identity: identity.hash, optionsForFile: () => ({ hardenedRuntime: true, entitlements: path.join(root, 'build/entitlements.mac.plist') }) });
    }
    if (args.notaryProfile) {
      const appZip = path.join(temp, 'notarize-app.zip');
      run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, appZip]);
      run('xcrun', ['notarytool', 'submit', appZip, '--keychain-profile', args.notaryProfile, '--wait'], { timeout: 45 * 60 * 1000 });
      run('xcrun', ['stapler', 'staple', app]);
    }
    const receipt = {
      product: PRODUCT, version, revision, electronVersion, architectures: ['arm64', 'x86_64'], builtAt: new Date().toISOString(),
      image: path.basename(dmg), updateZip: path.basename(zip), signing: 'unsigned', notarization: 'not requested', gatekeeper: 'not assessed', checks: {},
    };
    if (identity) {
      requireThat(tryRun('codesign', ['--verify', '--deep', '--strict', app]).ok, 'The signed app failed strict signature verification.');
      receipt.signing = identity.name;
      receipt.checks.appSignature = 'codesign --verify --deep --strict: valid';
      receipt.checks.hardenedRuntime = /flags=0x10000\(runtime\)/.test(both('codesign', ['-dv', '--verbose=2', app])) ? 'present' : 'missing';
      requireThat(receipt.checks.hardenedRuntime === 'present', 'The app was signed without the hardened runtime; notarization would refuse it.');
    }
    receipt.checks.architectures = run('lipo', ['-archs', path.join(app, `Contents/MacOS/${PRODUCT}`)]).trim();
    receipt.checks.fuses = `every slice reads ${[...new Set(verifyReleaseFuses(app))].join(', ')} (scripts/fuses.mjs WANTED_FUSES)`;
    // The MCP launcher answers `initialize` from inside the finished, signed bundle.
    const hello = spawnSync(mcp, [], { input: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n', encoding: 'utf8', timeout: 20_000, env: { ...process.env, FABRIC_SERVICES_DIR: temp } });
    const answer = (() => { try { return JSON.parse(hello.stdout.split('\n')[0]); } catch { return null; } })();
    requireThat(answer?.result?.serverInfo?.version === version, `The packaged MCP launcher did not answer initialize: ${(hello.stderr || hello.stdout || String(hello.error)).slice(0, 300)}`);
    receipt.checks.mcpLauncher = `Contents/Resources/bin/fabric-dashboards-mcp answers initialize as ${answer.result.serverInfo.name} ${version}`;
    if (args.notaryProfile) receipt.checks.appStaple = tryRun('xcrun', ['stapler', 'validate', app]).ok ? 'stapled' : 'not stapled';

    // The update zip keeps the app's signature and staple: ditto, never zip(1).
    run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip]);
    receipt.zipSha256 = sha256(zip);

    const settings = path.join(temp, 'dmg-settings.py');
    writeFileSync(settings, [
      `files = [${JSON.stringify(app)}]`, "symlinks = {'Applications': '/Applications'}",
      `icon_locations = {${JSON.stringify(`${PRODUCT}.app`)}: (140, 160), 'Applications': (400, 160)}`,
      'window_rect = ((200, 120), (540, 340))', "default_view = 'icon-view'", 'icon_size = 112', 'text_size = 13',
      'show_status_bar = False', 'show_tab_view = False', 'show_toolbar = False', 'show_pathbar = False', 'show_sidebar = False',
      "format = 'UDZO'", "filesystem = 'HFS+'", '',
    ].join('\n'));
    const built = tryRun('uvx', ['--from', 'dmgbuild==1.6.7', 'dmgbuild', '-s', settings, PRODUCT, dmg]);
    if (built.ok) receipt.checks.windowLayout = 'icon view, app beside Applications (dmgbuild 1.6.7)';
    else {
      receipt.checks.windowLayout = `default view: dmgbuild unavailable (${built.out.split('\n').pop()?.slice(0, 160)}); the image still installs by drag`;
      const dmgStage = path.join(temp, 'stage');
      mkdirSync(dmgStage);
      run('/usr/bin/ditto', [app, path.join(dmgStage, `${PRODUCT}.app`)]);
      symlinkSync('/Applications', path.join(dmgStage, 'Applications'));
      run('hdiutil', ['create', '-volname', PRODUCT, '-srcfolder', dmgStage, '-fs', 'HFS+', '-format', 'UDZO', '-imagekey', 'zlib-level=9', '-ov', dmg]);
    }
    if (identity) {
      run('codesign', ['--sign', identity.hash, '--timestamp', dmg]);
      receipt.checks.imageSignature = tryRun('codesign', ['--verify', '--strict', dmg]).ok ? 'valid' : 'invalid';
    }
    if (args.notaryProfile) {
      run('xcrun', ['notarytool', 'submit', dmg, '--keychain-profile', args.notaryProfile, '--wait']);
      run('xcrun', ['stapler', 'staple', dmg]);
      receipt.notarization = tryRun('xcrun', ['stapler', 'validate', dmg]).ok ? 'accepted and stapled' : 'submitted; staple did not validate';
    }
    if (identity) {
      const assess = tryRun('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '-vv', dmg]);
      receipt.gatekeeper = assess.ok ? 'accepted' : `not accepted: ${assess.out.split('\n').find((l) => l.includes('source=')) ?? assess.out.split('\n')[0]}`;
    }
    receipt.sha256 = sha256(dmg);
    receipt.bytes = readFileSync(dmg).length;
    if (!existsSync(dmg)) throw new Error('No disk image was produced.');
    receipt.pruned = pruneReleases(out, 2); // LC-15: this release and the previous one stay
    writeFileSync(path.join(out, 'update-feed.json'), JSON.stringify(updateFeed(version, path.basename(zip), notes), null, 2) + '\n');
    writeFileSync(path.join(out, `${base}.receipt.json`), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    unregisterBundle(path.join(temp, 'out', `${PRODUCT}-darwin-universal`, `${PRODUCT}.app`));
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let finished = false;
  // A promise that never settles lets Node drain its loop and exit 0 with nothing
  // built — a failure reported as success. Refuse that exit.
  process.on('beforeExit', () => { if (!finished) { console.error('The build stopped before writing a receipt; nothing was produced.'); process.exit(1); } });
  main().then(() => { finished = true; }).catch((error) => { finished = true; console.error(error.message); process.exit(1); });
}
