// FD-162, FD-163: each agent's organization from Project Observatory's registry, the organization filter, and the
// auditor's finding for a connection that crosses organizations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { addRegistryProjects, addSurveyPage, filterServices, groupByOrganization, keepsOrganization, organizationCounts, organizationOf, repositoryKey, type OrganizationsCache } from '../src/core/organizations';
import { OrganizationStore, readOrganizations } from '../src/core/organization-store';
import { merge as mergeSettings } from '../src/core/settings';
import { audit } from '../src/core/audit';
import { estateMap } from '../src/core/estate-map';
import { t } from '../src/core/i18n';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentsNav } from '../src/renderer/components/Navigation';
import { arrangeProducts, groupProducts } from '../src/core/products';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { snap } from './snap';

(globalThis as { React?: unknown }).React = React; // the components' classic JSX, as the other render tests do

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

test('FD-161: a section split by organization keeps the sort inside each group, "Not attributed" last; one organization is not split', () => {
  const p = (id: string, org: string | null) => ({ id, primary: { organization: org ? { name: org, label: org[0]!.toUpperCase() + org.slice(1) } : null } });
  const rows = [p('zeta', 'personal'), p('alpha', 'acme'), p('beta', null), p('gamma', 'acme'), p('delta', 'personal')];
  const groups = groupByOrganization(rows)!;
  assert.deepEqual(groups.map((g) => [g.name, g.label, g.rows.map((r) => r.id)]), [
    ['acme', 'Acme', ['alpha', 'gamma']],
    ['personal', 'Personal', ['zeta', 'delta']],
    ['', null, ['beta']],
  ], 'by label, the person\'s order inside each, not attributed last');
  assert.equal(groupByOrganization([p('a', 'acme'), p('b', 'acme')]), null, 'one organization: nothing to split');
  assert.equal(groupByOrganization([{ id: 'x', primary: {} }, { id: 'y', primary: {} }]), null, 'no map read: nothing to split');
  assert.equal(t('en', 'orgs.group'), 'Group by organization');
  assert.equal(t('ru', 'orgs.group'), 'Группировать по организациям');
});

test('FD-161: the grouping is kept in the settings; anything but true is off', () => {
  assert.equal(mergeSettings({ layout: { list: { groupByOrg: true } } }).layout.list.groupByOrg, true);
  assert.equal(mergeSettings({ layout: { list: { groupByOrg: 'yes' } } }).layout.list.groupByOrg, false);
  assert.equal(mergeSettings({}).layout.list.groupByOrg, false);
});

test('FD-161: grouped, each section reads a small heading per organization and no row is dragged; off, the list is as before', () => {
  const services = [
    { ...snap('alpha.default', 'ready'), organization: { name: 'acme', label: 'Acme' } },
    { ...snap('bravo.default', 'ready'), organization: { name: 'personal', label: 'Personal' } },
    { ...snap('charlie.default', 'ready'), organization: null },
  ];
  const render = (groupByOrg: boolean) => {
    const ps = groupProducts(services);
    const layout = { ...DEFAULT_SETTINGS.layout, list: { ...DEFAULT_SETTINGS.layout.list, groupByOrg } };
    const noop = () => undefined;
    return renderToStaticMarkup(React.createElement(AgentsNav, {
      page: 'overview', status: { services, off: [], unread: 0 } as never, arranged: arrangeProducts(ps, layout.list), products: ps, currentProduct: undefined, layout, changeLayout: noop,
      open: noop, go: noop, rail: false, queue: 0, urgent: false, auditErrors: 0, hiddenProblem: false,
      menu: { pin: noop, hide: noop, setOff: noop, kind: noop, isPinned: () => false, isHidden: () => false, isService: () => false },
    }));
  };
  const on = render(true);
  const headings = [...on.matchAll(/<div class="nav-subsection" aria-hidden="true">([^<]+)<\/div>/g)].map((m) => m[1]);
  assert.deepEqual(headings, ['Acme', 'Personal', 'Not attributed']);
  assert.doesNotMatch(on, /draggable="true"/, 'no drag across a heading');
  assert.match(on, /Group by organization/);
  const off = render(false);
  assert.doesNotMatch(off, /nav-subsection/);
  assert.match(off, /draggable="true"/, 'off: the rows drag as before');
});

// FD-237 (the operator, 2026-11-14): the list cut by one source at a time, the organizations or the GitHub owners.
const withRepo = (key: string, repository: string | null, organization: { name: string; label: string; personal?: boolean } | null) => {
  const s = snap(key, 'ready');
  return { ...s, organization, descriptor: { ...s.descriptor!, source: repository ? { repository } : undefined } } as typeof s;
};

test('FD-237: a GitHub owner is read from the repository and is a filter value of its own (gh:owner)', async () => {
  const { githubOwnerOf } = await import('../src/core/organizations');
  assert.deepEqual(githubOwnerOf('https://github.com/Example-Org/agent-bot.git'), { name: 'gh:example-org', label: 'Example-Org' });
  assert.deepEqual(githubOwnerOf('git@github.com:someone/tool.git'), { name: 'gh:someone', label: 'someone' });
  assert.deepEqual(githubOwnerOf('acme-co/fabric'), { name: 'gh:acme-co', label: 'acme-co' });
  assert.equal(githubOwnerOf('https://gitlab.com/acme/x'), null, 'another host is no GitHub owner');
  assert.equal(githubOwnerOf(null), null);
});

test('FD-237: the filter, the counts and the grouping follow the chosen source; the other source\'s values keep nothing', () => {
  const services = [
    withRepo('alpha.default', 'https://github.com/acme-co/alpha', { name: 'acme', label: 'Acme' }),
    withRepo('bravo.default', 'https://github.com/me/bravo', { name: 'personal', label: 'Personal', personal: true }),
    withRepo('charlie.default', 'https://github.com/acme-co/charlie', { name: 'personal', label: 'Personal', personal: true }),
    withRepo('delta.default', null, null),
  ];
  assert.deepEqual(organizationCounts(services, 'github').map((r) => [r.name, r.count]), [['gh:acme-co', 2], ['gh:me', 1], ['', 1]]);
  assert.deepEqual(organizationCounts(services, 'org').map((r) => [r.name, r.count, r.personal ?? false]), [['acme', 1, false], ['personal', 2, true], ['', 1, false]]);
  assert.deepEqual(filterServices(services, ['gh:acme-co'], null, 'github').map((s) => s.key), ['alpha.default', 'charlie.default']);
  assert.deepEqual(filterServices(services, ['acme'], null, 'github').map((s) => s.key), [], 'an organization name means nothing under GitHub');
  assert.deepEqual(filterServices(services, ['gh:acme-co'], 'delta.default', 'org').map((s) => s.key), ['delta.default'], 'the open agent stays; a gh: value keeps nothing under organizations');
  const groups = groupByOrganization(services.map((s) => ({ primary: s })), 'github');
  assert.deepEqual(groups?.map((g) => [g.label, g.rows.length]), [['acme-co', 2], ['me', 1], [null, 1]]);
});

test('FD-237: the source is kept in the settings (org by default), and gh: names are valid filter values', () => {
  assert.equal(mergeSettings({}).layout.list.orgSource, 'org');
  assert.equal(mergeSettings({ layout: { list: { orgSource: 'github' } } }).layout.list.orgSource, 'github');
  assert.equal(mergeSettings({ layout: { list: { orgSource: 'gitlab' } } }).layout.list.orgSource, 'org');
  assert.deepEqual(mergeSettings({ layout: { list: { orgs: ['gh:acme-co', 'gh:', 'gh:x/y', 'acme', '@mine'] } } }).layout.list.orgs, ['gh:acme-co', 'acme', '@mine']);
});

test('FD-237: the menu offers both sources, rows with counts and the person\'s own organization tagged; no Mine / Others / Shared rows', () => {
  const services = [
    withRepo('alpha.default', 'https://github.com/acme-co/alpha', { name: 'acme', label: 'Acme' }),
    withRepo('bravo.default', 'https://github.com/me/bravo', { name: 'personal', label: 'Personal', personal: true }),
    withRepo('charlie.default', 'https://github.com/acme-co/charlie', { name: 'personal', label: 'Personal', personal: true }),
  ];
  const render = (orgSource: 'org' | 'github', orgs: string[] = []) => {
    const ps = groupProducts(services);
    const layout = { ...DEFAULT_SETTINGS.layout, list: { ...DEFAULT_SETTINGS.layout.list, orgSource, orgs } };
    const noop = () => undefined;
    return renderToStaticMarkup(React.createElement(AgentsNav, {
      page: 'overview', status: { services, off: [], unread: 0 } as never, everyAgent: services, arranged: arrangeProducts(ps, layout.list), products: ps, currentProduct: undefined, layout, changeLayout: noop,
      open: noop, go: noop, rail: false, queue: 0, urgent: false, auditErrors: 0, hiddenProblem: false,
      menu: { pin: noop, hide: noop, setOff: noop, kind: noop, isPinned: () => false, isHidden: () => false, isService: () => false },
    } as never));
  };
  const org = render('org');
  assert.match(org, /role="radio" aria-checked="true"[^>]*>Organizations</);
  assert.match(org, /role="radio" aria-checked="false"[^>]*>GitHub</);
  assert.match(org, /Personal<span class="org-tag">yours<\/span>/);
  assert.doesNotMatch(org, />Mine<|>Other organizations<|>Shared between organizations</);
  const gh = render('github');
  assert.match(gh, />GitHub: all</);
  assert.match(render('org', ['acme']), /title="Organizations: Acme"/, 'the hover text is the button\'s own label');
  assert.match(gh, />acme-co<\/span><span class="count">2</);
  assert.match(gh, /Group by GitHub owner/);
  assert.match(render('org', ['@mine']), />Mine<\/span><span class="count">2</, 'a kind chosen before stays visible to clear, with what it keeps');
});

test('FD-237 (verifier): no source is a dead end; the other one is offered whenever it tells two or more apart', () => {
  const noop = () => undefined;
  const render = (services: ReturnType<typeof withRepo>[], orgSource: 'org' | 'github') => {
    const ps = groupProducts(services);
    const layout = { ...DEFAULT_SETTINGS.layout, list: { ...DEFAULT_SETTINGS.layout.list, orgSource } };
    return renderToStaticMarkup(React.createElement(AgentsNav, {
      page: 'overview', status: { services, off: [], unread: 0 } as never, everyAgent: services, arranged: arrangeProducts(ps, layout.list), products: ps, currentProduct: undefined, layout, changeLayout: noop,
      open: noop, go: noop, rail: false, queue: 0, urgent: false, auditErrors: 0, hiddenProblem: false,
      menu: { pin: noop, hide: noop, setOff: noop, kind: noop, isPinned: () => false, isHidden: () => false, isService: () => false },
    } as never));
  };
  const noMap = [withRepo('alpha.default', 'https://github.com/acme/a', null), withRepo('bravo.default', 'https://github.com/me/b', null)].map((s) => ({ ...s, organization: undefined })) as never;
  assert.match(render(noMap, 'org'), /role="radio" aria-checked="false"[^>]*>GitHub</, 'no map: GitHub is still reachable');
  const oneOwner = [withRepo('alpha.default', 'https://github.com/acme/a', { name: 'p', label: 'P' }), withRepo('bravo.default', 'https://github.com/acme/b', { name: 'q', label: 'Q' })];
  assert.match(render(oneOwner, 'github'), /role="radio" aria-checked="false"[^>]*>Organizations</, 'one GitHub owner left: the way back to Organizations stays');
});

test('FD-237 (verifier): a source change clears the choice it does not own, and MCP refuses an unknown source', async () => {
  const { SettingsStore, agentSettingsPatch } = await import('../src/core/settings');
  const store = new SettingsStore(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-237-')));
  store.update({ layout: { list: { orgs: ['acme'] } } });
  assert.deepEqual(store.update({ layout: { list: { orgSource: 'github' } } }).layout.list.orgs, []);
  assert.deepEqual(store.update({ layout: { list: { orgs: ['gh:acme'] } } }).layout.list.orgs, ['gh:acme'], 'a choice in the same source is kept');
  assert.deepEqual(store.update({ layout: { list: { orgSource: 'github', orgs: ['gh:me'] } } }).layout.list.orgs, ['gh:me']);
  const r = agentSettingsPatch({ layout: { list: { orgSource: 'gitlab' } } });
  assert.ok(r.refused.includes('layout.list.orgSource'));
});

test('FD-237 (verifier): the GitHub owner is the first path segment after the host, its case kept for the label', async () => {
  const { githubOwnerOf } = await import('../src/core/organizations');
  assert.deepEqual(githubOwnerOf('https://github.com/Acme/mono/tree/main/agents/x'), { name: 'gh:acme', label: 'Acme' });
  assert.deepEqual(githubOwnerOf('https://github.com/acme'), { name: 'gh:acme', label: 'acme' });
  assert.equal(githubOwnerOf('ssh://git@github.com/acme/x.git')?.name, 'gh:acme');
  assert.equal(githubOwnerOf('git+https://github.com/acme/x.git')?.name, 'gh:acme');
  assert.equal(githubOwnerOf('https://github.com.evil.example/acme/x'), null);
});

test('FD-237 (verifier round 3): gh: values compare without case, a refused source refuses its choice, GitHub pages name no owner', async () => {
  const { githubOwnerOf } = await import('../src/core/organizations');
  const { agentSettingsPatch } = await import('../src/core/settings');
  const services = [withRepo('alpha.default', 'https://github.com/Example-Org/alpha', null), withRepo('bravo.default', 'https://github.com/me/bravo', null)];
  assert.deepEqual(filterServices(services, ['gh:Example-Org'], null, 'github').map((s) => s.key), ['alpha.default']);
  assert.deepEqual(mergeSettings({ layout: { list: { orgs: ['gh:Acme', 'gh:acme', 'Acme'] } } }).layout.list.orgs, ['gh:acme', 'Acme'], 'gh: is kept in lower case, an organization name as written');
  const r = agentSettingsPatch({ layout: { list: { orgSource: 'GITHUB', orgs: ['gh:x'] } } });
  assert.ok(r.refused.includes('layout.list.orgs'), 'the choice sent with a refused source is refused too');
  assert.equal(githubOwnerOf('github.com/acme/x')?.name, 'gh:acme');
  assert.equal(githubOwnerOf('https://www.github.com/acme/x')?.name, 'gh:acme');
  assert.equal(githubOwnerOf('https://github.com/acme?tab=repositories')?.name, 'gh:acme');
  assert.equal(githubOwnerOf('https://github.com/orgs/acme'), null);
  assert.equal(githubOwnerOf('https://github.com/sponsors/acme'), null);
});

test('FD-238 (verifier rounds 3 and 4): a spend cell reads as a word whenever no report was read, failures included', async () => {
  const { spendIsWord } = await import('../src/renderer/components/Overview');
  const report = (costUsd: number | null) => ({ kind: 'report', summary: { today: { calls: 3, inputTokens: 0, outputTokens: 0, costUsd, subscriptionCalls: 0 }, month: { calls: 3, inputTokens: 0, outputTokens: 0, costUsd, subscriptionCalls: 0 } } }) as never;
  assert.equal(spendIsWord(null, 'today'), false, 'still reading: the spinner');
  assert.equal(spendIsWord([], 'today'), true);
  assert.equal(spendIsWord([{ kind: 'error' } as never], 'today'), true, '"unknown" is a word too');
  assert.equal(spendIsWord([report(1.5)], 'month'), false, 'a sum');
  assert.equal(spendIsWord([report(null)], 'month'), true, 'every call unpriced: "unknown"');
});

test('FD-237 (verifier rounds 5 and 6): an unknown source sent to the store keeps the choice; owners may carry _', async () => {
  const { SettingsStore } = await import('../src/core/settings');
  const { githubOwnerOf } = await import('../src/core/organizations');
  const store = new SettingsStore(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-237-')));
  store.update({ layout: { list: { orgs: ['acme'] } } });
  assert.deepEqual(store.update({ layout: { list: { orgSource: 'bogus' as never } } }).layout.list.orgs, ['acme']);
  assert.equal(githubOwnerOf('https://github.com/acme_emu/x')?.name, 'gh:acme_emu');
});
