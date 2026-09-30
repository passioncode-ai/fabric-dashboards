// The code-region gate (scripts/check-regions.mjs): a marker must close and its docs reference
// must open — watched failing on each planted defect, passing on the good file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { tmp } from './helpers';

test('check-regions: closed markers with resolving references pass; each defect is named', async () => {
  const { checkRegions } = await import('../scripts/check-regions.mjs');
  const root = tmp('fd-regions-');
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs/a.md'), '# A\n\n## Decision\n\ntext\n');
  const write = (name: string, text: string) => { fs.writeFileSync(path.join(root, name), text); return name; };
  const good = write('good.ts', '// #region feature — docs: docs/a.md#decision\nx();\n// #endregion feature\n');
  assert.deepEqual(checkRegions({ root, files: [good] }), { findings: [], regions: 1 });
  const cases: [string, string, string][] = [
    ['anchor.ts', '// #region feature — docs: docs/a.md#nowhere\n// #endregion feature\n', 'anchor-missing'],
    ['file.ts', '// #region feature — docs: docs/b.md#decision\n// #endregion feature\n', 'doc-missing'],
    ['open.ts', '// #region feature — docs: docs/a.md#decision\nx();\n', 'unclosed'],
    ['orphan.ts', 'x();\n// #endregion feature\n', 'end-without-start'],
    ['bare.ts', '// #region feature\n// #endregion feature\n', 'no-docs-reference'],
  ];
  for (const [name, text, code] of cases) {
    const { findings } = checkRegions({ root, files: [write(name, text)] });
    assert.deepEqual(findings.map((f: { code: string }) => f.code), [code], name);
  }
});
