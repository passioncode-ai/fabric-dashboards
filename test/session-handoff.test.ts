// FD-47 (contract DEC-0042, `session-handoff/1`): the folder a console writes for an agent passes the contract's
// own checker, `validateSessionHandoff` (copied in test/contract/, run here against real folders), with the
// contract's schema compiled by this repository's Ajv.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020';
import { prepareHandoff } from '../src/core/handoff';
import type { ServiceSnapshot } from '../src/core/types';
import { validateSessionHandoff, type SchemaCheck } from './contract/session-handoff';
import { tmp } from './helpers';

const fixtures = path.join(__dirname, 'fixtures', 'contract');
const schemaCheck: SchemaCheck = (() => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  // The two formats the schemas use, checked as the contract means them.
  ajv.addFormat('date-time', (v: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v) && !Number.isNaN(Date.parse(v)));
  ajv.addFormat('uri', (v: string) => { try { return Boolean(new URL(v)); } catch { return false; } });
  ajv.addSchema(JSON.parse(fs.readFileSync(path.join(fixtures, 'schema_common.json'), 'utf8')));
  const validate = ajv.compile(JSON.parse(fs.readFileSync(path.join(fixtures, 'schema_session-handoff.json'), 'utf8')));
  return (manifest: unknown) => (validate(manifest)
    ? { valid: true, errors: [] }
    : { valid: false, errors: (validate.errors ?? []).map((e) => ({ instancePath: e.instancePath, message: e.message ?? '', keyword: e.keyword })) as never });
})();

const snap = (): ServiceSnapshot => ({
  key: 'runner.dev', descriptorPath: '/x/runner.dev.json', state: 'down', reasons: [{ code: 'reason.noAnswer', params: { detail: 'connection refused' } }], problems: [],
  descriptor: { id: 'runner', instance: 'dev', name: 'Runner', origin: 'http://127.0.0.1:47199', placement: 'local', auth: { tokenFile: '/x/token', scheme: 'Bearer' }, source: { repository: 'https://github.com/example/runner' } },
  wellKnown: null, launchd: { managed: false }, latestEvent: null,
} as unknown as ServiceSnapshot);

const server = { command: '/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp', args: [] };
const start = (runtimeId: string, o: { task?: { kind: 'fix' }; dir?: string } = {}) => {
  const dir = o.dir ?? path.join(tmp('fd-sh-'), 'consoles', 'runner.dev');
  const r = prepareHandoff({ snapshot: snap(), activity: [], folder: '/w/runner', runtimeId, dir, server, version: '0.7.2', ...(o.task ? { task: o.task } : {}) });
  return { dir, r };
};
const verdict = async (dir: string) => {
  const v = await validateSessionHandoff(dir, { schema: schemaCheck });
  return { valid: v.valid, problems: [...v.schemaErrors.map((e) => `${e.instancePath} ${e.message}`), ...v.findings.map((f) => `${f.code} ${f.instancePath} ${f.message}`)] };
};

test('FD-47 DEC-0042: the contract\'s own checker accepts what the console writes for Claude Code, Codex and Gemini CLI, with and without a task', async () => {
  for (const runtimeId of ['claude-code', 'codex', 'gemini-cli']) {
    for (const task of [undefined, { kind: 'fix' as const }]) {
      const { dir, r } = start(runtimeId, task ? { task } : {});
      assert.ok(r.files.manifest, `${runtimeId}: handoff.json written`);
      const v = await verdict(dir);
      assert.deepEqual(v.problems, [], `${runtimeId}${task ? ' with a task' : ''}`);
      assert.equal(v.valid, true);
    }
  }
});

test('FD-47 SH-5/SH-7/SH-9: the manifest says per agent key, service_context with the key first, stdio MCP with no secret and not strict', () => {
  const { r } = start('claude-code', { task: { kind: 'fix' } });
  const m = JSON.parse(fs.readFileSync(r.files.manifest!, 'utf8'));
  assert.deepEqual(m.lifetime, { kind: 'agent-key', agentKey: 'runner.dev' });
  assert.deepEqual(m.firstCall, { server: 'fabric-dashboards', tool: 'service_context', arguments: { key: 'runner.dev' } });
  assert.deepEqual(m.mcp, { auth: 'none', strict: false });
  assert.deepEqual(m.files, ['context.md', 'mcp.json', 'task.md']);
  assert.equal(m.brief.delivery, 'inline');
  assert.ok(m.brief.text.endsWith(m.preamble), 'the brief ends with the preamble');
  assert.deepEqual(m.launch.args, [...r.handoff.before, ...r.handoff.after], 'the manifest records what the launch adds, in order');
  assert.ok(!JSON.stringify(m).includes('/x/token'), 'the token file is never named');
});

test('FD-47 SH-8: a brief over 1000 characters travels as brief.md, named by its absolute path, and still passes', async () => {
  const deep = path.join(tmp('fd-sh-'), 'd'.repeat(200), 'e'.repeat(200), 'f'.repeat(200), 'consoles', 'runner.dev');
  const { dir, r } = start('claude-code', { task: { kind: 'fix' }, dir: deep });
  assert.ok(r.files.brief, 'brief.md written');
  assert.deepEqual(r.handoff.before.slice(1), ['--append-system-prompt-file', path.join(dir, 'brief.md')]);
  assert.deepEqual((await verdict(dir)).problems, []);
  const again = start('claude-code', { dir });
  assert.equal(again.r.files.brief, null);
  assert.ok(!fs.existsSync(path.join(dir, 'brief.md')) && !fs.existsSync(path.join(dir, 'task.md')), 'SH-3: a later start leaves no file the manifest does not list');
  assert.deepEqual((await verdict(dir)).problems, []);
});

test('FD-47: a runtime the brief does not reach gets no handoff.json — its folder claims nothing', () => {
  const { dir, r } = start('aider');
  assert.equal(r.files.manifest, null);
  assert.ok(!fs.existsSync(path.join(dir, 'handoff.json')));
  const switched = start('claude-code', { dir });
  assert.ok(switched.r.files.manifest);
  start('aider', { dir });
  assert.ok(!fs.existsSync(path.join(dir, 'handoff.json')), 'a stale manifest from an earlier start is removed');
});

test('FD-47: the checker refuses a folder with a stray file — it is not checking nothing', async () => {
  const { dir } = start('claude-code');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x', { mode: 0o600 });
  const v = await verdict(dir);
  assert.equal(v.valid, false);
  assert.ok(v.problems.some((p) => /notes\.txt/.test(p)), v.problems.join('\n'));
});

test('FD-47 SH-3: a write that fails leaves no temporary file, and a temporary file a killed writer left is swept', async () => {
  const { dir } = start('claude-code');
  fs.writeFileSync(path.join(dir, 'context.md.4242.tmp'), 'half', { mode: 0o600 });
  start('claude-code', { dir });
  assert.ok(!fs.readdirSync(dir).some((n) => n.endsWith('.tmp')));
  assert.deepEqual((await verdict(dir)).problems, []);
  // A folder that refuses new files makes the write fail part-way. POSIX modes do that; Windows ignores them
  // (release run 38155693835 failed there on it), where the next test's failing rename covers the same path.
  if (process.platform !== 'win32') {
    fs.chmodSync(dir, 0o500);
    try {
      assert.throws(() => start('claude-code', { dir }));
    } finally {
      fs.chmodSync(dir, 0o700);
    }
    assert.ok(!fs.readdirSync(dir).some((n) => n.endsWith('.tmp')), 'nothing half-written is left');
  }
});

test('FD-47: a start that fails before its manifest leaves no manifest of an earlier start', () => {
  const { dir } = start('claude-code');
  assert.ok(fs.existsSync(path.join(dir, 'handoff.json')));
  fs.rmSync(path.join(dir, 'context.md'));
  fs.mkdirSync(path.join(dir, 'context.md')); // the write of context.md now fails
  assert.throws(() => start('claude-code', { dir }));
  assert.ok(!fs.existsSync(path.join(dir, 'handoff.json')), 'the old manifest no longer describes a launch that did not happen');
  assert.ok(!fs.readdirSync(dir).some((n) => n.endsWith('.tmp')), 'and nothing half-written is left');
});

test('FD-47 SH-8: a control character in the brief sends it as brief.md, never inline', async () => {
  const { briefFitsInline } = await import('../src/core/handoff');
  assert.equal(briefFitsInline('one line'), true);
  assert.equal(briefFitsInline('two\nlines'), false);
  assert.equal(briefFitsInline('a\u0007bell'), false);
  assert.equal(briefFitsInline('x'.repeat(1000)), true);
  assert.equal(briefFitsInline('x'.repeat(1001)), false);
});

