// The link Fabric (or anyone) hands Fabric Dashboards: fabric-dashboards://service/<id>.<instance>.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DOWNLOAD_URL, isServiceKey, safePath, SCHEME, serviceLink } from '../src/links';

test('a service link names the service in the path, a page in path=', () => {
  assert.equal(SCHEME, 'fabric-dashboards');
  assert.equal(serviceLink('example-agent.default'), 'fabric-dashboards://service/example-agent.default');
  assert.equal(serviceLink('example-agent.preview', '/dashboard/job_1?tab=log#end'),
    'fabric-dashboards://service/example-agent.preview?path=%2Fdashboard%2Fjob_1%3Ftab%3Dlog%23end');
  const parsed = new URL(serviceLink('example-agent.default', '/a b'));
  assert.equal(parsed.hostname, 'service');
  assert.equal(parsed.pathname, '/example-agent.default');
  assert.equal(parsed.searchParams.get('path'), '/a b');
});

test('a service key is id.instance in the descriptor\'s own syntax', () => {
  for (const good of ['example-agent.default', 'ab.x', 'a1-b.preview-2']) assert.equal(isServiceKey(good), true, good);
  for (const bad of ['', 'example-agent', 'Example.default', 'a.default', '1a.default', 'ab.', '.default', 'ab.c.d', 'ab/c.d', 'ab.Default', `a${'b'.repeat(63)}.x`, `ab.${'c'.repeat(33)}`, 'ab.c%2e']) {
    assert.equal(isServiceKey(bad), false, bad);
  }
});

test('the builder refuses to make a link the app would refuse', () => {
  assert.throws(() => serviceLink('Example.default'), /not a service key/);
  assert.throws(() => serviceLink('example-agent.default', '//evil.example/x'), /path must be/);
  assert.throws(() => serviceLink('example-agent.default', 'http://evil.example'), /path must be/);
  assert.throws(() => serviceLink('example-agent.default', '/a\\b'), /path must be/);
});

test('safePath keeps a page on the service\'s own origin', () => {
  assert.equal(safePath('/dashboard/job_1'), '/dashboard/job_1');
  assert.equal(safePath('/'), '/');
  for (const bad of ['', 'dashboard', '//host/x', '/a\\b', '/a\nb', '/a\u007fb', `/${'x'.repeat(2048)}`]) assert.equal(safePath(bad), null, JSON.stringify(bad));
});

test('the download page is the app\'s latest release', () => {
  assert.equal(DOWNLOAD_URL, 'https://github.com/passioncode-ai/fabric-dashboards/releases/latest');
});
