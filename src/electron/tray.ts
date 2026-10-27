// The menu bar glance (SCN-023): one icon in three states, problems first.
import { trayIcon } from '../core/platform';
import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { t, type Lang } from '../core/i18n';
import { trayMenuModel, type TrayItem } from '../core/tray-model';
import { traySessionsLine } from '../core/sessions-view';
import type { SessionRow } from '../core/sessions';
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import { attentionQueue, urgent } from '../core/attention';
import type { ServiceSnapshot } from '../core/types';

export type TrayLevel = 'ok' | 'degraded' | 'attention' | 'problem';

/** The icon's level. `problem` is what turns the sidebar badge red: the attention queue's urgent items (a problem state,
 *  a limit that stopped work, a failed action still news), read the same way (R1-U8). `attention`: a coding session needs
 *  the person (R1-P1, SCN-085): a call to act, not a fault. */
export function trayLevel(services: readonly ServiceSnapshot[], limits: Readonly<Record<string, readonly LimitView[]>> = {}, sessions: readonly SessionRow[] = [], now = Date.now()): TrayLevel {
  if (attentionQueue(services, { now, limits }).some(urgent)) return 'problem';
  if (sessions.some((r) => r.group === 'needs-you')) return 'attention';
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
  /** FD-129 (UX-19): the product ids the person hid; they leave the list of other agents. */
  hidden(): readonly string[];
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
    this.icons = { ok: load('ok'), degraded: load('degraded'), attention: load('attention'), problem: load('problem') };
    this.tray = new Tray(this.icons.ok);
    this.tray.setToolTip('Fabric Dashboards');
  }

  update(services: ServiceSnapshot[], limits: Readonly<Record<string, readonly LimitView[]>> = {}, sessions: readonly SessionRow[] = []): void {
    const lang = this.lang();
    const level = trayLevel(services, limits, sessions);
    // W2 (UX-04): the headline and the first items are the attention queue Overview, the sidebar and the Dock count.
    const model = trayMenuModel(services, { now: Date.now(), limits, lang, hidden: this.actions.hidden() });
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
