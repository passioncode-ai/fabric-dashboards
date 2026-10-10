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

test('FD-37 packages.yml: every system and architecture on its native runner, unsigned, no push trigger, collected by publish', () => {
  const wf = fs.readFileSync(path.join(root, '.github/workflows/packages.yml'), 'utf8');
  for (const row of ['{ runner: windows-latest, os: windows, arch: x64 }', '{ runner: windows-11-arm, os: windows, arch: arm64 }', '{ runner: ubuntu-24.04, os: linux, arch: x64 }', '{ runner: ubuntu-24.04-arm, os: linux, arch: arm64 }']) {
    assert.ok(wf.includes(row), `packages.yml builds ${row}`);
  }
  assert.match(wf, /on:\n {2}workflow_dispatch:\n {2}workflow_call:\n\n/, 'dispatch and call only (CI policy 2026-09-25)');
  assert.doesNotMatch(wf, /^\s+environment:|\$\{\{ secrets\./m, 'nothing here signs, so nothing reaches a secret');
  assert.ok(wf.includes('run: node scripts/dist-other.mjs'));
  // release-publish.yml collects `release-*`; the upload names match the script's artifacts and receipt.
  assert.ok(wf.includes('name: release-${{ matrix.os }}-${{ matrix.arch }}'));
  assert.ok(wf.includes('release/Fabric-Dashboards-${{ steps.version.outputs.version }}-${{ matrix.os }}-${{ matrix.arch }}'));
  assert.ok(wf.includes('if-no-files-found: error'));
  for (const m of wf.matchAll(/uses: ([^\s]+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, `${m[1]} is not pinned by commit`);
});
