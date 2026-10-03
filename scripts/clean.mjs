// LC-15: bring this checkout's build output back under the caps AGENTS.md names
// (## Build output and retention). Removes what a build regenerates — out/, test-results/,
// test/.debug/ and node_modules/.cache — and prunes release/ to the current and previous release.
// It never touches node_modules itself, sources, or anything git tracks.
//
//   npm run clean
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruneReleases } from './dist-mac.mjs';

export const REGENERATED = ['out', 'test-results', 'test/.debug', 'node_modules/.cache'];

export function clean(root) {
  const removed = [];
  for (const rel of REGENERATED) {
    const target = path.join(root, rel);
    if (!existsSync(target)) continue;
    rmSync(target, { recursive: true, force: true });
    removed.push(rel);
  }
  for (const name of pruneReleases(path.join(root, 'release'), 2)) removed.push(`release/${name}`);
  return removed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const removed = clean(root);
  console.log(removed.length ? `removed: ${removed.join(', ')}` : 'nothing to remove');
}
