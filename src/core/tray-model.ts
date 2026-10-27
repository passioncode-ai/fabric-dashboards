// #region tray-model — docs: docs/ux/scenarios.md#scn-023-glance-from-the-menu-bar
// SCN-023, W2 (UX-04): what the menu bar says, from the same attention queue as Overview, the sidebar and the Dock.
// The headline counts the queue; its items come first, each worded by what it is (a state, a spending limit that
// stopped work, an update); every other agent follows. Pure and free of Electron, so a test reads the menu.
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import { attentionQueue } from './attention';
import { t, type Lang } from './i18n';
import { displayName } from './names';
import { productIdOf } from './products';
import type { ServiceSnapshot, ServiceState } from './types';

export const MARK: Record<ServiceState, string> = {
  ready: '●', degraded: '▲', duplicate: '▲', down: '✕', foreign: '✕', conflict: '✕', invalid: '✕', stopped: '○', starting: '◌', stopping: '◌',
};

export interface TrayItem { key: string; label: string }
export interface TrayMenuModel { headline: string; attention: TrayItem[]; rest: TrayItem[] }

/** `hidden`: the products the person hid (FD-78; FD-129 UX-19): they leave the menu's list of other agents. The
 *  attention queue keeps them, so the menu counts what Overview, the sidebar and the Dock count. */
export function trayMenuModel(services: readonly ServiceSnapshot[], o: { now: number; limits?: Readonly<Record<string, readonly LimitView[]>>; lang: Lang; hidden?: readonly string[] }): TrayMenuModel {
  const { lang } = o;
  const queue = attentionQueue(services, o);
  // U-7: the name a person reads elsewhere, instance included, so two instances never read alike.
  const name = (s: ServiceSnapshot) => (s.descriptor ? displayName(s.descriptor.name, s.descriptor.instance) : s.key);
  const plain = (s: ServiceSnapshot): TrayItem => ({ key: s.key, label: `${MARK[s.state]}  ${t(lang, 'join.nameState', { name: name(s), state: t(lang, `state.${s.state}`) })}` });
  const attention = queue.map(({ s, limit }): TrayItem => {
    if (limit && s.state === 'ready') return { key: s.key, label: `✕  ${t(lang, 'tray.limit', { name: name(s) })}` };
    const version = s.wellKnown?.update?.available;
    if (s.state === 'ready' && version && !limit) return { key: s.key, label: `↑  ${t(lang, 'tray.update', { name: name(s), version })}` };
    return plain(s);
  });
  const inQueue = new Set(queue.map((x) => x.s.key));
  // "All agents ready" only when it is true: a degraded, stopped or starting agent is not ready.
  const notReady = services.filter((s) => s.state !== 'ready').length;
  const headline = queue.length ? t(lang, 'tray.problems', { count: queue.length })
    : notReady ? t(lang, 'tray.notAllReady', { ready: services.length - notReady, total: services.length }) : t(lang, 'tray.allReady');
  const hidden = new Set(o.hidden ?? []);
  return { headline, attention, rest: services.filter((s) => !inQueue.has(s.key) && !hidden.has(productIdOf(s.key))).map(plain) };
}
// #endregion tray-model
