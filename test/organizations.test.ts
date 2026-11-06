// FD-162, FD-163: each agent's organization from Project Observatory's registry, the organization filter, and the
// auditor's finding for a connection that crosses organizations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { addRegistryProjects, addSurveyPage, filterServices, keepsOrganization, organizationCounts, organizationOf, repositoryKey, type OrganizationsCache } from '../src/core/organizations';
import { OrganizationStore, readOrganizations } from '../src/core/organization-store';
import { merge as mergeSettings } from '../src/core/settings';
import { audit } from '../src/core/audit';
import { estateMap } from '../src/core/estate-map';
import { t } from '../src/core/i18n';

const PAGE_1 = {
  projects: [
    { id: 'project:a', organization: { name: 'acme', label: 'Acme' }, repositories: [{ nameWithOwner: 'acme-org/data-agent' }, { nameWithOwner: 'someone/data-agent' }] },
    { id: 'project:b', organization: { name: 'personal', label: 'personal' }, repositories: [{ nameWithOwner: 'someone/notes-agent' }] },
    { id: 'project:c', repositories: [{ nameWithOwner: 'someone/no-org' }] },
  ],
  nextCursor: 'project:b',
};
const PAGE_2 = { projects: [{ id: 'project:d', organization: { name: 'personal', label: 'personal' }, repositories: [{ nameWithOwner: 'someone/Observatory' }] }] };

test('FD-162: a repository key from every form a descriptor writes', () => {
  assert.equal(repositoryKey('https://github.com/acme-org/Data-Agent'), 'acme-org/data-agent');
  assert.equal(repositoryKey('https://github.com/acme-org/data-agent.git'), 'acme-org/data-agent');
  assert.equal(repositoryKey('git@github.com:someone/notes-agent.git'), 'someone/notes-agent');
  assert.equal(repositoryKey('someone/notes-agent'), 'someone/notes-agent');
  assert.equal(repositoryKey(''), null);
  assert.equal(repositoryKey(undefined), null);
});

test("FD-162: the survey's pages make the map; a project with no organization adds nothing", () => {
  const map: OrganizationsCache = { readAt: null, byRepository: {}, organizations: {} };
  assert.equal(addSurveyPage(map, PAGE_1), 'project:b');
  assert.equal(addSurveyPage(map, PAGE_2), null);
  assert.deepEqual(map.byRepository, { 'acme-org/data-agent': 'acme', 'someone/data-agent': 'acme', 'someone/notes-agent': 'personal', 'someone/observatory': 'personal' });
  assert.deepEqual(organizationOf(map, 'https://github.com/someone/data-agent'), { name: 'acme', label: 'Acme' }, 'a moved repository keeps its project');
  assert.equal(organizationOf(map, 'https://github.com/someone/no-org'), null, 'not known: never guessed');
  assert.equal(addSurveyPage(map, null), null);
});

test('FD-162: the filter keeps every agent, one organization or several, and the agent open on the page', () => {
  const s = [
    { key: 'a.default', organization: { name: 'acme', label: 'Acme' } },
    { key: 'b.default', organization: { name: 'personal', label: 'personal' } },
    { key: 'c.default', organization: null },
  ];
  assert.deepEqual(filterServices(s, []).map((x) => x.key), ['a.default', 'b.default', 'c.default']);
  assert.deepEqual(filterServices(s, ['acme']).map((x) => x.key), ['a.default']);
  assert.deepEqual(filterServices(s, ['acme', '']).map((x) => x.key), ['a.default', 'c.default'], "'' is not attributed");
  assert.deepEqual(filterServices(s, ['acme'], 'b.default').map((x) => x.key), ['a.default', 'b.default'], 'the open agent stays');
  assert.equal(keepsOrganization([], undefined), true);
  assert.deepEqual(organizationCounts(s), [{ name: 'acme', label: 'Acme', count: 1 }, { name: 'personal', label: 'personal', count: 1 }, { name: '', label: null, count: 1 }]);
  assert.deepEqual(organizationCounts([{ key: 'x' }]), [], 'no map read: no menu');
});

test('FD-162: the chosen organizations are kept in the settings, cleaned', () => {
  const s = mergeSettings({ layout: { list: { orgs: ['acme', '', 'acme', 'bad name!', 7] } } } as never);
  assert.deepEqual(s.layout.list.orgs, ['acme', '']);
  assert.deepEqual(mergeSettings({}).layout.list.orgs, []);
});

test('FD-162: the store reads every page, saves the map, keeps the last one when Observatory fails or is absent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-orgs-'));
  try {
    const file = path.join(dir, 'organizations.json');
    let mode: 'ok' | 'fail' | 'absent' = 'ok';
    const asked: (string | null)[] = [];
    const log: string[] = [];
    let changes = 0;
    let now = Date.parse('2026-11-06T13:00:00Z');
    const store = new OrganizationStore({
      file, log: (l) => log.push(l), onChange: () => { changes += 1; }, now: () => now,
      fetchPage: async (cursor) => { asked.push(cursor); if (mode === 'fail') throw new Error('initialize answered HTTP 401'); if (mode === 'absent') return null; return cursor ? PAGE_2 : PAGE_1; },
    });
    assert.equal(store.due(), true, 'never read');
    await store.refresh();
    assert.deepEqual(asked, [null, 'project:b']);
    assert.equal(changes, 1);
    assert.deepEqual(store.of('someone/notes-agent'), { name: 'personal', label: 'personal' });
    assert.equal(readOrganizations(file).byRepository['acme-org/data-agent'], 'acme', 'saved for the MCP server and the next start');
    assert.equal((fs.statSync(file).mode & 0o777).toString(8), process.platform === 'win32' ? (fs.statSync(file).mode & 0o777).toString(8) : '600');
    assert.equal(store.due(), false);
    now += 31 * 60_000;
    assert.equal(store.due(), true, 'read again after 30 minutes');
    mode = 'fail';
    await store.refresh();
    await store.refresh();
    assert.deepEqual(store.of('someone/notes-agent'), { name: 'personal', label: 'personal' }, 'a failed read keeps the last map');
    assert.equal(log.filter((l) => l.includes('could not be read')).length, 1, 'said once');
    mode = 'absent';
    await store.refresh();
    assert.match(log.at(-1) ?? '', /not here/);
    mode = 'ok';
    await store.refresh();
    assert.equal(changes, 1, 'the same map changes nothing');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const agent = (key: string, org: string | null, uses: string[] = []) => ({
  key, state: 'ready' as const, reasons: [],
  organization: org ? { name: org, label: org === 'acme' ? 'Acme' : org } : null,
  descriptor: { id: key.split('.')[0]!, instance: key.split('.')[1]!, name: key, origin: 'http://127.0.0.1:1', placement: 'local' } as never,
  wellKnown: {
    protocol: 'fabric-service/0.1', service: { id: key.split('.')[0]!, instance: key.split('.')[1]!, name: key, version: '1', build: { commit: 'x' } },
    process: { pid: 1, startedAt: '2026-11-06T00:00:00Z' }, status: 'ready', degraded: [], surfaces: { events: { path: '/e' } },
    extensions: { 'https://fabric.passioncode.ai/agent-contract/extensions/connections/0.1': { connections: uses.map((u) => ({ id: u, kind: 'service', target: u, state: 'ok' })) } },
  } as never,
});

test('FD-163: a connection to an agent of another organization is an error on the caller; an unknown one is not guessed', () => {
  const all = [agent('voc.default', 'acme', ['inbox.default', 'data.default', 'mystery.default']), agent('inbox.default', 'personal'), agent('data.default', 'acme'), agent('mystery.default', null)];
  const cross = audit(all).findings.filter((f) => f.reason.code === 'audit.connection.crossOrg');
  assert.deepEqual(cross.map((f) => [f.key, f.severity, f.reason.params]), [['voc.default', 'error', { name: 'inbox.default', theirs: 'personal', ours: 'Acme' }]]);
  assert.equal(audit(all.map((a) => ({ ...a, organization: undefined }))).findings.some((f) => f.reason.code === 'audit.connection.crossOrg'), false, 'no map: nothing told');
  assert.match(t('en', 'audit.connection.crossOrg', { name: 'Inbox', theirs: 'personal', ours: 'Acme' }), /work only with agents of the same organization/);
});

test('FD-162: a map scoped by the filter draws the shown agents and the ones they call, never "not installed"', () => {
  const all = [agent('voc.default', 'acme', ['inbox.default']), agent('inbox.default', 'personal'), agent('notes.default', 'personal')];
  const m = estateMap(all, new Set(['voc.default']));
  assert.deepEqual(m.nodes.map((n) => [n.id, n.missing]).sort(), [['inbox.default', false], ['voc.default', false]]);
  assert.deepEqual(m.edges.map((e) => `${e.from}>${e.to}`), ['voc.default>inbox.default']);
});

test("FD-162: Observatory's registry file, read without a token, comes first; the MCP survey is the fallback", async () => {
  const REGISTRY = {
    schema_version: 2,
    organization_labels: { acme: 'Acme' },
    projects: [
      { id: 'project:a', organization: 'acme', membership_rules: ['acme-org/data-agent: named in vault notes', 'someone/data-agent: repository name', 'data-agent: local folder, not a git repository'] },
      { id: 'project:b', organization: 'personal', membership_rules: ['someone/notes-agent: local folder name'] },
    ],
  };
  const map: OrganizationsCache = { readAt: null, byRepository: {}, organizations: {} };
  assert.equal(addRegistryProjects(map, REGISTRY), true);
  assert.deepEqual(map.byRepository, { 'acme-org/data-agent': 'acme', 'someone/data-agent': 'acme', 'someone/notes-agent': 'personal' });
  assert.deepEqual(map.organizations, { acme: 'Acme', personal: 'personal' }, 'a name without a label is shown as it is');
  assert.equal(addRegistryProjects(map, { schema_version: 3, projects: [] }), false, 'another schema is not read as this one');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-orgs-'));
  try {
    let pages = 0;
    let registry: unknown = REGISTRY;
    const store = new OrganizationStore({ file: path.join(dir, 'o.json'), log: () => undefined, onChange: () => undefined, readRegistry: () => registry,
      fetchPage: async (cursor) => { pages += 1; return cursor ? PAGE_2 : PAGE_1; } });
    await store.refresh();
    assert.equal(pages, 0, 'the file answered: the MCP surface is not asked');
    assert.deepEqual(store.of('someone/notes-agent'), { name: 'personal', label: 'personal' });
    registry = null;
    await store.refresh();
    assert.equal(pages, 2, 'no file: the survey');
    assert.deepEqual(store.of('acme-org/data-agent'), { name: 'acme', label: 'Acme' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
