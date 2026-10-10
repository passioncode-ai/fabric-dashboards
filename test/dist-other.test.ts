// FD-37 / ADR-0019 / platforms.md PL-02, PL-08: the Windows and Linux build's pure parts. The build itself
// runs only on each system's native runner (release.yml); these hold what it decides from its inputs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { tmp } from './helpers';

const root = path.resolve(__dirname, '..');

test('FD-37 dist-other: each system and architecture names its executable, launcher and artifacts', async () => {
  const d = await import('../scripts/dist-other.mjs');
  const win = d.target('win32', 'arm64', '1.2.3');
  assert.equal(win.executable, 'Fabric Dashboards.exe');
  assert.equal(win.launcher, 'fabric-dashboards-mcp.cmd');
  assert.ok(win.icon.endsWith(path.join('build', 'icon.ico')));
  assert.deepEqual(win.artifacts, ['Fabric-Dashboards-1.2.3-windows-arm64-setup.exe']);
  assert.equal(win.receipt, 'Fabric-Dashboards-1.2.3-windows-arm64.receipt.json');
  const linux = d.target('linux', 'x64', '1.2.3');
  assert.equal(linux.executable, 'fabric-dashboards', 'a Linux executable name has no space');
  assert.equal(linux.launcher, 'fabric-dashboards-mcp');
  assert.deepEqual(linux.artifacts, ['Fabric-Dashboards-1.2.3-linux-x64.AppImage', 'Fabric-Dashboards-1.2.3-linux-x64.deb']);
  assert.equal(linux.receipt, 'Fabric-Dashboards-1.2.3-linux-x64.receipt.json');
  assert.throws(() => d.target('darwin', 'arm64', '1.2.3'), /not darwin/, 'macOS is dist-mac.mjs');
  assert.throws(() => d.target('linux', 'ia32', '1.2.3'), /not ia32/);
  for (const t of [win, linux]) {
    assert.ok(fs.existsSync(path.join(t.launcherDir, t.launcher)), `${t.launcher} is in the repository`);
  }
});

test('FD-37 dist-other: ASAR integrity is on where Electron validates it, off on Linux; every other fuse as on macOS', async () => {
  const d = await import('../scripts/dist-other.mjs');
  const { WANTED_FUSES } = await import('../scripts/fuses.mjs');
  assert.deepEqual(d.wantedFuses('win32'), WANTED_FUSES);
  const linux = d.wantedFuses('linux');
  assert.equal(linux.EnableEmbeddedAsarIntegrityValidation, false);
  assert.deepEqual({ ...linux, EnableEmbeddedAsarIntegrityValidation: WANTED_FUSES.EnableEmbeddedAsarIntegrityValidation }, WANTED_FUSES);
  assert.equal(linux.RunAsNode, true, 'the MCP server runs inside the binary as Node');
  assert.notEqual(d.wantedFuses('win32'), WANTED_FUSES, 'a copy: the shared table is never changed');
});

test('FD-37 dist-other: Windows carries node-pty\'s prebuilt conpty set without debug symbols', async () => {
  const d = await import('../scripts/dist-other.mjs');
  const from = path.join(root, 'node_modules/node-pty');
  for (const arch of ['x64', 'arm64']) {
    const files = d.nativeFiles(from, 'win32', arch);
    assert.ok(files.includes(path.join('prebuilds', `win32-${arch}`, 'pty.node')), arch);
    assert.ok(files.every((f: string) => f.startsWith(path.join('prebuilds', `win32-${arch}`))), 'only this architecture');
    assert.ok(!files.some((f: string) => f.endsWith('.pdb')), 'no debug symbols');
  }
});

test('FD-37 dist-other: Linux carries the node-pty built for this machine, and says how to get it when missing', async () => {
  const d = await import('../scripts/dist-other.mjs');
  const from = tmp('fd-pty-');
  assert.throws(() => d.nativeFiles(from, 'linux', 'x64'), /node-gyp/);
  fs.mkdirSync(path.join(from, 'build/Release'), { recursive: true });
  fs.writeFileSync(path.join(from, 'build/Release/pty.node'), '');
  assert.deepEqual(d.nativeFiles(from, 'linux', 'arm64'), [path.join('build', 'Release', 'pty.node')]);
});

test('FD-37 dist-other: node-pty is staged with its runtime files only', async () => {
  const d = await import('../scripts/dist-other.mjs');
  const stage = tmp('fd-stage-');
  const out = d.stageNativeModulesFor(root, stage, 'win32', 'x64');
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest).sort(), ['license', 'main', 'name', 'types', 'version'], 'no scripts: nothing runs on install');
  assert.ok(fs.existsSync(path.join(out, 'LICENSE')));
  assert.ok(fs.existsSync(path.join(out, manifest.main)), 'its entry point');
  assert.ok(fs.existsSync(path.join(out, 'prebuilds/win32-x64/pty.node')));
  assert.equal(fs.existsSync(path.join(out, 'prebuilds/win32-arm64')), false, 'not the other architecture');
  assert.equal(fs.existsSync(path.join(out, 'prebuilds/darwin-arm64')), false, 'not the other system');
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [e.name]));
  assert.ok(!walk(path.join(out, 'lib')).some((f) => /\.test\.js|\.map$/.test(f)), 'no tests, no source maps');
});

test('FD-37 dist-other: the Windows installer is per-user, one click, keeps the data and is not signed by the builder', async () => {
  const d = await import('../scripts/dist-other.mjs');
  const t = d.target('win32', 'x64', '1.2.3');
  const c = d.builderConfig(t, '1.2.3', '/out');
  assert.equal(c.appId, 'ai.passioncode.fabric-dashboards');
  assert.equal(c.publish, null, 'electron-builder publishes nothing; release.yml does');
  assert.equal(c.npmRebuild, false, 'the packaged directory is already built');
  assert.deepEqual(c.protocols, [{ name: 'Fabric Dashboards', schemes: ['fabric-dashboards'] }]);
  assert.deepEqual(c.win.target, [{ target: 'nsis', arch: ['x64'] }]);
  assert.equal(c.win.signAndEditExecutable, false, 'the fused, checked executable is not rewritten');
  assert.equal(c.nsis.perMachine, false);
  assert.equal(c.nsis.oneClick, true);
  assert.equal(c.nsis.deleteAppDataOnUninstall, false, 'Settings → Uninstall decides about the data (ADR-0015)');
  assert.equal(c.nsis.artifactName, t.artifacts[0]);
  assert.equal(c.linux, undefined);
});

test('FD-37 dist-other: Linux makes an AppImage and a .deb that open fabric-dashboards:// links', async () => {
  const d = await import('../scripts/dist-other.mjs');
  const t = d.target('linux', 'arm64', '1.2.3');
  const c = d.builderConfig(t, '1.2.3', '/out');
  assert.deepEqual(c.linux.target, [{ target: 'AppImage', arch: ['arm64'] }, { target: 'deb', arch: ['arm64'] }]);
  assert.equal(c.linux.executableName, 'fabric-dashboards');
  assert.equal(c.linux.desktop.entry.MimeType, 'x-scheme-handler/fabric-dashboards;');
  assert.equal(c.appImage.artifactName, t.artifacts[0]);
  assert.equal(c.deb.artifactName, t.artifacts[1]);
  assert.equal(c.deb.packageName, 'fabric-dashboards', 'the name `sudo apt remove` uses (uninstallTarget)');
  assert.equal(c.productName, 'fabric-dashboards', '/opt/fabric-dashboards: Chromium\'s zygote cannot start from a path with a space');
  assert.equal(c.linux.desktop.entry.Name, 'Fabric Dashboards', 'people still see the product name');
  // Ubuntu 24.04: ordinary users may not create user namespaces, so the sandbox helper must be setuid root.
  const after = fs.readFileSync(c.deb.afterInstall, 'utf8');
  assert.ok(after.includes("APP_DIR='/opt/fabric-dashboards'"), 'the folder the .deb installs');
  assert.match(after, /chown root:root "\$APP_DIR\/chrome-sandbox"\n\s+chmod 4755 "\$APP_DIR\/chrome-sandbox"/, 'always, not only where root cannot unshare');
  assert.ok(after.includes('ln -sf "$APP_DIR/fabric-dashboards" /usr/bin/fabric-dashboards'));
  assert.ok(fs.readFileSync(c.deb.afterRemove, 'utf8').includes('rm -f /usr/bin/fabric-dashboards'));
  assert.ok(c.deb.depends.includes('libasound2t64 | libasound2'), 'ALSA, which a clean Ubuntu lacked');
  for (const lib of ['libgtk-3-0', 'libnss3', 'libgbm1']) assert.ok(c.deb.depends.includes(lib), lib);
  assert.equal(c.extraMetadata.version, '1.2.3');
  assert.equal(c.win, undefined);
});

test('FD-37 dist-other: the uninstall target names the package the .deb installs', async () => {
  const { uninstallTarget } = await import('../src/core/platform');
  const d = await import('../scripts/dist-other.mjs');
  const c = d.builderConfig(d.target('linux', 'x64', '1.2.3'), '1.2.3', '/out');
  const t = uninstallTarget('linux', '/opt/Fabric Dashboards/fabric-dashboards', {}, () => true);
  assert.equal(t.kind, 'package');
  assert.match(JSON.stringify(t), new RegExp(c.deb.packageName));
});

test('FD-37 packages.yml: every system and architecture on its native runner, signed only for a release, no push trigger, collected by publish', () => {
  const wf = fs.readFileSync(path.join(root, '.github/workflows/packages.yml'), 'utf8');
  const rows = (os: string) => [...wf.matchAll(/'(\[\{"runner"[^']*\])'/g)].map((m) => JSON.parse(m[1]!)).find((list: { os: string }[]) => list.every((r) => r.os === os) || os === 'all' && list.length === 4);
  assert.deepEqual(rows('all'), [
    { runner: 'windows-latest', os: 'windows', arch: 'x64' }, { runner: 'windows-11-arm', os: 'windows', arch: 'arm64' },
    { runner: 'ubuntu-24.04', os: 'linux', arch: 'x64' }, { runner: 'ubuntu-24.04-arm', os: 'linux', arch: 'arm64' },
  ], 'every system and architecture on its native runner');
  assert.deepEqual(rows('windows').map((r: { arch: string }) => r.arch), ['x64', 'arm64']);
  assert.deepEqual(rows('linux').map((r: { arch: string }) => r.arch), ['x64', 'arm64']);
  assert.match(wf, /\non:\n {2}workflow_dispatch:\n {2}workflow_call:\n {4}inputs:\n {6}sign:\n[^]*?\n\npermissions:/, 'dispatch and call only (CI policy 2026-09-25)');
  assert.doesNotMatch(wf, /\n {2}(push|pull_request|schedule):/);
  assert.doesNotMatch(wf, /\$\{\{ secrets\./, 'Windows signs over OIDC: no secret reaches this workflow');
  // PL-03: only a signing Windows job enters the release environment, and only release.yml asks for it.
  assert.ok(wf.includes("environment: ${{ inputs.sign && matrix.os == 'windows' && 'release' || '' }}"));
  assert.ok(wf.includes("FD_WINDOWS_SIGNING: ${{ inputs.sign && matrix.os == 'windows' && vars.AZURE_SIGNING_ENABLED == 'true' }}"));
  const order = ['--stage app', 'Sign the app\'s executable', '--stage installer', 'Sign the installer', '--stage seal', 'nsis-smoke.mjs', 'upload-artifact'].map((n) => wf.indexOf(n));
  assert.ok(order.every((i) => i > 0), 'every stage and signing step is there');
  assert.deepEqual([...order].sort((x, y) => x - y), order, 'sign between the stages, check the installer after sealing');
  assert.equal(wf.split("if: env.FD_WINDOWS_SIGNING == 'true'").length - 1, 2, 'both signing passes only when signing is on');
  assert.equal(wf.split('uses: passioncode-ai/.github/actions/windows-signing@v1').length - 1, 2, 'the organization\'s action signs and verifies (PL-03)');
  assert.doesNotMatch(wf, /artifact-signing-action|azure\/login/, 'no copied signing steps (PL-10)');
  assert.equal(wf.split('expected-subject: O=Siarhei Sheleh').length - 1, 2, 'both passes pin the organization\'s signer');
  assert.ok(wf.includes("FD_WINDOWS_RELEASE: ${{ inputs.sign && matrix.os == 'windows' }}"));
  const release = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  assert.ok(release.includes('uses: ./.github/workflows/packages.yml\n    with:\n      sign: true\n      os: windows'), 'the release signs its windows stage');
  assert.ok(release.includes('uses: ./.github/workflows/packages.yml\n    with:\n      os: linux'), 'the linux stage never asks to sign');
  const validate = fs.readFileSync(path.join(root, '.github/workflows/validate.yml'), 'utf8');
  assert.ok(!validate.includes('sign: true'), 'a rehearsal never signs');
  assert.ok(wf.includes('run: node scripts/dist-other.mjs'));
  // release-publish.yml collects `release-*`; the upload names match the script's artifacts and receipt.
  assert.ok(wf.includes('name: release-${{ matrix.os }}-${{ matrix.arch }}'));
  assert.ok(wf.includes('release/Fabric-Dashboards-${{ steps.version.outputs.version }}-${{ matrix.os }}-${{ matrix.arch }}'));
  assert.ok(wf.includes('if-no-files-found: error'));
  // Each Linux .deb is installed on a clean Ubuntu and asked `initialize` (scripts/deb-smoke.sh).
  assert.ok(wf.includes('docker run --rm --cap-add SYS_ADMIN --security-opt seccomp=unconfined --security-opt apparmor=unconfined -v "$PWD:/w:ro" ubuntu:24.04 bash /w/scripts/deb-smoke.sh "/w/$deb"'), 'a clean Ubuntu, with what Chromium\'s sandbox needs');
  // The Windows installer is installed, asked `initialize` and removed with the uninstaller the app runs.
  assert.ok(wf.includes('run: node scripts/nsis-smoke.mjs release/Fabric-Dashboards-*-windows-${{ matrix.arch }}-setup.exe'));
  const nsis = fs.readFileSync(path.join(root, 'scripts/nsis-smoke.mjs'), 'utf8');
  assert.ok(nsis.includes("'Uninstall Fabric Dashboards.exe'"), 'the name uninstallTarget looks for');
  assert.ok(wf.includes('!release/*.blockmap'), 'electron-updater\'s blockmap is not ours to publish');
  const smoke = fs.readFileSync(path.join(root, 'scripts/deb-smoke.sh'), 'utf8');
  for (const step of ['apt-get install -y -qq "$deb" xvfb xauth', 'app=/opt/fabric-dashboards', "grep 'not found'", 'useradd -m smoke', 'initialize', 'xvfb-run -a /usr/bin/fabric-dashboards', 'started $version', 'apt-get remove -y -qq fabric-dashboards']) assert.ok(smoke.includes(step), step);
  // Third-party actions by commit; the organization's own at @v1, as release.yml uses them (PL-10).
  for (const m of wf.matchAll(/uses: ([^\s]+)/g)) {
    if (m[1]!.startsWith('passioncode-ai/.github/')) assert.match(m[1]!, /@v1$/);
    else assert.match(m[1]!, /@[0-9a-f]{40}$/, `${m[1]} is not pinned by commit`);
  }
});

test('FD-37 PL-03: the Windows build runs in stages so the workflow can sign between them', async () => {
  const d = await import('../scripts/dist-other.mjs');
  assert.deepEqual(d.parseArgs([]), { stage: '', allowDirty: false }, 'no --stage runs all three');
  assert.deepEqual(d.parseArgs(['--stage', 'installer', '--allow-dirty']), { stage: 'installer', allowDirty: true });
  assert.throws(() => d.parseArgs(['--stage', 'sign']), /app, installer or seal/);
  assert.throws(() => d.parseArgs(['--unsigned']), /Unknown argument/);
  const sp = d.stagePaths('/r', d.target('win32', 'arm64', '1.2.3'));
  assert.equal(sp.app, path.join('/r', 'release', 'stage-windows-arm64', 'app'), 'release.yml signs the executable here');
  assert.equal(sp.build, path.join('/r', 'release', 'stage-windows-arm64', 'build.json'));
  assert.equal(d.signingExpected({ FD_WINDOWS_SIGNING: 'true' }), true);
  for (const v of [undefined, 'false', '1', 'TRUE']) assert.equal(d.signingExpected({ FD_WINDOWS_SIGNING: v }), false, `FD_WINDOWS_SIGNING=${v}`);
});

test('FD-37 PL-03: an unsigned Windows release says so in its CHANGELOG section, and only that section counts', async () => {
  const d = await import('../scripts/dist-other.mjs');
  const note = `${d.UNSIGNED_NOTE}; SmartScreen warns once. Verify them with SHA256SUMS.`;
  assert.equal(d.saysUnsigned(`# Changelog\n\n## 1.2.3 - 2026-10-11\n\n- ${note}\n\n## 1.2.2 - 2026-10-01\n`, '1.2.3'), true);
  assert.equal(d.saysUnsigned(`## 1.2.3 - 2026-10-11\n\n- Fixes.\n\n## 1.2.2 - 2026-10-01\n\n- ${note}\n`, '1.2.3'), false, 'an older release\'s line is not this one\'s');
  assert.equal(d.saysUnsigned(`## 1.2.30\n\n- ${note}\n`, '1.2.3'), false, 'another version');
  assert.equal(d.saysUnsigned('## Unreleased\n', '1.2.3'), false);
});

test('FD-37: every release job that calls a workflow grants what that workflow\'s jobs ask for, or the run never starts', () => {
  // A called workflow may not exceed its caller's permissions; GitHub refuses the whole run at startup
  // (v0.6.7-rc.1, run 38073408992: startup_failure) — even for a nested job that would be skipped.
  const read = (f: string) => fs.readFileSync(path.join(root, '.github/workflows', f), 'utf8');
  const asksIdToken = (f: string): boolean => /id-token: write/.test(read(f)) || [...read(f).matchAll(/uses: \.\/\.github\/workflows\/([\w.-]+)/g)].some((m) => asksIdToken(m[1]!));
  const release = read('release.yml');
  const jobs = release.slice(release.indexOf('\njobs:\n')).split(/\n(?= {2}[a-z-]+:\n)/).slice(1).map((chunk) => ({ name: /^ {2}([a-z-]+):/.exec(chunk)![1]!, body: chunk }));
  const callers = jobs.filter((j) => /uses: \.\/\.github\/workflows\//.test(j.body));
  assert.deepEqual(callers.map((j) => j.name).sort(), ['check', 'linux', 'windows']);
  for (const j of callers) {
    const called = /uses: \.\/\.github\/workflows\/([\w.-]+)/.exec(j.body)![1]!;
    if (asksIdToken(called)) assert.match(j.body, /id-token: write/, `${j.name} calls ${called}, whose jobs ask for id-token: write`);
  }
});
