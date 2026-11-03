// FD-135 (SCN-090): the name a person gives an agent lives in the agent's own GitHub repository (`.fabric/names.json`,
// ADR-0026). A fake GitHub stands behind `gh` here: what the app reads, what it commits, and what it shows.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Descriptor, RunResult, WellKnown } from '@passioncode-ai/fabric-service-host';
import { ActivityStore } from '../src/core/activity';
import {
  AgentNameStore, cleanName, customNameOf, fetchNames, githubRepoOf, ghFailure, namesFileText, NAMES_PATH, NAMES_SCHEMA, parseNamesFile, putName,
} from '../src/core/agent-names';
import { Launchd } from '../src/core/launchd';
import { Monitor } from '../src/core/monitor';
import { DEFAULT_SETTINGS } from '../src/core/types';
import * as tools from '../src/mcp/tools';
import { tmp } from './helpers';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const DESCRIPTOR = fixture('positive_service-descriptor.json') as Descriptor; // source.repository: github.com/example/example-agent
const READY: WellKnown = { ...(fixture('positive_service-well-known.json') as WellKnown), status: 'ready', degraded: [] };
const KEY = `${DESCRIPTOR.id}.${DESCRIPTOR.instance}`;
const REPO = { owner: 'example', repo: 'example-agent' };

/** A GitHub that holds files by `owner/repo`, answers the calls `gh api` makes, and records every write. */
function fakeGithub(files: Record<string, string | undefined> = {}, opts: { conflictOnce?: boolean; refuseWrite?: string; hidden?: string[] } = {}) {
  const store = new Map(Object.entries(files).filter(([, v]) => v !== undefined) as [string, string][]);
  const sha = (slug: string) => `sha-${Buffer.from(store.get(slug) ?? '').length}-${slug}`;
  const writes: { method: string; slug: string; message: string }[] = [];
  let conflict = opts.conflictOnce ?? false;
  const field = (args: string[], name: string) => args.find((a, i) => args[i - 1] === '-f' && a.startsWith(`${name}=`))?.slice(name.length + 1);
  const run = async (command: string, args: string[]): Promise<RunResult> => {
    assert.equal(command, '/fake/gh');
    if (args[1] === 'graphql') {
      const data: Record<string, unknown> = {};
      for (let j = 0; field(args, `o${j}`) !== undefined; j++) {
        const slug = `${field(args, `o${j}`)}/${field(args, `n${j}`)}`;
        data[`r${j}`] = opts.hidden?.includes(slug) ? null : { object: store.has(slug) ? { text: store.get(slug) } : null };
      }
      return { code: opts.hidden?.length ? 1 : 0, stdout: JSON.stringify({ data }), stderr: opts.hidden?.length ? 'gh: Could not resolve to a Repository' : '' };
    }
    const methodAt = args.indexOf('-X');
    const method = methodAt >= 0 ? args[methodAt + 1]! : 'GET';
    const url = args.find((a) => a.startsWith('repos/'))!;
    const slug = url.split('/').slice(1, 3).join('/');
    assert.equal(url, `repos/${slug}/contents/${NAMES_PATH}`);
    if (method === 'GET') {
      if (!store.has(slug)) return { code: 1, stdout: JSON.stringify({ message: 'Not Found', status: '404' }), stderr: 'gh: Not Found (HTTP 404)' };
      return { code: 0, stdout: JSON.stringify({ sha: sha(slug), content: Buffer.from(store.get(slug)!).toString('base64') }), stderr: '' };
    }
    if (opts.refuseWrite) return { code: 1, stdout: JSON.stringify({ message: opts.refuseWrite, status: '409' }), stderr: 'gh: Conflict (HTTP 409)' };
    if (conflict) {
      conflict = false;
      store.set(slug, namesFileText({ ...parseNamesFile(store.get(slug) ?? '{}'), 'other-agent.default': 'Set on the other Mac' }));
      return { code: 1, stdout: JSON.stringify({ message: 'names.json does not match', status: '409' }), stderr: 'gh: Conflict (HTTP 409)' };
    }
    if (store.has(slug) && field(args, 'sha') !== sha(slug)) return { code: 1, stdout: JSON.stringify({ message: 'sha mismatch', status: '409' }), stderr: 'gh: Conflict (HTTP 409)' };
    writes.push({ method, slug, message: field(args, 'message')! });
    if (method === 'DELETE') store.delete(slug);
    else store.set(slug, Buffer.from(field(args, 'content')!, 'base64').toString('utf8'));
    return { code: 0, stdout: JSON.stringify({ commit: { sha: `c${writes.length}` } }), stderr: '' };
  };
  return { run, store, writes };
}

test('FD-135: a GitHub address in any common form names its repository; another host or a path names none', () => {
  for (const url of ['https://github.com/example/example-agent', 'https://github.com/Example/example-agent.git', 'git@github.com:example/example-agent.git', 'git+https://github.com/example/example-agent'])
    assert.deepEqual(githubRepoOf(url), { owner: url.includes('Example') ? 'example' : 'example', repo: 'example-agent' }, url);
  for (const url of ['https://gitlab.com/example/example-agent', 'https://bitbucket.org/a/b', 'https://github.com/only-owner', 'not a url', '', undefined])
    assert.equal(githubRepoOf(url), null, String(url));
});

test('FD-135: a typed name is trimmed and folded; empty, control-only or longer than 80 characters is none', () => {
  assert.equal(cleanName('  Агент   экспериментов \n'), 'Агент экспериментов');
  assert.equal(cleanName('a\u0000b'), 'a b');
  assert.equal(cleanName('   '), null);
  assert.equal(cleanName('я'.repeat(80)), 'я'.repeat(80));
  assert.equal(cleanName('я'.repeat(81)), null);
  assert.equal(cleanName(42), null);
});

test('FD-135: the file is read leniently and written so a diff shows one line per name', () => {
  const text = namesFileText({ 'b-agent.default': 'B', 'a-agent.preview': 'A' });
  assert.equal(text, `{\n  "schema": "${NAMES_SCHEMA}",\n  "names": {\n    "a-agent.preview": "A",\n    "b-agent.default": "B"\n  }\n}\n`);
  assert.deepEqual(parseNamesFile(text), { 'a-agent.preview': 'A', 'b-agent.default': 'B' });
  assert.deepEqual(parseNamesFile(JSON.stringify({ schema: 'fabric-names/2', names: { 'a.default': 'A' } })), {}, 'another schema is no names');
  assert.deepEqual(parseNamesFile(JSON.stringify({ schema: NAMES_SCHEMA, names: { 'Bad Key': 'x', 'ok.default': '', 'fine.default': 7, 'good.default': ' G ' } })), { 'good.default': 'G' });
  assert.deepEqual(parseNamesFile('not json'), {});
});

test('FD-135: one GraphQL call reads every repository; one with no file has no names, one GitHub hides is an error', async () => {
  const gh = fakeGithub({ 'example/example-agent': namesFileText({ [KEY]: 'Агент экспериментов' }) }, { hidden: ['private/gone'] });
  const calls: string[][] = [];
  const read = await fetchNames(async (c, a) => { calls.push(a); return gh.run(c, a); }, '/fake/gh', [REPO, { owner: 'example', repo: 'no-file' }, { owner: 'private', repo: 'gone' }, REPO]);
  assert.equal(calls.length, 1, 'one call for every repository, the duplicate asked once');
  assert.deepEqual(read.get('example/example-agent'), { names: { [KEY]: 'Агент экспериментов' } });
  assert.deepEqual(read.get('example/no-file'), { names: {} });
  assert.match((read.get('private/gone') as { error: string }).error, /does not show private\/gone/);
});

test('FD-135: a rename creates the file, changes a name, gives a name back and removes the file when none is left', async () => {
  const gh = fakeGithub();
  const first = await putName(gh.run, '/fake/gh', REPO, KEY, '  Агент экспериментов ');
  assert.deepEqual(first, { ok: true, names: { [KEY]: 'Агент экспериментов' }, commit: 'c1' });
  assert.equal(gh.store.get('example/example-agent'), namesFileText({ [KEY]: 'Агент экспериментов' }));
  assert.match(gh.writes[0]!.message, /\[skip ci\]$/, 'a name is no reason to run the repository\'s CI');
  assert.deepEqual(await putName(gh.run, '/fake/gh', REPO, KEY, 'Агент экспериментов'), { ok: true, names: { [KEY]: 'Агент экспериментов' }, commit: null }, 'the same name commits nothing');
  await putName(gh.run, '/fake/gh', REPO, 'other.default', 'Other');
  await putName(gh.run, '/fake/gh', REPO, KEY, null);
  assert.deepEqual(parseNamesFile(gh.store.get('example/example-agent')!), { 'other.default': 'Other' });
  await putName(gh.run, '/fake/gh', REPO, 'other.default', null);
  assert.equal(gh.store.has('example/example-agent'), false, 'the last name gone, the file goes');
  assert.deepEqual(gh.writes.map((w) => w.method), ['PUT', 'PUT', 'PUT', 'DELETE']);
});

test('FD-135: a name set meanwhile on another Mac is kept: GitHub refuses the stale sha, and the change is made again on the new file', async () => {
  const gh = fakeGithub({ 'example/example-agent': namesFileText({}) }, { conflictOnce: true });
  const res = await putName(gh.run, '/fake/gh', REPO, KEY, 'Mine');
  assert.equal(res.ok, true);
  assert.deepEqual(parseNamesFile(gh.store.get('example/example-agent')!), { [KEY]: 'Mine', 'other-agent.default': 'Set on the other Mac' });
});

test('FD-135: a write GitHub refuses (a protected branch) is said in GitHub\'s words, and nothing is retried twice', async () => {
  const gh = fakeGithub({}, { refuseWrite: 'Repository rule violations found' });
  assert.deepEqual(await putName(gh.run, '/fake/gh', REPO, KEY, 'X'), { ok: false, error: 'Repository rule violations found' });
  assert.deepEqual(await putName(gh.run, '/fake/gh', REPO, 'Bad Key', 'X'), { ok: false, error: 'not a service key: Bad Key' });
  assert.match((await putName(gh.run, '/fake/gh', REPO, KEY, ' ')) .ok ? '' : 'refused', /refused/);
  assert.equal(ghFailure({ code: 1, stdout: '', stderr: 'gh: HTTP 401: Bad credentials\n' }), 'HTTP 401: Bad credentials');
});

test('FD-135: the store reads stale repositories once, keeps what it read, and does not ask again before its turn', async () => {
  const dir = tmp('fd-names-');
  const file = path.join(dir, 'agent-names.json');
  const gh = fakeGithub({ 'example/example-agent': namesFileText({ [KEY]: 'Named' }) });
  let now = Date.parse('2026-11-03T10:00:00Z');
  let calls = 0;
  let changes = 0;
  const store = new AgentNameStore({ file, run: async (c, a) => { calls++; return gh.run(c, a); }, gh: async () => '/fake/gh', now: () => now, onChange: () => changes++ });
  assert.deepEqual(store.stale([REPO], 30 * 60_000), [REPO], 'never read: due');
  await store.refresh([REPO]);
  assert.equal(store.name(KEY, DESCRIPTOR.source?.repository), 'Named');
  assert.equal(store.name(KEY, 'https://github.com/someone/else'), null, 'another repository cannot name this agent');
  assert.equal(changes, 1);
  assert.deepEqual(store.stale([REPO], 30 * 60_000), []);
  now += 30 * 60_000;
  assert.deepEqual(store.stale([REPO], 30 * 60_000), [REPO]);
  assert.equal(new AgentNameStore({ file, run: gh.run, gh: async () => null }).name(KEY, DESCRIPTOR.source?.repository), 'Named', 'a new start shows the cached name at once');
  // No gh: tried, not asked again before its turn, and nothing run.
  const none = new AgentNameStore({ file: path.join(dir, 'b.json'), run: async () => { throw new Error('ran'); }, gh: async () => null, now: () => now });
  await none.refresh([REPO]);
  assert.deepEqual(none.stale([REPO], 30 * 60_000), []);
  assert.equal(calls, 1);
});

test('FD-135: a rename shows at once; the reasons it cannot be saved come before GitHub is asked', async () => {
  const dir = tmp('fd-names-');
  const gh = fakeGithub();
  let changes = 0;
  const store = new AgentNameStore({ file: path.join(dir, 'agent-names.json'), run: gh.run, gh: async () => '/fake/gh', onChange: () => changes++ });
  assert.equal((await store.rename(KEY, DESCRIPTOR.source?.repository, 'Новое имя')).ok, true);
  assert.equal(store.name(KEY, DESCRIPTOR.source?.repository), 'Новое имя');
  assert.equal(changes, 1);
  assert.deepEqual(await store.rename(KEY, undefined, 'x'), { ok: false, refused: 'no-repository', error: 'the agent names no repository (source.repository)' });
  assert.equal((await store.rename(KEY, 'https://gitlab.com/a/b', 'x') as { refused?: string }).refused, 'not-github');
  const noGh = new AgentNameStore({ file: path.join(dir, 'c.json'), run: gh.run, gh: async () => null });
  assert.equal((await noGh.rename(KEY, DESCRIPTOR.source?.repository, 'x') as { refused?: string }).refused, 'no-gh');
  assert.equal(gh.writes.length, 1, 'the refusals asked GitHub nothing');
});

test('FD-135: a cache written by another process (the MCP server) is read again, and only then', async () => {
  const dir = tmp('fd-names-');
  const file = path.join(dir, 'agent-names.json');
  let changes = 0;
  const store = new AgentNameStore({ file, run: fakeGithub().run, gh: async () => '/fake/gh', onChange: () => changes++ });
  assert.equal(store.reloadIfChanged(), false);
  const other = new AgentNameStore({ file, run: fakeGithub().run, gh: async () => '/fake/gh' });
  await other.rename(KEY, DESCRIPTOR.source?.repository, 'From MCP');
  assert.equal(store.reloadIfChanged(), true);
  assert.equal(store.name(KEY, DESCRIPTOR.source?.repository), 'From MCP');
  assert.equal(changes, 1);
  assert.equal(store.reloadIfChanged(), false);
  assert.equal(customNameOf({ repos: {} }, KEY, DESCRIPTOR.source?.repository), null);
});

test('FD-135: the monitor shows the repository\'s name everywhere a name is read, and keeps the agent\'s own beside it', async () => {
  const base = tmp('fd-names-mon-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(DESCRIPTOR));
  let custom: string | null = 'Агент экспериментов';
  const runner = async (_c: string, args: string[]): Promise<RunResult> => (args[0] === 'print' ? { code: 0, stdout: `pid = ${READY.process.pid}\n`, stderr: '' } : { code: 0, stdout: '', stderr: '' });
  const monitor = new Monitor({ platform: 'darwin', servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en',
    launchd: new Launchd(runner, 501), wellKnown: async () => ({ kind: 'answer', doc: READY, ms: 3 }), customName: (key, repo) => (key === KEY && repo === DESCRIPTOR.source?.repository ? custom : null) });
  for (let i = 0; i < 5 && monitor.snapshot(KEY)?.state !== 'ready'; i++) await monitor.tick();
  let s = monitor.snapshot(KEY)!;
  assert.equal(s.descriptor?.name, 'Агент экспериментов');
  assert.equal(s.wellKnown?.service.name, 'Агент экспериментов'); // the answer's own name is replaced too
  assert.equal(s.agentName, DESCRIPTOR.name);
  assert.equal(s.descriptor?.source?.repository, DESCRIPTOR.source?.repository, 'the rest of the descriptor is the agent\'s');
  custom = null;
  monitor.namesChanged();
  s = monitor.snapshot(KEY)!;
  assert.equal(s.descriptor?.name, DESCRIPTOR.name);
  assert.equal(s.agentName, undefined);
});

test('FD-135: MCP rename commits to the agent\'s repository and list_services shows the name; null gives its own back', async () => {
  const dir = tmp('fd-names-mcp-');
  const services = path.join(dir, 'services');
  const userData = path.join(dir, 'app');
  fs.mkdirSync(services);
  fs.mkdirSync(userData);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(DESCRIPTOR));
  const gh = fakeGithub();
  const runner = async (_c: string, args: string[]): Promise<RunResult> => (args[0] === 'print' ? { code: 0, stdout: 'pid = 51234\n', stderr: '' } : { code: 0, stdout: '', stderr: '' });
  const deps = {
    servicesDir: () => services, settingsFile: () => path.join(userData, 'settings.json'), ghRun: gh.run, gh: async () => '/fake/gh',
    wellKnown: async () => ({ kind: 'answer' as const, doc: READY, ms: 3 }), launchd: new Launchd(runner, 501),
  } as unknown as tools.Deps;
  const out = await tools.rename(deps, KEY, 'Агент экспериментов');
  assert.deepEqual(out, { service: KEY, name: 'Агент экспериментов', own_name: DESCRIPTOR.name, repository: DESCRIPTOR.source!.repository!, commit: 'c1', changed: true });
  const listed = await tools.listServices(deps);
  assert.equal(listed.services.find((x) => x.key === KEY)?.name, 'Агент экспериментов');
  assert.equal((await tools.rename(deps, KEY, null)).name, DESCRIPTOR.name);
  await assert.rejects(tools.rename(deps, 'nobody.default', 'x'), /no installed service/);
});
