// The application menu as a template (UI wave 7: lifted out of main.ts's closure so it is read and tested on its own).
// FD-37: the app menu and the Command key are macOS's; elsewhere a File menu holds updates and Quit. ADR-0017: the panels
// fold away from the menu too; the window holds the state (Settings.layout).
import type { LayoutCommand } from '../core/api';
import { menuKeys, modeMenuItems } from '../core/platform';
import { t, type Lang } from '../core/i18n';

export interface MenuActions {
  quit(): void;
  checkUpdates(): void;
  page(page: 'agents' | 'sessions'): void;
  reload(hard: boolean): void;
  layout(which: LayoutCommand): void;
}

export function appMenuTemplate(platform: NodeJS.Platform, lang: Lang, a: MenuActions): Electron.MenuItemConstructorOptions[] {
  const keys = menuKeys(platform);
  const quit: Electron.MenuItemConstructorOptions = { label: t(lang, 'menu.quit'), accelerator: keys.quit, click: () => a.quit() };
  const checkUpdates: Electron.MenuItemConstructorOptions = { label: t(lang, 'menu.checkUpdates'), click: () => a.checkUpdates() };
  const layout = (label: string, accelerator: string, which: LayoutCommand): Electron.MenuItemConstructorOptions =>
    ({ label: t(lang, label), accelerator, click: () => a.layout(which) });
  return [
    keys.appMenu
      ? { role: 'appMenu', submenu: [
        { role: 'about' }, checkUpdates,
        { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, quit,
      ] }
      : { label: t(lang, 'menu.file'), submenu: [checkUpdates, { type: 'separator' }, quit] },
    { role: 'editMenu' },
    { label: t(lang, 'menu.view'), submenu: [
      // FD-103 (SCN-077): ⌘1 Agents, ⌘2 Sessions (Ctrl elsewhere).
      ...modeMenuItems(platform, (key) => t(lang, key)).map((m) => ({ id: m.id, label: m.label, accelerator: m.accelerator, click: () => a.page(m.page) })),
      { type: 'separator' },
      // FD-74: ⌘R reloads the dashboard on screen, ⇧⌘R first empties its cache.
      { id: 'reload-page', label: t(lang, 'menu.reload'), accelerator: keys.reload, click: () => a.reload(false) },
      { id: 'reload-hard', label: t(lang, 'menu.hardReload'), accelerator: keys.hardReload, click: () => a.reload(true) },
      { type: 'separator' },
      layout('menu.toggleSidebar', keys.sidebar, 'sidebar'),
      layout('menu.toggleConsole', keys.console, 'console'),
      layout('menu.toggleDetails', keys.details, 'details'),
      // FD-220: an agent's dashboard fills the window, and back.
      layout('menu.focus', keys.focus, 'focus'),
      // FD-227 (SCN-105): the open agents' strip from the keyboard.
      { type: 'separator' },
      layout('menu.nextAgent', keys.nextAgent, 'next-agent'),
      layout('menu.previousAgent', keys.previousAgent, 'previous-agent'),
      layout('menu.closeAgent', keys.closeAgent, 'close-agent'),
    ] },
    { role: 'windowMenu' },
    ...(keys.appMenu ? [] : [{ role: 'help' as const, submenu: [{ role: 'about' as const }] }]),
  ];
}
