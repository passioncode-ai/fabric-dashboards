// FD-37 / LC-14: what an uninstall removes on Windows and Linux — only this app's own folders.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { isProductPath, productDataPaths, purgeAfterExit } from '../src/core/uninstall';
import { tmp } from './helpers';

const WIN_ENV = { LOCALAPPDATA: 'C:\\Users\\e\\AppData\\Local', APPDATA: 'C:\\Users\\e\\AppData\\Roaming' };

test('FD-37: Windows product paths are this app\'s folders in LOCALAPPDATA and APPDATA, and the updater cache', () => {
  assert.deepEqual(productDataPaths('C:\\Users\\e', 'win32', WIN_ENV), [
    'C:\\Users\\e\\AppData\\Local\\Fabric Dashboards',
    'C:\\Users\\e\\AppData\\Roaming\\Fabric Dashboards',
    'C:\\Users\\e\\AppData\\Local\\fabric-dashboards-updater',
  ]);
});

test('FD-37: on Windows only those folders or what is inside them may be purged — never a parent, a sibling or another app', () => {
  const ok = (p: string) => isProductPath(p, 'win32', WIN_ENV, 'C:\\Users\\e');
  assert.equal(ok('C:\\Users\\e\\AppData\\Local\\Fabric Dashboards'), true);
  assert.equal(ok('c:\\users\\E\\appdata\\local\\fabric dashboards\\Cache'), true, 'Windows paths compare without case');
  assert.equal(ok('C:\\Users\\e\\AppData\\Local'), false);
  assert.equal(ok('C:\\Users\\e\\AppData\\Local\\Fabric Dashboards Helper'), false, 'a shared prefix is a sibling');
  assert.equal(ok('C:\\Users\\e\\AppData\\Local\\Fabric Dashboards\\..\\Other'), false, 'resolved before the check');
  assert.equal(ok('C:\\'), false);
});

test('FD-37: Linux product paths follow XDG, and purge stays inside them', () => {
  const env = { XDG_DATA_HOME: '/home/e/.local/share' };
  assert.deepEqual(productDataPaths('/home/e', 'linux', env), [
    '/home/e/.local/share/fabric-dashboards', '/home/e/.local/state/fabric-dashboards', '/home/e/.config/Fabric Dashboards', '/home/e/.cache/fabric-dashboards',
  ]);
  assert.equal(isProductPath('/home/e/.local/share/fabric-dashboards/Partitions', 'linux', env, '/home/e'), true);
  assert.equal(isProductPath('/home/e/.local/share', 'linux', env, '/home/e'), false);
  assert.equal(isProductPath('/home/e', 'linux', env, '/home/e'), false);
  assert.equal(isProductPath('/', 'linux', env, '/home/e'), false);
});

test('FD-37: on Windows the data goes only after the app exits, and the kept files stay', { skip: process.platform !== 'win32' && 'runs the Windows helper (PowerShell); POSIX has its own test in lifecycle.test.ts' }, async () => {
  const local = tmp('fd-local-');
  const env = { LOCALAPPDATA: local, APPDATA: tmp('fd-roaming-') };
  const data = path.join(local, 'Fabric Dashboards');
  fs.mkdirSync(path.join(data, 'Cache'), { recursive: true });
  fs.writeFileSync(path.join(data, 'settings.json'), '{}');
  fs.writeFileSync(path.join(data, 'Cookies'), 'x');
  const appProcess = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1500)']);
  const helper = purgeAfterExit(appProcess.pid!, [], { dir: data, names: ['settings.json'] }, 30_000, { platform: 'win32', env, home: path.dirname(local) })!;
  helper.ref();
  const helperDone = new Promise((resolve) => helper.once('exit', resolve));
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.ok(fs.existsSync(path.join(data, 'Cache')), 'nothing is removed while the app still runs');
  await helperDone;
  assert.deepEqual(fs.readdirSync(data), ['settings.json']);
});
