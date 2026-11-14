// FD-197 (studio-agent's DEC-0052): an instance belongs to the organization of the context it runs in (its instance
// name, the Cloudflare account its Worker is deployed in, this space for a platform product), before its repository's owner.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { addRegistryProjects, EMPTY_ORGANIZATIONS, organizationOf, organizationOfInstance, OWN_REPOSITORY_OWNER, type OrganizationsCache } from '../src/core/organizations';
import { readOrganizations } from '../src/core/organization-store';
import { tmp } from './helpers';

const REGISTRY = {
  schema_version: 2,
  organization_labels: { acme: 'Acme', home: 'Home', vendor: 'Vendor.ai', idle: 'Idle Co' },
  organization_personal: 'home',
  organization_platform: ['vendor'],
  projects: [
    { organization: 'acme', membership_rules: ['acme-co/voc-agent: the repository'] },
    { organization: 'home', membership_rules: ['someone/support-bot: the repository'] },
    { organization: 'vendor', membership_rules: ['vendor-ai/inbox: the repository', 'vendor-ai/observatory: the repository'] },
  ],
  cloudflare_accounts: {
    accounts: [
      { id: 'cloudflare:account:1', organization: 'home' },
      { id: 'cloudflare:account:2', organization: 'acme' },
      { id: 'cloudflare:account:3', organization: null },
    ],
    resources: [
      { kind: 'worker', name: 'inbox', account_ref: 'cloudflare:account:1' },
      { kind: 'worker', name: 'acme-inbox', account_ref: 'cloudflare:account:2' },
      { kind: 'worker', name: 'relay', account_ref: 'cloudflare:account:1' },
      { kind: 'worker', name: 'relay', account_ref: 'cloudflare:account:2' },
      { kind: 'worker', name: 'orphan', account_ref: 'cloudflare:account:3' },
      { kind: 'zone', name: 'acme.example', account_ref: 'cloudflare:account:2' },
    ],
  },
};

function map(doc: unknown = REGISTRY): OrganizationsCache {
  const m: OrganizationsCache = { ...EMPTY_ORGANIZATIONS, byRepository: {}, organizations: {} };
  assert.equal(addRegistryProjects(m, doc), true);
  return m;
}
const repo = (r: string) => `https://github.com/${r}`;

test('FD-197: an online instance belongs to the organization of the Cloudflare account it is deployed in', () => {
  const m = map();
  assert.deepEqual(organizationOfInstance(m, { key: 'inbox.default', repository: repo('vendor-ai/inbox'), placement: 'remote', origin: 'https://inbox.someone.workers.dev' }),
    { name: 'home', label: 'Home', personal: true }, "the personal account's Worker: the personal organization, whoever publishes it");
  assert.deepEqual(organizationOfInstance(m, { key: 'inbox.cloud', repository: repo('vendor-ai/inbox'), placement: 'remote', origin: 'https://acme-inbox.acme-dev.workers.dev' }), { name: 'acme', label: 'Acme' });
  assert.deepEqual(organizationOfInstance(m, { key: 'voc-agent.cloud', repository: repo('someone/support-bot'), placement: 'remote', origin: 'https://voc.api.acme.example' }),
    { name: 'home', label: 'Home', personal: true }, "a custom domain's zone is not a deployment: the repository decides");
});

test('FD-197: a Worker name in two accounts, or an account Observatory does not attribute, falls back to the repository', () => {
  const m = map();
  assert.deepEqual(organizationOfInstance(m, { key: 'inbox.relay', repository: repo('vendor-ai/inbox'), placement: 'remote', origin: 'https://relay.someone.workers.dev' }), { name: 'vendor', label: 'Vendor.ai' }, 'never guessed between two accounts');
  assert.deepEqual(organizationOfInstance(m, { key: 'inbox.orphan', repository: repo('vendor-ai/inbox'), placement: 'remote', origin: 'https://orphan.x.workers.dev' }), { name: 'vendor', label: 'Vendor.ai' });
  assert.equal(organizationOfInstance(m, { key: 'x.default', repository: repo('unknown/x'), placement: 'remote', origin: 'not a url' }), null);
});

test("FD-197: a platform product on this Mac runs in this space, so it is this space's organization; another product keeps its repository's", () => {
  const m = map();
  assert.deepEqual(organizationOfInstance(m, { key: 'project-observatory.default', repository: repo('vendor-ai/observatory'), placement: 'local' }), { name: 'home', label: 'Home', personal: true });
  assert.deepEqual(organizationOfInstance(m, { key: 'voc-agent.default', repository: repo('acme-co/voc-agent'), placement: 'local' }), { name: 'acme', label: 'Acme' }, "an organization's own agent on this Mac stays its organization's");
  const unmarked = map({ ...REGISTRY, organization_platform: [] });
  assert.deepEqual(organizationOfInstance(unmarked, { key: 'project-observatory.default', repository: repo('vendor-ai/observatory'), placement: 'local' }), { name: 'vendor', label: 'Vendor.ai' }, 'no platform named: the repository decides');
});

test('FD-197: an instance named after an organization is that organization\'s, even one with no project of its own', () => {
  const m = map();
  assert.deepEqual(organizationOfInstance(m, { key: 'observatory.acme', repository: repo('vendor-ai/observatory'), placement: 'local' }), { name: 'acme', label: 'Acme' });
  assert.deepEqual(organizationOfInstance(m, { key: 'support-bot.idle', repository: repo('someone/support-bot'), placement: 'remote', origin: 'https://inbox.someone.workers.dev' }), { name: 'idle', label: 'Idle Co' }, 'the name wins over the account');
  assert.deepEqual(organizationOf(m, repo('someone/support-bot')), { name: 'home', label: 'Home', personal: true }, 'the repository map itself is unchanged');
});

test('FD-197: the instance context survives the saved map, and the platform owner is this repository\'s', () => {
  const file = path.join(tmp('fd-org-ctx-'), 'organizations.json');
  fs.writeFileSync(file, JSON.stringify({ ...map(), readAt: '2026-11-10T09:00:00Z' }));
  const back = readOrganizations(file);
  assert.deepEqual(back.platform, ['vendor']);
  assert.deepEqual(back.byWorker, { inbox: 'home', 'acme-inbox': 'acme' });
  assert.equal('byZone' in back, false);
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as { repository: { url: string } };
  assert.match(pkg.repository.url, new RegExp(`github\\.com/${OWN_REPOSITORY_OWNER}/`));
});

test("FD-252: only a product the platform installs in every organization moves to this space; the platform organization's own agents stay its own", () => {
  const m = map();
  assert.deepEqual(organizationOfInstance(m, { key: 'fabric-inbox.default', repository: repo('vendor-ai/inbox'), placement: 'local' }), { name: 'home', label: 'Home', personal: true });
  assert.deepEqual(organizationOfInstance(m, { key: 'admin-agent.admin', repository: repo('vendor-ai/inbox'), placement: 'local' }), { name: 'vendor', label: 'Vendor.ai' }, "an agent of the platform's organization is that organization's, wherever it runs");
  const listed = map({ ...REGISTRY, platform_products: ['admin-agent'] });
  assert.deepEqual(organizationOfInstance(listed, { key: 'admin-agent.admin', repository: repo('vendor-ai/inbox'), placement: 'local' }), { name: 'home', label: 'Home', personal: true }, "the registry's own list wins over the default one");
  assert.deepEqual(organizationOfInstance(listed, { key: 'project-observatory.default', repository: repo('vendor-ai/observatory'), placement: 'local' }), { name: 'vendor', label: 'Vendor.ai' });
});
