// UI wave 7: the application menu's template, built on its own from main.ts's closure (FD-37, FD-74, FD-103, FD-220, FD-227).
import assert from 'node:assert/strict';
import test from 'node:test';
import { appMenuTemplate, type MenuActions } from '../src/electron/app-menu';
import type { LayoutCommand } from '../src/core/api';

function actions() {
  const did: string[] = [];
  const a: MenuActions = {
    quit: () => did.push('quit'), checkUpdates: () => did.push('check'), page: (p) => did.push(`page:${p}`),
    reload: (hard) => did.push(`reload:${hard}`), layout: (w: LayoutCommand) => did.push(`layout:${w}`),
  };
  return { a, did };
}
type Item = Electron.MenuItemConstructorOptions;
const click = (i: Item | undefined) => (i?.click as unknown as () => void)();
const view = (menu: Item[]) => (menu.find((m) => m.label === 'View')!.submenu as Item[]);

test('macOS: an app menu with About, Check for updates and Quit; no File or Help menu', () => {
  const { a, did } = actions();
  const menu = appMenuTemplate('darwin', 'en', a);
  assert.equal(menu[0]!.role, 'appMenu');
  assert.ok(!menu.some((m) => m.role === 'help'));
  const items = menu[0]!.submenu as Item[];
  click(items.find((i) => i.label === 'Quit Fabric Dashboards' || i.label?.startsWith('Quit')));
  click(items.find((i) => i.label?.startsWith('Check')));
  assert.deepEqual(did, ['quit', 'check']);
});

test('Windows and Linux: a File menu holds updates and Quit, and Help holds About', () => {
  const menu = appMenuTemplate('win32', 'en', actions().a);
  assert.equal(menu[0]!.role, undefined);
  assert.equal((menu[0]!.submenu as Item[]).length, 3);
  assert.equal(menu.at(-1)!.role, 'help');
});

test('View: Agents and Sessions, both reloads, the four panels and the three agent strip commands reach their actions', () => {
  const { a, did } = actions();
  const items = view(appMenuTemplate('darwin', 'en', a)).filter((i) => i.type !== 'separator');
  for (const i of items) click(i);
  assert.deepEqual(did, ['page:agents', 'page:sessions', 'reload:false', 'reload:true', 'layout:sidebar', 'layout:console', 'layout:details', 'layout:focus',
    'layout:next-agent', 'layout:previous-agent', 'layout:close-agent']);
  assert.ok(items.every((i) => typeof i.label === 'string' && i.label.length > 0 && !i.label.startsWith('menu.')), 'every label translated');
  assert.ok(items.every((i) => i.accelerator), 'every View command has its key');
});

test('Russian labels are the dictionary\'s', () => {
  const items = view(appMenuTemplate('darwin', 'ru', actions().a).map((m) => (m.label === 'Вид' ? { ...m, label: 'View' } : m)));
  assert.ok(items.filter((i) => i.type !== 'separator').every((i) => /[А-Яа-яЁё]/.test(String(i.label))));
});
