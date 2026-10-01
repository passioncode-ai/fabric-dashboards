// The notification policy (ADR-0010), on the cases the operator's Mac produced on 2026-10-01:
// 405 events asked to notify; 302 of them were one disk warning flapping on two instances.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { composeEventNotice, COOLDOWN_MS, displayName, episodeKey, intentOf, NotifyLedger } from '../src/core/notify';
import { tmp } from './helpers';

const HOUR = 3_600_000;

test('intent: what the agent wants from the operator, read from the event kind and level', () => {
  assert.equal(intentOf({ kind: 'job.awaiting_choice', level: 'notice' }), 'ask');
  assert.equal(intentOf({ kind: 'human_step.opened', level: 'notice' }), 'ask');
  assert.equal(intentOf({ kind: 'approval.requested', level: 'notice' }), 'ask');
  assert.equal(intentOf({ kind: 'plan.awaiting_approval', level: 'warning' }), 'ask', 'a question outranks its level');
  assert.equal(intentOf({ kind: 'job.failed', level: 'error' }), 'failed');
  assert.equal(intentOf({ kind: 'finding.opened', level: 'error' }), 'failed');
  assert.equal(intentOf({ kind: 'service.degraded', level: 'warning' }), 'attention');
  assert.equal(intentOf({ kind: 'finding.opened', level: 'warning' }), 'attention');
  for (const kind of ['job.delivered', 'job.done', 'stage.finished', 'store.synced', 'job.choice_made', 'service.recovered', 'finding.cleared', 'job.resumed', 'job.queued', 'job.started']) {
    assert.equal(intentOf({ kind, level: 'notice' }), 'quiet', `${kind} is for Activity, not a banner`);
  }
  assert.equal(intentOf({ kind: 'service.recovered', level: 'warning' }), 'quiet', 'an ending never notifies');
  assert.equal(intentOf({ kind: 'listing.revision', level: 'info' }), 'quiet');
  assert.equal(intentOf({ kind: 'journal.risk', level: 'notice' }), 'quiet', 'a plain notice is not a request');
});

test('episode: one subject is one episode; a warning with no subject is one per agent, across its instances', () => {
  const fa = { key: 'example-agent.default', id: 'example-agent' };
  const fp = { key: 'example-agent.preview', id: 'example-agent' };
  const disk = (text: string) => ({ kind: 'service.degraded', level: 'warning' as const, text });
  assert.equal(episodeKey(fa, disk('Only 4 GB free')), episodeKey(fp, disk('Only 1 GB free')), 'the same machine fact, said twice');
  const job = (id: string) => ({ kind: 'job.awaiting_choice', level: 'notice' as const, text: 'x', subject: { type: 'job', id } });
  assert.notEqual(episodeKey(fa, job('a')), episodeKey(fa, job('b')));
  assert.notEqual(episodeKey(fa, job('a')), episodeKey(fp, job('a')), 'a job belongs to its instance');
  assert.notEqual(episodeKey(fa, { kind: 'job.failed', level: 'error', text: 'render failed' }), episodeKey(fa, { kind: 'job.failed', level: 'error', text: 'verify failed' }), 'a failure without a subject is told by its sentence');
});

test('ledger: an episode notifies once per cool-down, and the record survives a restart', () => {
  const dir = tmp('fd-ledger-');
  const file = path.join(dir, 'notified.json');
  const t0 = Date.parse('2026-10-01T10:00:00Z');
  const a = new NotifyLedger(file);
  assert.equal(a.admit('example-agent|service.degraded|', 'attention', t0), true);
  for (let i = 1; i <= 150; i += 1) assert.equal(a.admit('example-agent|service.degraded|', 'attention', t0 + i * 60_000), false);
  assert.equal(a.admit('example-agent|service.degraded|', 'attention', t0 + COOLDOWN_MS.attention + 1), true, 'still degraded after the cool-down: said again');
  const b = new NotifyLedger(file);
  assert.equal(b.admit('example-agent|service.degraded|', 'attention', t0 + COOLDOWN_MS.attention + 2 * HOUR), false, 'a restarted app remembers');
  assert.equal(b.admit('store-agent.default|job.awaiting_choice|job_1', 'ask', t0), true);
  assert.equal(b.admit('store-agent.default|job.awaiting_choice|job_1', 'ask', t0 + 20 * HOUR), false);
  assert.ok(COOLDOWN_MS.failed < COOLDOWN_MS.attention && COOLDOWN_MS.attention < COOLDOWN_MS.ask);
  fs.writeFileSync(file, '{torn');
  assert.equal(new NotifyLedger(file).admit('x', 'failed', t0), true, 'an unreadable ledger starts empty, never throws');
  assert.equal(new NotifyLedger(null).admit('x', 'failed', t0), true, 'in memory without a file');
});

test('ledger forgets episodes two days old, so the file stays small', () => {
  const dir = tmp('fd-ledger-prune-');
  const file = path.join(dir, 'notified.json');
  const t0 = Date.parse('2026-10-01T10:00:00Z');
  const a = new NotifyLedger(file);
  for (let i = 0; i < 50; i += 1) a.admit(`k${i}`, 'failed', t0);
  a.admit('fresh', 'failed', t0 + 49 * HOUR);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))), ['fresh']);
});

test('display name: the instance is named when it is not the default, and only once', () => {
  assert.equal(displayName('Example Agent', 'default'), 'Example Agent');
  assert.equal(displayName('Example Agent', 'preview'), 'Example Agent · preview');
  assert.equal(displayName('Example Agent (preview)', 'preview'), 'Example Agent (preview)');
});

test('compose: who (the agent), what it wants (subtitle) and the sentence; several at once say the most urgent', () => {
  const one = composeEventNotice('ru', 'Store Agent', [{ intent: 'ask', text: 'The Q3 listing waits for your choice of markets.', link: '/dashboard#/jobs/7' }]);
  assert.deepEqual(one, { title: 'Store Agent', subtitle: 'Ждёт вашего решения', body: 'The Q3 listing waits for your choice of markets.', link: '/dashboard#/jobs/7', target: 'service' });
  assert.equal(composeEventNotice('en', 'Maker', [{ intent: 'failed', text: 'Job 7 failed at verify.' }]).subtitle, 'Failed');
  assert.equal(composeEventNotice('en', 'Maker', [{ intent: 'attention', text: 'Only 4 GB free.' }]).subtitle, 'Needs attention');
  const many = composeEventNotice('en', 'Example Agent', [
    { intent: 'attention', text: 'A provider is slow.' },
    { intent: 'failed', text: 'Order icon-7 failed.' },
    { intent: 'ask', text: 'Order icon-8 waits for your pick.', link: '/dashboard/icon-8' },
  ]);
  assert.deepEqual(many, { title: 'Example Agent', subtitle: '3 need you · needs your decision', body: 'Order icon-8 waits for your pick.', link: undefined, target: 'activity' });
});
