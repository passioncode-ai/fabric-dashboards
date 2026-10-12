// DEC-0070: a feed event may carry `data`; the app keeps only the members it shows.
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import type { Descriptor } from '@passioncode-ai/fabric-service-host';
import { fetchEvents } from '../src/core/probe';

test('DEC-0070: events with data are read; every member the protocol names is kept (notify drives notifications), data is not', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ events: [
      { id: 'e1', at: '2026-10-12T20:00:00Z', kind: 'build.done', level: 'info', text: 'Built', link: '/runs/1', notify: true, subject: { type: 'run', id: 'r1' }, data: { blob: 'x'.repeat(10_000) } },
      { id: 'e2', at: '2026-10-12T20:01:00Z', kind: 'run.slow', level: 'warning', text: 'Slow', data: [1, 2, 3] },
    ], cursor: 'c2' }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  try {
    const d = { origin: `http://127.0.0.1:${port}`, auth: { tokenFile: '~/t' } } as unknown as Descriptor;
    const page = await fetchEvents(d, '/fabric/v1/events', 'tok-0123456789abcdef', null);
    assert.deepEqual(page.events, [
      { id: 'e1', at: '2026-10-12T20:00:00Z', kind: 'build.done', level: 'info', text: 'Built', subject: { type: 'run', id: 'r1' }, link: '/runs/1', notify: true },
      { id: 'e2', at: '2026-10-12T20:01:00Z', kind: 'run.slow', level: 'warning', text: 'Slow' },
    ]);
    assert.equal(page.cursor, 'c2');
  } finally {
    server.close();
  }
});
