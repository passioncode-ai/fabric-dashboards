import { createContext, useContext, useEffect, useState } from 'react';
import type { FabricApi } from '../core/api';
import { duration as fmtDuration, hasKey, t as translate, type Lang } from '../core/i18n';
import type { Reason, ServiceSnapshot, ServiceState } from '../core/types';
import { displayName } from '../core/names';

declare global {
  interface Window { fabric: FabricApi }
}

export const api = (): FabricApi => window.fabric;

/** How long a finished action stays news on Overview and the service page (U-1, P-15). */
export const NEWS_MS = 30 * 60_000;

/** T-19: re-render once at the earliest of `times` + `ms`, so news that expires leaves the screen
 *  even when no status push arrives. Returns the current time for the render to compare against. */
export function useExpiry(times: (string | undefined)[], ms = NEWS_MS): number {
  const [now, setNow] = useState(() => Date.now());
  const due = times.map((at) => Date.parse(at ?? '') + ms).filter((t) => Number.isFinite(t) && t > now);
  const next = due.length ? Math.min(...due) : null;
  useEffect(() => {
    if (next === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - Date.now() + 50, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [next]);
  return Math.max(now, Date.now());
}

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

/** The name a person reads; a second instance of one agent carries its instance (ADR-0010). */
export const nameOf = (s: ServiceSnapshot) => {
  const named = s.descriptor ?? s.wellKnown?.service;
  return named ? displayName(named.name, named.instance) : s.key;
};
export const portOf = (s: ServiceSnapshot) => /:(\d+)$/.exec(s.descriptor?.origin ?? '')?.[1] ?? '—';
export const shortBuild = (s: ServiceSnapshot) => {
  const b = s.wellKnown?.service.build;
  if (!b) return '';
  return b.commit ? b.commit.slice(0, 7) + (b.dirty ? '+' : '') : (b.digest ?? '').replace('sha256:', '').slice(0, 7);
};
