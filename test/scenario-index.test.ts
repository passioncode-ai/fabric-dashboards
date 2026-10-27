// FD-02, UX-27: the index of docs/ux/scenarios.md and each scenario's own **Status:** line must agree. On 2026-10-22
// SCN-066 and on 2026-10-27 SCN-043 read `validated` in the index while their section still said `draft`, and both
// were found by comparing the two by hand.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/** Each scenario whose index row and section disagree on its status, as `<id>: index <a>, section <b>`. */
export function statusDrift(markdown: string): string[] {
  const index = new Map<string, string>();
  for (const line of markdown.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (/^SCN-\d+$/.test(cells[1] ?? '') && cells.length >= 8) index.set(cells[1]!, cells[6]!);
  }
  const sections = new Map<string, string>();
  for (const block of markdown.split(/^(?=### SCN-\d+:)/m)) {
    const id = /^### (SCN-\d+):/.exec(block)?.[1];
    if (id) sections.set(id, /\*\*Status:\*\*\s*([A-Za-z-]+)/.exec(block)?.[1] ?? '(none)');
  }
  const ids = [...new Set([...index.keys(), ...sections.keys()])].sort();
  return ids.filter((id) => index.get(id) !== sections.get(id))
    .map((id) => `${id}: index ${index.get(id) ?? '(none)'}, section ${sections.get(id) ?? '(none)'}`);
}

test('FD-02: every scenario carries the same status in the index and in its section', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ux', 'scenarios.md'), 'utf8');
  assert.ok(/^### SCN-001:/m.test(text), 'the scenarios have their sections');
  assert.deepEqual(statusDrift(text), []);
});

test('FD-02: the comparison names a drift, a missing section and a missing row', () => {
  const md = [
    '| SCN-001 | A | f | P-01 | ST-001 | validated | 2026-10-27 |',
    '| SCN-002 | B | f | P-01 | ST-001 | draft | 2026-10-27 |',
    '### SCN-001: A', '- **Status:** draft', '### SCN-003: C', '- **Status:** validated',
  ].join('\n');
  assert.deepEqual(statusDrift(md), [
    'SCN-001: index validated, section draft', 'SCN-002: index draft, section (none)', 'SCN-003: index (none), section validated',
  ]);
});
