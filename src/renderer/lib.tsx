import { createContext, useContext, useEffect, useState } from 'react';
import type { FabricApi } from '../core/api';
import { duration as fmtDuration, hasKey, t as translate, type Lang } from '../core/i18n';
import type { Reason, ServiceSnapshot, ServiceState } from '../core/types';
import { displayName } from '../core/names';
import { NEWS_MS } from '../core/focus';

declare global {
  interface Window { fabric: FabricApi }
}

export const api = (): FabricApi => window.fabric;

export { NEWS_MS };

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

// ADR-0017: the few icons the folded panels need, drawn in currentColor so they follow the theme.
const ICONS: Record<string, string> = {
  overview: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
  activity: 'M2 10h4l2-5 4 10 2-5h4',
  spend: 'M10 2v16M14 5.5c-.8-1-2.2-1.5-4-1.5-2.2 0-4 1-4 3s1.8 2.6 4 3 4 1 4 3-1.8 3-4 3c-1.8 0-3.2-.5-4-1.5',
  settings: 'M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM10 1.5v2.5M10 16v2.5M1.5 10H4M16 10h2.5M4 4l1.8 1.8M14.2 14.2 16 16M4 16l1.8-1.8M14.2 5.8 16 4',
  sidebar: 'M3 3h14v14H3zM8 3v14',
  console: 'M2 4h16v12H2zM5 8l3 2-3 2M10 13h4',
  chevronDown: 'M5 8l5 5 5-5',
  chevronUp: 'M5 12l5-5 5 5',
  close: 'M5 5l10 10M15 5 5 15',
};
export function Icon({ name }: { name: keyof typeof ICONS | string }) {
  return (
    <svg className="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={ICONS[name] ?? ''} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
