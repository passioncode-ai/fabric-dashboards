import { useEffect, useState } from 'react';
import { langFor, type Lang } from '../core/i18n';
import type { AppStatus } from '../core/types';
import { Activity } from './components/Activity';
import { Overview } from './components/Overview';
import { ServiceView } from './components/ServiceView';
import { Settings } from './components/Settings';
import mark from './brand/dashboards-mark.svg';
import { api, GLYPH, LangContext, nameOf, Spinner, useT } from './lib';

type Route = { page: 'overview' } | { page: 'activity' } | { page: 'settings' } | { page: 'service'; key: string; link?: string; nonce?: number };

const PROBLEM = new Set(['down', 'duplicate', 'foreign', 'conflict', 'invalid']);

export function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [route, setRoute] = useState<Route>({ page: 'overview' });
  const [stopKey, setStopKey] = useState<string | null>(null);

  useEffect(() => {
    void api().locale().then((l) => { setLang(langFor(l)); document.documentElement.lang = langFor(l); });
    void api().status().then(setStatus);
    void api().settings().then((s) => applyTheme(s.theme));
    const offStatus = api().onStatus(setStatus);
    const go = (target: { page: 'service' | 'activity'; key?: string; link?: string }) => {
      if (target.page === 'activity') setRoute({ page: 'activity' });
      else if (target.key) setRoute({ page: 'service', key: target.key, link: target.link, nonce: Date.now() });
    };
    const offNav = api().onNavigate(go);
    void api().takeNavigation().then((target) => { if (target) go(target); }); // after subscribing: nothing falls between
    return () => { offStatus(); offNav(); };
  }, []);

  useEffect(() => { if (route.page !== 'service') void api().hideView(); }, [route.page]);
  useEffect(() => {
    if (route.page === 'service' && status && !status.services.some((s) => s.key === route.key)) setRoute({ page: 'overview' }); // SCN-003: removed
  }, [status, route]);

  return (
    <LangContext.Provider value={lang}>
      {status ? <Shell status={status} route={route} setRoute={setRoute} stopKey={stopKey} setStopKey={setStopKey} /> : <div className="page muted row"><Spinner /></div>}
    </LangContext.Provider>
  );
}

function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
}

interface ShellProps {
  status: AppStatus; route: Route; setRoute: (r: Route) => void; stopKey: string | null; setStopKey: (k: string | null) => void;
}

function Shell({ status, route, setRoute, stopKey, setStopKey }: ShellProps) {
  const { t } = useT();
  const open = (key: string, link?: string) => setRoute({ page: 'service', key, link, nonce: Date.now() });
  const act = (key: string, action: 'restart' | 'start' | 'update') => {
    if (action === 'update') { open(key); void api().command(key, 'update'); }
    else void api().control(key, action);
  };
  const problems = status.services.filter((s) => PROBLEM.has(s.state)).length;
  const current = route.page === 'service' ? status.services.find((s) => s.key === route.key) : undefined;
  const stopping = stopKey ? status.services.find((s) => s.key === stopKey) : undefined;
  const count = status.services.length;

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Fabric Dashboards">
        <div className="brand"><img src={mark} alt="" /> {t('app.name')}</div>
        <div className="nav">
          <button className="nav-item" aria-current={route.page === 'overview' ? 'page' : undefined} onClick={() => setRoute({ page: 'overview' })}>
            <span className="nav-label">{t('nav.overview')}</span>
            {problems > 0 && <span className="count alert">{problems}</span>}
          </button>
          <button className="nav-item" aria-current={route.page === 'activity' ? 'page' : undefined} onClick={() => setRoute({ page: 'activity' })}>
            <span className="nav-label">{t('nav.activity')}</span>
            {status.unread > 0 && <span className="count">{status.unread}</span>}
          </button>
        </div>
        <div className="nav-section">{t('nav.services')}</div>
        <div className="nav nav-scroll">
          {status.services.map((s) => (
            <button key={s.key} className="nav-item" aria-current={route.page === 'service' && route.key === s.key ? 'page' : undefined} onClick={() => open(s.key)}>
              <span className={`state state-${s.state}`} aria-hidden="true"><span className="glyph">{GLYPH[s.state]}</span></span>
              <span className="nav-label">{nameOf(s)}</span>
              <span className="visually-hidden">{t(`state.${s.state}`)}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <UpdateLine status={status} />
          <button className="nav-item" aria-current={route.page === 'settings' ? 'page' : undefined} onClick={() => setRoute({ page: 'settings' })}>
            <span className="nav-label">{t('nav.settings')}</span>
          </button>
        </div>
      </nav>
      <main className="main">
        {route.page === 'service' && current
          ? <ServiceView key={current.key} s={current} link={route.link} nonce={route.nonce} overlayOpen={Boolean(stopKey)} askStop={setStopKey} />
          : (
            <div className="page">
              <div className="page-head">
                <h1>{t(route.page === 'activity' ? 'activity.title' : route.page === 'settings' ? 'settings.title' : 'overview.title')}</h1>
                {route.page === 'overview' && count > 0 && <span className="meta">{count === 1 ? t('overview.count.one') : t('overview.count', { count })}</span>}
              </div>
              {route.page === 'overview' && <Overview status={status} open={open} act={act} />}
              {route.page === 'activity' && <Activity status={status} openAt={open} />}
              {route.page === 'settings' && <Settings status={status} onTheme={applyTheme} />}
            </div>
          )}
      </main>
      {stopping && (
        <div className="scrim" role="presentation" onKeyDown={(e) => e.key === 'Escape' && setStopKey(null)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="stop-title" aria-describedby="stop-body">
            <h2 id="stop-title">{t('stop.title', { name: nameOf(stopping) })}</h2>
            <p id="stop-body">{t('stop.body')}</p>
            <div className="row">
              <button className="btn" autoFocus onClick={() => setStopKey(null)}>{t('action.cancel')}</button>
              <button className="btn btn-danger" onClick={() => { const k = stopping.key; setStopKey(null); void api().control(k, 'stop'); }}>{t('action.stop')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UpdateLine({ status }: { status: AppStatus }) {
  const { t } = useT();
  const u = status.update;
  if (u.state === 'checking') return <p className="meta row"><Spinner /> {t('update.checking')}</p>;
  if (u.state === 'downloading') return <p className="meta row"><Spinner /> {t('update.downloading')}</p>;
  if (u.state === 'ready') return <div className="row"><span className="meta">{t('update.ready', { version: u.version ?? '' })}</span><button className="btn btn-primary" onClick={() => void api().restartToUpdate()}>{t('update.restart')}</button></div>;
  if (u.state === 'error') return <div className="row"><span className="meta state-down">{t('update.error', { error: u.error ?? '' })}</span><button className="btn" onClick={() => void api().checkForUpdates()}>{t('update.retry')}</button></div>;
  return null;
}
