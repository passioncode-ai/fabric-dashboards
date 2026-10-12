// A helper that must run after the app exits survives it, on every OS (src/core/after-exit.ts). On Windows a
// non-detached child is killed with its parent (libuv's job object), which broke the 0.7.4 → 0.7.5 update on both
// Windows runners: this test is that failure, made small.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { tmp } from './helpers';

test('a helper started by spawnAfterExit outlives its parent and runs after it exited', async () => {
  const dir = tmp('fd-after-exit-');
  const done = path.join(dir, 'done.txt');
  const module = path.resolve(__dirname, '..', 'src', 'core', 'after-exit.ts');
  // The helper waits for its parent to be gone, then writes the file (as the update waiter runs the installer).
  const helper = `const p=Number(process.argv[1]);const f=process.argv[2];const alive=()=>{try{process.kill(p,0);return true}catch{return false}};const t=setInterval(()=>{if(!alive()){clearInterval(t);require('fs').writeFileSync(f,'after '+p)}},100);setTimeout(()=>process.exit(0),20000);`;
  const parent = `import(${JSON.stringify(module)}).then((m)=>{m.spawnAfterExit(process.execPath,['-e',${JSON.stringify(helper)},String(process.pid),${JSON.stringify(done)}]);setTimeout(()=>process.exit(0),300);});`;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '-e', parent], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(r.status, 0, r.stderr);
  for (let i = 0; i < 150 && !fs.existsSync(done); i += 1) await new Promise((x) => setTimeout(x, 100));
  assert.ok(fs.existsSync(done), 'the helper was killed with its parent (on Windows: not detached)');
  assert.match(fs.readFileSync(done, 'utf8'), /^after \d+$/);
});

test('FD-37: a replaced AppImage is started again by a system shell once this process has exited, with this run\'s arguments', { skip: process.platform === 'win32' ? 'an AppImage is Linux; the shell is POSIX' : false }, async () => {
  const { appImageRelaunchCommand } = await import('../src/core/self-update');
  const dir = tmp('fd-relaunch-');
  const out = path.join(dir, 'started.txt');
  const image = path.join(dir, 'new.AppImage');
  fs.writeFileSync(image, `#!/bin/sh\necho "$@" > ${JSON.stringify(out)}\n`, { mode: 0o755 });
  const module = path.resolve(__dirname, '..', 'src', 'core', 'after-exit.ts');
  // The parent stands in for the app: it starts the shell through spawnAfterExit with its own pid and exits.
  const parent = `Promise.all([import(${JSON.stringify(module)}), import(${JSON.stringify(path.resolve(__dirname, '..', 'src', 'core', 'self-update.ts'))})]).then(([a,s])=>{const c=s.appImageRelaunchCommand(process.pid,${JSON.stringify(image)},['--hidden','--no-sandbox']);a.spawnAfterExit(c.file,c.args);setTimeout(()=>process.exit(0),300);});`;
  const started = Date.now();
  const r = spawnSync(process.execPath, ['--import', 'tsx', '-e', parent], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(r.status, 0, r.stderr);
  for (let i = 0; i < 100 && !fs.existsSync(out); i += 1) await new Promise((x) => setTimeout(x, 100));
  assert.equal(fs.readFileSync(out, 'utf8').trim(), '--hidden --no-sandbox', 'the new image ran with this run\'s arguments');
  assert.ok(Date.now() - started < 30_000);
  const c = appImageRelaunchCommand(42, '/x/a b.AppImage', ['--x']);
  assert.deepEqual(c.args.slice(2), ['fabric-dashboards-relaunch', '42', '/x/a b.AppImage', '--x'], 'paths and arguments are arguments, never pasted into the script');
});

