import { offersAgentUpdate, offersFix, SETUP_KEY } from '../../core/offers';
import type { SinceLastVisit } from '../../core/visit';
import { installCommands } from '../../core/install-commands';
import { platformOf } from './Sessions';
import { areasInOrder, attention, type SetupCheckResult } from '../../core/doctor';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { sumSpend, type SpendEntry } from '../../core/spend';
import { attentionQueue, foldAttention, groupAttention, urgent } from '../../core/attention';
import { FixButton } from './ServiceActions';
import { money as formatMoney } from './Spend';
import { categoryOf, instanceOf, type Product } from '../../core/products';
import type { ListLayout } from '../../core/types';
import type { AppStatus, ServiceSnapshot, Settings } from '../../core/types';
import { api, GLYPH, nameOf, NEWS_MS, shortBuild, Spinner, StateBadge, useExpiry, useT } from '../lib';

/** FD-39 SCN-058: the setup the person's coding agent runs. The card shows what is done — read every few
 *  seconds while it is on screen — and opens the Setup console; the app runs none of the steps itself. */
export function SetupCard({ onOpen, consoleOpen, onShown }: { onOpen: (mode: 'new' | 'continue') => void; consoleOpen: boolean;
  /** Whether the card's setup steps are on screen (with Start, or with the console already open beside it). */
  onShown?: (shown: boolean) => void }) {
  const { t } = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [state, setState] = useState<{ mcp: boolean; skills: boolean; firstAgent: boolean } | null>(null);
  // UX-13 (SCN-058 alt path): which coding agents are installed, read with the checklist; null until known.
  const [runtimes, setRuntimes] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const found = useRef(false);
  useEffect(() => { void api().settings().then(setSettings); }, []);
  useEffect(() => {
    if (!settings || settings.setupDone) return undefined;
    const read = () => {
      void api().setupState().then(setState).catch(() => undefined);
      // Read only until one is found: the console's own read covers the rest, and Switchboard is not asked every 5 s.
      if (!found.current) void api().consoleInfo(SETUP_KEY).then((i) => { found.current = i.runtimes.length > 0; setRuntimes(i.runtimes.length); }).catch(() => undefined);
    };
    read();
    const timer = setInterval(read, 5000);
    return () => clearInterval(timer);
  }, [settings]);
  const done = Boolean(state && state.mcp && state.skills && state.firstAgent);
  const steps = Boolean(settings && !settings.setupDone && state && !done);
  useEffect(() => { onShown?.(steps); }, [steps]);
  useEffect(() => () => onShown?.(false), []);
  if (!settings || settings.setupDone || !state) return null;
  const hide = async () => setSettings((await api().updateSettings({ setupDone: true })).settings);
  if (done) {
    return (
      <section className="setup-done" aria-label={t('setup.agent.title')}>
        <span className="sev sev-ok"><span aria-hidden="true">●</span> {t('setup.agent.complete')}</span>
        <SetupCheck onRepair={() => onOpen('new')} lead={null} trail={<button className="btn btn-sm" onClick={() => void hide()}>{t('setup.agent.hide')}</button>} />
      </section>
    );
  }
  const item = (ok: boolean, key: string) => <li className={ok ? 'done' : ''}><span aria-hidden="true">{ok ? '✓' : '○'}</span> {t(key)}<span className="visually-hidden">{ok ? ' ✓' : ''}</span></li>;
  return (
    <section className="notice info setup setup-agent" aria-labelledby="setup-agent-title">
      <h2 id="setup-agent-title">{t('setup.agent.title')}</h2>
      <p>{done ? t('setup.agent.complete') : t('setup.agent.body')}</p>
      <ul className="checklist">
        {item(state.mcp, 'setup.agent.mcp')}
        {item(state.skills, 'setup.agent.skills')}
        {item(state.firstAgent, 'setup.agent.firstAgent')}
      </ul>
      {/* FD-74: one row of actions, the start first and Hide last, with Check setup between them. */}
      {runtimes === 0 && (
        <div className="install-runtimes">
          <p>{t('setup.agent.noRuntime')}</p>
          <ul>
            {installCommands(platformOf()).map((c) => (
              <li key={c.id} className="row">
                <span className="install-name">{c.name}</span>
                <code className="mono">{c.command}</code>
                <button className="btn btn-sm" aria-label={t('setup.agent.copyCommand', { name: c.name })}
                  onClick={() => void api().copyText(c.command).then(() => setCopied(c.id))}>{copied === c.id ? t('view.copied') : t('view.copy')}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <SetupCheck onRepair={() => onOpen('new')}
        lead={/* A setup stopped midway (the app quit, the runtime ended) continues where it was; it can also start over.
                UX-13: with no coding agent installed there is nothing to start; the commands above come first. */
          !done && !consoleOpen && runtimes !== 0 && (settings.consoles[SETUP_KEY]?.runtime
            ? <><button className="btn btn-primary" onClick={() => onOpen('continue')}>{t('setup.agent.continue')}</button><button className="btn" onClick={() => onOpen('new')}>{t('setup.agent.restart')}</button></>
            : <button className="btn btn-primary" onClick={() => onOpen('new')}>{t('setup.agent.start')}</button>)}
        trail={<button className="btn" onClick={() => void hide()}>{t('setup.agent.hide')}</button>} />
    </section>
  );
}

interface Props { status: AppStatus; products: Product[]; open: (key: string, link?: string, tab?: 'logs' | 'health') => void; act: (key: string, action: 'restart' | 'start' | 'update') => void; goSpend: () => void;
  /** FD-39 D-3: Fix / Update with agent. */
  agent?: (key: string, task: { kind: 'fix' | 'update' }) => void;
  /** FD-39 SCN-059: what changed since the last visit, and Continue for the agents the person worked with. */
  visit?: SinceLastVisit | null; onContinue?: (key: string) => void;
  /** FD-78: the person's kinds and hidden agents, and the Hidden fold shared with the sidebar. */
  list?: Pick<ListLayout, 'hidden' | 'kinds' | 'hiddenOpen'>; onHiddenOpen?: (open: boolean) => void;
  /** COPY-13: the first-run empty state's step a person can take: the Setup console (SCN-058). */
  onSetup?: () => void;
  /** The setup card above already offers Start: the empty state does not offer it a second time. */
  setupCard?: boolean;
  /** UX-08: the person dismissed "Since you were last here". */
  onDismissVisit?: () => void }

/** Needs attention shows this many rows; the rest wait behind "Show all" (ADR-0014). */
const ATTENTION_VISIBLE = 3;

export function Overview({ status, products, open, act, goSpend, agent, visit, onContinue, list, onHiddenOpen, onSetup, setupCard, onDismissVisit }: Props) {
  const { t, reason, lang } = useT();
  const [showAll, setShowAll] = useState(false);
  const [pathError, setPathError] = useState('');
  const showFolder = () => void api().showPath(status.servicesDir).then((r) => setPathError(r.ok ? '' : t('overview.showFailed', { error: r.error ?? '', path: status.servicesDir })));
  const services = status.services;
  // U-1: a row stays while its action runs ("Restarting…"), and comes back with the failure and Logs.
  // A failure is news for half an hour; after that the service's own state speaks again.
  const now = useExpiry(services.map((s) => (s.lastAction && !s.lastAction.ok ? s.lastAction.at : undefined)));
  const failed = (s: ServiceSnapshot) => Boolean(s.lastAction && !s.lastAction.ok && !s.busy && now - Date.parse(s.lastAction.at) < NEWS_MS);
  // W2 (UX-04, UX-06): the one queue the tray, the sidebar and the Dock count too, a limit that stopped work included.
  const attention = attentionQueue(services, { now, limits: status.limits });
  const limitOf = new Map(attention.map((x) => [x.s.key, x.limit]));

  if (status.dirError) {
    return (
      <div className="notice error" role="alert">
        <p>{t('overview.dirError', { error: status.dirError })}</p>
        <p className="mono">{status.servicesDir}</p>
        <button className="btn" onClick={() => void api().rescan()}>{t('overview.retry')}</button>
      </div>
    );
  }
  if (status.scanning && !services.length) return <p className="muted row"><Spinner /> {t('overview.scanning')}</p>;
  if (!services.length) {
    return (
      <section className="empty" aria-labelledby="empty-title">
        <h2 id="empty-title">{t('overview.empty.title')}</h2>
        <p>{t('overview.empty.body')}</p>
        <p className="mono">{status.servicesDir}</p>
        <div className="row">
          {/* COPY-13: the step a person takes comes first; the folder is for those who install by hand. */}
          {onSetup && !setupCard && <button className="btn btn-primary" onClick={onSetup}>{t('setup.agent.start')}</button>}
          <button className={onSetup && !setupCard ? 'btn' : 'btn btn-primary'} onClick={showFolder}>{t('overview.empty.show')}</button>
          <button className="btn" onClick={() => void api().openServiceGuide()}>{t('overview.empty.guide')}</button>
        </div>
        {pathError && <p className="notice error" role="alert">{pathError}</p>}
      </section>
    );
  }

  const action = (s: ServiceSnapshot) => {
    if (s.busy) return <span className="row meta" role="status"><Spinner /> {t(`busy.${s.busy}`)}</span>;
    // UX-06: a ready agent whose spending limit stopped work: the place to see and change it is Spend.
    if (s.state === 'ready' && limitOf.get(s.key)) return <button className="btn" onClick={goSpend}>{t('overview.attention.openSpend')}</button>;
    // T-20: an online service has no Logs tab.
    const logs = failed(s) && !isOnline(s) && s.descriptor?.paths?.logs?.length
      ? <button className="btn" aria-label={t('join.action', { action: t('action.logs'), name: nameOf(s) })} onClick={() => open(s.key, undefined, 'logs')}>{t('action.logs')}</button> : null;
    if (logs && !(s.state === 'down' || s.state === 'duplicate')) return logs;
    // DEC-0019: an online service is supervised by its platform — nothing here can restart it.
    if (isOnline(s)) return <button className="btn" onClick={() => open(s.key)}>{t('action.open')}</button>;
    // U-14: each action names the service it acts on, for a screen reader reading the button alone.
    const label = (action: string) => t('join.action', { action, name: nameOf(s) });
    if (s.state === 'down' || s.state === 'duplicate') return <span className="row">{logs}<button className="btn btn-primary" aria-label={label(t('action.restart'))} onClick={() => act(s.key, 'restart')}>{t('action.restart')}</button></span>;
    if (s.wellKnown?.update?.available && s.descriptor?.commands?.update) { // P-9: also when degraded — the update may be the fix
      const text = t('action.update', { version: s.wellKnown.update.available });
      return <button className="btn" aria-label={label(text)} onClick={() => act(s.key, 'update')}>{text}</button>;
    }
    return <button className="btn" aria-label={label(t('action.open'))} onClick={() => open(s.key)}>{t('action.open')}</button>;
  };

  // ADR-0012: one card per product, placed by its primary; Attention above stays per instance (hidden ones too).
  // FD-78: on this Mac, online, services; what the person hid is folded at the bottom.
  const hiddenIds = new Set(list?.hidden ?? []);
  const shown = products.filter((p) => !hiddenIds.has(p.id));
  const local = shown.filter((p) => categoryOf(p, list?.kinds) === 'local');
  const online = shown.filter((p) => categoryOf(p, list?.kinds) === 'online');
  const service = shown.filter((p) => categoryOf(p, list?.kinds) === 'service');
  const hidden = products.filter((p) => hiddenIds.has(p.id));
  const off = status.off ?? []; // FD-123

  const attentionLine = (s: ServiceSnapshot) => {
    // UX-06: a limit that stopped work says so first, in the auditor's words.
    const limit = limitOf.get(s.key);
    const stopped = limit ? reason({ code: 'audit.limit.tripped', params: { limit: limit.id } }) : '';
    const rest = attentionWhy(s);
    return [stopped, rest].filter(Boolean).join(' ');
  };
  const attentionWhy = (s: ServiceSnapshot) => {
    const lastFailure = failed(s) ? reason(s.lastAction!.reason) : '';
    if (s.reasons.length) return [lastFailure, ...s.reasons.map(reason)].filter(Boolean).join(' ');
    if (lastFailure) return lastFailure;
    const tile = s.wellKnown?.summary?.find((x) => x.attention);
    if (tile) return t('reason.attention', { label: tile.label, value: tile.value });
    const version = s.wellKnown?.update?.available;
    return version ? reason({ code: 'audit.update', params: { version } }) : '';
  };
  // FD-86: agents in one state for one reason fold into one line naming them all; a busy row stays its own.
  const entries = groupAttention(attention, ({ s }) => (s.busy ? '' : `${s.state}|${attentionLine(s)}`));
  const fold = foldAttention(entries, showAll, ATTENTION_VISIBLE);
  // UX-07: a folded row's shared action, applied to each member: Restart N when every member is a local agent that
  // is down or runs twice; otherwise each name opens its agent.
  const groupAction = (members: ServiceSnapshot[]) => {
    if (!members.every((m) => (m.state === 'down' || m.state === 'duplicate') && !isOnline(m) && !m.busy)) return null;
    const text = t('overview.attention.restartAll', { count: members.length });
    return <button className="btn btn-primary" aria-label={`${text}: ${members.map(nameOf).join(', ')}`} onClick={() => members.forEach((m) => act(m.key, 'restart'))}>{text}</button>;
  };

  return (
    <>
      <StatusStrip status={status} products={products} attention={attention.length} urgent={attention.some(urgent)} goSpend={goSpend}
        goAttention={() => { const el = document.getElementById('attention-title'); el?.scrollIntoView({ block: 'start' }); el?.focus(); }} />
      {/* VIS-12: what to act on now comes first; the news of the last visit follows it. */}
      {attention.length > 0 && (
        <section className="attention" aria-labelledby="attention-title">
          <h2 id="attention-title" tabIndex={-1}>{t('overview.attention')} <span className="count">{attention.length}</span></h2>
          <ul>
            {fold.shown.map(({ lead: { s }, members }) => members.length > 1 ? (
              <li key={s.key} className="group">
                <StateBadge state={s.state} />
                <span className="name">{t('overview.attention.group', { count: members.length })} {members.map(({ s: m }, i) => (
                  <Fragment key={m.key}>{i > 0 && ', '}<button className="linkish" title={nameOf(m)} onClick={() => open(m.key)}>{nameOf(m)}</button></Fragment>
                ))}</span>
                <span className="why" title={attentionLine(s)}>{attentionLine(s)}</span>
                {/* UX-07: the outage behind a folded row is fixed by acting on every member at once. */}
                <span className="row-actions">{groupAction(members.map((x) => x.s))}</span>
              </li>
            ) : (
              <li key={s.key}>
                <StateBadge state={s.state} />
                <button className="linkish name" title={nameOf(s)} onClick={() => open(s.key)}>{nameOf(s)}</button>
                <span className="why" title={attentionLine(s)}>{attentionLine(s)}</span>
                {/* VIS-02: every action of the row in one cell, so the row stays one line and the reason keeps its room. */}
                <span className="row-actions">
                  {action(s)}
                  {agent && !s.busy && offersFix(s) && <FixButton s={s} onFix={() => agent(s.key, { kind: 'fix' })} />}
                  {agent && !s.busy && !offersFix(s) && offersAgentUpdate(s, false) && <button className="btn" aria-label={t('join.action', { action: t('agent.update'), name: nameOf(s) })} onClick={() => agent(s.key, { kind: 'update' })}>{t('agent.update')}</button>}
                </span>
              </li>
            ))}
          </ul>
          {fold.more !== null && (
            <button className="btn-link more" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
              {showAll ? t('overview.attention.less') : t('overview.attention.all', { count: fold.more })}
            </button>
          )}
        </section>
      )}
      {visit?.since && (() => {
        const byKey = new Map(services.map((x) => [x.key, x]));
        const names = (keys: string[]) => keys.map((k) => (byKey.get(k) ? nameOf(byKey.get(k)!) : k)).join(', ');
        const worked = visit.continueKeys.filter((k) => byKey.has(k));
        const updates = (visit.updates ?? []).filter((u) => byKey.has(u.key));
        const changed = visit.added.length + visit.removed.length + visit.alerts.length + updates.length > 0;
        // UX-09 (FD-129): the section always says what changed, "Nothing changed since …" included.
        return (
          <section className="visit" aria-labelledby="visit-title">
            <div className="row">
              <h2 id="visit-title">{t('visit.title')}</h2>
              <span className="spacer" />
              {/* UX-08: read, then put away; a later visit after an hour away opens it again with what is new. */}
              {onDismissVisit && <button className="btn-link" onClick={onDismissVisit}>{t('visit.dismiss')}</button>}
            </div>
            {!changed && <p className="meta">{t('visit.nothing', { when: new Date(visit.since).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) })}</p>}
            <ul>
              {visit.alerts.map((a) => byKey.has(a.key) && (
                <li key={a.key} className={`state-${a.level === 'error' ? 'down' : 'degraded'}`}>
                  <button className="linkish name" onClick={() => open(a.key)}>{nameOf(byKey.get(a.key)!)}</button>
                  <span className="why" title={a.text}>{a.text}</span>
                  {agent && offersFix(byKey.get(a.key)!) && <FixButton s={byKey.get(a.key)!} onFix={() => agent(a.key, { kind: 'fix' })} />}
                </li>
              ))}
              {visit.added.length > 0 && <li className="meta">{t('visit.added', { names: names(visit.added) })}</li>}
              {visit.removed.length > 0 && <li className="meta">{t('visit.removed', { names: names(visit.removed) })}</li>}
              {updates.length > 0 && <li className="meta">{t('visit.updates', { names: updates.map((u) => `${nameOf(byKey.get(u.key)!)} ${u.version}`).join(', ') })}</li>}
            </ul>
            {onContinue && worked.length > 0 && (
              <div className="row wrap">
                <span className="meta">{t('visit.worked')}</span>
                {worked.slice(0, 6).map((k) => (
                  <button key={k} className="btn" aria-label={t('visit.continueWith', { name: nameOf(byKey.get(k)!) })} onClick={() => onContinue(k)}>{t('visit.continue')} · {nameOf(byKey.get(k)!)}</button>
                ))}
              </div>
            )}
          </section>
        );
      })()}
      <div className="cards">
        {local.map((p) => <Card key={p.id} p={p} open={open} />)}
      </div>
      {online.length > 0 && (
        <section className="online" aria-labelledby="online-title">
          <h2 id="online-title">{t('overview.online')}</h2>
          <div className="cards">
            {online.map((p) => <Card key={p.id} p={p} open={open} />)}
          </div>
        </section>
      )}
      {service.length > 0 && (
        <section className="online" aria-labelledby="service-title">
          <h2 id="service-title">{t('overview.service')}</h2>
          <div className="cards">
            {service.map((p) => <Card key={p.id} p={p} open={open} />)}
          </div>
        </section>
      )}
      {hidden.length + off.length > 0 && (
        <section className="online" aria-labelledby="hidden-title">
          <h2 id="hidden-title"><button className="btn-link fold" aria-expanded={Boolean(list?.hiddenOpen)} onClick={() => onHiddenOpen?.(!list?.hiddenOpen)}>
            <span aria-hidden="true">{list?.hiddenOpen ? '▾' : '▸'}</span> {t('nav.hidden', { count: hidden.length + off.length })}
          </button></h2>
          {list?.hiddenOpen && hidden.length > 0 && <div className="cards">{hidden.map((p) => <Card key={p.id} p={p} open={open} />)}</div>}
          {/* FD-123: agents turned off have no state to show; the sidebar's Hidden turns them on. */}
          {list?.hiddenOpen && off.length > 0 && <p className="muted off-list">{t('overview.offList', { names: off.map((o) => o.name).join(', ') })}</p>}
        </section>
      )}
    </>
  );
}

function Card({ p, open }: { p: Product; open: (key: string) => void }) {
  const { t, duration, time } = useT();
  const s = p.primary;
  const others = p.members.slice(1);
  const wk = s.wellKnown;
  const uptime = wk ? Date.now() - new Date(wk.process.startedAt).getTime() : null;
  return (
    // U-14: the label a screen reader reads carries what the card says first: name, state, purpose, connections.
    // VIS-11 (FD-113): and what a sighted person reads next: the tiles flagged for attention and the latest event.
    <button className="card" onClick={() => open(s.key)} aria-label={[
      t('join.nameState', { name: nameOf(s), state: t(`state.${s.state}`) }), s.descriptor?.summary,
      ...others.map((m) => `${instanceOf(m.key)}: ${t(`state.${m.state}`)}`),
      ...(wk?.summary ?? []).slice(0, 6).filter((tile) => tile.attention).map((tile) => `${tile.label}: ${tile.value}`),
      s.latestEvent ? `${time(s.latestEvent.at)} ${s.latestEvent.text}` : null,
    ].filter(Boolean).join('. ')}>
      <div className="card-head">
        <div>
          <h3 title={nameOf(s)}>{nameOf(s)}</h3>{/* VIS-15: the card cuts a long name */}
          <div className="meta">
            {wk ? <span className="mono">{wk.service.version} · {shortBuild(s)}</span> : <span className="mono">{s.key}</span>}
            {uptime !== null && !isOnline(s) && <> · {t('card.uptime', { uptime: duration(uptime) })}</>}
            {isOnline(s) && <> · {t('card.online', { host: hostOf(s) })}</>}
          </div>
        </div>
        <StateBadge state={s.state} />
      </div>
      {s.descriptor?.summary && <p className="card-summary" title={s.descriptor.summary}>{s.descriptor.summary}</p>}
      {wk?.summary && wk.summary.length > 0 && (
        <div className="tiles">
          {wk.summary.slice(0, 6).map((tile) => (
            <div key={tile.label} className={`tile${tile.attention ? ' attn' : ''}`} title={`${tile.label}: ${tile.value}`}>
              <div className="v">{tile.value}</div>
              <div className="l">{tile.label}</div>
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="card-members">
          {t('card.members')}
          {others.map((m) => (
            <span key={m.key} className={`state state-${m.state}`}>
              <span className="glyph" aria-hidden="true">{GLYPH[m.state]}</span> {instanceOf(m.key)}
              <span className="visually-hidden">{t(`state.${m.state}`)}</span>
            </span>
          ))}
        </div>
      )}
      <div className="event">
        {s.latestEvent ? <><span className="mono">{time(s.latestEvent.at)}</span> {s.latestEvent.text}</> : t('card.noEvent')}
      </div>
    </button>
  );
}

/** DEC-0019: a remote placement — an online agent or dashboard at an https origin. */
export function isOnline(s: ServiceSnapshot): boolean {
  return s.descriptor?.placement === 'remote';
}

function hostOf(s: ServiceSnapshot): string {
  try { return new URL(s.descriptor?.origin ?? '').host; } catch { return s.descriptor?.origin ?? ''; }
}

/** The top of the main screen (ADR-0014, SCN-041): how many agents run well, what needs you, and
 *  what they spent: each cell a label over its number (COPY-04: no word agrees with the count), the spend cell
 *  opening Spend. */
function StatusStrip({ status, products, attention, urgent, goSpend, goAttention }: { status: AppStatus; products: Product[]; attention: number; urgent: boolean; goSpend: () => void; goAttention: () => void }) {
  const { t } = useT();
  const [spend, setSpend] = useState<SpendEntry[] | null>(null);
  // D-3: read on arrival and every minute while Overview is open; a hidden window gets the last sums (LC-08).
  useEffect(() => {
    let alive = true;
    const read = () => void api().spend().then((r) => { if (alive) setSpend(r.entries); }, () => undefined);
    read();
    const timer = setInterval(read, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  const ready = products.filter((p) => p.primary.state === 'ready').length;
  const problems = status.services.filter((s) => ['down', 'duplicate', 'foreign', 'conflict', 'invalid'].includes(s.state)).length;
  // Reachable when anything reports or failed to report: Spend lists the failures (D-3). With no
  // report at all the sum is unknown, never "≥ $0.00" (T-22).
  const reporting = spend?.some((e) => e.kind === 'report' || e.kind === 'error') ?? false;
  const reported = spend?.some((e) => e.kind === 'report') ?? false;
  const sum = (window: 'today' | 'month') => (reported ? formatMoney(sumSpend(spend ?? [], window), t) : t('spend.unknown'));
  return (
    <section className="strip" aria-label={t('overview.strip')}>
      <div className="cell"><span className="l">{t('overview.strip.ready')}</span><span className="v">{ready}<span className="of">/{products.length}</span></span></div>
      {/* VIS-12: the two counts of what needs the person jump to Needs attention; a cell that goes somewhere says so
          with its arrow, not only on hover. */}
      <button className={`cell${problems ? ' bad' : ''}`} onClick={goAttention} disabled={!problems}><span className="l">{t('overview.strip.down')}<Go /></span><span className="v">{problems}</span></button>
      <button className={`cell${attention ? (urgent ? ' attn urgent' : ' attn') : ''}`} onClick={goAttention} disabled={!attention}><span className="l">{t('overview.strip.attention')}<Go /></span><span className="v">{attention}</span></button>
      <button className="cell" onClick={goSpend} disabled={!reporting}>
        <span className="l">{t('overview.strip.spendToday')}<Go /></span><span className="v">{spend === null ? <Spinner /> : reporting ? sum('today') : t('overview.strip.noSpend')}</span>
      </button>
      <button className="cell" onClick={goSpend} disabled={!reporting}>
        <span className="l">{t('overview.strip.spendMonth')}<Go /></span><span className="v">{spend === null ? <Spinner /> : reporting ? sum('month') : t('overview.strip.noSpend')}</span>
      </button>
    </section>
  );
}

/** The strip's mark of a cell that opens something (VIS-12): shown while the cell can be pressed. */
function Go() {
  return <span className="go" aria-hidden="true">›</span>;
}

// #region setup-check — docs: docs/ux/scenarios.md#scn-070-check-what-is-set-up
/** FD-65 (SCN-070): Check setup runs the PassionCode launcher's read-only doctor and lists what needs the person,
 *  grouped by area, each with its fix; Repair with my coding agent opens the Setup console with those lines. */
export function SetupCheck({ onRepair, lead, trail }: { onRepair: () => void; lead?: ReactNode; trail?: ReactNode }) {
  const { t, lang } = useT();
  const [result, setResult] = useState<SetupCheckResult | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => { void api().setupCheckLast().then((r) => setResult((x) => x ?? r)).catch(() => undefined); }, []);
  const check = async () => {
    setRunning(true);
    try { setResult(await api().setupCheck()); } catch (error) { setResult({ kind: 'error', detail: String((error as Error)?.message ?? error), checkedAt: new Date().toISOString() }); } finally { setRunning(false); }
  };
  const lines = result?.kind === 'report' ? attention(result.report) : [];
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="setup-check">
      <div className="row wrap">
        {lead}
        <button className="btn" disabled={running} onClick={() => void check()}>{t('setupCheck.run')}</button>
        {trail}
        {running && <span className="meta row" role="status"><Spinner /> {t('setupCheck.running')}</span>}
        {!running && result?.kind === 'report' && <span className="meta" role="status">{t('setupCheck.summary', { fail: result.report.summary.fail, warn: result.report.summary.warn, ok: result.report.summary.ok, at: time(result.checkedAt) })}</span>}
      </div>
      {!running && result?.kind === 'no-node' && <p className="notice error" role="alert">{t('setupCheck.noNode')}</p>}
      {!running && result?.kind === 'error' && <p className="notice error" role="alert">{t('setupCheck.error', { detail: result.detail })}</p>}
      {!running && result?.kind === 'report' && !lines.length && <p className="meta">{t('setupCheck.clean')}</p>}
      {!running && lines.length > 0 && (
        <>
          {areasInOrder(lines).map((a) => (
            <div key={a} className="setup-check-area">
              <h3>{t(`setupCheck.area.${a}`)}</h3>
              <ul>
                {lines.filter((c) => c.area === a).map((c) => (
                  <li key={c.id} className={`setup-check-${c.state}`}>
                    <span className="chip">{t(`setupCheck.state.${c.state}`)}</span> {c.detail}
                    {c.fix && <div className="meta setup-check-fix">{t('setupCheck.fix')} <code>{c.fix}</code></div>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button className="btn btn-primary" onClick={onRepair}>{t('setupCheck.repair')}</button>
        </>
      )}
    </div>
  );
}
// #endregion setup-check
