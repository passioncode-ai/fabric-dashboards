// FD-134 (SB-189): a Switchboard refusal shows its sentence for a person, not the JSON line that carries it.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Runner } from '@passioncode-ai/fabric-service-host';
import { readFallback } from '../src/core/fallback';
import { handoversOf, sbFailure } from '../src/core/switchboard';

const SENTENCE = 'This account is signed out. Sign in again in Switchboard.';
const refusal = (extra: Record<string, unknown> = {}) => JSON.stringify({ ok: false, error: SENTENCE, raw: 'backend: 401 invalid_grant (token revoked at 2026-11-02T18:00:00Z)', ...extra });

test('FD-134: the error of a JSON refusal on the last line of stderr is shown, not the line', () => {
  assert.equal(sbFailure({ code: 1, stdout: '', stderr: `warning: something earlier\n${refusal()}\n` }), SENTENCE);
});

test('FD-134: a JSON refusal on stdout (before SB-189) still shows its error', () => {
  assert.equal(sbFailure({ code: 1, stdout: JSON.stringify({ ok: false, error: SENTENCE }), stderr: '' }), SENTENCE);
});

test('FD-134: plain text, a JSON line without an error and broken JSON fall back to the last line', () => {
  assert.equal(sbFailure({ code: 1, stdout: '', stderr: 'first\nSwitchboard is not running\n' }), 'Switchboard is not running');
  assert.equal(sbFailure({ code: 1, stdout: '', stderr: '{"ok":false}' }), '{"ok":false}');
  assert.equal(sbFailure({ code: 1, stdout: '', stderr: '{"ok":false,"error":' }), '{"ok":false,"error":');
  assert.equal(sbFailure({ code: 1, stdout: '', stderr: JSON.stringify({ ok: false, error: '  ' }) }), JSON.stringify({ ok: false, error: '  ' }));
  assert.equal(sbFailure({ code: 7, stdout: '', stderr: '' }), 'exit 7');
});

test('FD-134: a long plain line is cut at the limit; a sentence gets up to 300 characters', () => {
  assert.equal(sbFailure({ code: 1, stdout: '', stderr: 'x'.repeat(500) }).length, 200);
  assert.equal(sbFailure({ code: 1, stdout: '', stderr: 'x'.repeat(500) }, 300).length, 300);
  assert.equal(sbFailure({ code: 1, stdout: '', stderr: JSON.stringify({ ok: false, error: 'y'.repeat(500) }) }).length, 300);
});

test('FD-134: Settings → Coding agents shows the sentence of a refused read', async () => {
  const run: Runner = async () => ({ code: 1, stdout: '', stderr: refusal() });
  assert.deepEqual(await readFallback(run, '/sb'), { kind: 'error', detail: SENTENCE });
});

test('FD-134: an old Switchboard is still recognised when its text arrives inside raw', async () => {
  const run: Runner = async () => ({ code: 2, stdout: '', stderr: JSON.stringify({ ok: false, error: 'Unknown command.', raw: "error: unrecognized subcommand 'handovers'" }) });
  assert.deepEqual(await handoversOf(run, '/sb'), { unavailable: 'old', detail: 'Unknown command.' });
});
