import { useEffect, useRef, useState } from 'react';
import { langFor, t as tr, type Lang } from '../core/i18n';
import type { AppStatus } from '../core/types';
import { groupProducts, productOf, type Product } from '../core/products';
import { Activity, type ActivityFilter } from './components/Activity';
import { LoginQuestion, Overview } from './components/Overview';
import { ServiceView } from './components/ServiceView';
import { Settings } from './components/Settings';
import { Spend } from './components/Spend';
import mark from './brand/dashboards-mark.svg';
import { api, GLYPH, LangContext, nameOf, Spinner, useT } from './lib';

type Route = { page: 'overview' } | { page: 'activity'; serviceKey?: string; nonce?: number } | { page: 'spend' } | { page: 'settings' } | { page: 'service'; key: string; link?: string; nonce?: number; tab?: 'logs' | 'health' };

const PROBLEM = new Set(['down', 'duplicate', 'foreign', 'conflict', 'invalid']);

export function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [route, setRoute] = useState<Route>({ page: 'overview' });
  const [stopKey, setStopKey] = useState<string | null>(null);
  // U-8: the Activity filter is kept between visits; a notification about one service presets it (U-19).
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>({ serviceKey: '', minLevel: '' });

  useEffect(() => {
    void api().locale().then((l) => { setLang(langFor(l)); document.documentElement.lang = langFor(l); });
    void api().status().then(setStatus);
    void api().settings().then((s) => applyTheme(s.theme));
    const offStatus = api().onStatus(setStatus);
    const go = (target: { page: 'service' | 'activity' | 'overview'; key?: string; link?: string }) => {
      if (target.page === 'overview') setRoute({ page: 'overview' });
      else if (target.page === 'activity') {
        if (target.key) setActivityFilter((f) => ({ ...f, serviceKey: target.key! }));
        setRoute({ page: 'activity', serviceKey: target.key, nonce: Date.now() });
      } else if (target.key) setRoute({ page: 'service', key: target.key, link: target.link, nonce: Date.now() });
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
      {status ? <Shell status={status} route={route} setRoute={setRoute} stopKey={stopKey} setStopKey={setStopKey} activityFilter={activityFilter} setActivityFilter={setActivityFilter} /> : <div className="page muted row" role="status"><Spinner /> {tr(lang, 'app.loading')}</div>}
    </LangContext.Provider>
  );
}

function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
}

interface ShellProps {
  status: AppStatus; route: Route; setRoute: (r: Route) => void; stopKey: string | null; setStopKey: (k: string | null) => void;
  activityFilter: ActivityFilter; setActivityFilter: (f: ActivityFilter) => void;
}

function Shell({ status, route, setRoute, stopKey, setStopKey, activityFilter, setActivityFilter }: ShellProps) {
  const { t } = useT();
  const open = (key: string, link?: string, tab?: 'logs' | 'health') => setRoute({ page: 'service', key, link, nonce: Date.now(), tab });
  const act = (key: string, action: 'restart' | 'start' | 'update') => {
    // U-2: an update started from Needs attention shows its output on the service's Health tab.
    if (action === 'update') open(key, undefined, 'health');
    else void api().control(key, action);
  };
  const problems = status.services.filter((s) => PROBLEM.has(s.state)).length;
  const current = route.page === 'service' ? status.services.find((s) => s.key === route.key) : undefined;
  const stopping = stopKey ? status.services.find((s) => s.key === stopKey) : undefined;
  // U-14: the Stop dialog holds focus. Everything behind it is inert while it is open (the embedded
  // dashboard is a native view and hides itself on overlayOpen); closing it puts focus back on the
  // control that opened it, when that control is still on screen.
  const opener = useRef<HTMLElement | null>(null);
  const askStop = (key: string) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setStopKey(key); };
  const stopOpen = Boolean(stopping);
  useEffect(() => {
    if (stopOpen) return;
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected && !(el as HTMLButtonElement).disabled) el.focus();
  }, [stopOpen]);
  // T-18: a service removed while its Stop dialog is open takes the dialog with it — never a hidden
  // dashboard behind an invisible dialog, never the dialog coming back by itself when it returns.
  useEffect(() => { if (stopKey && !stopping) setStopKey(null); }, [stopKey, stopping]);
  // T-21: Escape closes the dialog wherever focus is, including after a click on the backdrop.
  useEffect(() => {
    if (!stopOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setStopKey(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [stopOpen]);
  const confirmStop = (key: string) => {
    // T-21: Stop turns into a disabled Stop and then Start, so focus goes to the service's title,
    // which stays on screen, instead of falling to the page.
    opener.current = document.getElementById('svc-title');
    setStopKey(null);
    void api().control(key, 'stop');
  };
  // ADR-0012: one sidebar entry per product; every member keeps its own key, state and controls.
  const products = groupProducts(status.services);
  const foreground = products.filter((p) => !p.background);
  const background = products.filter((p) => p.background);
  const currentProduct = route.page === 'service' ? productOf(products, route.key) : undefined;
  const count = products.length; // ADR-0012: the heading counts what the sidebar lists

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Fabric Dashboards" inert={stopOpen}>
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
          <button className="nav-item" aria-current={route.page === 'spend' ? 'page' : undefined} onClick={() => setRoute({ page: 'spend' })}>
            <span className="nav-label">{t('nav.spend')}</span>
          </button>
        </div>
        <div className="nav nav-scroll">
          {foreground.length > 0 && <div className="nav-section">{t('nav.services')}</div>}
          {foreground.map((p) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} />)}
          {background.length > 0 && <div className="nav-section">{t('nav.background')}</div>}
          {background.map((p) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} />)}
        </div>
        <div className="sidebar-footer">
          <UpdateLine status={status} />
          <button className="nav-item" aria-current={route.page === 'settings' ? 'page' : undefined} onClick={() => setRoute({ page: 'settings' })}>
            <span className="nav-label">{t('nav.settings')}</span>
          </button>
        </div>
      </nav>
      <main className="main" inert={stopOpen}>
        {route.page === 'service' && current
          ? <ServiceView key={current.key} s={current} all={status.services} members={currentProduct?.members ?? [current]} open={open} link={route.link} nonce={route.nonce} tab={route.tab} runUpdate={route.tab === 'health' && route.page === 'service'} activityRev={status.activityRev} overlayOpen={stopOpen} askStop={askStop} updateStarted={() => setRoute({ ...route, tab: undefined })} />
          : (
            <div className="page">
              <div className="page-head">
                <h1>{t(route.page === 'activity' ? 'activity.title' : route.page === 'spend' ? 'spend.title' : route.page === 'settings' ? 'settings.title' : 'overview.title')}</h1>
                {route.page === 'overview' && count > 0 && <span className="meta">{count === 1 ? t('overview.count.one') : t('overview.count', { count })}</span>}
              </div>
              {route.page === 'overview' && <LoginQuestion />}
              {route.page === 'overview' && <Overview status={status} products={products} open={open} act={act} goSpend={() => setRoute({ page: 'spend' })} />}
              {route.page === 'activity' && <Activity status={status} openAt={open} filter={activityFilter} setFilter={setActivityFilter} />}
              {route.page === 'spend' && <Spend status={status} />}
              {route.page === 'settings' && <Settings status={status} onTheme={applyTheme} />}
            </div>
          )}
      </main>
      {stopping && (
        <div className="scrim" role="presentation">
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="stop-title" aria-describedby="stop-body">
            <h2 id="stop-title">{t('stop.title', { name: nameOf(stopping) })}</h2>
            <p id="stop-body">{t('stop.body')}</p>
            <div className="row">
              <button className="btn" autoFocus onClick={() => setStopKey(null)}>{t('action.cancel')}</button>
              <button className="btn btn-danger" onClick={() => confirmStop(stopping.key)}>{t('action.stop')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A product in the sidebar: the primary's name and state; a member in trouble adds a mark, never a changed state (ADR-0012). */
function ProductItem({ p, current, open }: { p: Product; current: boolean; open: (key: string) => void }) {
  const { t } = useT();
  const s = p.primary;
  return (
    <button className="nav-item" aria-current={current ? 'page' : undefined} onClick={() => open(s.key)}>
      <span className={`state state-${s.state}`} aria-hidden="true"><span className="glyph">{GLYPH[s.state]}</span></span>
      <span className="nav-label">{nameOf(s)}</span>
      {p.memberProblem && <span className="count alert" title={t('nav.memberProblem')} aria-hidden="true">!</span>}
      <span className="visually-hidden">{t(`state.${s.state}`)}{p.memberProblem ? `, ${t('nav.memberProblem')}` : ''}</span>
    </button>
  );
}

function UpdateLine({ status }: { status: AppStatus }) {
  const { t } = useT();
  const u = status.update;
  if (u.state === 'checking') return <p className="meta row"><Spinner /> {t('update.checking')}</p>;
  if (u.state === 'downloading') return <p className="meta row"><Spinner /> {t('update.downloading')}</p>;
  if (u.state === 'ready') return <div className="row"><span className="meta">{(u.version ? t('update.ready', { version: u.version }) : t('update.readyUnnamed'))}</span><button className="btn btn-primary" onClick={() => void api().restartToUpdate()}>{t('update.restart')}</button></div>;
  if (u.state === 'misplaced') return <div className="row"><span className="meta state-down">{t('update.misplaced')}</span><button className="btn" onClick={() => void api().moveToApplications()}>{t('move.confirm')}</button></div>;
  if (u.state === 'error') return <div className="row"><span className="meta state-down">{t('update.error', { error: u.error ?? '' })}</span><button className="btn" onClick={() => void api().checkForUpdates()}>{t('update.retry')}</button></div>;
  return null;
}
