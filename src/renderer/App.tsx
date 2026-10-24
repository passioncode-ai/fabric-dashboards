import { useCallback, useEffect, useRef, useState } from 'react';
import { langFor, t as tr, type Lang } from '../core/i18n';
import { DEFAULT_SETTINGS, type AppStatus, type Settings as AppSettings, type SettingsPatch, type ListSort } from '../core/types';
import { groupProducts, productOf, type Product, arrangeProducts, categoryOf, setKind, toggleHidden, togglePin } from '../core/products';
import { Activity, type ActivityFilter } from './components/Activity';
import { SetupCard, Overview } from './components/Overview';
import { ServiceView } from './components/ServiceView';
import { Settings } from './components/Settings';
import { Spend } from './components/Spend';
import { ConnectionsMap } from './components/ConnectionsMap';
import { audit } from '../core/audit';
import { SETUP_KEY } from '../core/offers';
import { sinceLastVisit, type SinceLastVisit } from '../core/visit';
import type { ConsoleTask, Rect } from '../core/api';
import mark from './brand/dashboards-mark.svg';
import { api, GLYPH, Icon, LangContext, nameOf, Spinner, useT } from './lib';

type Route = { page: 'overview' } | { page: 'handover'; key: string } | { page: 'activity'; serviceKey?: string; nonce?: number } | { page: 'spend' } | { page: 'map' } | { page: 'settings' } | { page: 'service'; key: string; link?: string; nonce?: number; tab?: 'logs' | 'health' | 'connections' };

const PROBLEM = new Set(['down', 'duplicate', 'foreign', 'conflict', 'invalid']);

export function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [route, setRoute] = useState<Route>({ page: 'overview' });
  const [stopKey, setStopKey] = useState<string | null>(null);
  // U-8: the Activity filter is kept between visits; a notification about one service presets it (U-19).
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>({ serviceKey: '', minLevel: '' });
  // ADR-0017: how much of the window the dashboard gets, remembered in Settings.layout.
  const [layout, setLayout] = useState<AppSettings['layout']>(DEFAULT_SETTINGS.layout);
  const changeLayout = (patch: NonNullable<SettingsPatch['layout']>, persist = true) => {
    setLayout((l) => ({ ...l, ...patch, console: { ...l.console, ...(patch.console ?? {}) }, list: { ...l.list, ...(patch.list ?? {}) } }));
    // Review R-9: the screen is the truth while the person moves panels; a slower reply never undoes a later change.
    if (persist) void api().updateSettings({ layout: patch }).catch(() => undefined);
  };

  // The language the main process speaks: the person's choice in Settings, else the system's.
  const reloadLang = () => void api().locale().then((l) => { setLang(langFor(l)); document.documentElement.lang = langFor(l); });
  useEffect(() => {
    reloadLang();
    void api().status().then(setStatus);
    void api().settings().then((s) => { applyTheme(s.theme); setLayout(s.layout); });
    const offStatus = api().onStatus(setStatus);
    const go = (target: { page: 'service' | 'activity' | 'overview' | 'spend' | 'map' | 'settings'; key?: string; link?: string }) => {
      if (target.page === 'overview') setRoute({ page: 'overview' });
      else if (target.page === 'spend' || target.page === 'map' || target.page === 'settings') setRoute({ page: target.page });
      else if (target.page === 'activity') {
        if (target.key) setActivityFilter((f) => ({ ...f, serviceKey: target.key! }));
        setRoute({ page: 'activity', serviceKey: target.key, nonce: Date.now() });
      } else if (target.key) setRoute({ page: 'service', key: target.key, link: target.link, nonce: Date.now() });
    };
    const offNav = api().onNavigate(go);
    const offLayout = api().onLayoutCommand((which) => setLayout((l) => {
      const patch = which === 'sidebar' ? { sidebar: l.sidebar === 'collapsed' ? 'expanded' as const : 'collapsed' as const }
        : which === 'console' ? { console: { open: !l.console.open } }
        : { header: l.header === 'full' ? 'compact' as const : 'full' as const };
      void api().updateSettings({ layout: patch }).catch(() => undefined);
      return { ...l, ...patch, console: { ...l.console, ...('console' in patch ? patch.console : {}) } };
    }));
    void api().takeNavigation().then((target) => { if (target) go(target); }); // after subscribing: nothing falls between
    return () => { offStatus(); offNav(); offLayout(); };
  }, []);

  useEffect(() => { if (route.page !== 'service') void api().hideView(); }, [route.page]);
  // U-18: the main process keeps the screen on show, so Restart to update reopens on it.
  useEffect(() => { api().routeChanged(route.page === 'service' ? { page: 'service', key: route.key } : { page: route.page }); }, [route.page, route.page === 'service' ? route.key : '']);
  useEffect(() => {
    if (route.page === 'service' && status && !status.services.some((s) => s.key === route.key)) setRoute({ page: 'overview' }); // SCN-003: removed
  }, [status, route]);

  return (
    <LangContext.Provider value={lang}>
      {status ? <Shell status={status} route={route} setRoute={setRoute} stopKey={stopKey} setStopKey={setStopKey} activityFilter={activityFilter} setActivityFilter={setActivityFilter} layout={layout} changeLayout={changeLayout} onLanguage={reloadLang} /> : <div className="page muted row" role="status"><Spinner /> {tr(lang, 'app.loading')}</div>}
    </LangContext.Provider>
  );
}

// FD-42: `system` follows macOS (nativeTheme reports it to prefers-color-scheme), live.
const systemLight = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
let chosenTheme: 'system' | 'dark' | 'light' = 'dark';
function paintTheme() {
  const light = chosenTheme === 'light' || (chosenTheme === 'system' && Boolean(systemLight?.matches));
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
}
systemLight?.addEventListener?.('change', paintTheme);
export function applyTheme(theme: 'system' | 'dark' | 'light') {
  chosenTheme = theme;
  paintTheme();
}

interface ShellProps {
  status: AppStatus; route: Route; setRoute: (r: Route) => void; stopKey: string | null; setStopKey: (k: string | null) => void;
  activityFilter: ActivityFilter; setActivityFilter: (f: ActivityFilter) => void;
  layout: AppSettings['layout']; changeLayout: (patch: NonNullable<SettingsPatch['layout']>, persist?: boolean) => void;
  onLanguage: () => void;
}

function Shell({ status, route, setRoute, stopKey, setStopKey, activityFilter, setActivityFilter, layout, changeLayout, onLanguage }: ShellProps) {
  const { t } = useT();
  const open = (key: string, link?: string, tab?: 'logs' | 'health' | 'connections') => setRoute({ page: 'service', key, link, nonce: Date.now(), tab });
  // SCN-059: the agent selected last leads the next visit's Continue list.
  const routeKey = route.page === 'service' ? route.key : null;
  useEffect(() => { if (routeKey) void api().updateSettings({ lastService: routeKey }).catch(() => undefined); }, [routeKey]);
  const act = (key: string, action: 'restart' | 'start' | 'update') => {
    // U-2: an update started from Needs attention shows its output on the service's Health tab.
    if (action === 'update') open(key, undefined, 'health');
    else void api().control(key, action);
  };
  const problems = status.services.filter((s) => PROBLEM.has(s.state)).length;
  // FD-81: the auditor runs with every status push; the nav carries what does not work, the page the rest.
  const auditErrors = audit(status.services).counts.error;
  const current = route.page === 'service' ? status.services.find((s) => s.key === route.key) : undefined;
  const handover = route.page === 'handover' ? (status.handovers ?? []).find((h) => h.key === route.key) : undefined;
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
  // FD-39 (ADR-0020): pinned first in pin order, the rest in the chosen sort.
  const arranged = arrangeProducts(products, layout.list);
  const { pinned, hidden } = arranged;
  const pin = (id: string) => changeLayout({ list: { pinned: togglePin(layout.list.pinned, id) } });
  // FD-78: the row's menu: pin, agent or service, hide. A hidden agent is still watched and still alerts.
  const rowMenu: RowActions = {
    pin,
    hide: (id) => changeLayout({ list: { hidden: toggleHidden(layout.list.hidden, id) } }),
    kind: (p, kind) => changeLayout({ list: { kinds: setKind(layout.list.kinds, p, kind) } }),
    isPinned: (id) => layout.list.pinned.includes(id),
    isHidden: (id) => layout.list.hidden.includes(id),
    isService: (p) => categoryOf(p, layout.list.kinds) === 'service',
  };
  const hiddenProblem = hidden.some((p) => PROBLEM.has(p.primary.state) || p.memberProblem);
  // FD-39 D-3: Fix / Update with agent opens the agent's page and console; the console starts the task once it is ready.
  const [agentTask, setAgentTask] = useState<{ key: string; task?: ConsoleTask; mode?: 'new' | 'continue'; nonce: number } | null>(null);
  // FD-39 SCN-059: Continue resumes the agent's last console session, with its context written fresh.
  const continueWith = (key: string) => {
    setRoute({ page: 'service', key });
    if (!layout.console.open) changeLayout({ console: { open: true } });
    setAgentTask({ key, mode: 'continue', nonce: Date.now() });
  };
  const [visit, setVisit] = useState<SinceLastVisit | null>(null);
  // FD-39 SCN-058: the Setup console from the card or from Settings; Continue resumes a setup stopped midway.
  const openSetup = (mode: 'new' | 'continue') => {
    void api().updateSettings({ setupDone: false }).catch(() => undefined);
    setRoute({ page: 'overview' });
    setSetupOpen(true);
    if (mode === 'continue') setAgentTask({ key: SETUP_KEY, mode: 'continue', nonce: Date.now() });
  };
  // FD-39 SCN-058: the Setup console sits beside Overview; on a first launch with nothing set up it opens by itself
  // (the runtime starts on the person's click: it spends their subscription).
  const [setupOpen, setSetupOpen] = useState(false);
  const setupDecided = useRef(false);
  useEffect(() => {
    // Decided once, after the first scan: an agent found then means this is not a first session.
    if (setupDecided.current || status.scanning) return;
    setupDecided.current = true;
    void Promise.all([api().settings(), api().setupState()]).then(([s, st]) => {
      if (!s.setupDone && status.services.length === 0 && !(st.mcp && st.skills && st.firstAgent)) setSetupOpen(true);
      // SCN-059: what changed since the previous launch, computed once; this launch becomes the next one's baseline.
      setVisit(sinceLastVisit({ services: status.services, lastVisitAt: s.lastVisitAt, known: s.knownServices, consoles: s.consoles, lastService: s.lastService }));
      void api().updateSettings({ lastVisitAt: new Date().toISOString(), knownServices: status.services.map((x) => x.key) }).catch(() => undefined);
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.scanning]);
  const handToAgent = (key: string, task: ConsoleTask) => {
    setRoute({ page: 'service', key });
    if (!layout.console.open) changeLayout({ console: { open: true } });
    setAgentTask({ key, task, nonce: Date.now() });
  };
  const currentProduct = route.page === 'service' ? productOf(products, route.key) : undefined;
  const count = products.length; // ADR-0012: the heading counts what the sidebar lists
  const rail = layout.sidebar === 'collapsed';
  // #region console-drawer — docs: docs/ux/scenarios.md#scn-048-open-an-agents-console-over-its-dashboard
  // FD-92: the console is a drawer over the content area, from under the page header down; it never resizes the
  // dashboard. The main process draws it in a view of its own (drawer.ts); this page says which console, whether it is
  // open and where the area is. A fold, a new height or a taken job comes back from the drawer's page.
  const drawerKey = route.page === 'service' && current ? (layout.console.open ? current.key : null)
    : route.page === 'handover' && handover ? handover.key
    : route.page === 'overview' && setupOpen ? SETUP_KEY : null;
  const mainRef = useRef<HTMLElement>(null);
  const [area, setArea] = useState<Rect | null>(null);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const measure = () => {
      const m = el.getBoundingClientRect();
      const top = el.querySelector('[data-drawer-top]')?.getBoundingClientRect().bottom ?? m.top;
      const y = Math.max(m.top, Math.min(top, m.bottom));
      setArea((a) => (a && a.x === m.left && a.y === y && a.width === m.width && a.height === m.bottom - y ? a : { x: m.left, y, width: m.width, height: m.bottom - y }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const head = el.querySelector('[data-drawer-top]');
    if (head) observer.observe(head);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [route.page, route.page === 'service' ? route.key : '', layout.header, layout.sidebar, drawerKey]);
  const drawerTask = agentTask && agentTask.key === drawerKey ? { task: agentTask.task, mode: agentTask.mode, nonce: agentTask.nonce } : null;
  useEffect(() => {
    api().consoleDrawer({ key: drawerKey, open: Boolean(drawerKey), rect: area, height: layout.console.height, task: drawerTask, suspended: stopOpen });
  }, [drawerKey, area, layout.console.height, drawerTask?.nonce, stopOpen]);
  const drawerOwner = useRef({ route, drawerKey });
  drawerOwner.current = { route, drawerKey };
  useEffect(() => api().onDrawerChange((c) => {
    const { route: r } = drawerOwner.current;
    if (c.kind === 'height') changeLayout({ console: { height: c.height } });
    else if (c.kind === 'taskTaken') setAgentTask((x) => (x && x.nonce === c.nonce ? null : x));
    else if (r.page === 'service') changeLayout({ console: { open: false } });
    else if (r.page === 'overview') setSetupOpen(false);
    else if (r.page === 'handover') setRoute({ page: 'overview' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  // #endregion console-drawer

  return (
    <div className={`app${rail ? ' rail' : ''}`}>
      <nav className="sidebar" aria-label="Fabric Dashboards" inert={stopOpen}>
        <div className="brand"><img src={mark} alt="" /> <span className="brand-name">{t('app.name')}</span></div>
        <div className="nav">
          <button className="nav-item" aria-current={route.page === 'overview' ? 'page' : undefined} title={rail ? t('nav.overview') : undefined} onClick={() => setRoute({ page: 'overview' })}>
            <Icon name="overview" /><span className="nav-label">{t('nav.overview')}</span>
            {problems > 0 && <span className="count alert">{problems}</span>}
          </button>
          <button className="nav-item" aria-current={route.page === 'activity' ? 'page' : undefined} title={rail ? t('nav.activity') : undefined} onClick={() => setRoute({ page: 'activity' })}>
            <Icon name="activity" /><span className="nav-label">{t('nav.activity')}</span>
            {status.unread > 0 && <span className="count">{status.unread}</span>}
          </button>
          <button className="nav-item" aria-current={route.page === 'map' ? 'page' : undefined} title={rail ? t('nav.map') : undefined} onClick={() => setRoute({ page: 'map' })}>
            <Icon name="map" /><span className="nav-label">{t('nav.map')}</span>
            {auditErrors > 0 && <span className="count alert">{auditErrors}</span>}
          </button>
          <button className="nav-item" aria-current={route.page === 'spend' ? 'page' : undefined} title={rail ? t('nav.spend') : undefined} onClick={() => setRoute({ page: 'spend' })}>
            <Icon name="spend" /><span className="nav-label">{t('nav.spend')}</span>
          </button>
        </div>
        <div className="nav nav-scroll">
          {/* FD-62 (SB-108): the consoles that took a Switchboard hand-over of their own. */}
          {(status.handovers ?? []).length > 0 && <div className="nav-section">{t('nav.handovers')}</div>}
          {(status.handovers ?? []).map((h) => (
            <button key={h.key} className="nav-item" aria-current={route.page === 'handover' && route.key === h.key ? 'page' : undefined} title={rail ? h.workflow : undefined} onClick={() => setRoute({ page: 'handover', key: h.key })}>
              <span className={`state state-${h.state === 'running' ? 'ready' : 'stopped'}`} aria-hidden="true"><span className="glyph">{GLYPH[h.state === 'running' ? 'ready' : 'stopped']}</span></span>
              <span className="nav-label">{h.workflow || h.agent}</span>
              <span className="visually-hidden">{t(h.state === 'running' ? 'handover.running' : 'handover.ended')}</span>
            </button>
          ))}
          {pinned.length > 0 && <div className="nav-section">{t('nav.pinned')}</div>}
          {pinned.map((p) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} rail={rail} pinned menu={rowMenu} />)}
          {/* FD-78: on this Mac, online, services; the sort applies inside each section. */}
          {(['local', 'online', 'service'] as const).map((c, i) => arranged[c].length > 0 && (
            <div key={c} role="group" aria-labelledby={`nav-${c}`}>
              <div className="nav-section nav-section-row">
                <span id={`nav-${c}`}>{t(`nav.${c}`)}</span>
                {!rail && i === (['local', 'online', 'service'] as const).findIndex((x) => arranged[x].length > 0) && products.length > 1 && (
                  <select className="sort-select" aria-label={t('list.sort')} value={layout.list.sort} onChange={(e) => changeLayout({ list: { sort: e.target.value as ListSort } })}>
                    <option value="name">{t('list.sort.name')}</option>
                    <option value="status">{t('list.sort.status')}</option>
                    <option value="activity">{t('list.sort.activity')}</option>
                  </select>
                )}
              </div>
              {arranged[c].map((p) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} rail={rail} pinned={false} menu={rowMenu} />)}
            </div>
          ))}
          {/* FD-78: hidden agents, folded at the bottom; a problem among them still shows on the fold. */}
          {hidden.length > 0 && (
            <div className="nav-hidden">
              {/* In the narrow rail the fold is an entry of its own, so hidden agents stay one click away. */}
              <button className={rail ? 'nav-item' : 'nav-section nav-fold-section'} aria-expanded={layout.list.hiddenOpen} title={rail ? t('nav.hidden', { count: hidden.length }) : undefined} onClick={() => changeLayout({ list: { hiddenOpen: !layout.list.hiddenOpen } })}>
                <span aria-hidden="true">{layout.list.hiddenOpen ? '▾' : '▸'}</span> <span className={rail ? 'nav-label' : undefined}>{t('nav.hidden', { count: hidden.length })}</span>
                {hiddenProblem && <span className="count alert" title={t('nav.hiddenProblem')} aria-hidden="true">!</span>}
                {hiddenProblem && <span className="visually-hidden">{t('nav.hiddenProblem')}</span>}
              </button>
              {layout.list.hiddenOpen && hidden.map((p) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} rail={rail} pinned={false} menu={rowMenu} />)}
            </div>
          )}
        </div>
        <div className="sidebar-footer">
          {!rail && <UpdateLine status={status} />}
          <button className="nav-item" aria-current={route.page === 'settings' ? 'page' : undefined} title={rail ? t('nav.settings') : undefined} onClick={() => setRoute({ page: 'settings' })}>
            <Icon name="settings" /><span className="nav-label">{t('nav.settings')}</span>
            {rail && ['ready', 'held', 'misplaced', 'error'].includes(status.update.state) && <span className="count alert" aria-hidden="true">!</span>}
          </button>
          {/* ADR-0017 (SCN-047): the list folds into a rail and back; remembered. */}
          <button className="nav-item nav-fold" aria-expanded={!rail} title={t(rail ? 'sidebar.expand' : 'sidebar.collapse')} onClick={() => changeLayout({ sidebar: rail ? 'expanded' : 'collapsed' })}>
            <Icon name="sidebar" /><span className="nav-label">{t(rail ? 'sidebar.expand' : 'sidebar.collapse')}</span>
          </button>
        </div>
      </nav>
      <main className="main" inert={stopOpen} ref={mainRef}>
        {route.page === 'handover' && handover
          ? <div className="page-wrap">
            <div className="page">
              <div className="page-head" data-drawer-top=""><h1>{handover.workflow || handover.agent}</h1></div>
              <p className="meta">{t('handover.what', { agent: handover.agent, account: handover.account || '—', dir: handover.dir })}</p>
              <p>{t(handover.state !== 'running' ? 'handover.done' : handover.kind === 'resume' ? 'handover.resumeBody' : 'handover.body')}</p>
              {handover.state === 'exited' && <button className="btn" onClick={() => { void api().consoleDismissHandover(handover.key); setRoute({ page: 'overview' }); }}>{t('handover.close')}</button>}
            </div>
          </div>
        : route.page === 'service' && current
          ? <div className="svc-page">
            <ServiceView key={current.key} s={current} all={status.services} members={currentProduct?.members ?? [current]} open={open} link={route.link} nonce={route.nonce} tab={route.tab} runUpdate={route.tab === 'health' && route.page === 'service'} activityRev={status.activityRev} overlayOpen={stopOpen} askStop={askStop} updateStarted={() => setRoute({ ...route, tab: undefined })}
              headerFull={layout.header === 'full'} onToggleHeader={() => changeLayout({ header: layout.header === 'full' ? 'compact' : 'full' })}
              consoleOpen={layout.console.open} onToggleConsole={() => changeLayout({ console: { open: !layout.console.open } })} onAgent={handToAgent} />
          </div>
          : (
            <div className="page-wrap">
            <div className="page">
              <div className="page-head" data-drawer-top="">
                <h1>{t(route.page === 'activity' ? 'activity.title' : route.page === 'spend' ? 'spend.title' : route.page === 'map' ? 'map.title' : route.page === 'settings' ? 'settings.title' : 'overview.title')}</h1>
                {route.page === 'overview' && count > 0 && <span className="meta">{count === 1 ? t('overview.count.one') : t('overview.count', { count })}</span>}
              </div>
              {route.page === 'overview' && <SetupCard onOpen={openSetup} consoleOpen={setupOpen} />}
              {route.page === 'overview' && <Overview status={status} products={products} open={open} act={act} agent={handToAgent} onSetup={() => openSetup('new')} visit={visit} onContinue={continueWith} goSpend={() => setRoute({ page: 'spend' })} list={layout.list} onHiddenOpen={(o) => changeLayout({ list: { hiddenOpen: o } })} />}
              {route.page === 'activity' && <Activity status={status} openAt={open} filter={activityFilter} setFilter={setActivityFilter} />}
              {route.page === 'spend' && <Spend status={status} />}
              {route.page === 'map' && <ConnectionsMap status={status} open={(key) => open(key, undefined, 'connections')} onAgent={handToAgent} openConsole={(key) => (key.startsWith('handover.') ? setRoute({ page: 'handover', key }) : open(key))} />}
              {route.page === 'settings' && <Settings status={status} onTheme={applyTheme} onLanguage={onLanguage} onSetup={() => openSetup('new')} />}
            </div>
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

/** FD-78: what a row's menu can do. */
interface RowActions {
  pin: (id: string) => void;
  hide: (id: string) => void;
  kind: (p: Product, kind: 'agent' | 'service') => void;
  isPinned: (id: string) => boolean;
  isHidden: (id: string) => boolean;
  isService: (p: Product) => boolean;
}

/** A product in the sidebar: the primary's name and state; a member in trouble adds a mark, never a changed state (ADR-0012). */
function ProductItem({ p, current, open, rail, pinned, menu }: { p: Product; current: boolean; open: (key: string) => void; rail: boolean; pinned: boolean; menu: RowActions }) {
  const { t } = useT();
  const s = p.primary;
  return (
    <div className={`nav-row${pinned ? ' pinned' : ''}`}>
    <button className="nav-item" aria-current={current ? 'page' : undefined} title={rail ? t('join.nameState', { name: nameOf(s), state: t(`state.${s.state}`) }) : undefined} onClick={() => open(s.key)}>
      <span className={`state state-${s.state}`} aria-hidden="true"><span className="glyph">{GLYPH[s.state]}</span></span>
      {rail && <span className="initials" aria-hidden="true">{initialsOf(nameOf(s))}</span>}
      <span className="nav-label">{nameOf(s)}</span>
      {p.memberProblem && <span className="count alert" title={t('nav.memberProblem')} aria-hidden="true">!</span>}
      <span className="visually-hidden">{t(`state.${s.state}`)}{p.memberProblem ? `, ${t('nav.memberProblem')}` : ''}</span>
    </button>
    {!rail && <RowMenu p={p} menu={menu} />}
    </div>
  );
}

/** FD-78: one small button per row opens its actions (global rule: one primary action, the rest in a menu). */
function RowMenu({ p, menu }: { p: Product; menu: RowActions }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // The list scrolls, so the menu is placed against the window: below the button, or above it near the bottom.
  const [at, setAt] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const box = useRef<HTMLDivElement | null>(null);
  const toggle = () => {
    const r = box.current?.querySelector('.row-menu-btn')?.getBoundingClientRect();
    if (r) setAt(window.innerHeight - r.bottom < 140 ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right } : { top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(!open);
  };
  const name = nameOf(p.primary);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); (box.current?.querySelector('.row-menu-btn') as HTMLButtonElement | null)?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    (box.current?.querySelector('[role="menuitem"]') as HTMLButtonElement | null)?.focus();
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  const pinned = menu.isPinned(p.id), hidden = menu.isHidden(p.id), service = menu.isService(p);
  const act = (f: () => void) => () => { f(); setOpen(false); };
  return (
    <div className={`row-menu${open || pinned ? ' shown' : ''}`} ref={box}>
      <button className="row-menu-btn pin-btn" aria-haspopup="menu" aria-expanded={open} title={t('list.menu', { name })} aria-label={t('list.menu', { name })} onClick={toggle}>
        {pinned
          ? <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 1h4l-.5 4 2.5 2.5V9H8.6L8 15l-.6-6H4V7.5L6.5 5z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
          : <span aria-hidden="true">⋯</span>}
      </button>
      {open && (
        <div className="menu" role="menu" aria-label={name} style={at} onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          const items = [...(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
        }}>
          {!hidden && <button role="menuitem" onClick={act(() => menu.pin(p.id))}>{t(pinned ? 'list.unpin' : 'list.pin', { name })}</button>}
          <button role="menuitem" onClick={act(() => menu.kind(p, service ? 'agent' : 'service'))}>{t(service ? 'list.asAgent' : 'list.asService')}</button>
          <button role="menuitem" onClick={act(() => menu.hide(p.id))}>{t(hidden ? 'list.unhide' : 'list.hide')}</button>
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
  if (u.state === 'held') return <div className="row"><span className="meta">{t('update.held', { version: u.version ?? '' })}</span>{u.steps && <button className="btn" onClick={() => void api().openUpdateSteps()}>{t('update.steps')}</button>}<button className="btn btn-primary" onClick={() => void api().restartToUpdate()}>{t('update.installNow')}</button></div>;
  if (u.state === 'ready') return <div className="row"><span className="meta">{(u.version ? t('update.ready', { version: u.version }) : t('update.readyUnnamed'))}</span><button className="btn btn-primary" onClick={() => void api().restartToUpdate()}>{t('update.restart')}</button></div>;
  if (u.state === 'misplaced') return <div className="row"><span className="meta state-down">{t('update.misplaced')}</span><button className="btn" onClick={() => void api().moveToApplications()}>{t('move.confirm')}</button></div>;
  if (u.state === 'error') return <div className="row"><span className="meta state-down">{t('update.error', { error: u.error ?? '' })}</span><button className="btn" onClick={() => void api().checkForUpdates()}>{t('update.retry')}</button></div>;
  return null;
}

/** Two letters for a rail entry: the first letters of the first two words, else the first two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}
