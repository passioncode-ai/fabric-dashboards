// FD-114: update-proof's stand-in for the release pointer: taken only from a loopback http URL, written only by a debug
// Windows or Linux build, removed from every other build, and wired to the same port in the workflow and the proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PROOF_FEED_FILE, proofFeedUrl } from '../src/core/release-verify';

const root = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
const url = (u: unknown) => proofFeedUrl(JSON.stringify({ url: u }));

test('FD-114: only a loopback http URL of an update-feed.json is a proof feed', () => {
  assert.equal(url('http://127.0.0.1:47391/update-feed.json'), 'http://127.0.0.1:47391/update-feed.json');
  for (const bad of [
    'https://github.com/passioncode-ai/fabric-dashboards/releases/latest/download/update-feed.json',
    'http://localhost:47391/update-feed.json', 'http://127.0.0.2:47391/update-feed.json', 'http://127.0.0.1/update-feed.json',
    'https://127.0.0.1:47391/update-feed.json', 'http://127.0.0.1:47391/other.json', 'http://127.0.0.1:47391/x/update-feed.json',
    'http://127.0.0.1:47391/update-feed.json?v=1', 'http://127.0.0.1:47391/update-feed.json#x', 'http://u:p@127.0.0.1:47391/update-feed.json',
    'file:///update-feed.json', 42, null,
  ]) assert.equal(url(bad), null, String(bad));
  assert.equal(proofFeedUrl('not json'), null);
  assert.equal(proofFeedUrl('{}'), null);
});

test('FD-114: the updater reads the release pointer through the proof feed, which falls back to the release feed', () => {
  const src = read('src/electron/updater.ts');
  assert.match(src, /path\.join\(__dirname, '\.\.', PROOF_FEED_FILE\)/, 'out/main/proof-feed.json beside out/main/electron/updater.js');
  assert.match(src, /return \(this\.feedUrl = url \?\? DEFAULT_FEED\)/);
  assert.equal((src.match(/DEFAULT_FEED/g) ?? []).length, 2, 'declared, and only the fallback reads it');
  assert.match(src, /net\.fetch\(this\.feed,/);
  assert.match(src, /setFeedURL\(\{ url: this\.feed,/);
});

test('FD-114: a proof feed is written only by a debug Windows or Linux build and removed from every other build', () => {
  const other = read('scripts/dist-other.mjs');
  const removed = other.indexOf('rmSync(proofFeed, { force: true })');
  const written = other.indexOf('writeFileSync(proofFeed,');
  assert.ok(other.indexOf("execFileSync('npm', ['run', 'build']") < removed && removed < written, 'build, then remove, then write only on request');
  assert.match(other, /requireThat\(allowDirty && process\.env\.FD_WINDOWS_RELEASE !== 'true'/, 'never a release');
  assert.match(other, /requireThat\(PROOF_FEED_URL\.test\(process\.env\.FD_PROOF_FEED\)/);
  const mac = read('scripts/dist-mac.mjs');
  assert.match(mac, /run\('npm', \['run', 'build'\][^\n]*\n\s*rmSync\(path\.join\(root, 'out', 'main', PROOF_FEED_FILE\), \{ force: true \}\)/, 'a macOS build never carries one');
  assert.match(mac, new RegExp(`export const PROOF_FEED_FILE = '${PROOF_FEED_FILE}'`));
  for (const wf of ['release.yml', 'packages.yml', 'validate.yml']) assert.doesNotMatch(read(`.github/workflows/${wf}`), /FD_PROOF_FEED/, wf);
});

test('FD-114: update-proof bakes the port its server listens on, and takes `via` from the environment, never the shell', () => {
  const wf = read('.github/workflows/update-proof.yml');
  const proof = read('scripts/update-proof.mjs');
  const port = /http:\/\/127\.0\.0\.1:(\d+)\/update-feed\.json/.exec(wf)?.[1];
  assert.ok(port, 'the workflow bakes a proof feed');
  assert.match(proof, new RegExp(`const PROOF_PORT = ${port};`));
  assert.match(wf, /FD_PROOF_VIA: \$\{\{ inputs\.via \}\}/);
  assert.doesNotMatch(wf, /update-proof\.mjs[^\n]*inputs\.via/, 'an input is never spliced into a command line');
  assert.match(proof, /update_check ready version=\$\{esc\(via\)\}/, 'the pointer moves only once <via> waits ready');
});

test('FD-114: with three versions on Windows the copy keeps the default profile, where the relaunched copy reads its marker', () => {
  const proof = read('scripts/update-proof.mjs');
  assert.match(proof, /const defaultProfile = process\.platform === 'win32' && via;/);
  assert.match(proof, /\.\.\.\(defaultProfile \? \{\} : \{ FABRIC_DASHBOARDS_USER_DATA: data \}\)/);
  assert.match(proof, /path\.join\(process\.env\.LOCALAPPDATA \?\? '', 'Fabric Dashboards'\)/, 'platform.ts places: %LOCALAPPDATA%\\Fabric Dashboards');
});

test('FD-98: a ready Windows or Linux copy rechecks the release pointer; macOS and a switched-off copy keep waiting', async () => {
  const { recheckWhileReady } = await import('../src/core/version');
  for (const channel of ['nsis', 'appimage']) {
    assert.equal(recheckWhileReady({ channel, state: 'ready', manual: false, enabled: true }), true, channel);
    assert.equal(recheckWhileReady({ channel, state: 'ready', manual: false, enabled: false }), false, `${channel}: automatic updates off`);
    assert.equal(recheckWhileReady({ channel, state: 'ready', manual: true, enabled: false }), true, `${channel}: the person's own check`);
    for (const state of ['idle', 'downloading', 'checking', 'held', 'error']) assert.equal(recheckWhileReady({ channel, state, manual: false, enabled: true }), false, `${channel} ${state}`);
  }
  for (const channel of ['squirrel', 'package', 'not-yet', 'development']) assert.equal(recheckWhileReady({ channel, state: 'ready', manual: true, enabled: true }), false, channel);
});

test('FD-98: a newer release is prepared beside the ready one, which stays ready on any failure', () => {
  const src = read('src/electron/updater.ts');
  const prep = src.slice(src.indexOf('private async prepareFile('), src.indexOf('// #endregion appimage-update'));
  assert.equal((prep.match(/this\.fail\(/g) ?? []).length, 1, 'every failure goes through the local fail, which keeps a ready update (its one this.fail is the ordinary case)');
  assert.match(prep, /over \? this\.event\('update_check', code, `\$\{error\}; the ready \$\{over\} stays`/);
  assert.match(prep, /if \(!over\) this\.set\(\{ state: 'downloading', version \}\)/, 'the state stays ready while the newer one is prepared');
  assert.match(prep, /if \(nsis && !over\) fs\.rmSync\(pending/, 'the ready installer is not removed before the newer one is ready');
  assert.match(prep, /if \(previous && previous\.file !== staged\) fs\.rmSync\(previous\.file/, 'and removed once it is');
  assert.match(prep, /if \(over\) \{ this\.event\('update_check', 'needs_migration'/, 'a newer release that needs a person never displaces a ready one');
  const check = src.slice(src.indexOf('  check(manual = false): void {'), src.indexOf('  private async readFeed('));
  assert.ok(check.indexOf('recheckWhileReady(') < check.indexOf('mayCheck('), 'the ready recheck comes before the ordinary gate');
  assert.match(src, /if \(this\.rechecking\) return;/, 'one recheck at a time');
  assert.match(read('scripts/update-proof.mjs'), /requireThat\(!viaInstalled\?\.test\(logText\(\)\), `FD-98:/, 'the three-version proof fails on a second restart');
});
