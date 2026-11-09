// FD-195 (SCN-094 steps 7 to 9): the agent list's filter by Mine, Other organizations and Shared between organizations,
// beside each organization; the personal organization is the one Project Observatory's config marks `default: true`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { addRegistryProjects, EMPTY_ORGANIZATIONS, filterServices, keepsOrganization, kindCounts, organizationOf, ORG_MINE, ORG_OTHERS, ORG_SHARED, sharedProducts, type Organization } from '../src/core/organizations';
import { merge } from '../src/core/settings';

const mine: Organization = { name: 'home', label: 'Home', personal: true };
const acme: Organization = { name: 'acme', label: 'Acme' };
const agents = [
  { key: 'copy-agent.home', organization: mine },
  { key: 'copy-agent.acme', organization: acme }, // one product in two organizations: shared
  { key: 'bot.default', organization: acme },
  { key: 'mail.default', organization: mine },
  { key: 'tool.default', organization: null }, // not attributed
];

test('FD-195: the personal organization is the one Observatory marks default; its agents read personal', () => {
  const cache = structuredClone(EMPTY_ORGANIZATIONS);
  assert.ok(addRegistryProjects(cache, { schema_version: 2, organization_personal: 'home', organization_labels: { home: 'Home', acme: 'Acme' },
    projects: [{ organization: 'home', membership_rules: ['me/mail: mine'] }, { organization: 'acme', membership_rules: ['acme-co/bot: theirs'] }] }));
  assert.equal(cache.personal, 'home');
  assert.deepEqual(organizationOf(cache, 'https://github.com/me/mail'), { name: 'home', label: 'Home', personal: true });
  assert.deepEqual(organizationOf(cache, 'acme-co/bot'), { name: 'acme', label: 'Acme' }, 'another organization carries no flag');
});

test('FD-195: Mine, Other organizations and Shared keep their agents, and combine with names as a union', () => {
  const keys = (chosen: string[]) => filterServices(agents, chosen).map((s) => s.key);
  assert.deepEqual(keys([ORG_MINE]), ['copy-agent.home', 'mail.default']);
  assert.deepEqual(keys([ORG_OTHERS]), ['copy-agent.acme', 'bot.default'], 'not attributed is no other organization');
  assert.deepEqual(keys([ORG_SHARED]), ['copy-agent.home', 'copy-agent.acme']);
  assert.deepEqual(keys([ORG_MINE, '']), ['copy-agent.home', 'mail.default', 'tool.default']);
  assert.deepEqual(keys([ORG_SHARED, 'acme']), ['copy-agent.home', 'copy-agent.acme', 'bot.default']);
  assert.deepEqual(keys([]), agents.map((a) => a.key), 'nothing chosen: every agent');
  assert.deepEqual(filterServices(agents, [ORG_MINE], 'bot.default').map((s) => s.key), ['copy-agent.home', 'bot.default', 'mail.default'], 'the agent open on the page stays');
  assert.equal(keepsOrganization([ORG_MINE], acme), false);
});

test('FD-195: the kinds count their agents; Mine is unknown while no personal organization is known', () => {
  assert.deepEqual(kindCounts(agents), { mine: 2, others: 2, shared: 2 });
  assert.deepEqual([...sharedProducts(agents)], ['copy-agent']);
  assert.equal(kindCounts(agents.map((a) => ({ ...a, organization: a.organization ? { name: a.organization.name, label: a.organization.label } : null }))).mine, null);
});

test('FD-195: the kinds are kept in the settings, any other @ word dropped', () => {
  const l = merge({ layout: { list: { orgs: ['@mine', '@others', '@shared', 'acme', '', '@nope'] } } } as never).layout.list;
  assert.deepEqual(l.orgs, ['@mine', '@others', '@shared', 'acme', '']);
});
