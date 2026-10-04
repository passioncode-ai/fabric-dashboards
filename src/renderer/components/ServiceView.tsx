import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ActivityItem, ServiceSnapshot } from '../../core/types';
import { instanceOf } from '../../core/products';
import { api, GLYPH, nameOf, portOf, shortBuild, Spinner, StateBadge, useT } from '../lib';
import { Feed } from './Activity';

type Tab = 'dashboard' | 'activity' | 'health' | 'logs';

interface Props {
  s: ServiceSnapshot;
  /** Every instance of this service's product, primary first (ADR-0012); one entry means no switcher. */
  members: ServiceSnapshot[];
  open: (key: string) => void;
  link?: string;
  nonce?: number; // a new value re-opens the same link (a second click on one notification)
  overlayOpen: boolean;
  askStop: (key: string) => void;
}

export function ServiceView({ s, members, open, link, nonce, overlayOpen, askStop }: Props) {
  const { t, reason, duration } = useT();
  const hasDashboard = Boolean(s.wellKnown?.surfaces.dashboard);
  const [tab, setTabState] = useState<Tab>(hasDashboard ? 'dashboard' : 'health');
  const chosen = useRef(false); // the operator picked a tab; stop choosing for them
  const setTab = (x: Tab) => { chosen.current = true; setTabState(x); };
  const [output, setOutput] = useState<{ title: string; text: string } | null>(null);
  useEffect(() => { chosen.current = false; setOutput(null); }, [s.key]);
  // The first snapshot can arrive before the first answer: open the dashboard once it exists.
  useEffect(() => { if (!chosen.current) setTabState(hasDashboard ? 'dashboard' : 'health'); }, [s.key, hasDashboard]);
  useEffect(() => { if (link) setTabState('dashboard'); }, [link, nonce]);

  const wk = s.wellKnown;
  const managed = s.descriptor?.lifecycle.manager === 'launchd';
  const running = ['ready', 'degraded', 'duplicate'].includes(s.state);
  const run = async (which: 'doctor' | 'update') => {
    setOutput({ title: which, text: '' });
    const r = await api().command(s.key, which);
    const status = r.timedOut ? t('result.commandTimeout', { command: which }) : t('result.command', { command: which, code: r.code ?? '—' });
    setOutput({ title: status, text: r.output });
    if (which === 'doctor') setTabState('health');
  };

  return (
    <div className="svc">
      {members.length > 1 && <InstanceSwitch current={s} members={members} open={open} />}
      <header className="svc-head">
        <div className="svc-title">
          <h1>{nameOf(s)}</h1>
          <StateBadge state={s.state} />
          {s.busy && <span className="row meta"><Spinner /> {t(`busy.${s.busy}`)}</span>}
        </div>
        <div className="facts">
          {wk && <span>{t('health.version')} <b>{wk.service.version}</b></span>}
          {wk && <span>{t('health.build')} <b>{shortBuild(s)}</b></span>}
          {wk && <span>{t('health.pid')} <b>{wk.process.pid}</b></span>}
          <span>{t('health.port')} <b>{portOf(s)}</b></span>
          {wk && <span>{t('card.uptime', { uptime: duration(Date.now() - new Date(wk.process.startedAt).getTime()) })}</span>}
        </div>
        {s.reasons.length > 0 && <ul className="reasons">{s.reasons.map((r, i) => <li key={i}>{reason(r)}</li>)}</ul>}
        {s.lastAction && !s.busy && (
          <p className={`meta${s.lastAction.ok ? '' : ' state-down'}`} role="status">{reason(s.lastAction.reason)}</p>
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
          {s.descriptor?.paths && <button className="btn" onClick={() => void api().showPath(s.descriptor!.paths!.data)}>{t('action.showData')}</button>}
          <button className="btn" onClick={() => void api().showPath(s.descriptorPath)}>{t('action.showFile')}</button>
        </div>
      </header>
      <div className="tabs" role="tablist">
        {(['dashboard', 'activity', 'health', ...(s.descriptor?.placement === 'remote' ? [] : ['logs'])] as Tab[]).map((x) => (
          <button key={x} role="tab" className="tab" aria-selected={tab === x} onClick={() => setTab(x)}>{t(`tab.${x}`)}</button>
        ))}
      </div>
      <div className="svc-body">
        {tab === 'dashboard' && <DashboardHost s={s} link={link} nonce={nonce} hidden={overlayOpen} />}
        {tab === 'activity' && <div className="pane"><ServiceActivity serviceKey={s.key} /></div>}
        {tab === 'health' && <div className="pane"><Health s={s} output={output} /></div>}
        {tab === 'logs' && <div className="pane"><Logs serviceKey={s.key} /></div>}
      </div>
    </div>
  );
}

function DashboardHost({ s, link, nonce, hidden }: { s: ServiceSnapshot; link?: string; nonce?: number; hidden: boolean }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'opening' | 'open' | 'error' | 'restarted' | 'crashed'>('opening');
  const [error, setError] = useState('');
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
    void api().showView(s.key, rect(), link, owner).then((r) => {
      if (cancelled) return;
      if (r.ok) setPhase('open');
      else { setPhase('error'); setError(r.error ?? ''); void api().hideView(owner); }
    });
    return () => { cancelled = true; };
  }, [s.key, available, hidden, link, nonce]);

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
    if (e.kind === 'crashed') { setPhase('crashed'); void api().hideView(owner); }
    if (e.kind === 'error') { setPhase('error'); setError(e.error ?? ''); }
  }), [s.key]);

  const reload = async () => { await api().reloadView(s.key); setPhase('open'); api().viewBounds(rect()); };

  if (!s.wellKnown?.surfaces.dashboard && s.wellKnown) return <div className="dash-overlay muted">{t('view.noDashboard')}</div>;
  return (
    <div className="dash-host" ref={ref}>
      {!available && <div className="dash-overlay muted">{t('view.unavailable')}</div>}
      {available && phase === 'opening' && <div className="dash-overlay muted row"><Spinner /> {t('view.opening')}</div>}
      {available && phase === 'error' && (
        <div className="dash-overlay">
          <p role="alert">{t('view.signInError', { name: s.descriptor?.name ?? s.key, error })}</p>
          {s.descriptor && <p className="mono muted">{s.descriptor.auth.tokenFile}</p>}
          <button className="btn" onClick={() => void reload()}>{t('overview.retry')}</button>
        </div>
      )}
      {available && phase === 'crashed' && (
        <div className="dash-overlay"><p>{t('view.crashed')}</p><button className="btn btn-primary" onClick={() => void reload()}>{t('action.reload')}</button></div>
      )}
      {available && phase === 'restarted' && (
        <div className="reload-bar notice info"><span>{t('view.restartedReload')}</span><button className="btn" onClick={() => void reload()}>{t('action.reload')}</button></div>
      )}
    </div>
  );
}

function Health({ s, output }: { s: ServiceSnapshot; output: { title: string; text: string } | null }) {
  const { t } = useT();
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
        {s.descriptor && <><dt>origin</dt><dd>{s.descriptor.origin}</dd></>}
        {s.descriptor?.lifecycle.label && <><dt>launchd</dt><dd>{s.descriptor.lifecycle.label}{s.launchd.pid ? ` · pid ${s.launchd.pid}` : ''}{s.launchd.disabled ? ' · disabled' : ''}</dd></>}
        {wk && <><dt>{t('health.started')}</dt><dd>{new Date(wk.process.startedAt).toLocaleString()}</dd></>}
        {wk && <><dt>{t('health.surfaces')}</dt><dd>{Object.entries(wk.surfaces).map(([k, v]) => `${k} ${(v as { path: string }).path}`).join(' · ')}</dd></>}
      </dl>
      {output && (
        <section>
          <h3 className="row">{output.text === '' && output.title.length < 10 ? <><Spinner /> {t('busy.doctor')}</> : output.title}</h3>
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
  if (!logs) return <p className="row muted"><Spinner /></p>;
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

function ServiceActivity({ serviceKey }: { serviceKey: string }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  useEffect(() => { void api().activity({ serviceKey }).then(setItems); }, [serviceKey]);
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
