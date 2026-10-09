// FD-37: what differs between macOS, Windows and Linux, decided in one pure module (ADR-0019) so every
// branch is tested on any operating system.
import assert from 'node:assert/strict';
import test from 'node:test';
import { isAbsoluteFolder, menuKeys, notificationSettingsUrl, places, startHidden, trayIcon, uninstallCommand, uninstallTarget, windowChrome } from '../src/core/platform';

const none = () => false;

test('FD-37: uninstall on macOS trashes the .app bundle and nothing else', () => {
  assert.deepEqual(uninstallTarget('darwin', '/Applications/Fabric Dashboards.app/Contents/MacOS/Fabric Dashboards', {}, none),
    { kind: 'trash-bundle', path: '/Applications/Fabric Dashboards.app' });
  const odd = uninstallTarget('darwin', '/usr/local/bin/fabric-dashboards', {}, none);
  assert.deepEqual(odd, { kind: 'none', reason: 'uninstall.reason.noBundle' }, 'a binary outside a bundle is never trashed by guesswork (0.6.7 trashed its parent)');
});

test('FD-37: uninstall on Windows runs this install\'s own NSIS uninstaller — never trashes a parent folder', () => {
  const exe = 'C:\\Users\\e\\AppData\\Local\\Programs\\Fabric Dashboards\\Fabric Dashboards.exe';
  const uninstaller = 'C:\\Users\\e\\AppData\\Local\\Programs\\Fabric Dashboards\\Uninstall Fabric Dashboards.exe';
  assert.deepEqual(uninstallTarget('win32', exe, {}, (p) => p === uninstaller), { kind: 'run-uninstaller', path: uninstaller, args: ['/S'] });
  assert.deepEqual(uninstallTarget('win32', exe, {}, none), { kind: 'none', reason: 'uninstall.reason.noUninstaller' });
});

test('FD-37: uninstall on Linux trashes the AppImage file, points a .deb at apt, and refuses anything else', () => {
  assert.deepEqual(uninstallTarget('linux', '/tmp/.mount_FabricX/fabric-dashboards', { APPIMAGE: '/home/e/Applications/Fabric-Dashboards-0.7.0-x86_64.AppImage' }, () => true),
    { kind: 'trash-file', path: '/home/e/Applications/Fabric-Dashboards-0.7.0-x86_64.AppImage' });
  assert.deepEqual(uninstallTarget('linux', '/opt/Fabric Dashboards/fabric-dashboards', {}, none), { kind: 'package', command: 'sudo apt remove fabric-dashboards' });
  assert.deepEqual(uninstallTarget('linux', '/home/e/build/fabric-dashboards', {}, none), { kind: 'none', reason: 'uninstall.reason.notInstalled' });
  assert.deepEqual(uninstallTarget('linux', '/x/y', { APPIMAGE: '/home/e/not-an-image' }, () => true), { kind: 'none', reason: 'uninstall.reason.notAppImage' }, 'APPIMAGE must name an .AppImage file');
});

test('FD-37: an absolute folder follows the OS grammar; a Windows share is not a local folder', () => {
  assert.equal(isAbsoluteFolder('/Users/e/repo', 'darwin'), true);
  assert.equal(isAbsoluteFolder('repo', 'linux'), false);
  assert.equal(isAbsoluteFolder('C:\\Users\\e\\repo', 'win32'), true);
  assert.equal(isAbsoluteFolder('D:/work/repo', 'win32'), true);
  assert.equal(isAbsoluteFolder('\\\\server\\share\\repo', 'win32'), false);
  assert.equal(isAbsoluteFolder('/Users/e/repo', 'win32'), false, 'a rootless path depends on the current drive');
});

test('FD-37: window, tray and menu keys per OS', () => {
  assert.deepEqual(windowChrome('darwin'), { titleBarStyle: 'hiddenInset' });
  assert.deepEqual(windowChrome('win32'), {});
  assert.deepEqual(windowChrome('linux'), {});
  assert.deepEqual(trayIcon('darwin', 'problem'), { file: 'trayProblemTemplate.png', template: true });
  assert.deepEqual(trayIcon('win32', 'problem'), { file: 'tray-problem.png', template: false });
  assert.deepEqual(trayIcon('linux', 'ok'), { file: 'tray-ok.png', template: false });
  assert.equal(menuKeys('darwin').quit, 'Command+Q');
  assert.equal(menuKeys('darwin').appMenu, true);
  const other = menuKeys('win32');
  assert.equal(other.quit, 'Ctrl+Q');
  assert.equal(other.appMenu, false);
  assert.ok(Object.values(other).every((v) => typeof v !== 'string' || !v.includes('Cmd')), 'no Command key off macOS');
});

test('FD-37: a login launch starts hidden — macOS reports it, Windows and Linux pass --hidden', () => {
  assert.equal(startHidden('darwin', { argv: [], wasOpenedAtLogin: true, afterUpdate: false }), true);
  assert.equal(startHidden('win32', { argv: [], wasOpenedAtLogin: undefined, afterUpdate: false }), false);
  assert.equal(startHidden('win32', { argv: ['app.exe', '--hidden'], wasOpenedAtLogin: undefined, afterUpdate: false }), true);
  assert.equal(startHidden('linux', { argv: [], wasOpenedAtLogin: true, afterUpdate: false }), false, 'only macOS reports a login launch');
  assert.equal(startHidden('linux', { argv: [], wasOpenedAtLogin: undefined, afterUpdate: true }), true);
});

test('FD-37: notification settings open where each OS keeps them; Linux has no standard address', () => {
  assert.match(notificationSettingsUrl('darwin') ?? '', /^x-apple\.systempreferences:/);
  assert.equal(notificationSettingsUrl('win32'), 'ms-settings:notifications');
  assert.equal(notificationSettingsUrl('linux'), null);
});

test('FD-37: the Windows uninstaller starts only after this app has exited, by its own path, never through a shell string', () => {
  const target = { kind: 'run-uninstaller' as const, path: "C:\\Users\\o'brien\\AppData\\Local\\Programs\\Fabric Dashboards\\Uninstall Fabric Dashboards.exe", args: ['/S'] };
  const cmd = uninstallCommand(target, 4242);
  assert.equal(cmd.file, 'powershell.exe');
  assert.deepEqual(cmd.args.slice(0, 4), ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden']);
  const script = cmd.args[cmd.args.length - 1]!;
  assert.match(script, /Wait-Process -Id 4242 -Timeout 30/);
  assert.match(script, /Start-Process -FilePath 'C:\\Users\\o''brien\\.*Uninstall Fabric Dashboards\.exe' -ArgumentList '\/S'/, 'single quotes doubled: a path cannot end the literal');
});

test('FD-37 / PL-06: where the app keeps its data and logs on Windows and Linux; macOS keeps Electron\'s own places', () => {
  assert.equal(places('darwin', {}, '/Users/e'), null);
  assert.deepEqual(places('win32', { LOCALAPPDATA: 'C:\\Users\\e\\AppData\\Local' }, 'C:\\Users\\e'),
    { userData: 'C:\\Users\\e\\AppData\\Local\\Fabric Dashboards', logs: 'C:\\Users\\e\\AppData\\Local\\Fabric Dashboards\\Logs' });
  assert.deepEqual(places('win32', {}, 'C:\\Users\\e'),
    { userData: 'C:\\Users\\e\\AppData\\Local\\Fabric Dashboards', logs: 'C:\\Users\\e\\AppData\\Local\\Fabric Dashboards\\Logs' }, 'not the roaming profile');
  assert.deepEqual(places('linux', {}, '/home/e'), { userData: '/home/e/.local/share/fabric-dashboards', logs: '/home/e/.local/state/fabric-dashboards' });
  assert.deepEqual(places('linux', { XDG_DATA_HOME: '/d', XDG_STATE_HOME: '/s' }, '/home/e'), { userData: '/d/fabric-dashboards', logs: '/s/fabric-dashboards' });
});
