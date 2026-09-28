import { createContext, useContext } from 'react';
import type { FabricApi } from '../core/api';
import { duration as fmtDuration, hasKey, t as translate, type Lang } from '../core/i18n';
import type { Reason, ServiceSnapshot, ServiceState } from '../core/types';

declare global {
  interface Window { fabric: FabricApi }
}

export const api = (): FabricApi => window.fabric;

export const LangContext = createContext<Lang>('en');

export function useT() {
  const lang = useContext(LangContext);
  const t = (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
  const reason = (r: Reason | null | undefined): string => {
    if (!r) return '';
    if (r.code === 'raw') return String(r.params?.text ?? '');
    const params = { ...(r.params ?? {}) };
    if (typeof params.since === 'string' && /T/.test(params.since)) params.since = new Date(params.since).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    return hasKey(r.code) ? translate(lang, r.code, params) : r.code;
  };
  const duration = (ms: number) => fmtDuration(lang, ms);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  return { t, reason, duration, time, lang };
}

export const GLYPH: Record<ServiceState, string> = {
  ready: '●', degraded: '▲', duplicate: '▲', down: '✕', foreign: '✕', conflict: '✕', invalid: '✕', stopped: '○', starting: '◌', stopping: '◌',
};

export function StateBadge({ state }: { state: ServiceState }) {
  const { t } = useT();
  return (
    <span className={`state state-${state}`}>
      <span className="glyph" aria-hidden="true">{GLYPH[state]}</span>
      {t(`state.${state}`)}
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export const nameOf = (s: ServiceSnapshot) => s.descriptor?.name ?? s.wellKnown?.service.name ?? s.key;
export const portOf = (s: ServiceSnapshot) => /:(\d+)$/.exec(s.descriptor?.origin ?? '')?.[1] ?? '—';
export const shortBuild = (s: ServiceSnapshot) => {
  const b = s.wellKnown?.service.build;
  if (!b) return '';
  return b.commit ? b.commit.slice(0, 7) + (b.dirty ? '+' : '') : (b.digest ?? '').replace('sha256:', '').slice(0, 7);
};
