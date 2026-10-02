// DEC-0019 — online services in the app's own code: links, the MCP tools and the test hooks.
// The real-TLS path is test/e2e/remote.test.ts; the package's probe is packages/service-host/test/remote.test.ts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fromServiceUrl } from '../src/core/deeplink';
import { Launchd } from '../src/core/launchd';
import { setTestRemote, testRemote, tlsFor, parseTestRemote } from '../src/core/testhooks';
import type { WellKnown, WellKnownResult } from '../src/core/types';
import * as tools from '../src/mcp/tools';
import { tmp } from './helpers';

const REMOTE = {
  protocol: 'fabric-service/0.1', id: 'example-agent', instance: 'default', name: 'Example Agent', placement: 'remote' as const,
  origin: 'https://agent.example.com', auth: { tokenFile: '/tmp/never-read.token' }, lifecycle: { manager: 'none' as const },
  installedAt: '2026-10-02T18:00:00Z', installedBy: 'test',
};
const WELL_KNOWN: WellKnown = {
  protocol: 'fabric-service/0.1', service: { id: 'example-agent', instance: 'default', name: 'Example Agent', version: '0.1.0', build: { commit: '0000000' } },
  process: { pid: 1, startedAt: '2026-10-02T18:00:00Z' }, status: 'ready', degraded: [], surfaces: { dashboard: { path: '/', login: true }, events: { path: '/fabric/v1/events' } },
};
const SECRET = 'remote-token-never-returned-1';

function setup() {
  const dir = tmp('fd-remote-');
  fs.writeFileSync(path.join(dir, 'example-agent.default.json'), JSON.stringify(REMOTE));
  const seen: { origin: string; headers?: Record<string, string> }[] = [];
  const deps = {
    servicesDir: () => dir,
    wellKnown: async (origin: string, options?: { headers?: Record<string, string> }): Promise<WellKnownResult> => {
      seen.push({ origin, headers: options?.headers });
      return options?.headers?.Authorization === `Bearer ${SECRET}` ? { kind: 'answer', doc: WELL_KNOWN, ms: 40 } : { kind: 'refused', detail: 'HTTP 401' };
    },
    launchd: new Launchd(async () => ({ code: 0, stdout: '', stderr: '' }), 501),
    open: async () => 0,
    host: async () => ({ state: 'available', observed_at: '2026-10-02T00:00:00Z', application: null }),
    run: async () => ({ code: 0, output: '', timedOut: false }),
    events: async (_d: unknown, _p: string, token: string) => { assert.equal(token, SECRET); return { events: [], cursor: null }; },
    token: () => SECRET,
    now: () => 1_000_000,
    sleep: async () => undefined,
    platform: 'darwin' as NodeJS.Platform,
  } as unknown as tools.Deps;
  return { deps, seen };
}

test('open?url= takes exactly a registered online origin and refuses any other https URL', () => {
  const known = [{ key: 'example-agent.default', descriptor: REMOTE }] as never;
  const ok = fromServiceUrl('https://agent.example.com/jobs/1', known);
  assert.deepEqual(ok, { ok: true, target: { page: 'service', key: 'example-agent.default', link: '/jobs/1' } });
  assert.match(String((fromServiceUrl('https://evil.example.com/', known) as { reason: string }).reason), /none is at https:\/\/evil\.example\.com$/);
  assert.equal(fromServiceUrl('https://u:p@agent.example.com/', known).ok, false);
  assert.equal(fromServiceUrl('https://agent.example.com:8443/', known).ok, false, 'another port is another origin');
});

test('MCP: list_services marks the placement and probes an online service with its token', async (t) => {
  const { deps, seen } = setup();
  const list = await tools.listServices(deps);
  const svc = list.services.find((s: { key: string }) => s.key === 'example-agent.default')!;
  assert.equal(svc.placement, 'remote');
  assert.equal(svc.state, 'ready');
  assert.equal(seen[0]!.headers?.Authorization, `Bearer ${SECRET}`, 'the token goes to the online origin only as a header');
  assert.ok(!JSON.stringify(list).includes(SECRET), 'no tool result carries the token');
  t.diagnostic(`state ${svc.state}`);
});

test('MCP: an online service refuses start/stop/restart; activity reads it with the token', async () => {
  const { deps } = setup();
  await assert.rejects(tools.control(deps, 'example-agent.default', 'restart'), /supervised by its platform/);
  const act = await tools.activity(deps, 'example-agent.default', 5);
  assert.deepEqual(act.events, []);
});

test('the test hook reaches only its own name and is empty until main.ts sets it', () => {
  setTestRemote(null);
  assert.deepEqual(tlsFor('https://agent.example.com'), {});
  const dir = tmp('fd-hook-');
  fs.writeFileSync(path.join(dir, 'ca.pem'), '-----BEGIN CERTIFICATE-----\nAA\n-----END CERTIFICATE-----\n');
  setTestRemote(parseTestRemote(JSON.stringify({ name: 'agent.example.com', connect: '127.0.0.1:47123', caFile: path.join(dir, 'ca.pem') })));
  assert.equal(testRemote()!.connectPort, 47123);
  assert.deepEqual(Object.keys(tlsFor('https://agent.example.com:47123')).sort(), ['ca', 'connect']);
  assert.deepEqual(tlsFor('https://other.example.com'), {}, 'any other name keeps the system trust');
  assert.throws(() => parseTestRemote('{"name":"x"}'), /needs name, connect/);
  setTestRemote(null);
});
