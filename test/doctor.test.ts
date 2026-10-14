// FD-65 (SCN-070): Check setup reads the PassionCode launcher's `doctor --json` strictly, maps its exit codes, and
// hands the Setup console the lines a person acts on.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { areasInOrder, attention, DOCTOR_PIN, doctorArgv, doctorMarkdown, doctorResult, parseDoctor } from '../src/core/doctor';
import { setupMarkdown } from '../src/core/setup';

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures/doctor/doctor-failing.json'), 'utf8');
const NOW = new Date('2026-10-14T17:10:00Z');

test('FD-65: the pinned, read-only doctor — never `--fix`, never an unpinned launcher', () => {
  assert.deepEqual(doctorArgv('/usr/local/bin/npx'), ['/usr/local/bin/npx', ['--yes', `@passioncode-ai/passioncode@${DOCTOR_PIN}`, 'doctor', '--json']]);
  assert.match(DOCTOR_PIN, /^\d+\.\d+\.\d+$/, 'an exact version, not latest');
});

test('FD-65: the report is read strictly — a check without the documented area or state is dropped, the summary recounted', () => {
  const r = parseDoctor(FIXTURE)!;
  assert.equal(r.ok, false);
  assert.deepEqual(r.checks.map((c) => c.id), ['prereq.node', 'app.inbox', 'app.dashboards.running', 'mcp.claude.fabric-dashboards']);
  assert.deepEqual(r.summary, { ok: 1, warn: 1, fail: 1, info: 1 });
  assert.equal(parseDoctor('not json'), null);
  assert.equal(parseDoctor('{"checks":"x","ok":true}'), null);
});

test('FD-65: exit 0 and 1 carry the report; anything else, a timeout or a missing npx is said as such', () => {
  const failing = doctorResult({ code: 1, stdout: FIXTURE, stderr: '', output: '' }, NOW);
  assert.equal(failing.kind, 'report');
  assert.equal(doctorResult({ code: 0, stdout: FIXTURE, output: '' }, NOW).kind, 'report');
  assert.deepEqual(doctorResult({ code: 2, stdout: '', stderr: '\nunknown command: doctor\nmore', output: '' }, NOW), { kind: 'error', detail: 'unknown command: doctor', checkedAt: NOW.toISOString() });
  assert.deepEqual(doctorResult({ code: 1, stdout: 'garbage', stderr: '', output: 'garbage' }, NOW), { kind: 'error', detail: 'garbage', checkedAt: NOW.toISOString() });
  assert.deepEqual(doctorResult({ code: null, timedOut: true, output: '' }, NOW), { kind: 'error', detail: 'no answer within 120 s', checkedAt: NOW.toISOString() });
  assert.deepEqual(doctorResult({ code: null, started: false, output: 'spawn npx ENOENT' }, NOW), { kind: 'no-node' });
});

test('FD-65: failures first, then warnings; ok and info are not asked of the person', () => {
  assert.deepEqual(attention(parseDoctor(FIXTURE)!).map((c) => c.id), ['mcp.claude.fabric-dashboards', 'app.inbox']);
  assert.deepEqual(areasInOrder(attention(parseDoctor(FIXTURE)!)), ['mcp', 'apps'], 'an area with a failure is shown first');
});

test('FD-65: Repair with my coding agent — the Setup brief starts from what the check found, with each fix', () => {
  const report = parseDoctor(FIXTURE)!;
  const md = setupMarkdown({ runtimeId: 'claude-code', runtimeName: 'Claude Code', server: { command: '/x/mcp', args: [] }, state: { mcp: true, skills: true, firstAgent: true }, platform: 'darwin', doctor: report });
  assert.ok(md.indexOf('What the last Check setup found') < md.indexOf('## Steps, in order'), 'the check comes before the steps');
  assert.match(md, /\*\*fail\*\* `mcp\.claude\.fabric-dashboards` \(mcp\): .*points at a missing file — fix: claude mcp add/);
  assert.doesNotMatch(md, /prereq\.node/, 'a passing check is not handed over');
  assert.equal(doctorMarkdown({ ...report, checks: report.checks.filter((c) => c.state === 'ok') }), '', 'nothing to repair: no section');
  const without = setupMarkdown({ runtimeId: 'codex', runtimeName: 'Codex', server: { command: '/x/mcp', args: [] }, state: { mcp: true, skills: true, firstAgent: true }, platform: 'darwin' });
  assert.doesNotMatch(without, /Check setup found/);
});
