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
  assert.deepEqual(calls.at(-1), ['/usr/bin/env', '-u', 'ELECTRON_RUN_AS_NODE', '/usr/bin/open', '-a', app.path, deep]);
  assert.ok(calls.every((c) => !c.includes('-n')), 'never request a second application instance');
});

test('MCP desktop dispatch removes RunAsNode in the child and preserves the server environment', { skip: process.platform !== 'darwin' && 'macOS dispatch through /usr/bin/open; Windows and Linux open links in FD-37 M3' }, async () => {
  const { execRunner } = await import('../src/core/launchd');
  const previous = process.env.ELECTRON_RUN_AS_NODE;
  process.env.ELECTRON_RUN_AS_NODE = '1';
  let observed = '';
  const probe = ['-e', 'process.stdout.write(JSON.stringify(process.env.ELECTRON_RUN_AS_NODE ?? null))'];
  try {
    const deps = liveDeps(async (command, args) => {
      // Replace only the GUI command with an inert child. Keep the real environment
      // boundary, so the pre-fix direct open path observably inherits RunAsNode.
      const at = args.indexOf('/usr/bin/open');
      const result = command === '/usr/bin/open'
        ? await execRunner(process.execPath, probe)
        : await execRunner(command, [...args.slice(0, at), process.execPath, ...probe]);
      observed = result.stdout;
      return result;
    });
    assert.equal(await deps.open('fabric-dashboards://service/example-agent.default', app.path), 0);
    assert.equal(JSON.parse(observed), null, 'the GUI must not inherit the MCP launcher RunAsNode flag');
    assert.equal(process.env.ELECTRON_RUN_AS_NODE, '1', 'do not mutate the live MCP process environment');
  } finally {
    if (previous === undefined) delete process.env.ELECTRON_RUN_AS_NODE;
    else process.env.ELECTRON_RUN_AS_NODE = previous;
  }
});
