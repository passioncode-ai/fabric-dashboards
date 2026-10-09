import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { tmp } from './helpers';

test('dist: arguments, identity choice and the update feed', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  assert.deepEqual(dist.parseArgs(['--notary-profile', 'fabric-notary']), { unsigned: false, notaryProfile: 'fabric-notary', identity: '', allowDirty: false, stage: '' });
  assert.throws(() => dist.parseArgs(['--unsigned', '--identity', 'x']), /cannot be combined/);
  assert.throws(() => dist.parseArgs(['--bogus']), /Unknown argument/);
  const out = '  1) ' + 'A'.repeat(40) + ' "Developer ID Application: Someone (TEAM)"\n  2) ' + 'B'.repeat(40) + ' "Apple Development: Someone (X)"\n';
  assert.equal(dist.pickIdentity(out).hash, 'A'.repeat(40));
  assert.throws(() => dist.pickIdentity(out, 'Developer ID Application: Other (Y)'), /not a valid/);
  const feed = dist.updateFeed('0.1.1', 'Fabric-Dashboards-0.1.1-mac.zip', 'Fixes.', '2026-09-28T00:00:00Z');
  assert.equal(feed.currentRelease, '0.1.1');
  assert.equal(feed.releases[0].updateTo.url, 'https://github.com/passioncode-ai/fabric-dashboards/releases/download/v0.1.1/Fabric-Dashboards-0.1.1-mac.zip');
});

test('dist: the workspace package is staged where the app\'s require finds it inside app.asar', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  const root = path.resolve(__dirname, '..');
  const stage = tmp('fd-stage-');
  fs.mkdirSync(path.join(stage, 'out'));
  const target = dist.stageWorkspacePackages(root, stage);
  assert.equal(target, path.join(stage, 'node_modules/@passioncode-ai/fabric-service-host'));
  for (const f of ['package.json', 'dist/index.js', 'dist/state.js', 'dist/links.js', 'test-vectors/state-precedence.json']) assert.ok(fs.existsSync(path.join(target, f)), f);
  assert.equal(fs.existsSync(path.join(target, 'src')), false, 'sources and tests stay out of the app');
  assert.equal(fs.existsSync(path.join(target, 'test')), false);
  // Resolved from the stage alone, as main.js resolves it inside the bundle.
  const probe = `const h = require('@passioncode-ai/fabric-service-host'); const s = require('@passioncode-ai/fabric-service-host/state');
    process.stdout.write(JSON.stringify([h.serviceLink('a1.default'), s.DOWN_AFTER_MS, h.loadStateVectors().cases.length > 0]));`;
  fs.writeFileSync(path.join(stage, 'out/probe.js'), probe);
  const r = spawnSync(process.execPath, [path.join(stage, 'out/probe.js')], { encoding: 'utf8', cwd: stage, env: { ...process.env, NODE_PATH: '' } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ['fabric-dashboards://service/a1.default', 15000, true]);
});

// #region release-in-ci — docs: docs/RUNBOOK.md#release
// The release is signed only in CI (passioncode-ai/.github release-signing): the build is staged
// so the organization's notarize action can notarize and staple the app before the update zip and
// the disk image are made from it, then notarize the image. The local path stays for debugging.
test('dist: staged CI arguments — the identity is named, the caller notarizes', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  const id = 'Developer ID Application: Example Org (TEAMID0000)';
  assert.deepEqual(dist.parseArgs(['--stage', 'app', '--identity', id]), { unsigned: false, notaryProfile: '', identity: id, allowDirty: false, stage: 'app' });
  assert.equal(dist.parseArgs(['--stage', 'package', '--identity', id]).stage, 'package');
  assert.equal(dist.parseArgs(['--stage', 'seal']).stage, 'seal');
  assert.throws(() => dist.parseArgs(['--stage', 'app']), /--identity/, 'a staged build never picks an identity from the keychain');
  assert.throws(() => dist.parseArgs(['--stage', 'package']), /--identity/);
  assert.throws(() => dist.parseArgs(['--stage', 'app', '--identity', id, '--notary-profile', 'p']), /notarized by its caller/);
  assert.throws(() => dist.parseArgs(['--stage', 'app', '--unsigned']), /cannot be combined/);
  assert.throws(() => dist.parseArgs(['--stage', 'zip', '--identity', id]), /app, package or seal/);
  assert.throws(() => dist.parseArgs(['--stage']), /Give a value/);
});

test('dist: one certificate listed twice is one identity', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  // `security find-identity` lists a certificate once per keychain in the search list.
  const twice = '  1) ' + 'C'.repeat(40) + ' "Developer ID Application: Example Org (TEAMID0000)"\n  2) ' + 'C'.repeat(40) + ' "Developer ID Application: Example Org (TEAMID0000)"\n     2 valid identities found\n';
  assert.equal(dist.pickIdentity(twice).hash, 'C'.repeat(40));
  assert.equal(dist.pickIdentity(twice, 'Developer ID Application: Example Org (TEAMID0000)').hash, 'C'.repeat(40));
  const two = twice.replace(/^( {2}2\) )C{40}/m, `$1${'D'.repeat(40)}`);
  assert.throws(() => dist.pickIdentity(two), /exactly one/);
});

test('dist: the notary status is read, not assumed from the exit code', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  assert.deepEqual(dist.notaryVerdict('{"id":"sub-1","status":"Accepted","message":"Processing complete"}'), { accepted: true, status: 'Accepted', id: 'sub-1' });
  assert.deepEqual(dist.notaryVerdict('{"id":"sub-2","status":"Invalid","message":"Processing complete"}'), { accepted: false, status: 'Invalid', id: 'sub-2' });
  assert.deepEqual(dist.notaryVerdict('Error: HTTP status code: 401'), { accepted: false, status: 'unreadable', id: '' });
  assert.deepEqual(dist.notaryVerdict(''), { accepted: false, status: 'unreadable', id: '' });
});

test('dist: staged paths are the ones the release workflow hands the notarize action', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  const p = dist.stagePaths('/r', '1.2.3');
  assert.deepEqual(p, {
    out: '/r/release', stage: '/r/release/stage', app: '/r/release/stage/Fabric Dashboards.app', record: '/r/release/stage/build.json',
    dmg: '/r/release/Fabric-Dashboards-1.2.3.dmg', zip: '/r/release/Fabric-Dashboards-1.2.3-mac.zip',
    feed: '/r/release/update-feed.json', receipt: '/r/release/Fabric-Dashboards-1.2.3.receipt.json',
  });
  assert.equal(dist.stagePaths('/r', '1.2.3', true).dmg, '/r/release/Fabric-Dashboards-1.2.3-unsigned.dmg');
});

test('dist: the receipt asserts notarization and Gatekeeper on the app, the update zip and the image', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  const ok = { ok: true, out: 'accepted\nsource=Notarized Developer ID' };
  const all = { appSignature: true, imageSignature: true, appStaple: true, zipStaple: true, imageStaple: true, appGatekeeper: ok, imageGatekeeper: ok };
  const caller = { signing: 'Developer ID Application: Example Org (TEAMID0000)', notarizedBy: 'caller' };

  const good = dist.assessRelease(caller, all);
  assert.deepEqual(good.problems, []);
  assert.equal(good.gatekeeper, 'accepted');
  assert.match(good.notarization, /^accepted and stapled: app, update zip, image/);
  assert.equal(good.checks.appGatekeeper, 'spctl --type execute: accepted, source=Notarized Developer ID');
  assert.equal(good.checks.imageGatekeeper, 'spctl --type open --context context:primary-signature: accepted, source=Notarized Developer ID');

  const rejected = { ok: false, out: 'rejected\nsource=Unnotarized Developer ID' };
  const appNotAssessed = dist.assessRelease(caller, { ...all, appGatekeeper: rejected });
  assert.match(appNotAssessed.problems.join('\n'), /app.*Gatekeeper/);
  assert.match(appNotAssessed.gatekeeper, /^not accepted: app source=Unnotarized Developer ID/);
  assert.match(dist.assessRelease(caller, { ...all, zipStaple: false }).problems.join('\n'), /update zip.*not stapled/);
  assert.match(dist.assessRelease(caller, { ...all, imageStaple: false }).problems.join('\n'), /image.*not stapled/);
  assert.match(dist.assessRelease(caller, { ...all, imageSignature: false }).problems.join('\n'), /image.*signature/);
  assert.match(dist.assessRelease({ ...caller, notarizedBy: 'profile fabric-notary' }, { ...all, appStaple: false }).problems.join('\n'), /app.*not stapled/);

  // Signed, not notarized (a local debug build): recorded honestly, not a failure.
  const debug = dist.assessRelease({ ...caller, notarizedBy: 'none' }, { ...all, appStaple: false, zipStaple: false, imageStaple: false, appGatekeeper: rejected, imageGatekeeper: rejected });
  assert.deepEqual(debug.problems, []);
  assert.equal(debug.notarization, 'not requested');
  assert.match(debug.gatekeeper, /^not accepted/);

  const unsigned = dist.assessRelease({ signing: 'unsigned', notarizedBy: 'none' }, {});
  assert.deepEqual(unsigned, { signing: 'unsigned', notarization: 'not requested', gatekeeper: 'not assessed', checks: {}, problems: [] });
});

test('dist: release.yml signs in the release environment and ships only what was made from the stapled app', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  const root = path.resolve(__dirname, '..');
  const wf = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  const at = (needle: string) => { const i = wf.indexOf(needle); assert.ok(i >= 0, `release.yml lacks ${needle}`); return i; };
  // Triggers: a vX.Y.Z tag publishes; an -rc tag does not trigger; a dispatch rehearses by default.
  at('tags: ["v[0-9]+.[0-9]+.[0-9]+"]');
  assert.match(wf, /workflow_dispatch:\s+inputs:\s+publish:[\s\S]*?type: boolean\s+default: false/);
  at("publish: ${{ github.event_name == 'push' || inputs.publish }}");
  at('environment: release');
  // ADR-0015: Squirrel follows the latest release's feed even backwards, so a full release must be
  // newer than the published one; a rehearsal (-rc) is exempt.
  const guard = at('A full release is newer than the latest published one');
  assert.ok(guard < at('  check:'), 'the version guard runs before anything is built');
  at("if: ${{ !contains(github.ref_name, '-rc.') }}");
  at('repos/$GITHUB_REPOSITORY/releases/latest');
  at('sort -V');
  // F-1/F-2: one release at a time, the check repeated right before publish, a failed lookup is not a tag.
  at('group: release\n');
  assert.ok(at('still-newest:') < at('uses: passioncode-ai/.github/.github/workflows/release-publish.yml@v1'));
  at('needs: [macos, still-newest]');
  at("grep -q 'HTTP 404' /tmp/gh-err");
  at('team-id: ${{ vars.APPLE_TEAM_ID }}');
  // The order that makes the update zip and the image come from the stapled app.
  const order = [
    at('uses: passioncode-ai/.github/actions/apple-signing@v1'),
    at('--stage app --identity "$IDENTITY"'),
    at('path: release/stage/Fabric Dashboards.app'),
    at('--stage package --identity "$IDENTITY"'),
    at('path: ${{ steps.version.outputs.dmg }}'),
    at('--stage seal'),
    at('name: release-macos'),
    at('uses: passioncode-ai/.github/actions/apple-signing/cleanup@v1'),
    at('uses: passioncode-ai/.github/.github/workflows/release-publish.yml@v1'),
  ];
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'release.yml steps are out of order');
  assert.equal(wf.split('uses: passioncode-ai/.github/actions/notarize@v1').length - 1, 2, 'the app and the image are each notarized once');
  // The workflow's literal paths are the script's.
  assert.equal(path.relative(root, dist.stagePaths(root, '1.2.3').app), 'release/stage/Fabric Dashboards.app');
  at('release/Fabric-Dashboards-${version}.dmg');
  for (const f of ['.dmg', '-mac.zip', 'update-feed.json', '.receipt.json']) assert.ok(new RegExp(`path:[\\s\\S]*release/[^\\n]*${f.replace('.', '\\.')}`).test(wf), `release-macos uploads ${f}`);
  // No keychain profile, no login-keychain identity, no team id literal in the CI path.
  assert.doesNotMatch(wf, /notary-profile|keychain-profile|find-identity/);
  assert.doesNotMatch(wf, /\([A-Z0-9]{10}\)|KJ35UYYL22/);
  // Third-party actions are pinned by commit.
  for (const m of wf.matchAll(/uses: ([^\s]+)/g)) {
    if (m[1].startsWith('passioncode-ai/.github/') || m[1].startsWith('./')) continue;
    assert.match(m[1], /@[0-9a-f]{40}$/, `${m[1]} is not pinned by commit`);
  }
});

test('dist: no team id or signing identity is written into the build script', () => {
  const root = path.resolve(__dirname, '..');
  const src = fs.readFileSync(path.join(root, 'scripts/dist-mac.mjs'), 'utf8');
  assert.doesNotMatch(src, /KJ35UYYL22|Developer ID Application: [A-Z][a-z]/);
});
// #endregion release-in-ci

// #region usage-descriptions — docs: docs/RUNBOOK.md#usage-descriptions
test('dist: no NS…UsageDescription survives in the app or its helpers (FD-06)', async (t) => {
  if (process.platform !== 'darwin') return t.skip('plutil is macOS');
  const dist = await import('../scripts/dist-mac.mjs');
  assert.deepEqual(dist.usageDescriptionKeys({ NSCameraUsageDescription: 'x', NSBluetoothAlwaysUsageDescription: 'y', NSHumanReadableCopyright: 'z', CFBundleName: 'A' }),
    ['NSCameraUsageDescription', 'NSBluetoothAlwaysUsageDescription']);
  const app = path.join(tmp('fd-plist-'), 'A.app');
  const plist = (dir: string, body: Record<string, string>) => {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'Info.plist');
    fs.writeFileSync(file, JSON.stringify(body));
    assert.equal(spawnSync('plutil', ['-convert', 'xml1', file]).status, 0);
    return file;
  };
  const main = plist(path.join(app, 'Contents'), { CFBundleName: 'A', NSMicrophoneUsageDescription: 'mic', NSCameraUsageDescription: 'cam' });
  const helper = plist(path.join(app, 'Contents/Frameworks/A Helper (Renderer).app/Contents'), { CFBundleName: 'A Helper', NSAudioCaptureUsageDescription: 'audio' });
  fs.mkdirSync(path.join(app, 'Contents/Frameworks/Electron Framework.framework'), { recursive: true });
  assert.equal(dist.stripUsageDescriptions(app), 2);
  const read = (f: string) => JSON.parse(spawnSync('plutil', ['-convert', 'json', '-o', '-', f], { encoding: 'utf8' }).stdout);
  assert.deepEqual(read(main), { CFBundleName: 'A' });
  assert.deepEqual(read(helper), { CFBundleName: 'A Helper' });
});
// #endregion usage-descriptions

test('ADR-0017: node-pty is staged with its runtime files only, universal in both folders, and an executable spawn-helper', { skip: process.platform !== 'darwin' && 'the macOS staging joins prebuilds with lipo, which only macOS has' }, async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  const root = path.resolve(__dirname, '..');
  const stage = tmp('fd-stage-pty-');
  const target = dist.stageNativeModules(root, stage);
  assert.equal(target, path.join(stage, 'node_modules/node-pty'));
  for (const arch of ['arm64', 'x64']) {
    const helper = path.join(target, 'prebuilds', `darwin-${arch}`, 'spawn-helper');
    assert.ok(fs.existsSync(path.join(target, 'prebuilds', `darwin-${arch}`, 'pty.node')), arch);
    assert.equal(fs.statSync(helper).mode & 0o111, 0o111, `${arch} spawn-helper is executable`);
    // No thin Intel-only file ships: macOS 26 warns about one ("Support Ending for Intel-Based Apps").
    for (const file of ['pty.node', 'spawn-helper']) {
      const archs = spawnSync('lipo', ['-archs', path.join(target, 'prebuilds', `darwin-${arch}`, file)], { encoding: 'utf8' }).stdout.trim().split(/\s+/).sort();
      assert.deepEqual(archs, ['arm64', 'x86_64'], `${arch}/${file} is universal`);
    }
  }
  assert.deepEqual(dist.thinMachO(target), [], 'the staged module has no thin Mach-O');
  // The check finds a thin Intel-only binary the way the 0.6.6 bundle carried one.
  const thin = path.join(stage, 'thin');
  fs.mkdirSync(thin);
  spawnSync('lipo', [path.join(target, 'prebuilds/darwin-x64/pty.node'), '-thin', 'x86_64', '-output', path.join(thin, 'pty.node')]);
  fs.writeFileSync(path.join(thin, 'notes.txt'), 'not a binary');
  assert.deepEqual(dist.thinMachO(thin), ['pty.node [x86_64]']);
  const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  assert.ok(files(path.join(target, 'lib')).every((f) => !/\.test\.js$|\.map$/.test(f)), 'no tests or source maps ship');
  assert.equal(fs.existsSync(path.join(target, 'src')), false, 'no C++ sources ship');
  assert.equal(dist.NATIVE_UNPACK, '**/node_modules/node-pty/**');
  // The staged module alone runs a command on a PTY.
  const probe = path.join(stage, 'probe.js');
  fs.writeFileSync(probe, `const p = require(${JSON.stringify(target)}).spawn('/bin/echo', ['staged-ok'], { cols: 40, rows: 5, cwd: '/', env: { PATH: '/bin' } });
let out = ''; p.onData((d) => { out += d; }); p.onExit((e) => { process.stdout.write(JSON.stringify({ out, code: e.exitCode })); process.exit(0); });`);
  const r = spawnSync(process.execPath, [probe], { encoding: 'utf8', timeout: 20_000 });
  const answer = JSON.parse(r.stdout || 'null');
  assert.equal(answer?.code, 0, r.stderr);
  assert.match(answer.out, /staged-ok/);
});

test('LC-16: the release Info.plist asks Squirrel to refuse downgrades', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  assert.deepEqual(dist.UPDATE_INFO, { ElectronSquirrelPreventDowngrades: true });
});

test('LC-16: openpgp is staged as its one CommonJS build with manifest and licence, and loads from the stage', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  const root = path.resolve(__dirname, '..');
  const stage = tmp('fd-stage-gpg-');
  const target = dist.stageVerifierModules(root, stage);
  assert.equal(target, path.join(stage, 'node_modules/openpgp'));
  const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.relative(target, path.join(dir, e.name))]));
  assert.deepEqual(files(target).sort(), ['LICENSE', 'dist/node/openpgp.min.cjs', 'package.json']);
  const manifest = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
  assert.equal(manifest.main, 'dist/node/openpgp.min.cjs');
  const r = spawnSync(process.execPath, ['-e', `const o = require(${JSON.stringify(target)}); process.stdout.write(typeof o.verify)`], { encoding: 'utf8' });
  assert.equal(r.stdout, 'function');
});
