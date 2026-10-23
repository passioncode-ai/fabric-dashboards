// FD-93: the main process's read of an agent's load report (contract DEC-0104): the token goes only to the service's own
// document, a refused token, a bad answer and a report that fails FAC-SEM-132 are each an entry with its reason.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { readLoad } from '../src/core/load';
import { fetchLoad } from '../src/core/probe';
import type { Descriptor, WellKnown } from '../src/core/types';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const DESCRIPTOR = fixture('positive_service-descriptor.json') as Descriptor;
const KEY = 'https://fabric.passioncode.ai/agent-contract/extensions/load/0.1';
const wellKnown = (ext?: unknown, service = DESCRIPTOR) => ({ ...fixture('positive_service-well-known.json'), service: { ...fixture('positive_service-well-known.json').service, id: service.id, instance: service.instance }, ...(ext === undefined ? {} : { extensions: { [KEY]: ext } }) }) as WellKnown;
const DECL = fixture('positive_service-load-extension.json');

async function server(handler: http.RequestListener): Promise<{ origin: string; close: () => Promise<void> }> {
  const s = http.createServer(handler);
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, close: () => new Promise((r) => s.close(() => r())) };
}

test('FD-93: the report is read with the descriptor token from the declared path and summed', async () => {
  let seen = '';
  const srv = await server((req, res) => { seen = `${req.url} ${req.headers['x-example-token']}`; res.end(JSON.stringify(fixture('positive_service-load.json'))); });
  try {
    const d = { ...DESCRIPTOR, origin: srv.origin } as Descriptor;
    const e = await readLoad({ key: 'k', state: 'ready', descriptor: d, wellKnown: wellKnown(DECL) }, { token: () => 'tok-1', fetchLoad, now: () => Date.parse('2026-10-22T11:06:00Z') });
    assert.equal(e.kind, 'report');
    assert.equal(seen, '/fabric/v1/load tok-1', 'the descriptor\'s own header and scheme');
    if (e.kind === 'report') assert.equal(e.summary.contexts.length, 2);
  } finally { await srv.close(); }
});

test('FD-93: a refused token, a non-JSON answer and a report that fails FAC-SEM-132 are errors with their reason', async () => {
  const answers: [number, string][] = [[401, ''], [200, 'not json'], [200, JSON.stringify(fixture('semantic_service-load-gap.json').input)], [500, '']];
  const srv = await server((_req, res) => { const [status, body] = answers.shift()!; res.statusCode = status; res.end(body); });
  try {
    const d = { ...DESCRIPTOR, origin: srv.origin } as Descriptor;
    const read = () => readLoad({ key: 'k', state: 'ready', descriptor: d, wellKnown: wellKnown(DECL) }, { token: () => 'tok', fetchLoad, now: () => 0 });
    const codes: string[] = [];
    for (let i = 0; i < 4; i += 1) { const e = await read(); assert.equal(e.kind, 'error'); if (e.kind === 'error') codes.push(e.reason.code); }
    assert.deepEqual(codes, ['load.err.refused', 'load.err.notJson', 'load.err.malformed', 'load.err.http']);
  } finally { await srv.close(); }
});

test('FD-93: no token for a foreign answer or another service\'s document; a wrong declaration is reported, not read', async () => {
  const never = { token: () => { throw new Error('no token'); }, fetchLoad: async () => { throw new Error('no read'); }, now: () => 0 };
  assert.equal((await readLoad({ key: 'k', state: 'foreign', descriptor: DESCRIPTOR, wellKnown: wellKnown(DECL) }, never)).kind, 'none');
  assert.equal((await readLoad({ key: 'k', state: 'ready', descriptor: DESCRIPTOR, wellKnown: wellKnown(DECL, { ...DESCRIPTOR, id: 'someone-else' }) }, never)).kind, 'none');
  assert.equal((await readLoad({ key: 'k', state: 'ready', descriptor: DESCRIPTOR, wellKnown: wellKnown() }, never)).kind, 'none');
  const bad = await readLoad({ key: 'k', state: 'ready', descriptor: DESCRIPTOR, wellKnown: wellKnown({ path: 'load', windowSeconds: 5, limits: {} }) }, never);
  assert.equal(bad.kind, 'invalid');
});
