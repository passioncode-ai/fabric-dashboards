import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PageState } from '../../core/api';
import type { ActivityItem, ServiceSnapshot } from '../../core/types';
import { instanceOf } from '../../core/products';
import { commandRan, commandReason } from '../../core/outcome';
import { api, GLYPH, nameOf, NEWS_MS, portOf, shortBuild, Spinner, StateBadge, useExpiry, useT } from '../lib';
import { Feed } from './Activity';

type Tab = 'dashboard' | 'activity' | 'health' | 'logs';

interface Props {
  s: ServiceSnapshot;
  /** Every service, for a conflict's other descriptor (U-4). */
  all: ServiceSnapshot[];
  /** Every instance of this service's product, primary first (ADR-0012); one entry means no switcher. */
  members: ServiceSnapshot[];
  open: (key: string, link?: string, tab?: 'logs' | 'health') => void;
  link?: string;
  nonce?: number; // a new value re-opens the same link (a second click on one notification)
  /** The tab a navigation asks for (Logs after a failed action, Health for an update). */
  tab?: 'logs' | 'health';
  /** Needs attention's Update: run the update once this page shows (its output lands on Health). */
  runUpdate?: boolean;
  /** Grows with every activity row (P-7). */
  activityRev?: number;
  overlayOpen: boolean;
  askStop: (key: string) => void;
  /** T-23: the update a navigation asked for has started; the route forgets the request. */
  updateStarted?: () => void;
}

export function ServiceView({ s, all, members, open, link, nonce, tab: askedTab, runUpdate, activityRev, overlayOpen, askStop, updateStarted }: Props) {
  const [pathError, setPathError] = useState('');
  // P-6: a folder or file that cannot be shown says so here, as Overview's Show folder does.
  const show = (p: string) => void api().showPath(p).then((r) => setPathError(r.ok ? '' : t('overview.showFailed', { path: p, error: r.error ?? '' })));
  const { t, reason, duration } = useT();
  const hasDashboard = Boolean(s.wellKnown?.surfaces.dashboard);
  const [tab, setTabState] = useState<Tab>(hasDashboard ? 'dashboard' : 'health');
  const chosen = useRef(false); // the operator picked a tab; stop choosing for them
  const setTab = (x: Tab) => { chosen.current = true; setTabState(x); };
  const [output, setOutput] = useState<{ title: string; text: string; running: 'doctor' | 'update' | null } | null>(null);
  useEffect(() => { chosen.current = false; setOutput(null); }, [s.key]);
  // The first snapshot can arrive before the first answer: open the dashboard once it exists.
  useEffect(() => { if (!chosen.current) setTabState(hasDashboard ? 'dashboard' : 'health'); }, [s.key, hasDashboard]);
  useEffect(() => { if (link) setTabState('dashboard'); }, [link, nonce]);
  useEffect(() => { if (askedTab) { chosen.current = true; setTabState(askedTab); } }, [askedTab, nonce]);
  const updateRan = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (runUpdate && s.descriptor?.commands?.update && updateRan.current !== nonce) { updateRan.current = nonce; updateStarted?.(); void run('update'); }
  }, [runUpdate, nonce]);

  // R-7, T-16: the link a navigation carried is applied once per navigation. Kept here, not in the
  // dashboard host, which unmounts on every tab switch and would apply it again.
  const appliedLink = useRef<string | null>(null);
  const now = useExpiry([s.lastAction?.at]);
  const wk = s.wellKnown;
  const managed = s.descriptor?.lifecycle.manager === 'launchd';
  const running = ['ready', 'degraded', 'duplicate'].includes(s.state);
  // U-2: an explicit running state, a failure that ends the spinner, and the output on Health for both commands.
  const run = async (which: 'doctor' | 'update') => {
    const command = t(`command.${which}`);
    chosen.current = true;
    setTabState('health');
    setOutput({ title: '', text: '', running: which });
    try {
      const r = await api().command(s.key, which);
      if (r.refused) { setOutput({ title: r.refused, text: '', running: null }); return; }
      const reason = commandReason(r, command);
      setOutput({ title: t(reason.code, reason.params), text: commandRan(r) ? r.output : '', running: null });
    } catch (error) {
      setOutput({ title: t('result.commandFailed', { command, error: String((error as Error)?.message ?? error) }), text: '', running: null });
    }
  };
  const tabs = (['dashboard', 'activity', 'health', ...(s.descriptor?.placement === 'remote' ? [] : ['logs'])] as Tab[]);
  const conflictWith = s.state === 'conflict' ? all.filter((o) => o.key !== s.key && o.state === 'conflict' && portOf(o) === portOf(s)) : [];

  return (
    <div className="svc">
      {members.length > 1 && <InstanceSwitch current={s} members={members} open={open} />}
      <header className="svc-head">
        <div className="svc-title">
          <h1 id="svc-title" tabIndex={-1}>{nameOf(s)}</h1>
          <StateBadge state={s.state} />
          {s.busy && <span className="row meta"><Spinner /> {t(`busy.${s.busy}`)}</span>}
        </div>
        {s.descriptor?.summary && <p className="svc-summary">{s.descriptor.summary}</p>}
        <div className="facts">
          {wk && <span>{t('health.version')} <b>{wk.service.version}</b></span>}
          {wk && <span>{t('health.build')} <b>{shortBuild(s)}</b></span>}
          {wk && <span>{t('health.pid')} <b>{wk.process.pid}</b></span>}
          <span>{t('health.port')} <b>{portOf(s)}</b></span>
          {wk && <span>{t('card.uptime', { uptime: duration(Date.now() - new Date(wk.process.startedAt).getTime()) })}</span>}
        </div>
        <Tools names={wk?.surfaces.mcp?.capabilities ?? []} />
        {s.reasons.length > 0 && <ul className="reasons">{s.reasons.map((r, i) => <li key={i}>{reason(r)}</li>)}</ul>}
        {s.lastAction && !s.busy && now - Date.parse(s.lastAction.at) < NEWS_MS && ( /* P-15: news for half an hour, as on Overview */
          <p className={`meta row${s.lastAction.ok ? '' : ' state-down'}`} role="status">
            {reason(s.lastAction.reason)}
            {!s.lastAction.ok && tabs.includes('logs') && s.descriptor?.paths?.logs?.length ? <button className="btn btn-sm" onClick={() => setTab('logs')}>{t('action.logs')}</button> : null}
          </p>
        )}
        <div className="row">
          {managed && (s.state === 'stopped'
            ? <button className="btn btn-primary" disabled={Boolean(s.busy)} onClick={() => void api().control(s.key, 'start')}>{t('action.start')}</button>
            : <>
                <button className={`btn${s.state === 'down' || s.state === 'duplicate' ? ' btn-primary' : ''}`} disabled={Boolean(s.busy) || s.state === 'invalid' || s.state === 'conflict'} onClick={() => void api().control(s.key, 'restart')}>{t('action.restart')}</button>
                <button className="btn" disabled={Boolean(s.busy) || !running && s.state !== 'down'} onClick={() => askStop(s.key)}>{t('action.stop')}</button>
              </>)}
          {wk?.update?.available && s.descriptor?.commands?.update && (
            <button className="btn" disabled={Boolean(s.busy)} onClick={() => void run('update')}>{t('action.update', { version: wk.update.available })}</button>
          )}
          {s.descriptor?.commands?.doctor && <button className="btn" disabled={Boolean(s.busy)} onClick={() => void run('doctor')}>{t('action.doctor')}</button>}
          {s.descriptor?.paths && <button className="btn" onClick={() => show(s.descriptor!.paths!.data)}>{t('action.showData')}</button>}
          <button className="btn" onClick={() => show(s.descriptorPath)}>{t('action.showFile')}</button>
          {conflictWith.map((o) => (
            <button key={o.key} className="btn" onClick={() => show(o.descriptorPath)}>{t('action.showFileOf', { name: nameOf(o) })}</button>
          ))}
        </div>
        {pathError && <p className="notice error" role="alert">{pathError}</p>}
      </header>
      <div className="tabs" role="tablist" aria-label={nameOf(s)} onKeyDown={(e) => {
        // U-14: arrow keys move between tabs, as a tab list should.
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = tabs.indexOf(tab);
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
        setTab(next);
        (document.getElementById(`tab-${next}`) as HTMLButtonElement | null)?.focus();
      }}>
        {tabs.map((x) => (
          <button key={x} id={`tab-${x}`} role="tab" className="tab" aria-selected={tab === x} aria-controls={tab === x ? `panel-${x}` : undefined} tabIndex={tab === x ? 0 : -1} onClick={() => setTab(x)}>{t(`tab.${x}`)}</button>
        ))}
      </div>
      <div className="svc-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'dashboard' && <DashboardHost s={s} link={link} nonce={nonce} hidden={overlayOpen} applied={appliedLink} />}
        {tab === 'activity' && <div className="pane"><ServiceActivity serviceKey={s.key} tick={`${activityRev ?? ''}|${s.latestEvent?.id ?? ''}`} /></div>}
        {tab === 'health' && <div className="pane"><Health s={s} output={output} /></div>}
        {tab === 'logs' && <div className="pane"><Logs serviceKey={s.key} /></div>}
      </div>
    </div>
  );
}

function DashboardHost({ s, link, nonce, hidden, applied }: { s: ServiceSnapshot; link?: string; nonce?: number; hidden: boolean; applied: { current: string | null } }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'opening' | 'open' | 'error' | 'restarted' | 'crashed'>('opening');
  const [error, setError] = useState<{ text: string; stage: 'sign-in' | 'page' }>({ text: '', stage: 'sign-in' });
  // R-6: Retry and Reload run the show again, fresh, so the view is signed in and attached again.
  const [attempt, setAttempt] = useState(0);
  const fresh = useRef(false);
  // R-7: a link from a notification or another agent is applied once (`applied`, owned by the
  // service page); a tab switch or a remount afterwards keeps the page the person moved to.
  const owner = useRef(`host-${Math.random().toString(36).slice(2)}-${Date.now()}`).current; // this mount, for show/hide (ViewSlot)
  const available = Boolean(s.wellKnown?.surfaces.dashboard) && (s.state === 'ready' || s.state === 'degraded');
  const rect = () => {
    const r = ref.current?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : { x: 0, y: 0, width: 0, height: 0 };
  };

  useLayoutEffect(() => {
    if (!available || hidden) { void api().hideView(owner); return; }
    let cancelled = false;
    setPhase('opening');
    const linkId = link ? `${s.key}|${nonce ?? ''}|${link}` : null;
    const useLink = linkId && linkId !== applied.current ? link : undefined;
    const isFresh = fresh.current;
    fresh.current = false;
    api().showView(s.key, rect(), useLink, owner, isFresh).then((r) => {
      if (cancelled) return;
      if (r.ok) { setPhase('open'); if (useLink) applied.current = linkId; }
      else { fresh.current = true; setPhase('error'); setError({ text: r.error ?? '', stage: r.stage ?? 'sign-in' }); void api().hideView(owner); }
    }, (e: unknown) => {
      if (cancelled) return;
      fresh.current = true;
      setPhase('error'); setError({ text: String((e as Error)?.message ?? e), stage: 'page' }); void api().hideView(owner);
    });
    return () => { cancelled = true; };
  }, [s.key, available, hidden, link, nonce, attempt]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => api().viewBounds(rect()));
    observer.observe(el);
    const onResize = () => api().viewBounds(rect());
    window.addEventListener('resize', onResize);
    return () => { observer.disconnect(); window.removeEventListener('resize', onResize); void api().hideView(owner); };
  }, [s.key]);

  useEffect(() => api().onViewEvent((e) => {
    if (e.key !== s.key) return;
    if (e.kind === 'restarted') setPhase('restarted');
    // R-6, T-17: after a crash or a failed load the next show loads again, fresh — never re-attaches the dead page.
    if (e.kind === 'crashed') { fresh.current = true; setPhase('crashed'); void api().hideView(owner); }
    // A page that failed to load: the view is hidden, so this message is what shows (R-6).
    if (e.kind === 'error') { fresh.current = true; setPhase('error'); setError({ text: e.error ?? '', stage: 'page' }); void api().hideView(owner); }
  }), [s.key]);

  const reload = () => { fresh.current = true; setAttempt((n) => n + 1); };

  if (!s.wellKnown?.surfaces.dashboard && s.wellKnown) return <div className="dash-overlay muted">{t('view.noDashboard')}</div>;
  return (
    <div className="dash-frame">
    {available && (phase === 'open' || phase === 'restarted') && <DashboardToolbar serviceKey={s.key} />}
    {/* Above the host, never inside it: the embedded page covers the host's whole rectangle. */}
    {available && phase === 'restarted' && (
      <div className="reload-bar notice info" role="status"><span>{t('view.restartedReload')}</span><button className="btn" onClick={reload}>{t('action.reload')}</button></div>
    )}
    <div className="dash-host" ref={ref}>
      {!available && <div className="dash-overlay muted">{t('view.unavailable')}</div>}
      {available && phase === 'opening' && <div className="dash-overlay muted row"><Spinner /> {t('view.opening')}</div>}
      {available && phase === 'error' && (
        <div className="dash-overlay">
          <p role="alert">{error.stage === 'sign-in' ? t('view.signInError', { name: nameOf(s), error: error.text }) : t('view.loadError', { name: nameOf(s), error: error.text })}</p>
          {s.descriptor && error.stage === 'sign-in' && <p className="mono muted">{s.descriptor.auth.tokenFile}</p>}
          <button className="btn" onClick={reload}>{t('overview.retry')}</button>
        </div>
      )}
      {available && phase === 'crashed' && (
        <div className="dash-overlay"><p role="alert">{t('view.crashed')}</p><button className="btn btn-primary" onClick={reload}>{t('action.reload')}</button></div>
      )}
    </div>
    </div>
  );
}

/** ADR-0014, SCN-039/040: back, forward, reload, the dashboard's home, the page's address and the two
 *  ways to hand it on. Instant — a toolbar used tens of times a day carries no animation. */
function DashboardToolbar({ serviceKey }: { serviceKey: string }) {
  const { t } = useT();
  const [page, setPage] = useState<PageState | null>(null);
  const [copied, setCopied] = useState<'address' | 'link' | null>(null);
  useEffect(() => {
    let alive = true;
    void api().viewPage(serviceKey).then((p) => { if (alive) setPage(p); });
    const off = api().onViewEvent((e) => { if (e.key === serviceKey && e.kind === 'navigated' && e.page) setPage(e.page); });
    return () => { alive = false; off(); };
  }, [serviceKey]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  const go = (action: 'back' | 'forward' | 'home' | 'refresh') => void api().viewNavigate(serviceKey, action);
  const copy = async (which: 'address' | 'link') => {
    if (!page) return;
    await api().copyText(which === 'address' ? page.address : page.link);
    setCopied(which);
  };
  return (
    <div className="dash-toolbar" role="toolbar" aria-label={t('view.toolbar')}>
      <button className="icon-btn" disabled={!page?.canGoBack} onClick={() => go('back')} aria-label={t('view.back')} title={t('view.back')}>‹</button>
      <button className="icon-btn" disabled={!page?.canGoForward} onClick={() => go('forward')} aria-label={t('view.forward')} title={t('view.forward')}>›</button>
      <button className="icon-btn" onClick={() => go('refresh')} aria-label={t('view.refresh')} title={t('view.refresh')}>{page?.loading ? <Spinner /> : '↻'}</button>
      <button className="icon-btn" onClick={() => go('home')} aria-label={t('view.home')} title={t('view.home')}>⌂</button>
      <input className="address mono" readOnly value={page?.address ?? ''} aria-label={t('view.address')} onFocus={(e) => e.currentTarget.select()} />
      <button className="btn btn-sm" disabled={!page} onClick={() => void copy('address')}>{copied === 'address' ? t('view.copied') : t('view.copyAddress')}</button>
      <button className="btn btn-sm" disabled={!page} onClick={() => void copy('link')} title={t('view.copyLinkHint')}>{copied === 'link' ? t('view.copied') : t('view.copyLink')}</button>
      <span className="visually-hidden" role="status">{copied ? t('view.copied') : ''}</span>
    </div>
  );
}

function Health({ s, output }: { s: ServiceSnapshot; output: { title: string; text: string; running: 'doctor' | 'update' | null } | null }) {
  const { t, lang } = useT();
  const wk = s.wellKnown;
  return (
    <>
      {s.problems.length > 0 && (
        <div className="notice error"><h3>{t('health.problems')}</h3><ul>{s.problems.map((p) => <li key={p}>{p}</li>)}</ul></div>
      )}
      {wk && wk.degraded.length === 0 && <p className="state state-ready">{t('health.allClear')}</p>}
      {wk && wk.degraded.length > 0 && <ul>{wk.degraded.map((d) => <li key={d.source}><b>{d.source}</b>: {d.reason}</li>)}</ul>}
      <dl className="kv">
        <dt>{t('health.descriptor')}</dt><dd>{s.descriptorPath}</dd>
        {s.descriptor && <><dt>{t('health.origin')}</dt><dd>{s.descriptor.origin}</dd></>}
        {s.descriptor?.lifecycle.label && <><dt>{t('health.launchd')}</dt><dd>{s.descriptor.lifecycle.label}{s.launchd.pid ? ` · ${t('health.pid')} ${s.launchd.pid}` : ''}{s.launchd.disabled ? ` · ${t('health.disabled')}` : ''}</dd></>}
        {wk && <><dt>{t('health.started')}</dt><dd>{new Date(wk.process.startedAt).toLocaleString(lang)}</dd></>}
        {wk && <><dt>{t('health.surfaces')}</dt><dd>{Object.entries(wk.surfaces).map(([k, v]) => `${k} ${(v as { path: string }).path}`).join(' · ')}</dd></>}
      </dl>
      {output && (
        <section>
          <h3 className="row"><span className="row" role="status">{output.running ? <><Spinner /> {t(output.running === 'doctor' ? 'busy.doctor' : 'busy.updating')}</> : output.title}</span></h3>
          {output.text && <pre className="log">{output.text}</pre>}
        </section>
      )}
    </>
  );
}

function Logs({ serviceKey }: { serviceKey: string }) {
  const { t } = useT();
  const [logs, setLogs] = useState<{ path: string; text?: string; error?: string }[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void api().logs(serviceKey).then((l) => alive && setLogs(l));
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 3000);
    return () => { alive = false; clearInterval(timer); };
  }, [serviceKey]);
  if (!logs) return <p className="row muted" role="status"><Spinner /> {t('app.loading')}</p>;
  if (!logs.length) return <p className="muted">{t('logs.none')}</p>;
  return (
    <>
      {logs.map((l) => (
        <section key={l.path}>
          <p className="mono muted">{l.path}</p>
          {l.error ? <p className="notice error">{t('logs.unreadable', { path: l.path, error: l.error })}</p> : <pre className="log">{l.text}</pre>}
        </section>
      ))}
    </>
  );
}

function ServiceActivity({ serviceKey, tick }: { serviceKey: string; tick: string }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  // P-7: new rows appear while the tab is open, as on the Activity page.
  useEffect(() => { void api().activity({ serviceKey }).then(setItems); }, [serviceKey, tick]);
  return <Feed items={items} />;
}

/** The instances of one product (ADR-0012): each opens its own page with its own key, session and
 *  controls — switching never borrows another member's authority. */
function InstanceSwitch({ current, members, open }: { current: ServiceSnapshot; members: ServiceSnapshot[]; open: (key: string) => void }) {
  const { t } = useT();
  const label = (m: ServiceSnapshot) => {
    const instance = instanceOf(m.key);
    const where = t(m.descriptor?.placement === 'remote' ? 'instance.remote' : 'instance.local');
    return `${instance === 'default' ? t('instance.main') : instance} · ${where}`;
  };
  return (
    <nav className="instances" aria-label={t('instance.switch', { name: nameOf(members[0] ?? current) })}>
      {members.map((m) => (
        <button key={m.key} className="instance" aria-current={m.key === current.key ? 'page' : undefined} onClick={() => open(m.key)}>
          <span className={`state state-${m.state}`} aria-hidden="true"><span className="glyph">{GLYPH[m.state]}</span></span>
          {label(m)}
          <span className="visually-hidden">{t(`state.${m.state}`)}</span>
        </button>
      ))}
    </nav>
  );
}

const TOOLS_VISIBLE = 8;

/** The agent's MCP tools, as its well-known document names them (DEC-0016/0020): what an agent
 *  session can ask of it. Eight show; the rest wait behind "+N more". */
function Tools({ names }: { names: string[] }) {
  const { t } = useT();
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [names.join(',')]);
  if (!names.length) return null;
  const shown = all ? names : names.slice(0, TOOLS_VISIBLE);
  return (
    <div className="svc-tools" role="group" aria-label={t('svc.tools')}>
      <span className="meta">{t('svc.tools')}</span>
      {shown.map((n) => <code key={n} className="tool-chip">{n}</code>)}
      {names.length > TOOLS_VISIBLE && (
        <button className="btn-link btn btn-sm" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? t('svc.tools.fewer') : t('svc.tools.more', { count: names.length - TOOLS_VISIBLE })}
        </button>
      )}
    </div>
  );
}
