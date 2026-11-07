// FD-169 (SCN-095, the contract's DEC-0149): an agent whose every degraded entry is a setup one reads "Waits for
// setup" over `degraded`; a mixed list stays degraded; what leaves the window keeps the host state.
import assert from 'node:assert/strict';
import test from 'node:test';
import { attentionQueue, urgent } from '../src/core/attention';
import { fixTask, handoffContext } from '../src/core/handoff';
import { allKeys, t } from '../src/core/i18n';
import { offersFix, offersSetup } from '../src/core/offers';
import { SETUP_RANK, shownState, waitsForSetup } from '../src/core/setup-wait';
import { trayLevel } from '../src/electron/tray';
import { GLYPH } from '../src/renderer/lib';
import { snap } from './snap';

const NOW = Date.parse('2026-11-07T16:00:00Z');
const setupReason = (source: string) => ({ code: 'reason.setup', params: { source, reason: 'no key yet' } });
const waiting = snap('alpha.default', 'degraded', { reasons: [setupReason('openrouter'), setupReason('telegram')] });
const mixed = snap('bravo.default', 'degraded', { reasons: [setupReason('openrouter'), { code: 'reason.degraded', params: { source: 'disk', reason: 'full' } }] });
const broken = snap('charlie.default', 'degraded', { reasons: [{ code: 'reason.degraded', params: { source: 'disk', reason: 'full' } }] });

test('FD-169: only a degraded agent whose every reason is a setup one waits for setup', () => {
  assert.equal(waitsForSetup(waiting), true);
  assert.equal(shownState(waiting), 'setup');
  assert.equal(waitsForSetup(mixed), false, 'a mixed list stays degraded');
  assert.equal(shownState(mixed), 'degraded');
  assert.equal(waitsForSetup(broken), false);
  assert.equal(waitsForSetup(snap('delta.default', 'degraded', { reasons: [] })), false, 'no reason is not a setup');
  assert.equal(waitsForSetup(snap('echo.default', 'ready')), false);
  assert.equal(waiting.state, 'degraded', 'the host state is untouched');
});

test('FD-169: in the attention queue it sits after degraded and before a tile, and is never urgent', () => {
  const tile = snap('foxtrot.default', 'ready', { tile: true });
  const q = attentionQueue([tile, waiting, broken], { now: NOW });
  assert.deepEqual(q.map((x) => x.s.key), ['charlie.default', 'alpha.default', 'foxtrot.default']);
  assert.equal(q[1]!.rank, SETUP_RANK);
  assert.equal(q.some((x) => x.s === waiting && urgent(x)), false);
});

test('FD-169: the menu bar stays calm for it; a partly working agent still reads degraded', () => {
  assert.equal(trayLevel([waiting], {}, [], NOW), 'ok');
  assert.equal(trayLevel([waiting, mixed], {}, [], NOW), 'degraded');
});

test('FD-169: the button reads Set up and its task is a setup, unless a problem or a failed action sits beside it', () => {
  assert.equal(offersFix(waiting), true, 'the same button');
  assert.equal(offersSetup(waiting), true);
  assert.equal(offersSetup(mixed), false);
  assert.equal(offersSetup({ ...waiting, problems: ['descriptor: bad port'] }), false);
  assert.equal(offersSetup({ ...waiting, lastAction: { action: 'restart', ok: false, reason: { code: 'result.failed' }, at: '2026-11-07T15:59:00Z' } }), false);
  const job = fixTask(handoffContext(waiting, [], null));
  assert.match(job.title, /waits for setup$/);
  assert.match(job.body, /hidden prompt/);
  assert.doesNotMatch(fixTask(handoffContext(broken, [], null)).title, /setup/);
});

test('FD-169: its words exist in both languages and its glyph is the diamond', () => {
  for (const k of ['state.setup', 'agent.setup', 'agent.setupShort']) assert.ok(allKeys().includes(k), k);
  assert.equal(t('en', 'state.setup'), 'Waits for setup');
  assert.equal(t('ru', 'state.setup'), 'Ждёт настройки');
  assert.equal(t('ru', 'agent.setup'), 'Настроить с агентом для кода');
  assert.equal(GLYPH.setup, '◆');
});
