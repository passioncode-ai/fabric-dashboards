// FD-270: the local lifecycle broker's launchd targets, read from its registry by label.
import assert from 'node:assert/strict';
import test from 'node:test';
import { BrokerTargetReader, brokerLaunchdTargets } from '../src/core/broker-targets';

const REGISTRY = JSON.stringify({
  schemaVersion: 1,
  targets: {
    'dashboards.desktop': { kind: 'app', identity: { bundleId: 'ai.example.app' } },
    'sample.service': { kind: 'launchd', targetId: 'sample.service', identity: { label: 'ai.example.sample' } },
    'no-label': { kind: 'launchd', identity: {} },
    broken: null,
  },
});

test('FD-270: only launchd targets with a label are the broker\'s; apps and malformed entries are left out', () => {
  assert.deepEqual([...brokerLaunchdTargets(REGISTRY)], [['ai.example.sample', 'sample.service']]);
  assert.deepEqual([...brokerLaunchdTargets(JSON.stringify({ targets: [{ kind: 'launchd', targetId: 'a.b', identity: { label: 'ai.a' } }] }))], [['ai.a', 'a.b']]);
  assert.equal(brokerLaunchdTargets('{}').size, 0);
  assert.throws(() => brokerLaunchdTargets('not json'));
});

test('FD-270: the reader reads again only when the file changed; absent or unreadable holds nothing, macOS only', () => {
  let reads = 0;
  let stamp = { mtimeMs: 1, size: REGISTRY.length };
  let text = REGISTRY;
  const r = new BrokerTargetReader({ platform: 'darwin', everyMs: 0, stat: () => stamp, read: () => { reads += 1; return text; } });
  assert.equal(r.targetOf('ai.example.sample', 0), 'sample.service');
  assert.equal(r.targetOf('ai.example.other', 1), null);
  assert.equal(reads, 1, 'unchanged: not read again');
  stamp = { mtimeMs: 2, size: 5 };
  text = 'oops!';
  assert.equal(r.targetOf('ai.example.sample', 2), null);
  assert.ok(r.error);
  const gone = new BrokerTargetReader({ platform: 'darwin', stat: () => { throw new Error('ENOENT'); } });
  assert.equal(gone.targetOf('ai.example.sample', 0), null);
  assert.equal(gone.error, null);
  const linux = new BrokerTargetReader({ platform: 'linux', stat: () => stamp, read: () => REGISTRY });
  assert.equal(linux.targetOf('ai.example.sample', 0), null);
});
