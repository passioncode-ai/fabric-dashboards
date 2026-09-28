// Rejects drift: every vendored brand file must hash to the pinned value in
// docs/brand-source.json, and the pinned bytes must be the canonical ones.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pin = JSON.parse(readFileSync(path.join(root, 'docs/brand-source.json'), 'utf8'));
let failed = 0;
for (const f of pin.files) {
  const actual = createHash('sha256').update(readFileSync(path.join(root, f.copy))).digest('hex');
  if (actual !== f.sha256) {
    console.error(`FAIL ${f.copy}: sha256 ${actual} differs from the pinned ${f.sha256} (${f.source}@${f.commit}). Re-copy the canonical file and repin; never edit it here.`);
    failed += 1;
  }
}
if (failed) process.exit(1);
console.log(`PASS brand: ${pin.files.length} vendored files match their pins`);
