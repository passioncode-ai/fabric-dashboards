// The dashboard toolbar's address (ADR-0014): what it shows and copies for the page a view is on.
import assert from 'node:assert/strict';
import test from 'node:test';
import { pageAddress } from '../src/electron/policy';

const O = 'http://127.0.0.1:47195';
const KEY = 'example-agent.default';

test('a page on the service shows its own address and the link that opens it here', () => {
  const a = pageAddress(`${O}/dashboard/job_1?tab=log#graph`, O, '/dashboard', KEY);
  assert.equal(a.address, `${O}/dashboard/job_1?tab=log#graph`);
  assert.equal(a.path, '/dashboard/job_1?tab=log#graph');
  assert.equal(a.link, 'fabric-dashboards://service/example-agent.default?path=%2Fdashboard%2Fjob_1%3Ftab%3Dlog%23graph');
});

test('the one-time sign-in URL is never shown or copied: it reads as the dashboard', () => {
  const a = pageAddress(`${O}/fabric/v1/login?code=abcdefghijklmnopqrstuvwxyz012345`, O, '/dashboard', KEY);
  assert.equal(a.address, `${O}/dashboard`);
  assert.equal(a.address.includes('code='), false);
  assert.equal(a.link.includes('code'), false);
});

test('a page off the service origin, or no page yet, reads as the dashboard', () => {
  assert.equal(pageAddress('https://evil.example/x', O, '/dashboard', KEY).address, `${O}/dashboard`);
  assert.equal(pageAddress('about:blank', O, '/dashboard', KEY).path, '/dashboard');
  assert.equal(pageAddress('', O, '/', KEY).link, 'fabric-dashboards://service/example-agent.default?path=%2F');
});

test('an online service keeps its https origin', () => {
  const a = pageAddress('https://agent.example.com/dashboard/', 'https://agent.example.com', '/dashboard/', 'agent.default');
  assert.equal(a.address, 'https://agent.example.com/dashboard/');
});
