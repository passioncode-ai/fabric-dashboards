// The menu bar glance (SCN-023): one icon in three states, problems first.
import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { t, type Lang } from '../core/i18n';
import { attentionRank } from '@passioncode-ai/fabric-service-host/state';
import type { ServiceSnapshot, ServiceState } from '../core/types';

export type TrayLevel = 'ok' | 'degraded' | 'problem';

export function trayLevel(services: ServiceSnapshot[]): TrayLevel {
  const bad: ServiceState[] = ['down', 'duplicate', 'foreign', 'conflict', 'invalid'];
  if (services.some((s) => bad.includes(s.state))) return 'problem';
  if (services.some((s) => s.state === 'degraded' || s.state === 'starting' || s.state === 'stopping')) return 'degraded';
  return 'ok';
}

const MARK: Record<ServiceState, string> = {
  ready: '●', degraded: '▲', duplicate: '▲', down: '✕', foreign: '✕', conflict: '✕', invalid: '✕', stopped: '○', starting: '◌', stopping: '◌',
};

export interface TrayActions {
  open(key?: string): void;
  pause(): void;
  resume(): void;
  paused(): boolean;
  quit(): void;
}

export class AppTray {
  private readonly tray: Tray;
  private readonly icons: Record<TrayLevel, Electron.NativeImage>;

  constructor(assets: string, private readonly actions: TrayActions, private readonly lang: () => Lang) {
    const load = (name: string) => {
      const image = nativeImage.createFromPath(path.join(assets, `${name}Template.png`));
      image.setTemplateImage(true);
      return image;
    };
    this.icons = { ok: load('tray'), degraded: load('trayDegraded'), problem: load('trayProblem') };
    this.tray = new Tray(this.icons.ok);
    this.tray.setToolTip('Fabric Dashboards');
  }

  update(services: ServiceSnapshot[]): void {
    const lang = this.lang();
    const level = trayLevel(services);
    this.tray.setImage(this.icons[level]);
    const problems = services
      .map((s) => ({ s, rank: attentionRank(s.state, s.wellKnown) }))
      .filter((x) => x.rank !== null && x.rank < 6)
      .sort((a, b) => a.rank! - b.rank!);
    const item = (s: ServiceSnapshot): MenuItemConstructorOptions => ({
      label: `${MARK[s.state]}  ${s.descriptor?.name ?? s.key} — ${t(lang, `state.${s.state}`)}`,
      click: () => this.actions.open(s.key),
    });
    const template: MenuItemConstructorOptions[] = [
      { label: problems.length ? t(lang, 'tray.problems', { count: problems.length }) : t(lang, 'tray.allReady'), enabled: false },
      ...problems.map((p) => item(p.s)),
      { type: 'separator' },
      ...services.filter((s) => !problems.some((p) => p.s.key === s.key)).map(item),
      { type: 'separator' },
      { label: t(lang, 'tray.open'), click: () => this.actions.open() },
      this.actions.paused()
        ? { label: t(lang, 'tray.resume'), click: () => this.actions.resume() }
        : { label: t(lang, 'tray.pause'), click: () => this.actions.pause() },
      { type: 'separator' },
      { label: t(lang, 'tray.quit'), click: () => this.actions.quit() },
    ];
    this.tray.setContextMenu(Menu.buildFromTemplate(template));
    this.tray.setToolTip(`Fabric Dashboards — ${problems.length ? t(lang, 'tray.problems', { count: problems.length }) : t(lang, 'tray.allReady')}`);
  }
}
