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

test('FD-65: the report is read strictly: a check without a documented state is dropped, the summary recounted; FD-212: one of an area this version does not know is kept under Other', () => {
  const r = parseDoctor(FIXTURE)!;
  assert.equal(r.ok, false);
  assert.deepEqual(r.checks.map((c) => [c.id, c.area]), [['prereq.node', 'prerequisites'], ['app.inbox', 'apps'], ['app.dashboards.running', 'apps'], ['mcp.claude.fabric-dashboards', 'mcp'], ['bad.check', 'other']]);
  assert.deepEqual(r.summary, { ok: 2, warn: 1, fail: 1, info: 1 });
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
  assert.match(md, /\*\*fail\*\* `mcp\.claude\.fabric-dashboards` \(mcp\): .*points at a missing file; fix: claude mcp add/);
  assert.doesNotMatch(md, /prereq\.node/, 'a passing check is not handed over');
  assert.equal(doctorMarkdown({ ...report, checks: report.checks.filter((c) => c.state === 'ok') }), '', 'nothing to repair: no section');
  const without = setupMarkdown({ runtimeId: 'codex', runtimeName: 'Codex', server: { command: '/x/mcp', args: [] }, state: { mcp: true, skills: true, firstAgent: true }, platform: 'darwin' });
  assert.doesNotMatch(without, /Check setup found/);
});

test('FD-185: the setup reads as steps, one per area in the launcher\'s order, with the first one not done', async () => {
  const { setupSteps } = await import('../src/core/doctor');
  const report = parseDoctor(JSON.stringify({ version: '0.2.75', at: 't', ok: false, checks: [
    { id: 'node', area: 'prerequisites', state: 'ok', detail: 'Node 26' },
    { id: 'skills.adapter', area: 'skills', state: 'warn', detail: 'old', fix: 'update' },
    { id: 'app.fabric', area: 'apps', state: 'fail', detail: 'missing', fix: 'install' },
    { id: 'app.inbox', area: 'apps', state: 'warn', detail: 'old' },
    { id: 'svc', area: 'services', state: 'info', detail: 'one' },
  ] }))!;
  const { steps, next } = setupSteps(report);
  assert.deepEqual(steps.map((s) => [s.area, s.state]), [['prerequisites', 'done'], ['skills', 'attention'], ['apps', 'todo'], ['mcp', 'done'], ['services', 'done']]);
  assert.equal(steps[2]!.first!.id, 'app.fabric', 'a failure is named before a warning of the same step');
  assert.deepEqual([steps[2]!.fail, steps[2]!.warn], [1, 1]);
  assert.equal(next, 'skills');
  assert.equal(setupSteps(parseDoctor(JSON.stringify({ version: 'x', at: 't', ok: true, checks: [] }))!).next, null, 'nothing left');
});

test('FD-184 (the launcher\'s PC-171): a check names what its fix needs from a person; a step says Needs you with it', async () => {
  const { setupSteps, doctorMarkdown } = await import('../src/core/doctor');
  const report = parseDoctor(JSON.stringify({ version: '0.2.76', at: 't', ok: false, checks: [
    { id: 'app.switchboard', area: 'apps', state: 'fail', detail: 'not signed in', fix: 'switchboard onboard', gate: 'sign-in' },
    { id: 'app.inbox', area: 'apps', state: 'warn', detail: 'old', fix: 'update it', gate: null },
    { id: 'mcp.x', area: 'mcp', state: 'fail', detail: 'missing', fix: 'add it', gate: 'teleport' },
    { id: 'svc.y', area: 'services', state: 'warn', detail: 'waits', gate: 'secret' },
  ] }))!;
  assert.deepEqual(report.checks.map((c) => c.gate), ['sign-in', null, null, null], 'unknown gates and gates without a fix read as an agent\'s step');
  const steps = setupSteps(report).steps;
  assert.equal(steps.find((s) => s.area === 'apps')!.gate, 'sign-in');
  assert.equal(steps.find((s) => s.area === 'apps')!.gateCheck!.id, 'app.switchboard');
  assert.equal(steps.find((s) => s.area === 'mcp')!.gate, null);
  assert.match(doctorMarkdown(report), /app\.switchboard.*needs the person: sign-in/);
  const old = parseDoctor(JSON.stringify({ version: '0.2.75', at: 't', ok: false, checks: [{ id: 'a', area: 'apps', state: 'fail', detail: 'd', fix: 'f' }] }))!;
  assert.equal(old.checks[0]!.gate, null, 'a launcher before 0.2.76 has no gates');
});

test('FD-212: the memory area and an area this version does not know are kept, so a failing check never vanishes', async () => {
  const { setupSteps } = await import('../src/core/doctor');
  const report = parseDoctor(JSON.stringify({ version: '0.2.77', at: 't', ok: false, checks: [
    { id: 'node', area: 'prerequisites', state: 'ok', detail: 'Node 26' },
    { id: 'memory.vault', area: 'memory', state: 'fail', detail: 'no vault', fix: 'set up the wiki' },
    { id: 'future.thing', area: 'future-area', state: 'fail', detail: 'broken' },
    { id: 'bad', area: 'Bad Area!', state: 'fail', detail: 'dropped: not an area name' },
  ] }))!;
  assert.deepEqual(report.checks.map((c) => [c.id, c.area]), [['node', 'prerequisites'], ['memory.vault', 'memory'], ['future.thing', 'other']]);
  assert.equal(report.summary.fail, 2, 'the summary counts every failure the report is failed for');
  const { steps } = setupSteps(report);
  assert.deepEqual(steps.map((s) => s.area), ['prerequisites', 'skills', 'apps', 'mcp', 'services', 'memory', 'other']);
  assert.deepEqual(setupSteps(parseDoctor(JSON.stringify({ version: 'x', at: 't', ok: true, checks: [] }))!).steps.map((s) => s.area),
    ['prerequisites', 'skills', 'apps', 'mcp', 'services'], 'memory and other are steps only when the report has their checks');
  assert.ok(areasInOrder(report.checks).includes('other'));
});
