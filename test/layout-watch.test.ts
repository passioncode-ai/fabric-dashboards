// FD-274: the embedded dashboard follows its slot when something above it grows (the task line could not be clicked).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { elementsAbove, type TreeNode } from '../src/renderer/layout-watch';

type N = TreeNode & { name: string };
function node(name: string, parent: N | null, previous: N | null = null): N { return { name, parentElement: parent, previousElementSibling: previous }; }

test('FD-274: the elements watched are every previous sibling of the slot and of each ancestor, up to the stop', () => {
  const body = node('body', null);
  const main = node('main', body, node('sidebar', body));
  const header = node('svc-head', main);
  const tabs = node('tabs', main, header);
  const bodyPane = node('svc-body', main, tabs);
  const toolbar = node('toolbar', bodyPane);
  const slot = node('dash-host', bodyPane, toolbar);
  assert.deepEqual(elementsAbove(slot, body).map((n) => n.name), ['toolbar', 'tabs', 'svc-head', 'sidebar']);
  assert.deepEqual(elementsAbove(slot, main).map((n) => n.name), ['toolbar', 'tabs', 'svc-head']);
  assert.equal(elementsAbove(slot, body, 2).length, 2, 'bounded');
});

test('FD-274: the dashboard host observes what is above it, not only its own size', () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, '..', 'src/renderer/components/ServiceView.tsx'), 'utf8');
  assert.match(src, /for \(const above of elementsAbove\(el, document\.body\)\) observer\.observe\(above\);/);
});
