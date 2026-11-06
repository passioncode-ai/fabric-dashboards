// FD-161: who installed an agent, read from its descriptor's installedBy (contract DEC-0061).
import assert from 'node:assert/strict';
import test from 'node:test';
import { installedByWords } from '../src/core/installed-by';
import { t } from '../src/core/i18n';

test('FD-161: installedBy reads as who installed the agent, by role and never by name', () => {
  const words = (v: unknown) => installedByWords({ installedBy: v as never });
  assert.deepEqual(words({ by: 'person', role: 'operator', tool: 'passioncode 0.2.76' }), { code: 'installedBy.operator', params: { tool: 'passioncode 0.2.76' } });
  assert.deepEqual(words({ by: 'person', role: 'administrator', tool: 'x 1' }), { code: 'installedBy.administrator', params: { tool: 'x 1' } });
  assert.deepEqual(words({ by: 'person', tool: 'x 1' }), { code: 'installedBy.person', params: { tool: 'x 1' } });
  assert.deepEqual(words({ by: 'node', tool: 'project-observatory 0.34.0' }), { code: 'installedBy.node', params: { tool: 'project-observatory 0.34.0' } });
  assert.deepEqual(words({ by: 'organization', tool: 'project-observatory 0.34.0' }), { code: 'installedBy.organization', params: { tool: 'project-observatory 0.34.0' } });
  assert.deepEqual(words('example-agent install'), { code: 'installedBy.tool', params: { tool: 'example-agent install' } }, 'the older form: the installer as the service wrote it');
  assert.deepEqual(words({ by: 'robot', tool: 'x 1' }), { code: 'installedBy.tool', params: { tool: 'x 1' } }, 'an unknown kind shows only the tool');
  assert.equal(words(''), null);
  assert.equal(words(undefined), null);
  assert.equal(installedByWords(null), null);
});

test('FD-161: the words in English and Russian', () => {
  assert.equal(t('en', 'installedBy.operator', { tool: 'passioncode 0.2.76' }), 'you, with passioncode 0.2.76');
  assert.equal(t('ru', 'installedBy.organization', { tool: 'project-observatory 0.34.0' }), 'Project Observatory по списку агентов организации (project-observatory 0.34.0)');
});
