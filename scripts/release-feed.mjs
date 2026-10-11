#!/usr/bin/env node
// #region release-feed — docs: docs/RUNBOOK.md#release
// FD-37 M4a (platforms.md PL-04): the release's update-feed.json names every platform the release ships, and a
// release whose feed lacks one is refused. The macOS seal writes the Squirrel feed (currentRelease, releases);
// this adds `platforms` from every system's receipt, in release.yml's `feed` job, after all of them are built.
// An installed copy finds its own file here, then verifies it against the GPG-signed SHA256SUMS as on macOS.
//
//   node scripts/release-feed.mjs --feed <macOS update-feed.json> --receipts <folder of *.receipt.json> --out <file>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The platforms every full release ships (PL-02, PL-08): one key per OS and architecture. */
export const PLATFORMS = ['darwin-universal', 'win32-x64', 'win32-arm64', 'linux-x64', 'linux-arm64'];

/** A receipt's platform key, from the fields each dist script writes. */
export function platformOf(receipt) {
  if (receipt.updateZip && receipt.arch === 'universal') return 'darwin-universal';
  if (receipt.platform === 'windows' || receipt.platform === 'win32') return `win32-${receipt.arch}`;
  if (receipt.platform === 'linux') return `linux-${receipt.arch}`;
  return null;
}

/** What an installed copy on that platform updates from: the file it installs, its hash, and (Linux) the package a
 *  .deb copy is told about. Names only; the trust is SHA256SUMS. */
function entryOf(key, receipt) {
  if (key === 'darwin-universal') return { update: receipt.updateZip, sha256: receipt.zipSha256 };
  const files = Object.entries(receipt.files ?? {});
  if (key.startsWith('win32-')) {
    const setup = files.find(([name]) => name.endsWith('-setup.exe'));
    return setup ? { update: setup[0], sha256: setup[1] } : null;
  }
  const image = files.find(([name]) => name.endsWith('.AppImage'));
  const deb = files.find(([name]) => name.endsWith('.deb'));
  return image && deb ? { update: image[0], sha256: image[1], package: deb[0], packageSha256: deb[1] } : null;
}

/** The feed with `platforms`, or an error naming what is missing or inconsistent. Never a partial feed. */
export function withPlatforms(feed, receipts) {
  const version = feed?.currentRelease;
  if (typeof version !== 'string' || !version) throw new Error('the macOS feed names no currentRelease');
  const commits = new Set(receipts.map((r) => r.commit));
  if (commits.size > 1) throw new Error(`the receipts were built from different commits: ${[...commits].join(', ')}`);
  const platforms = {};
  for (const receipt of receipts) {
    const key = platformOf(receipt);
    if (!key) continue;
    if (receipt.version !== version) throw new Error(`${key} was built as ${receipt.version}, the feed names ${version}`);
    if (platforms[key]) throw new Error(`two receipts for ${key}`);
    const entry = entryOf(key, receipt);
    if (!entry || !entry.update || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '')) throw new Error(`the ${key} receipt names no update file with its hash`);
    if (!entry.update.includes(`-${version}`)) throw new Error(`${entry.update} is not this release's file`);
    platforms[key] = entry;
  }
  const missing = PLATFORMS.filter((key) => !platforms[key]);
  if (missing.length) throw new Error(`the feed would lack ${missing.join(', ')}: a release missing a platform is refused (PL-04)`);
  return { ...feed, platforms: Object.fromEntries(PLATFORMS.map((key) => [key, platforms[key]])) };
}

function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); if (i < 0 || !argv[i + 1]) throw new Error(`${name} is required`); return argv[i + 1]; };
  const feed = JSON.parse(fs.readFileSync(arg('--feed'), 'utf8'));
  const dir = arg('--receipts');
  const receipts = fs.readdirSync(dir).filter((n) => n.endsWith('.receipt.json')).map((n) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')));
  const out = withPlatforms(feed, receipts);
  fs.mkdirSync(path.dirname(arg('--out')), { recursive: true });
  fs.writeFileSync(arg('--out'), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`update-feed.json names ${Object.keys(out.platforms).join(', ')} for ${out.currentRelease}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`::error::${error.message}`); process.exit(1); }
}
// #endregion release-feed
