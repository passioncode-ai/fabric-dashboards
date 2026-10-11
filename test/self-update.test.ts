// FD-37 M4b (platforms.md PL-04): how each install updates itself, and the Linux AppImage's own file in a feed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { withPlatforms } from '../scripts/release-feed.mjs';
import { NSIS_UPDATE_ARGS, platformKey, platformUpdate, replaceAppImage, stagedAppImage, updateChannel, updateFileName } from '../src/core/self-update';
import { mayCheck } from '../src/core/version';
import { tmp } from './helpers';

const dir = path.join(__dirname, 'fixtures', 'release-0.7.3');
const feed = withPlatforms(JSON.parse(fs.readFileSync(path.join(dir, 'update-feed.json'), 'utf8')),
  fs.readdirSync(dir).filter((n) => n.endsWith('.receipt.json')).map((n) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))));

test('FD-37 M4 PL-04: the channel follows how the copy was installed', () => {
  assert.equal(updateChannel({ platform: 'darwin', packaged: true }), 'squirrel');
  const image = { appImage: '/home/me/Apps/Fabric-Dashboards-0.7.3-linux-x64.AppImage', appDir: '/tmp/.mount_FabricAbC', execPath: '/tmp/.mount_FabricAbC/fabric-dashboards', appImageIsFile: true };
  assert.equal(updateChannel({ platform: 'linux', packaged: true, ...image }), 'appimage');
  assert.equal(updateChannel({ platform: 'linux', packaged: true, ...image, execPath: '/opt/fabric-dashboards/fabric-dashboards' }), 'package', 'a .deb copy started from an AppImage\'s shell inherits APPIMAGE and must not overwrite it');
  assert.equal(updateChannel({ platform: 'linux', packaged: true, ...image, appDir: undefined }), 'package');
  assert.equal(updateChannel({ platform: 'linux', packaged: true, ...image, appImageIsFile: false }), 'package', 'a link or a missing file is not replaced');
  assert.equal(updateChannel({ platform: 'linux', packaged: true, ...image, execPath: '/tmp/.mount_FabricAbCx/fabric-dashboards' }), 'package', 'a sibling folder with the same prefix is not inside');
  assert.equal(updateChannel({ platform: 'linux', packaged: true }), 'package', 'a .deb copy (no APPIMAGE) never checks');
  assert.equal(updateChannel({ platform: 'linux', packaged: true, ...image, appImage: 'relative.AppImage' }), 'package', 'only an absolute AppImage path is replaced');
  assert.equal(updateChannel({ platform: 'linux', packaged: true, ...image, appImage: '/tmp/not-an-image' }), 'package');
  assert.equal(updateChannel({ platform: 'win32', packaged: true, nsisUninstaller: true }), 'nsis', 'M4c: an NSIS install updates itself');
  assert.equal(updateChannel({ platform: 'win32', packaged: true }), 'not-yet', 'a copy without the installer\'s uninstaller beside it does not');
  assert.equal(updateChannel({ platform: 'linux', packaged: false, appImage: '/x.AppImage' }), 'development');
  for (const state of ['package', 'notyet']) assert.equal(mayCheck({ manual: true, enabled: true, state }), false, `${state} never checks`);
});

test('FD-37 M4b: each Linux copy finds its own AppImage in the 0.7.3 feed, with the hash SHA256SUMS gives', () => {
  assert.equal(platformKey('linux', 'arm64'), 'linux-arm64');
  assert.equal(platformKey('darwin', 'arm64'), 'darwin-universal');
  const x64 = platformUpdate(feed, 'linux-x64', '0.7.3');
  assert.deepEqual(x64, { ok: true, file: 'Fabric-Dashboards-0.7.3-linux-x64.AppImage', sha256: '8fb393bdbf7f29b62ca2c3b2fb6b5cd476ee7c740a2dcb4597da42a494ad8915' });
  assert.equal(platformUpdate(feed, 'linux-arm64', '0.7.3').ok, true);
  assert.equal(updateFileName('win32-arm64', '0.7.3'), 'Fabric-Dashboards-0.7.3-windows-arm64-setup.exe');
});

test('FD-37 M4b: a feed without this platform, with another release\'s file, or without a hash is refused', () => {
  const { platforms, ...older } = feed as { platforms: Record<string, { update: string; sha256: string }> };
  assert.match(String((platformUpdate(older, 'linux-x64', '0.7.3') as { why: string }).why), /names no update for linux-x64/);
  const foreign = { ...feed, platforms: { ...platforms, 'linux-x64': { ...platforms['linux-x64'], update: 'Fabric-Dashboards-0.6.0-linux-x64.AppImage' } } };
  assert.match(String((platformUpdate(foreign, 'linux-x64', '0.7.3') as { why: string }).why), /not Fabric-Dashboards-0\.7\.3-linux-x64\.AppImage/);
  const nohash = { ...feed, platforms: { ...platforms, 'linux-x64': { update: 'Fabric-Dashboards-0.7.3-linux-x64.AppImage' } } };
  assert.match(String((platformUpdate(nohash, 'linux-x64', '0.7.3') as { why: string }).why), /no sha256/);
  assert.equal(platformUpdate(feed, 'linux-ia32', '0.7.3').ok, false);
});

test('FD-37 M4b: the new AppImage replaces this one in one step, executable; a failure leaves the old one and no .part', () => {
  const folder = tmp('fd-appimage-');
  const target = path.join(folder, 'Fabric Dashboards.AppImage');
  fs.writeFileSync(target, 'old', { mode: 0o755 });
  const staged = stagedAppImage(target, '0.7.4');
  assert.equal(path.dirname(staged), folder, 'beside the target: the rename stays on one file system');
  assert.match(path.basename(staged), /^\.Fabric Dashboards\.AppImage\.0\.7\.4\.part$/);
  fs.writeFileSync(staged, 'new', { mode: 0o600 });
  replaceAppImage(target, staged);
  assert.equal(fs.readFileSync(target, 'utf8'), 'new');
  if (process.platform !== 'win32') assert.equal(fs.statSync(target).mode & 0o777, 0o755, 'executable');
  assert.ok(!fs.existsSync(staged));
  assert.throws(() => replaceAppImage(target, path.join(folder, 'missing.part')));
  assert.equal(fs.readFileSync(target, 'utf8'), 'new', 'the old file stays when the replacement fails');
  assert.deepEqual(fs.readdirSync(folder).filter((n) => n.endsWith('.part')), []);
});

test('FD-37 M4c: a Windows copy finds its own installer in the 0.7.3 feed, and runs it as an update — silent, in place, the app started again', () => {
  assert.deepEqual(platformUpdate(feed, 'win32-x64', '0.7.3'), { ok: true, file: 'Fabric-Dashboards-0.7.3-windows-x64-setup.exe', sha256: '19322ee2ba495ec862ee6b425d944ee27a8331110562ff75b56fca3d5c57548f' });
  assert.equal(platformUpdate(feed, 'win32-arm64', '0.7.3').ok, true);
  assert.deepEqual([...NSIS_UPDATE_ARGS], ['--updated', '/S', '--force-run'], 'electron-builder\'s update flags; never an uninstall');
});
