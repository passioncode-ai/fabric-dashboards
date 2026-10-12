// A helper that must run after the app exits survives it, on every OS (src/core/after-exit.ts). On Windows a
// non-detached child dies with its parent (libuv's job object) and a detached PowerShell does not run at all; the
// helper is a grandchild started through cmd.exe. Each test below is that failure, made small: a parent starts the
// helper through the real function and exits, and the helper must do its work after the parent is gone.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { powerShellLauncherLine } from '../src/core/after-exit';
import { tmp } from './helpers';

const moduleUrl = (name: string) => pathToFileURL(path.resolve(__dirname, '..', 'src', 'core', name)).href;
const runParent = (code: string) => spawnSync(process.execPath, ['--import', 'tsx', '-e', code], { encoding: 'utf8', timeout: 60_000 });
const waitFor = async (file: string, ms: number) => { for (let i = 0; i < ms / 100 && !fs.existsSync(file); i += 1) await new Promise((x) => setTimeout(x, 100)); };

test('a helper outlives the process that started it and runs after that process exited', async () => {
  const dir = tmp('fd-after-exit-');
  const done = path.join(dir, 'done.txt');
  let parent: string;
  if (process.platform === 'win32') {
    // The real Windows path: PowerShell, started through powerShellAfterExit; the parent waits for the launcher, as the app does.
    const ps = `$p = [int]$env:FD_PARENT; while (Get-Process -Id $p -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 100 }; Set-Content -LiteralPath '${done.replace(/'/g, "''")}' -Value ('after ' + $p)`;
    parent = `process.env.FD_PARENT=String(process.pid);import(${JSON.stringify(moduleUrl('after-exit.ts'))}).then((m)=>m.powerShellAfterExit(${JSON.stringify(ps)})).then(()=>process.exit(0),(e)=>{console.error(e.message);process.exit(2)});`;
  } else {
    const helper = `const p=Number(process.argv[1]);const f=process.argv[2];const alive=()=>{try{process.kill(p,0);return true}catch{return false}};const t=setInterval(()=>{if(!alive()){clearInterval(t);require('fs').writeFileSync(f,'after '+p)}},100);setTimeout(()=>process.exit(0),20000);`;
    parent = `import(${JSON.stringify(moduleUrl('after-exit.ts'))}).then((m)=>{m.spawnAfterExit(process.execPath,['-e',${JSON.stringify(helper)},String(process.pid),${JSON.stringify(done)}]);setTimeout(()=>process.exit(0),300);});`;
  }
  const r = runParent(parent);
  assert.equal(r.status, 0, r.stderr);
  await waitFor(done, 45_000);
  assert.ok(fs.existsSync(done), 'the helper died with its parent, or never ran');
  assert.match(fs.readFileSync(done, 'utf8').trim(), /^after \d+$/);
});

test('the Windows launcher carries the script encoded, and refuses one too long for cmd.exe', () => {
  const line = powerShellLauncherLine("Write-Output 'a \"quoted\" & piped | path'");
  assert.match(line, /^"start "" \/b powershell\.exe -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand [A-Za-z0-9+/=]+"$/);
  const encoded = /-EncodedCommand ([A-Za-z0-9+/=]+)"$/.exec(line)![1]!;
  assert.equal(Buffer.from(encoded, 'base64').toString('utf16le'), "Write-Output 'a \"quoted\" & piped | path'", 'no quoting can break it');
  assert.throws(() => powerShellLauncherLine('x'.repeat(4000)), /too long for cmd\.exe/);
});

test('FD-37: a replaced AppImage is started again by a system shell once this process has exited, with this run\'s arguments', { skip: process.platform === 'win32' ? 'an AppImage is Linux; the shell is POSIX' : false }, async () => {
  const { appImageRelaunchCommand } = await import('../src/core/self-update');
  const dir = tmp('fd-relaunch-');
  const out = path.join(dir, 'started.txt');
  const image = path.join(dir, 'new.AppImage');
  fs.writeFileSync(image, `#!/bin/sh\necho "$@" > ${JSON.stringify(out)}\n`, { mode: 0o755 });
  const parent = `Promise.all([import(${JSON.stringify(moduleUrl('after-exit.ts'))}), import(${JSON.stringify(moduleUrl('self-update.ts'))})]).then(([a,s])=>{const c=s.appImageRelaunchCommand(process.pid,${JSON.stringify(image)},['--hidden','--no-sandbox']);a.spawnAfterExit(c.file,c.args);setTimeout(()=>process.exit(0),300);});`;
  const r = runParent(parent);
  assert.equal(r.status, 0, r.stderr);
  await waitFor(out, 10_000);
  assert.equal(fs.readFileSync(out, 'utf8').trim(), '--hidden --no-sandbox', 'the new image ran with this run\'s arguments');
  const c = appImageRelaunchCommand(42, '/x/a b.AppImage', ['--x']);
  assert.deepEqual(c.args.slice(2), ['fabric-dashboards-relaunch', '42', '/x/a b.AppImage', '--x'], 'paths and arguments are arguments, never pasted into the script');
});
