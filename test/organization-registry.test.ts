import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readObservatoryRegistry } from '../src/core/organization-store';

// FD-302 (refactor wave 2): the registry reader moved out of main.ts keeps what it read there.
test('FD-302: readObservatoryRegistry adds the config\'s labels, the personal and platform organizations and Cloudflare accounts', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-registry-'));
  const base = path.join(data, 'project-observatory-full');
  fs.mkdirSync(path.join(base, 'registry'), { recursive: true });
  fs.mkdirSync(path.join(base, 'config'), { recursive: true });
  assert.equal(readObservatoryRegistry(data, { XDG_DATA_HOME: data }), null, 'no projects.json: null');
  fs.writeFileSync(path.join(base, 'registry', 'projects.json'), JSON.stringify({ schema: 2, projects: [] }));
  assert.deepEqual(readObservatoryRegistry(data, { XDG_DATA_HOME: data }), { schema: 2, projects: [] }, 'no config: the projects as they are');
  fs.writeFileSync(path.join(base, 'config', 'organizations.json'), JSON.stringify({ organizations: {
    me: { label: 'Me', default: true }, pc: { label: 'PC', match: { repository_owners: ['PassionCode-AI'] } }, acme: { label: 'Acme' } } }));
  fs.writeFileSync(path.join(base, 'registry', 'cloudflare-account.json'), JSON.stringify({ a1: 'acme' }));
  const r = readObservatoryRegistry(data, { XDG_DATA_HOME: data })!;
  assert.deepEqual(r.organization_labels, { me: 'Me', pc: 'PC', acme: 'Acme' });
  assert.equal(r.organization_personal, 'me');
  assert.deepEqual(r.organization_platform, ['pc'], 'the owner of this app\'s repository, case-insensitive');
  assert.deepEqual(r.cloudflare_accounts, { a1: 'acme' });
  fs.writeFileSync(path.join(base, 'config', 'organizations.json'), JSON.stringify({ organizations: { pc: { platform: true }, acme: { platform: true } } }));
  assert.deepEqual(readObservatoryRegistry(data, { XDG_DATA_HOME: data })!.organization_platform, ['pc', 'acme'], 'marked platform wins');
  fs.rmSync(data, { recursive: true, force: true });
});
