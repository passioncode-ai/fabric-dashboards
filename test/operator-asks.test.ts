// FD-125 (ADR-0010 amendment 2026-10-27): a decision an agent waits for reaches the operator channel, once.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { intentOf } from '../src/core/notify';
import { ASK_REPEAT_MS, askDelivered, askIdOf, emptyOutageState, enqueueAsk, observe, OUTAGE_GIVE_UP_MS, owedAsks, type Words } from '../src/core/outage-alerts';
import { OutageAlerts } from '../src/electron/outage-alerts';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { tmp } from './helpers';

const words: Words = { down: (n) => `${n} is down`, failing: (n, s) => `${n}: ${s}`, back: (n) => `${n} is back`, removed: (n) => `${n} was removed`, since: (m, r) => `${m} ${r}`, after: (m) => `${m}`, wasDown: (m, r) => `${m} ${r}`, ask: (n) => `${n} waits for your decision`, open: (l) => `Open: ${l}` };
const LINK = 'fabric-dashboards://service/sshlg-growth.default?path=%2Fdashboard%2F%3Fview%3Ddrafts';
const ask = (at: number, episode = 'sshlg-growth.default|draft.awaiting_approval|draft:19b6') => ({ serviceKey: 'sshlg-growth.default', name: 'Growth', episode, at, text: 'A config draft waits for approval.', link: LINK });

test('FD-125: the growth kinds read as a decision; a guardrail stop too; a delivery does not', () => {
  for (const kind of ['draft.awaiting_approval', 'experiment.decision_needed', 'experiment.guardrail_stopped', 'experiment.guardrail_breached_external']) {
    assert.equal(intentOf({ kind, level: 'notice' }), 'ask', kind);
  }
  assert.equal(intentOf({ kind: 'service.fault', level: 'error' }), 'failed', 'a fault stays a banner on the Mac');
  assert.equal(intentOf({ kind: 'draft.approved', level: 'notice' }), 'quiet');
});

test('FD-125: an ask is queued once per event, the same question is not repeated within a day, and it is sent once', () => {
  const id = askIdOf('sshlg-growth.default', '01JB/evt 7');
  assert.equal(id, 'ask:sshlg-growth.default:01JB_evt_7', 'no slash or space in a message id');
  let s = enqueueAsk(emptyOutageState(), id, ask(1_000));
  assert.equal(enqueueAsk(s, id, ask(2_000)), s, 'the same event twice');
  assert.equal(enqueueAsk(s, 'ask:x:2', ask(1_000 + ASK_REPEAT_MS - 1)), s, 'the same question again within a day');
  const due = owedAsks(s, 5_000, words, () => true);
  assert.deepEqual(due, [{ id, msg: { serviceKey: 'sshlg-growth.default', kind: 'question', eventId: id, subject: 'Growth waits for your decision', text: `A config draft waits for approval.\nOpen: ${LINK}` } }]);
  assert.deepEqual(owedAsks(s, 5_000, words, () => false), [], 'paused, quiet hours or a muted agent: it waits');
  s = askDelivered(s, id);
  assert.deepEqual(owedAsks(s, 5_000, words, () => true), []);
  assert.notEqual(enqueueAsk(s, 'ask:x:3', ask(1_000 + ASK_REPEAT_MS)), s, 'a day later the question may be asked again');
  assert.deepEqual(owedAsks(enqueueAsk(emptyOutageState(), id, ask(0)), OUTAGE_GIVE_UP_MS + 1, words, () => true), [], 'a day undelivered: given up');
});

test('FD-125: a look at the services keeps the queue, and forgets an ask two days old', () => {
  const s = enqueueAsk(emptyOutageState(), 'ask:a:1', ask(0));
  assert.ok(observe(s, [], 1_000).asks?.['ask:a:1'], 'kept');
  assert.deepEqual(observe(s, [], 2 * ASK_REPEAT_MS).asks, {}, 'forgotten');
  assert.equal(observe(emptyOutageState(), [], 0).asks, undefined, 'a state without asks stays without');
});

test('FD-125: the sender delivers an ask through the channel once and keeps it across a restart until it is taken', async () => {
  const dir = tmp('fd-asks-');
  const sent: string[] = [];
  const make = () => new OutageAlerts({
    dataDir: dir, snapshots: () => [], settings: () => DEFAULT_SETTINGS, words: () => words, nameOf: () => 'x', reasonOf: () => 'x',
    allowed: () => true, version: '0.0.0', log: (l) => sent.push(l), changed: () => undefined,
  });
  const a = make();
  a.ask('sshlg-growth.default', 'evt-1', { name: 'Growth', episode: 'e', at: Date.now(), text: 't', link: null });
  a.stop();
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'outage-alerts.json'), 'utf8'));
  assert.equal(saved.asks['ask:sshlg-growth.default:evt-1'].delivered, false, 'no channel here: it waits on disk');
  const b = make();
  b.ask('sshlg-growth.default', 'evt-1', { name: 'Growth', episode: 'e', at: Date.now(), text: 't', link: null });
  b.stop();
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'outage-alerts.json'), 'utf8')).asks).length, 1, 'read back after a restart, not queued twice');
});
