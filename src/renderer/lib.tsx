import { createContext, useContext, useEffect, useState } from 'react';
import type { FabricApi } from '../core/api';
import { duration as fmtDuration, hasKey, t as translate, type Lang } from '../core/i18n';
import type { Reason, ServiceSnapshot, ServiceState } from '../core/types';
import { displayName } from '../core/names';
import { NEWS_MS } from '../core/focus';
import { machineRu } from '../core/machine-ru';

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
    if (r.code === 'raw') return lang === 'ru' ? machineRu(String(r.params?.text ?? '')) : String(r.params?.text ?? ''); // FD-19
    const params = { ...(r.params ?? {}) };
    if (typeof params.since === 'string' && /T/.test(params.since)) params.since = new Date(params.since).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    return hasKey(r.code) ? translate(lang, r.code, params) : r.code;
  };
  const duration = (ms: number) => fmtDuration(lang, ms);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  return { t, reason, duration, time, lang };
}

/** The one mark per state, on every surface (VIS-08): sidebar, cards, tray menu, Connections tab and map. The word
 *  always goes with it; colour is the third signal, never the only one. src/electron/tray.ts keeps a copy that a
 *  test holds equal to this table. */
export const GLYPH: Record<ServiceState, string> = {
  ready: '●', degraded: '▲', duplicate: '▲', down: '✕', foreign: '✕', conflict: '✕', invalid: '✕', stopped: '○', starting: '◌', stopping: '◌',
};

/** A connection's state in the same shapes: works as ready, slow as degraded, broken as down (VIS-08). */
export const CONN_MARK = { ok: GLYPH.ready, degraded: GLYPH.degraded, down: GLYPH.down, unknown: GLYPH.stopped } as const;

/** An auditor finding or a stopped session: an error is drawn as down, a warning as degraded, a fine one as ready.
 *  `setup` has no agent state of its own and keeps its diamond. */
export const SEV_MARK = { ok: GLYPH.ready, error: GLYPH.down, warn: GLYPH.degraded, setup: '◆', info: GLYPH.stopped } as const;

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
/** COPY-02: an origin without a port uses its scheme's (443 for https), so the port is a number, never a dash. */
export const portOf = (s: ServiceSnapshot) => {
  const origin = s.descriptor?.origin ?? '';
  return /:(\d+)$/.exec(origin)?.[1] ?? (origin.startsWith('https://') ? '443' : origin.startsWith('http://') ? '80' : '');
};
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
  // FD-81: the Connections map, three nodes and two lines.
  map: 'M3 5h4v4H3zM13 3h4v4h-4zM13 13h4v4h-4zM7 7l6-2M7 7l6 8',
  console: 'M2 4h16v12H2zM5 8l3 2-3 2M10 13h4',
  chevronDown: 'M5 8l5 5 5-5',
  chevronUp: 'M5 12l5-5 5 5',
  close: 'M5 5l10 10M15 5 5 15',
  // FD-74: the dashboard toolbar and the console's Terminal button.
  back: 'M12 4l-6 6 6 6',
  forward: 'M8 4l6 6-6 6',
  reload: 'M16 10a6 6 0 1 1-1.76-4.24M16 3.5v3h-3',
  home: 'M3 9.5 10 3.5l7 6M5 8v8.5h10V8',
  copy: 'M7 7h9v10H7zM4 13V3h9',
  check: 'M4 10.5l4 4 8-9',
  external: 'M11 3h6v6M17 3l-7.5 7.5M14 12v5H3V6h5',
};
export function Icon({ name }: { name: keyof typeof ICONS | string }) {
  return (
    <svg className="icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={ICONS[name] ?? ''} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
