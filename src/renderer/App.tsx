import { useCallback, useEffect, useRef, useState } from 'react';
import { langFor, t as tr, type Lang } from '../core/i18n';
import { DEFAULT_SETTINGS, SIDEBAR_WIDTH, type AppStatus, type Settings as AppSettings, type SettingsPatch, type ListSort } from '../core/types';
import { groupProducts, productOf, type Product, arrangeProducts, categoryOf, setKind, setOff, showAgain, togglePin } from '../core/products';
import { Activity, type ActivityFilter } from './components/Activity';
import { SetupCard, Overview } from './components/Overview';
import { ServiceView } from './components/ServiceView';
import { Settings } from './components/Settings';
import { Spend } from './components/Spend';
import { ConnectionsMap } from './components/ConnectionsMap';
import { AgentsNav, ModeSwitch, SessionsNav, type AgentsPage, type Mode, type RowActions } from './components/Navigation';
import { AllSessions, hasConsole, SessionBody, SessionHeader } from './components/Sessions';
import { resolveSessionRoute } from '../core/sessions-view';
import type { SessionRow } from '../core/sessions';
import { audit } from '../core/audit';
import { attentionQueue, urgent } from '../core/attention';
import { SETUP_KEY } from '../core/offers';
import { revisitDue, sinceLastVisit, type SinceLastVisit } from '../core/visit';
import type { ConsoleTask, NavTarget, Rect } from '../core/api';
import mark from './brand/dashboards-mark.svg';
import { api, Icon, LangContext, nameOf, Spinner, useT } from './lib';

/** FD-103: `sessions` is All sessions; `session` one session's page, `follow` a console key a Continue started (the row
 *  it becomes is followed), `until` how long a row that is not listed yet is waited for. */
type Route = { page: 'overview' } | { page: 'activity'; serviceKey?: string; nonce?: number } | { page: 'spend' } | { page: 'map' } | { page: 'settings'; section?: 'sessions'; nonce?: number }
  | { page: 'service'; key: string; link?: string; nonce?: number; tab?: 'logs' | 'health' | 'connections' }
  | { page: 'sessions' } | { page: 'session'; id: string; follow?: string; until?: number };

/** FD-103 (SCN-077): which mode a page belongs to; Settings belongs to neither and keeps the mode it was opened from. */
const modeOfRoute = (r: Route): Mode | null => (r.page === 'sessions' || r.page === 'session' ? 'sessions' : r.page === 'settings' ? null : 'agents');
/** How long a session page waits for a row that is not listed yet (a notification clicked before the next read). */
const SESSION_WAIT_MS = 20_000;

const PROBLEM = new Set(['down', 'duplicate', 'foreign', 'conflict', 'invalid']);

export function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [route, setRouteState] = useState<Route>({ page: 'overview' });
  // FD-103 (SCN-077): the mode the sidebar shows, and the page last open in each mode.
  const [mode, setMode] = useState<Mode>('agents');
  const lastRoute = useRef<Record<Mode, Route>>({ agents: { page: 'overview' }, sessions: { page: 'sessions' } });
  const setRoute = useCallback((r: Route) => {
    const m = modeOfRoute(r);
    if (m) { lastRoute.current[m] = r; setMode(m); }
    setRouteState(r);
  }, []);
  const switchMode = useCallback((m: Mode) => { setMode(m); setRouteState(lastRoute.current[m]); }, []);
  /** A link, a notification or the menu chose the page: the mode remembered from the last launch no longer applies. */
  const navigated = useRef(false);
  const [stopKey, setStopKey] = useState<string | null>(null);
  // U-8: the Activity filter is kept between visits; a notification about one service presets it (U-19).
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>({ serviceKey: '', minLevel: '' });
  // VIS-06: the scheme the window paints, handed to the console's view so its terminal follows it.
  const [scheme, setScheme] = useState<AppSettings['theme']>('dark');
  // SCN-079: the All sessions page's one-time explanation.
  const [noteSeen, setNoteSeen] = useState(true);
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
    void api().settings().then((s) => {
      applyTheme(s.theme);
      setScheme(s.theme);
      setLayout(s.layout);
      setNoteSeen(s.sessionsNoteSeen);
      // SCN-077 step 5: the window opens in the mode, and on the session page, it was closed on.
      if (!navigated.current && s.layout.mode === 'sessions') setRoute(s.layout.sessionId ? { page: 'session', id: s.layout.sessionId, until: Date.now() + SESSION_WAIT_MS } : { page: 'sessions' });
    });
    const offStatus = api().onStatus(setStatus);
    // FD-122: what an agent arranged through MCP shows at once; a drag in progress is not undone (R-9 holds for writes).
    const offSettings = api().onSettings((s) => { setLayout(s.layout); applyTheme(s.theme); setScheme(s.theme); });
    const go = (target: NavTarget) => {
      navigated.current = true;
      if (target.page === 'agents') switchMode('agents');
      else if (target.page === 'sessions') {
        // SCN-085: a notification opens its session, the tray's line All sessions; the menu the mode's last page.
        if (target.key === 'all') setRoute({ page: 'sessions' });
        else if (target.key) setRoute({ page: 'session', id: target.key, until: Date.now() + SESSION_WAIT_MS });
        else switchMode('sessions');
      } else if (target.page === 'overview') setRoute({ page: 'overview' });
      else if (target.page === 'spend' || target.page === 'map' || target.page === 'settings') setRoute({ page: target.page });
      else if (target.page === 'activity') {
        if (target.key) setActivityFilter((f) => ({ ...f, serviceKey: target.key! }));
        setRoute({ page: 'activity', serviceKey: target.key, nonce: Date.now() });
      } else if (target.key) setRoute({ page: 'service', key: target.key, link: target.link, nonce: Date.now() });
    };
    const offNav = api().onNavigate(go);
    const offLayout = api().onLayoutCommand((which) => setLayout((l) => {
      // On a session's page the console is the page itself (SCN-080): the menu's console toggle has nothing to fold.
      const patch = which === 'sidebar' ? { sidebar: l.sidebar === 'collapsed' ? 'expanded' as const : 'collapsed' as const }
        : which === 'console' ? { console: { open: !l.console.open } }
        : { header: l.header === 'full' ? 'compact' as const : 'full' as const };
      void api().updateSettings({ layout: patch }).catch(() => undefined);
      return { ...l, ...patch, console: { ...l.console, ...('console' in patch ? patch.console : {}) } };
    }));
    void api().takeNavigation().then((target) => { if (target) go(target); }); // after subscribing: nothing falls between
    return () => { offStatus(); offSettings(); offNav(); offLayout(); };
  }, []);

  useEffect(() => { if (route.page !== 'service') void api().hideView(); }, [route.page]);
  // U-18: the main process keeps the screen on show, so Restart to update reopens on it.
  useEffect(() => { api().routeChanged(route.page === 'service' ? { page: 'service', key: route.key } : route.page === 'session' ? { page: 'sessions' } : { page: route.page }); }, [route.page, route.page === 'service' ? route.key : '']);
  // SCN-077 step 5: the mode and the session page are remembered (Settings.layout), so a relaunch opens on them.
  const sessionIdNow = route.page === 'session' ? route.id : route.page === 'sessions' ? null : undefined;
  useEffect(() => {
    if (!status) return;
    const patch: NonNullable<SettingsPatch['layout']> = {};
    if (layout.mode !== mode) patch.mode = mode;
    if (mode === 'sessions' && sessionIdNow !== undefined && layout.sessionId !== sessionIdNow) patch.sessionId = sessionIdNow;
    if (Object.keys(patch).length) changeLayout(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sessionIdNow, Boolean(status)]);
  useEffect(() => {
    if (route.page === 'service' && status && !status.services.some((s) => s.key === route.key)) setRoute({ page: 'overview' }); // SCN-003: removed
  }, [status, route]);

  return (
    <LangContext.Provider value={lang}>
      {status ? <Shell status={status} route={route} setRoute={setRoute} mode={mode} switchMode={switchMode} stopKey={stopKey} setStopKey={setStopKey} activityFilter={activityFilter} setActivityFilter={setActivityFilter} layout={layout} changeLayout={changeLayout} onLanguage={reloadLang}
        scheme={scheme} onTheme={(th) => { applyTheme(th); setScheme(th); }} noteSeen={noteSeen} onNoteSeen={() => { setNoteSeen(true); void api().updateSettings({ sessionsNoteSeen: true }).catch(() => undefined); }} /> : <div className="page muted row" role="status"><Spinner /> {tr(lang, 'app.loading')}</div>}
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
  status: AppStatus; route: Route; setRoute: (r: Route) => void; mode: Mode; switchMode: (m: Mode) => void; stopKey: string | null; setStopKey: (k: string | null) => void;
  activityFilter: ActivityFilter; setActivityFilter: (f: ActivityFilter) => void;
  layout: AppSettings['layout']; changeLayout: (patch: NonNullable<SettingsPatch['layout']>, persist?: boolean) => void;
  onLanguage: () => void;
  scheme: AppSettings['theme']; onTheme: (theme: AppSettings['theme']) => void;
  noteSeen: boolean; onNoteSeen: () => void;
}

function Shell({ status, route, setRoute, mode, switchMode, stopKey, setStopKey, activityFilter, setActivityFilter, layout, changeLayout, onLanguage, scheme, onTheme, noteSeen, onNoteSeen }: ShellProps) {
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
  // W2 (UX-04): the Overview badge counts the queue Needs attention lists, the tray and the Dock count; red when
  // something does not work.
  const queue = attentionQueue(status.services, { now: Date.now(), limits: status.limits });
  // FD-81: the auditor runs with every status push; the nav carries what does not work, the page the rest. UX-05: with
  // the limits the main process holds, as the page reads them.
  const auditErrors = audit(status.services, status.limits ?? {}).counts.error;
  const current = route.page === 'service' ? status.services.find((s) => s.key === route.key) : undefined;
  const stopping = stopKey ? status.services.find((s) => s.key === stopKey) : undefined;
  // #region sessions-shell — docs: docs/ux/scenarios.md#scn-080-open-one-sessions-page
  // FD-103: the session on show, followed through a Continue (its new row) and waited for while it may still arrive;
  // a session that left the list returns the page to All sessions, never to an empty page (UX-18).
  const [waitTick, setWaitTick] = useState(0);
  const waiting = route.page === 'session' && (route.until ?? 0) > Date.now();
  useEffect(() => {
    if (route.page !== 'session' || (!route.until && !route.follow)) return;
    const timer = setTimeout(() => setWaitTick((n) => n + 1), Math.max(500, (route.until ?? Date.now() + SESSION_WAIT_MS) - Date.now()));
    return () => clearTimeout(timer);
  }, [route]);
  const resolved = route.page === 'session' ? resolveSessionRoute(status.sessions?.rows ?? null, route.id, { follow: route.follow, wait: waiting }) : null;
  const sessionRow: SessionRow | null = resolved?.found ?? null;
  useEffect(() => {
    if (route.page !== 'session' || !resolved) return;
    const expired = (route.until ?? 0) <= Date.now();
    if (resolved.settled && resolved.found && (resolved.found.id !== route.id || route.until || route.follow)) setRoute({ page: 'session', id: resolved.found.id });
    else if (resolved.gone) setRoute({ page: 'sessions' });
    // A Continue whose new session never showed: back to the row it came from, or to All sessions.
    else if (route.follow && expired && waitTick > 0) setRoute(resolved.found ? { page: 'session', id: resolved.found.id } : { page: 'sessions' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, resolved?.found?.id, resolved?.gone, waitTick]);
  const openSession = (id: string) => setRoute({ page: 'session', id });
  const followContinue = (key: string) => setRoute({ page: 'session', id: route.page === 'session' ? route.id : '', follow: key, until: Date.now() + SESSION_WAIT_MS });
  // SCN-081 step 2: End asks first; the question holds focus and goes when the session ends by itself.
  const [ending, setEnding] = useState<SessionRow | null>(null);
  const [endError, setEndError] = useState('');
  const endStillOffered = ending ? (status.sessions?.rows ?? []).some((r) => r.id === ending.id && r.actions.includes('end')) : false;
  useEffect(() => { if (ending && !endStillOffered) { setEnding(null); setEndError(''); } }, [ending, endStillOffered]);
  const askEnd = (row: SessionRow) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setEndError(''); setEnding(row); };
  const confirmEnd = async (row: SessionRow) => {
    const r = await api().sessionsEnd(row.id).catch((e: unknown) => ({ ok: false as const, reason: 'spawn' as const, detail: String((e as Error)?.message ?? e) }));
    if (r.ok) { setEnding(null); return; }
    setEndError(t('sessions.endFailed', { reason: r.detail ?? r.reason }));
  };
  useEffect(() => {
    if (!ending) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEnding(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ending]);
  // #endregion sessions-shell
  // U-14: the Stop dialog holds focus. Everything behind it is inert while it is open (the embedded
  // dashboard is a native view and hides itself on overlayOpen); closing it puts focus back on the
  // control that opened it, when that control is still on screen.
  const opener = useRef<HTMLElement | null>(null);
  const askStop = (key: string) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setStopKey(key); };
  const stopOpen = Boolean(stopping) || Boolean(ending);
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
  const { hidden } = arranged;
  const pin = (id: string) => changeLayout({ list: { pinned: togglePin(layout.list.pinned, id) } });
  // FD-78: the row's menu: pin, agent or service, hide. A hidden agent is still watched and still alerts.
  const rowMenu: RowActions = {
    pin,
    hide: (id) => changeLayout({ list: layout.list.hidden.includes(id) ? showAgain(layout.list, id) : { hidden: [...layout.list.hidden, id] } }),
    // FD-123: off is also hidden; on leaves it hidden and watched until shown again.
    setOff: (id, off) => { const patch = setOff(layout.list, id, off); if (patch) changeLayout({ list: patch }); },
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
  const startVisit = (s: AppSettings) => {
    setVisit(sinceLastVisit({ services: status.services, lastVisitAt: s.lastVisitAt, known: s.knownServices, consoles: s.consoles, lastService: s.lastService }));
    void api().updateSettings({ lastVisitAt: new Date().toISOString(), knownServices: status.services.map((x) => x.key) }).catch(() => undefined);
  };
  // The setup card offers Start; the empty state below it then does not offer it again.
  const [setupCard, setSetupCard] = useState(false);
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
      // SCN-059: what changed since the previous launch; this launch becomes the next one's baseline.
      startVisit(s);
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.scanning]);
  // UX-08: the app lives for days in the menu bar; a window shown again after an hour hidden is a new visit.
  const visitShown = useRef<string | null>(status.shown?.at ?? null);
  useEffect(() => {
    if (!setupDecided.current || !revisitDue(visitShown.current, status.shown)) return;
    visitShown.current = status.shown!.at;
    void api().settings().then(startVisit).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.shown?.at]);
  const handToAgent = (key: string, task: ConsoleTask) => {
    setRoute({ page: 'service', key });
    if (!layout.console.open) changeLayout({ console: { open: true } });
    setAgentTask({ key, task, nonce: Date.now() });
  };
  const currentProduct = route.page === 'service' ? productOf(products, route.key) : undefined;
  const count = products.length; // ADR-0012: the heading counts what the sidebar lists
  const rail = layout.sidebar === 'collapsed';
  // FD-121 (SCN-087): while the sidebar's edge is held the dashboard and the console step aside, since a native view
  // under the pointer would take the drag from the page.
  const [resizing, setResizing] = useState(false);
  // #region console-drawer — docs: docs/ux/scenarios.md#scn-048-open-an-agents-console-over-its-dashboard
  // FD-92: the console is a drawer over the content area, from under the page header down; it never resizes the
  // dashboard. The main process draws it in a view of its own (drawer.ts); this page says which console, whether it is
  // open and where the area is. A fold, a new height or a taken job comes back from the drawer's page.
  // FD-103 (SCN-080): on a session's page the console is the page under its header, full height, never a drawer.
  const pageConsole = route.page === 'session' && sessionRow && hasConsole(sessionRow) ? sessionRow.key : null;
  const [menuOverPage, setMenuOverPage] = useState(false);
  const drawerKey = pageConsole ?? (route.page === 'service' && current ? (layout.console.open ? current.key : null)
    : route.page === 'overview' && setupOpen ? SETUP_KEY : null);
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
  }, [route.page, route.page === 'service' ? route.key : '', layout.header, layout.sidebar, drawerKey, sessionRow?.id]);
  const drawerTask = agentTask && agentTask.key === drawerKey ? { task: agentTask.task, mode: agentTask.mode, nonce: agentTask.nonce } : null;
  useEffect(() => {
    api().consoleDrawer({ key: drawerKey, open: Boolean(drawerKey), rect: area, height: layout.console.height, task: drawerTask, suspended: stopOpen || menuOverPage || resizing, full: Boolean(pageConsole), scheme });
  }, [drawerKey, area, layout.console.height, drawerTask?.nonce, stopOpen, menuOverPage, resizing, Boolean(pageConsole), scheme]);
  const focusOutRef = useRef<(back: boolean) => void>(() => undefined);
  const drawerOwner = useRef({ route, drawerKey });
  drawerOwner.current = { route, drawerKey };
  useEffect(() => api().onDrawerChange((c) => {
    const { route: r } = drawerOwner.current;
    if (c.kind === 'height') changeLayout({ console: { height: c.height } });
    else if (c.kind === 'taskTaken') setAgentTask((x) => (x && x.nonce === c.nonce ? null : x));
    else if (c.kind === 'focusOut') focusOutRef.current(c.back); // VIS-05
    else if (r.page === 'service') changeLayout({ console: { open: false } });
    else if (r.page === 'overview') setSetupOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  // #endregion console-drawer
  const agentsPage: AgentsPage = route.page === 'overview' || route.page === 'activity' || route.page === 'map' || route.page === 'spend' || route.page === 'service' || route.page === 'settings' ? route.page : 'other';

  const sessionsRows = status.sessions?.rows ?? [];
  // VIS-05: Esc then Tab leaves the terminal: forward to the sidebar's first control, back to the header's last action.
  const focusOutOfConsole = (back: boolean) => {
    const pick = back
      ? [...(mainRef.current?.querySelectorAll<HTMLElement>('[data-drawer-top] button:not([disabled]), [data-drawer-top] select:not([disabled])') ?? [])].pop()
      : document.querySelector<HTMLElement>('.sidebar button:not([disabled])');
    pick?.focus();
  };
  focusOutRef.current = focusOutOfConsole;
  return (
    <div className={`app${rail ? ' rail' : ''}${resizing ? ' resizing' : ''}`} style={rail ? undefined : { gridTemplateColumns: `${layout.sidebarWidth}px 1fr` }}>
      <nav className="sidebar" aria-label="Fabric Dashboards" inert={stopOpen}>
        {!rail && <SidebarEdge width={layout.sidebarWidth} onWidth={(w, persist) => changeLayout({ sidebarWidth: w }, persist)} onHold={setResizing} />}
        <div className="brand"><img src={mark} alt="" /> <span className="brand-name">{t('app.name')}</span></div>
        <ModeSwitch mode={mode} rows={sessionsRows} rail={rail} onMode={switchMode} />
        {mode === 'agents'
          ? <AgentsNav page={agentsPage} status={status} arranged={arranged} products={products} currentProduct={currentProduct} layout={layout} changeLayout={changeLayout} open={open}
            go={(page) => setRoute({ page })} rail={rail} queue={queue.length} urgent={queue.some(urgent)} auditErrors={auditErrors} hiddenProblem={hiddenProblem} menu={rowMenu} />
          : <SessionsNav sessions={status.sessions} currentId={route.page === 'session' ? (sessionRow?.id ?? route.id) : null} allCurrent={route.page === 'sessions'} rail={rail}
            endedOpen={layout.endedOpen} onEndedOpen={(o) => changeLayout({ endedOpen: o })} openAll={() => setRoute({ page: 'sessions' })} openRow={openSession} />}
        <div className="sidebar-footer">
          {!rail && <UpdateLine status={status} />}
          {rail && <RailUpdate status={status} goSettings={() => setRoute({ page: 'settings' })} />}
          <button className="nav-item" aria-current={route.page === 'settings' ? 'page' : undefined} title={rail ? t('nav.settings') : undefined} onClick={() => setRoute({ page: 'settings' })}>
            <Icon name="settings" /><span className="nav-label">{t('nav.settings')}</span>
          </button>
          {/* ADR-0017 (SCN-047): the list folds into a rail and back; remembered. */}
          <button className="nav-item nav-fold" aria-expanded={!rail} title={t(rail ? 'sidebar.expand' : 'sidebar.collapse')} onClick={() => changeLayout({ sidebar: rail ? 'expanded' : 'collapsed' })}>
            <Icon name="sidebar" /><span className="nav-label">{t(rail ? 'sidebar.expand' : 'sidebar.collapse')}</span>
          </button>
        </div>
      </nav>
      <main className="main" inert={stopOpen} ref={mainRef}>
        {route.page === 'session'
          ? (sessionRow
            ? <div className="session-page">
              <SessionHeader row={sessionRow} autoContinue={status.sessions?.autoContinue !== false} open={openSession} askEnd={askEnd} continued={followContinue} onMenu={setMenuOverPage} />
              {pageConsole ? <div className="session-console-area" aria-hidden="true" /> : <SessionBody row={sessionRow} autoContinue={status.sessions?.autoContinue !== false} />}
            </div>
            : <div className="page-wrap"><div className="page"><p className="muted row" role="status"><Spinner /> {t('sessions.reading')}</p></div></div>)
        : route.page === 'service' && current
          ? <div className="svc-page">
            <ServiceView key={current.key} s={current} all={status.services} members={currentProduct?.members ?? [current]} open={open} link={route.link} nonce={route.nonce} tab={route.tab} runUpdate={route.tab === 'health' && route.page === 'service'} activityRev={status.activityRev} overlayOpen={stopOpen || resizing} askStop={askStop} updateStarted={() => setRoute({ ...route, tab: undefined })}
              headerFull={layout.header === 'full'} onToggleHeader={() => changeLayout({ header: layout.header === 'full' ? 'compact' : 'full' })}
              consoleOpen={layout.console.open} onToggleConsole={() => changeLayout({ console: { open: !layout.console.open } })} onAgent={handToAgent} />
          </div>
          : (
            <div className="page-wrap">
            <div className="page">
              <div className="page-head" data-drawer-top="">
                <h1>{t(route.page === 'activity' ? 'activity.title' : route.page === 'spend' ? 'spend.title' : route.page === 'map' ? 'map.title' : route.page === 'settings' ? 'settings.title' : route.page === 'sessions' ? 'sessions.all' : 'overview.title')}</h1>
                {route.page === 'overview' && count > 0 && <span className="meta">{count === 1 ? t('overview.count.one') : t('overview.count', { count })}</span>}
              </div>
              {route.page === 'overview' && <SetupCard onOpen={openSetup} consoleOpen={setupOpen} onShown={setSetupCard} />}
              {route.page === 'overview' && <Overview status={status} products={products} open={open} act={act} agent={handToAgent} onSetup={() => openSetup('new')} setupCard={setupCard} visit={visit} onDismissVisit={() => setVisit(null)} onContinue={continueWith} goSpend={() => setRoute({ page: 'spend' })} list={layout.list} onHiddenOpen={(o) => changeLayout({ list: { hiddenOpen: o } })} />}
              {route.page === 'activity' && <Activity status={status} openAt={open} filter={activityFilter} setFilter={setActivityFilter} />}
              {route.page === 'spend' && <Spend status={status} />}
              {route.page === 'map' && <ConnectionsMap status={status} open={(key) => open(key, undefined, 'connections')} onAgent={handToAgent} />}
              {route.page === 'settings' && <Settings status={status} onTheme={onTheme} onLanguage={onLanguage} onSetup={() => openSetup('new')} section={route.section} nonce={route.nonce} />}
              {route.page === 'sessions' && <AllSessions sessions={status.sessions} noteSeen={noteSeen} onNoteSeen={onNoteSeen} onSetUp={() => setRoute({ page: 'settings', section: 'sessions', nonce: Date.now() })}
                endedOpen={layout.endedOpen} onEndedOpen={(o) => changeLayout({ endedOpen: o })} open={openSession} askEnd={askEnd} continued={(key) => setRoute({ page: 'session', id: '', follow: key, until: Date.now() + SESSION_WAIT_MS })} />}
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
      {ending && (
        <div className="scrim" role="presentation">
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="end-title" aria-describedby="end-body">
            <h2 id="end-title">{t('sessions.endTitle')}</h2>
            <p id="end-body">{t('sessions.endBody')}</p>
            {endError && <p className="notice error" role="alert">{endError}</p>}
            <div className="row">
              <button className="btn" autoFocus onClick={() => setEnding(null)}>{t('action.cancel')}</button>
              <button className="btn btn-danger" onClick={() => void confirmEnd(ending)}>{t('sessions.endConfirm')}</button>
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
  if (u.state === 'held') return <div className="row"><span className="meta">{t('update.held', { version: u.version ?? '' })}</span>{u.steps && <button className="btn" onClick={() => void api().openUpdateSteps()}>{t('update.steps')}</button>}<button className="btn btn-primary" onClick={() => void api().restartToUpdate()}>{t('update.installNow')}</button></div>;
  if (u.state === 'ready') return <div className="row"><span className="meta">{(u.version ? t('update.ready', { version: u.version }) : t('update.readyUnnamed'))}</span><button className="btn btn-primary" onClick={() => void api().restartToUpdate()}>{t('update.restart')}</button></div>;
  if (u.state === 'misplaced') return <div className="row"><span className="meta state-down">{t('update.misplaced')}</span><button className="btn" onClick={() => void api().moveToApplications()}>{t('move.confirm')}</button></div>;
  if (u.state === 'error') return <div className="row"><span className="meta state-down">{t('update.error', { error: u.error ?? '' })}</span><button className="btn" onClick={() => void api().checkForUpdates()}>{t('update.retry')}</button></div>;
  return null;
}

/** W2: the folded rail keeps the app's own update in sight: an entry of its own, named by its title and its
 *  accessible name, that restarts into a ready update or opens Settings where a moved app or an error is explained. */
function RailUpdate({ status, goSettings }: { status: AppStatus; goSettings: () => void }) {
  const { t } = useT();
  const u = status.update;
  if (!['ready', 'held', 'misplaced', 'error'].includes(u.state)) return null;
  const ready = u.state === 'ready' || u.state === 'held';
  const label = u.state === 'held' ? t('update.held', { version: u.version ?? '' })
    : u.state === 'ready' ? (u.version ? t('update.ready', { version: u.version }) : t('update.readyUnnamed'))
    : u.state === 'misplaced' ? t('update.misplaced') : t('update.error', { error: u.error ?? '' });
  const action = ready ? (u.state === 'held' ? t('update.installNow') : t('update.restart')) : t('nav.settings');
  return (
    <button className="nav-item nav-update" title={`${label} ${action}`} onClick={() => (ready ? void api().restartToUpdate() : goSettings())}>
      <Icon name="update" /><span className="nav-label">{`${label}. ${action}`}</span>
      <span className={`count${ready ? '' : ' alert'}`} aria-hidden="true">{ready ? '↑' : '!'}</span>
    </button>
  );
}

// #region sidebar-edge — docs: docs/ux/scenarios.md#scn-087-arrange-the-sidebar-width-and-order
/** FD-121 (SCN-087): the expanded sidebar's right edge. Dragged, it follows the pointer within SIDEBAR_WIDTH and is
 *  stored on release; double-click or Home returns it to the start; Left and Right move it by a step. */
function SidebarEdge({ width, onWidth, onHold }: { width: number; onWidth: (w: number, persist: boolean) => void; onHold: (held: boolean) => void }) {
  const { t } = useT();
  const clamp = (w: number) => Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, Math.round(w)));
  const last = useRef(width);
  return (
    <div className="sidebar-edge" role="separator" aria-orientation="vertical" aria-label={t('sidebar.width')} title={t('sidebar.widthHint')} tabIndex={0}
      aria-valuenow={width} aria-valuemin={SIDEBAR_WIDTH.min} aria-valuemax={SIDEBAR_WIDTH.max}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = width;
        onHold(true);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        last.current = clamp(e.clientX);
        onWidth(last.current, false);
      }}
      onPointerUp={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        onHold(false);
        onWidth(last.current, true);
      }}
      onPointerCancel={() => { onHold(false); onWidth(last.current, true); }}
      onDoubleClick={() => onWidth(SIDEBAR_WIDTH.default, true)}
      onKeyDown={(e) => {
        const next = e.key === 'ArrowLeft' ? width - SIDEBAR_WIDTH.step : e.key === 'ArrowRight' ? width + SIDEBAR_WIDTH.step : e.key === 'Home' ? SIDEBAR_WIDTH.default : null;
        if (next === null) return;
        e.preventDefault();
        onWidth(clamp(next), true);
      }} />
  );
}
// #endregion sidebar-edge
