import assert from 'node:assert/strict';
import test from 'node:test';

test('dist: arguments, identity choice and the update feed', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  assert.deepEqual(dist.parseArgs(['--notary-profile', 'fabric-notary']), { unsigned: false, notaryProfile: 'fabric-notary', identity: '', allowDirty: false });
  assert.throws(() => dist.parseArgs(['--unsigned', '--identity', 'x']), /cannot be combined/);
  assert.throws(() => dist.parseArgs(['--bogus']), /Unknown argument/);
  const out = '  1) ' + 'A'.repeat(40) + ' "Developer ID Application: Someone (TEAM)"\n  2) ' + 'B'.repeat(40) + ' "Apple Development: Someone (X)"\n';
  assert.equal(dist.pickIdentity(out).hash, 'A'.repeat(40));
  assert.throws(() => dist.pickIdentity(out, 'Developer ID Application: Other (Y)'), /not a valid/);
  const feed = dist.updateFeed('0.1.1', 'Fabric-Dashboards-0.1.1-mac.zip', 'Fixes.', '2026-09-28T00:00:00Z');
  assert.equal(feed.currentRelease, '0.1.1');
  assert.equal(feed.releases[0].updateTo.url, 'https://github.com/passioncode-ai/fabric-dashboards/releases/download/v0.1.1/Fabric-Dashboards-0.1.1-mac.zip');
});
