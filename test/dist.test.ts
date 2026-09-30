import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { tmp } from './helpers';

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
