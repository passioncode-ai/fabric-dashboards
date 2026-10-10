// FD-37 M3 / LC-07: launch at login on Linux is an XDG autostart entry, written only by the person's choice.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { autostartEntry, autostartPath, autostartProgram, entryIsOn, execArg, xdgLoginItem } from '../src/core/autostart';
import { applyLoginItem, loginItemAtStartup } from '../src/core/loginitem';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { tmp } from './helpers';

test('FD-37 LC-07 (Linux): the entry lives in XDG_CONFIG_HOME/autostart, or ~/.config/autostart', () => {
  assert.equal(autostartPath({}, '/home/me'), '/home/me/.config/autostart/fabric-dashboards.desktop');
  assert.equal(autostartPath({ XDG_CONFIG_HOME: '/x/cfg' }, '/home/me'), '/x/cfg/autostart/fabric-dashboards.desktop');
  assert.equal(autostartPath({ XDG_CONFIG_HOME: 'relative' }, '/home/me'), '/home/me/.config/autostart/fabric-dashboards.desktop', 'a relative value is ignored, as the spec says');
});

test('FD-37 LC-07 (Linux): an AppImage starts its own file at login, not the mount it runs from', () => {
  assert.equal(autostartProgram({ APPIMAGE: '/home/me/Apps/Fabric-Dashboards.AppImage' }, '/tmp/.mount_FabricX/fabric-dashboards'), '/home/me/Apps/Fabric-Dashboards.AppImage');
  assert.equal(autostartProgram({}, '/opt/Fabric Dashboards/fabric-dashboards'), '/opt/Fabric Dashboards/fabric-dashboards');
});

test('FD-37 LC-07 (Linux): Exec quotes a path with a space or a reserved character, and starts hidden', () => {
  assert.equal(execArg('/usr/bin/x'), '/usr/bin/x');
  assert.equal(execArg('/opt/Fabric Dashboards/fabric-dashboards'), '"/opt/Fabric Dashboards/fabric-dashboards"');
  assert.equal(execArg('/a/$b"c'), '"/a/\\$b\\"c"');
  assert.equal(execArg('/a/100%'), '"/a/100%%"', 'a literal % is doubled');
  const entry = autostartEntry('/opt/Fabric Dashboards/fabric-dashboards');
  assert.match(entry, /^\[Desktop Entry\]\nType=Application\n/);
  assert.match(entry, /\nExec="\/opt\/Fabric Dashboards\/fabric-dashboards" --hidden\n/);
  assert.ok(entryIsOn(entry, '/opt/Fabric Dashboards/fabric-dashboards'));
  assert.equal(entryIsOn(entry, '/home/me/other.AppImage'), false, 'an entry for another copy is not this one');
  assert.equal(entryIsOn(`${entry}Hidden=true\n`, '/opt/Fabric Dashboards/fabric-dashboards'), false, 'switched off by the desktop');
  assert.equal(entryIsOn(entry.replace('enabled=true', 'enabled=false'), '/opt/Fabric Dashboards/fabric-dashboards'), false);
});

test('FD-37 LC-07 (Linux): the person\'s choice writes and removes the entry; a launch only reads it', () => {
  const home = tmp('fd-xdg-');
  const env = {};
  const exe = '/opt/Fabric Dashboards/fabric-dashboards';
  const os = xdgLoginItem(env, home, exe);
  const file = autostartPath(env, home);
  assert.deepEqual(os.get(), { openAtLogin: false, status: 'not-registered' });
  // A launch before the person chose registers nothing (LC-07).
  assert.equal(loginItemAtStartup({ ...DEFAULT_SETTINGS, launchAtLoginAsked: false }, os), null);
  assert.equal(fs.existsSync(file), false);
  assert.equal(applyLoginItem(true, os), undefined);
  assert.ok(entryIsOn(fs.readFileSync(file, 'utf8'), exe));
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o644);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['fabric-dashboards.desktop'], 'no temporary file left');
  // The person removed it in their desktop's startup settings: the stored choice follows.
  fs.rmSync(file);
  assert.deepEqual(loginItemAtStartup({ ...DEFAULT_SETTINGS, launchAtLoginAsked: true, launchAtLogin: true }, os), { launchAtLogin: false });
  applyLoginItem(true, os);
  assert.equal(applyLoginItem(false, os), undefined);
  assert.equal(fs.existsSync(file), false);
  assert.doesNotThrow(() => os.set(false), 'removing an absent entry is not an error');
});
