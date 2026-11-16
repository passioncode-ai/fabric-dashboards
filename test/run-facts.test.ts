// FD-250: the Logs tab says how the supervisor last saw the agent run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runFacts } from '../src/core/run-facts';
import { redactSecrets } from '../src/core/bugs';
import { lastLogLine } from '../src/core/monitor';
import { t } from '../src/core/i18n';

test('FD-250: launchd and systemd runs read as the process now and how the last run ended', () => {
  const crashed = runFacts({ managed: true, loaded: true, pid: null, disabled: false, runs: 37, lastExit: { code: 1 } });
  assert.deepEqual(crashed, [{ code: 'logs.ran.code', params: { by: 'launchd', runs: 37, code: 1 } }]);
  assert.equal(t('en', crashed[0]!.code, crashed[0]!.params), 'launchd started it 37 times; its last run ended with exit code 1.');
  const unit = runFacts({ managed: true, by: 'systemd', loaded: true, pid: 4242, disabled: false, runs: 2, lastExit: { signal: 'SIGKILL' } });
  assert.deepEqual(unit, [{ code: 'logs.pid', params: { pid: 4242 } }, { code: 'logs.ran.signal', params: { by: 'systemd', runs: 2, signal: 'SIGKILL' } }]);
  assert.equal(t('ru', unit[1]!.code, unit[1]!.params), 'systemd запускал его раз: 2; последний запуск остановлен сигналом (SIGKILL).');
  assert.deepEqual(runFacts({ managed: false, loaded: false, pid: null, disabled: false }), [], 'no supervisor, nothing to say');
  assert.deepEqual(runFacts({ managed: true, loaded: true, pid: null, disabled: false }), [], 'a job never run says nothing');
  assert.deepEqual(runFacts(null), []);
});

test('FD-250: a log line keeps its words and loses what reads as a credential', () => {
  assert.equal(redactSecrets('connect to https://bot:hunter22@api.example.com failed'), 'connect to https://<credentials>@api.example.com failed');
  assert.equal(redactSecrets('auth failed: token=abcdef123456 rejected'), 'auth failed: token=<redacted> rejected');
  assert.equal(redactSecrets('using sk-or-v1abcdefghijklmnop'), 'using <redacted>');
  assert.equal(redactSecrets('Error: listen EADDRINUSE 127.0.0.1:4700'), 'Error: listen EADDRINUSE 127.0.0.1:4700');
  assert.equal(lastLogLine('ok\nFATAL: password: s3cretValue1 not accepted\n'), 'FATAL: password: <redacted> not accepted');
});
