// The menu bar glance (SCN-023): one icon in three states, problems first.
import { trayIcon } from '../core/platform';
import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { t, type Lang } from '../core/i18n';
import { trayMenuModel, type TrayItem } from '../core/tray-model';
import { traySessionsLine } from '../core/sessions-view';
import type { SessionRow } from '../core/sessions';
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import type { ServiceSnapshot, ServiceState } from '../core/types';

export type TrayLevel = 'ok' | 'degraded' | 'problem';

export function trayLevel(services: ServiceSnapshot[], limits: Readonly<Record<string, readonly LimitView[]>> = {}): TrayLevel {
  const bad: ServiceState[] = ['down', 'duplicate', 'foreign', 'conflict', 'invalid'];
  // UX-06: a limit that stopped work is a problem, as on Overview.
  if (services.some((s) => bad.includes(s.state) || limits[s.key]?.some((l) => l.state === 'tripped'))) return 'problem';
  if (services.some((s) => s.state === 'degraded' || s.state === 'starting' || s.state === 'stopping')) return 'degraded';
  return 'ok';
}

export interface TrayActions {
  open(key?: string): void;
  /** FD-103 (SCN-085): the Sessions line opens the Sessions mode on All sessions. */
  sessions(): void;
  pause(): void;
  resume(): void;
  paused(): boolean;
  quit(): void;
}

export class AppTray {
  private readonly tray: Tray;
  private readonly icons: Record<TrayLevel, Electron.NativeImage>;
  private shown = ''; // what the menu shows now; an identical update rebuilds nothing (LC-08)

  constructor(assets: string, private readonly actions: TrayActions, private readonly lang: () => Lang) {
    // FD-37: macOS tints a monochrome template; Windows and Linux show the colour set (trayIcon).
    const load = (level: TrayLevel) => {
      const icon = trayIcon(process.platform, level);
      const image = nativeImage.createFromPath(path.join(assets, icon.file));
      image.setTemplateImage(icon.template);
      return image;
    };
    this.icons = { ok: load('ok'), degraded: load('degraded'), problem: load('problem') };
    this.tray = new Tray(this.icons.ok);
    this.tray.setToolTip('Fabric Dashboards');
  }

  update(services: ServiceSnapshot[], limits: Readonly<Record<string, readonly LimitView[]>> = {}, sessions: readonly SessionRow[] = []): void {
    const lang = this.lang();
    const level = trayLevel(services, limits);
    // W2 (UX-04): the headline and the first items are the attention queue Overview, the sidebar and the Dock count.
    const model = trayMenuModel(services, { now: Date.now(), limits, lang });
    const sessionsLine = traySessionsLine(lang, sessions);
    const signature = JSON.stringify([lang, level, this.actions.paused(), model, sessionsLine]);
    if (signature === this.shown) return;
    this.shown = signature;
    this.tray.setImage(this.icons[level]);
    const item = (i: TrayItem): MenuItemConstructorOptions => ({ label: i.label, click: () => this.actions.open(i.key) });
    const headline = model.headline;
    const template: MenuItemConstructorOptions[] = [
      { label: headline, enabled: false },
      // FD-103 (SCN-085): "Sessions: running N, need you M" under the headline, while one runs or needs the person.
      ...(sessionsLine ? [{ label: sessionsLine, click: () => this.actions.sessions() }] : []),
      ...model.attention.map(item),
      { type: 'separator' },
      ...model.rest.map(item),
      { type: 'separator' },
      { label: t(lang, 'tray.open'), click: () => this.actions.open() },
      this.actions.paused()
        ? { label: t(lang, 'tray.resume'), click: () => this.actions.resume() }
        : { label: t(lang, 'tray.pause'), click: () => this.actions.pause() },
      { type: 'separator' },
      // Said where it applies, not in a modal on the way out (lifecycle LC-07).
      { label: t(lang, 'quit.note'), enabled: false },
      { label: t(lang, 'tray.quit'), click: () => this.actions.quit() },
    ];
    this.tray.setContextMenu(Menu.buildFromTemplate(template));
    this.tray.setToolTip(t(lang, 'tray.tooltip', { headline }));
  }
}
