// The menu bar glance (SCN-023): one icon in three states, problems first.
import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { displayName } from '../core/names';
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
  private shown = ''; // what the menu shows now; an identical update rebuilds nothing (LC-08)

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
    const signature = JSON.stringify([lang, level, this.actions.paused(), services.map((s) => [s.key, s.state, s.descriptor?.name, attentionRank(s.state, s.wellKnown)])]);
    if (signature === this.shown) return;
    this.shown = signature;
    this.tray.setImage(this.icons[level]);
    const problems = services
      .map((s) => ({ s, rank: attentionRank(s.state, s.wellKnown) }))
      .filter((x) => x.rank !== null && x.rank < 6)
      .sort((a, b) => a.rank! - b.rank!);
    // U-7: the name a person reads elsewhere, instance included, so two instances never read alike.
    const item = (s: ServiceSnapshot): MenuItemConstructorOptions => ({
      label: `${MARK[s.state]}  ${s.descriptor ? displayName(s.descriptor.name, s.descriptor.instance) : s.key} — ${t(lang, `state.${s.state}`)}`,
      click: () => this.actions.open(s.key),
    });
    // "All ready" only when it is true: a degraded, stopped or starting service is not ready.
    const notReady = services.filter((s) => s.state !== 'ready').length;
    const headline = problems.length ? t(lang, 'tray.problems', { count: problems.length })
      : notReady ? t(lang, 'tray.notAllReady', { ready: services.length - notReady, total: services.length }) : t(lang, 'tray.allReady');
    const template: MenuItemConstructorOptions[] = [
      { label: headline, enabled: false },
      ...problems.map((p) => item(p.s)),
      { type: 'separator' },
      ...services.filter((s) => !problems.some((p) => p.s.key === s.key)).map(item),
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
    this.tray.setToolTip(`Fabric Dashboards — ${headline}`);
  }
}
