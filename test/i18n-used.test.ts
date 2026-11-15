// Wave 1 (C-05 of the 2026-11-15 audit): `console.handover` was removed from both dictionaries while the console still
// asked for it, and the window showed the key itself. Every literal key the window and the main process ask for exists.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { hasKey } from '../src/core/i18n';

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

test('every literal t(\'…\') key the code asks for exists in the dictionaries', () => {
  const missing: string[] = [];
  for (const f of [...files('src/renderer'), ...files('src/electron'), ...files('src/core')]) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/\bt\(\s*(?:lang\s*,\s*)?'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9-]+)+)'/g)) {
      if (!hasKey(m[1]!)) missing.push(`${path.relative('.', f)}: ${m[1]}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});
