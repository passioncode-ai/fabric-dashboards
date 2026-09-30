import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fromServiceUrl, linkFor, parseDeepLink, safePath, type Known } from '../src/core/deeplink';
import type { Descriptor } from '../src/core/types';

const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract/positive_service-descriptor.json'), 'utf8')) as Descriptor;
const known: Known = [
  { key: 'example-agent.default', descriptor: { ...base, id: 'example-agent', instance: 'default', origin: 'http://127.0.0.1:47195' } },
  { key: 'example-agent.preview', descriptor: { ...base, id: 'example-agent', instance: 'preview', origin: 'http://127.0.0.1:47196' } },
  { key: 'broken.default', descriptor: null },
];

test('open by service and path lands on that page of that service', () => {
  assert.deepEqual(parseDeepLink('fabric-dashboards://open?service=example-agent.default&path=/dashboard/job_1', known), {
    ok: true, target: { page: 'service', key: 'example-agent.default', link: '/dashboard/job_1' },
  });
  assert.deepEqual(parseDeepLink('fabric-dashboards://open?service=example-agent.preview', known), {
    ok: true, target: { page: 'service', key: 'example-agent.preview' },
  });
});

test('open by a service URL finds the service by its origin and keeps path, query and fragment', () => {
  const raw = `fabric-dashboards://open?url=${encodeURIComponent('http://127.0.0.1:47196/dashboard/job_2?tab=log#end')}`;
  assert.deepEqual(parseDeepLink(raw, known), {
    ok: true, target: { page: 'service', key: 'example-agent.preview', link: '/dashboard/job_2?tab=log#end' },
  });
  assert.deepEqual(fromServiceUrl('http://localhost:47195/', known), { ok: true, target: { page: 'service', key: 'example-agent.default', link: undefined } });
});

test('overview and activity need no service', () => {
  assert.deepEqual(parseDeepLink('fabric-dashboards://', known), { ok: true, target: { page: 'overview' } });
  assert.deepEqual(parseDeepLink('fabric-dashboards://activity', known), { ok: true, target: { page: 'activity' } });
});

test('a link can name only an installed service and only a path on its own origin', () => {
  const refused: Record<string, RegExp> = {
    'https://example.com/': /not a fabric-dashboards/,
    'fabric-dashboards://delete?service=example-agent.default': /unknown link verb/,
    'fabric-dashboards://open': /service= or url=/,
    'fabric-dashboards://open?service=nobody.default': /no installed service/,
    'fabric-dashboards://open?service=broken.default': /no installed service/,
    'fabric-dashboards://open?service=example-agent.default&path=//evil.example/x': /path must be/,
    'fabric-dashboards://open?service=example-agent.default&path=http://evil.example': /path must be/,
    'fabric-dashboards://open?service=example-agent.default&url=http://127.0.0.1:47195/': /not both/,
    [`fabric-dashboards://open?url=${encodeURIComponent('http://evil.example:47195/')}`]: /local service/,
    [`fabric-dashboards://open?url=${encodeURIComponent('https://127.0.0.1:47195/')}`]: /local service/,
    [`fabric-dashboards://open?url=${encodeURIComponent('http://u:p@127.0.0.1:47195/')}`]: /credentials/,
    [`fabric-dashboards://open?url=${encodeURIComponent('http://127.0.0.1:9999/')}`]: /no installed service on port 9999/,
  };
  for (const [raw, reason] of Object.entries(refused)) {
    const result = parseDeepLink(raw, known);
    assert.equal(result.ok, false, raw);
    assert.match((result as { reason: string }).reason, reason, raw);
  }
});

test('safePath refuses backslashes, control characters and over-long paths', () => {
  assert.equal(safePath('/a\\b'), null);
  assert.equal(safePath('/a\nb'), null);
  assert.equal(safePath(`/${'x'.repeat(2048)}`), null);
  assert.equal(safePath('/dashboard/job_1'), '/dashboard/job_1');
});

test('linkFor hands out the service form and round-trips through parseDeepLink', () => {
  const link = linkFor('example-agent.default', '/dashboard/job_3?x=1');
  assert.equal(link, 'fabric-dashboards://service/example-agent.default?path=%2Fdashboard%2Fjob_3%3Fx%3D1');
  assert.deepEqual(parseDeepLink(link, known), { ok: true, target: { page: 'service', key: 'example-agent.default', link: '/dashboard/job_3?x=1' } });
  assert.equal(linkFor('example-agent.preview'), 'fabric-dashboards://service/example-agent.preview');
  assert.deepEqual(parseDeepLink(linkFor('example-agent.preview'), known), { ok: true, target: { page: 'service', key: 'example-agent.preview' } });
});

// SCN-101 / AR-2.5: the form Fabric's "Open dashboard" opens.
test('service/<id>.<instance> opens that service, a page of it with path=', () => {
  assert.deepEqual(parseDeepLink('fabric-dashboards://service/example-agent.default', known), {
    ok: true, target: { page: 'service', key: 'example-agent.default' },
  });
  assert.deepEqual(parseDeepLink('fabric-dashboards://service/example-agent.preview/', known), {
    ok: true, target: { page: 'service', key: 'example-agent.preview' },
  }, 'one trailing slash is the same link');
  assert.deepEqual(parseDeepLink('fabric-dashboards://SERVICE/example-agent.default?path=%2Fdashboard%2Fjob_1', known), {
    ok: true, target: { page: 'service', key: 'example-agent.default', link: '/dashboard/job_1' },
  });
});

test('the old open?service= and open?url= links keep working', () => {
  assert.deepEqual(parseDeepLink('fabric-dashboards://open?service=example-agent.default&path=%2Fdashboard', known), {
    ok: true, target: { page: 'service', key: 'example-agent.default', link: '/dashboard' },
  });
});

test('a malformed or foreign service link is refused with the reason and opens nothing', () => {
  const refused: Record<string, RegExp> = {
    'fabric-dashboards://service': /needs the service/,
    'fabric-dashboards://service/': /needs the service/,
    'fabric-dashboards://service/example-agent': /not a service key/,
    'fabric-dashboards://service/Example-Agent.default': /not a service key/,
    'fabric-dashboards://service/example-agent.default.x': /not a service key/,
    'fabric-dashboards://service/example-agent%2Edefault': /not a service key/,
    'fabric-dashboards://service/..%2F..%2Fetc.passwd': /not a service key/,
    'fabric-dashboards://service/example-agent.default/dashboard': /one service/,
    'fabric-dashboards://service//example-agent.default': /not a service key|one service/,
    'fabric-dashboards://service/nobody.default': /no installed service "nobody.default"/,
    'fabric-dashboards://service/broken.default': /no installed service "broken.default"/,
    'fabric-dashboards://service/example-agent.default?path=//evil.example/x': /path must be/,
    'fabric-dashboards://service/example-agent.default?path=http://evil.example': /path must be/,
    'fabric-dashboards://service/example-agent.default?path=': /path must be/,
    'fabric-dashboards://service/example-agent.default?path=/a&path=/b': /one path/,
    'fabric-dashboards://service/example-agent.default?url=http://127.0.0.1:47195/': /unknown parameter "url"/,
    'fabric-dashboards://service/example-agent.default?service=example-agent.preview': /unknown parameter "service"/,
    'fabric-dashboards://service/example-agent.default#x': /fragment/,
    'fabric-dashboards://user:pw@service/example-agent.default': /user, password or port/,
    'fabric-dashboards://service:8080/example-agent.default': /user, password or port/,
    'fabric-dashboards://user@open?service=example-agent.default': /user, password or port/,
    'fabric-dashboards:service/example-agent.default': /unknown link verb/,
  };
  for (const [raw, reason] of Object.entries(refused)) {
    const result = parseDeepLink(raw, known);
    assert.equal(result.ok, false, raw);
    assert.match((result as { reason: string }).reason, reason, raw);
  }
});

test('a refusal quotes at most a clipped, escaped piece of the link', () => {
  const long = `fabric-dashboards://service/${'a'.repeat(500)}.default`;
  const r = parseDeepLink(long, known) as { ok: false; reason: string };
  assert.equal(r.ok, false);
  assert.ok(r.reason.length < 200, r.reason);
  const quoted = parseDeepLink('fabric-dashboards://service/a"b.default', known) as { ok: false; reason: string };
  assert.match(quoted.reason, /\\"|%22/, 'a quote inside the key is escaped or still encoded');
});
