// FD-37 M4a (platforms.md PL-04): the feed names every platform the release ships; a release missing one is refused.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PLATFORMS, platformOf, withPlatforms } from '../scripts/release-feed.mjs';
import { FEED_FILE, sha256, signedFeed } from '../src/core/release-verify';

const dir = path.join(__dirname, 'fixtures', 'release-0.7.3');
const feed = JSON.parse(fs.readFileSync(path.join(dir, 'update-feed.json'), 'utf8'));
const receipts = fs.readdirSync(dir).filter((n) => n.endsWith('.receipt.json')).map((n) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')));

test('FD-37 M4a PL-04: the published 0.7.3 receipts give a feed naming all five platforms, each with its file and hash', () => {
  const out = withPlatforms(feed, receipts);
  assert.deepEqual(Object.keys(out.platforms), PLATFORMS);
  assert.deepEqual(out.platforms['darwin-universal'], { update: 'Fabric-Dashboards-0.7.3-mac.zip', sha256: 'aeee02b1c5ada432eb472bf7f6ec371bfcdc072e6699786766f09d48732f42a2' });
  assert.equal(out.platforms['win32-arm64'].update, 'Fabric-Dashboards-0.7.3-windows-arm64-setup.exe');
  assert.equal(out.platforms['linux-x64'].update, 'Fabric-Dashboards-0.7.3-linux-x64.AppImage');
  assert.equal(out.platforms['linux-x64'].package, 'Fabric-Dashboards-0.7.3-linux-x64.deb');
  assert.deepEqual(out.releases, feed.releases, 'Squirrel\'s part of the feed is unchanged');
  assert.equal(out.currentRelease, '0.7.3');
});

test('FD-37 M4a PL-04: a release whose feed would lack a platform is refused, naming it', () => {
  for (const key of PLATFORMS) {
    const without = receipts.filter((r: Record<string, unknown>) => platformOf(r) !== key);
    assert.throws(() => withPlatforms(feed, without), new RegExp(`lack ${key}.*PL-04`), key);
  }
});

test('FD-37 M4a: receipts from another version or another commit, or a receipt without its file, are refused', () => {
  const linux = receipts.find((r: Record<string, unknown>) => platformOf(r) === 'linux-x64');
  const rest = receipts.filter((r: unknown) => r !== linux);
  assert.throws(() => withPlatforms(feed, [...rest, { ...linux, version: '0.7.2' }]), /built as 0\.7\.2/);
  assert.throws(() => withPlatforms(feed, [...rest, { ...linux, commit: 'deadbee' }]), /different commits/);
  assert.throws(() => withPlatforms(feed, [...rest, { ...linux, files: {} }]), /linux-x64 receipt names no update file/);
  assert.throws(() => withPlatforms(feed, [...receipts, linux]), /two receipts for linux-x64/);
  assert.throws(() => withPlatforms({}, receipts), /no currentRelease/);
});

test('FD-37 M4a: an installed macOS copy still accepts the feed with platforms (the same signedFeed check it runs today)', () => {
  const bytes = Buffer.from(`${JSON.stringify(withPlatforms(feed, receipts), null, 2)}\n`);
  const sums = new Map([[FEED_FILE, sha256(bytes)]]);
  assert.deepEqual(signedFeed(bytes, sums, '0.7.3'), { ok: true, needsPerson: null });
});
