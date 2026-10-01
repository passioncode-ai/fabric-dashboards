import assert from 'node:assert/strict';
import test from 'node:test';
import { BUNDLE_ID, discoverHost } from '../src/mcp/host';
import { liveDeps } from '../src/mcp/tools';

const app = { id: BUNDLE_ID, version: '0.3.1', path: '/Applications/Fabric Dashboards.app' };
const result = (data: unknown, code = 0) => async () => ({ code, stdout: JSON.stringify(data), stderr: '' });

test('host discovery distinguishes absence, lookup failure, version and handler', async () => {
  assert.equal((await discoverHost(result({ application: app, handler: app }), 'darwin')).state, 'available');
  assert.equal((await discoverHost(result({ application: null, handler: null }), 'darwin')).state, 'not_installed');
  for (const data of [{}, null, { application: null }, { application: null, handler: app }, { application: { ...app, id: 'other' }, handler: app }]) {
    assert.equal((await discoverHost(result(data), 'darwin')).state, 'unknown');
  }
  assert.equal((await discoverHost(result({}, 1), 'darwin')).state, 'unknown');
  assert.equal((await discoverHost(async () => { throw new Error('lookup timeout'); }, 'darwin')).state, 'unknown');
  assert.equal((await discoverHost(async () => ({ code: 0, stdout: 'not json', stderr: '' }), 'darwin')).state, 'unknown');
  for (const version of ['0.2.0', 'not-known', '0.3.0-beta.1']) {
    assert.equal((await discoverHost(result({ application: { ...app, version }, handler: app }), 'darwin')).state, 'incompatible');
  }
  for (const handler of [null, { ...app, id: 'other' }, { ...app, path: '/Other.app' }]) {
    assert.equal((await discoverHost(result({ application: app, handler }), 'darwin')).state, 'handler_mismatch');
  }
  assert.equal((await discoverHost(async () => { throw new Error('must not run'); }, 'linux')).state, 'unsupported');
});

test('live host adapter reads OS metadata without opening and pins opening to the checked app path', async () => {
  const calls: string[][] = [];
  const deps = liveDeps(async (cmd, args) => {
    calls.push([cmd, ...args]);
    return { code: 0, stdout: JSON.stringify({ application: app, handler: app }), stderr: '' };
  });
  await deps.host();
  if (process.platform === 'darwin') assert.equal(calls[0]![0], '/usr/bin/osascript');
  const deep = 'fabric-dashboards://service/example-agent.default';
  await deps.open(deep, app.path);
  assert.deepEqual(calls.at(-1), ['/usr/bin/open', '-a', app.path, deep]);
  assert.ok(calls.every((c) => !c.includes('-n')), 'never request a second application instance');
});
