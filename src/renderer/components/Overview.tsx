import { attentionRank } from '@passioncode-ai/fabric-service-host/state';
import { useEffect, useState } from 'react';
import { sumSpend, type SpendEntry } from '../../core/spend';
import { instanceOf, type Product } from '../../core/products';
import type { AppStatus, ServiceSnapshot, Settings } from '../../core/types';
import { api, GLYPH, nameOf, shortBuild, Spinner, StateBadge, useT } from '../lib';

/** The first-run question (SCN-024, lifecycle LC-07): launch at login is off until the person
 *  answers here or in Settings; either answer registers or unregisters once, and the card is gone. */
export function LoginQuestion() {
  const { t } = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void api().settings().then(setSettings); }, []);
  if (!settings || settings.launchAtLoginAsked) return error ? <p className="notice error" role="alert">{error}</p> : null;
  const choose = async (launchAtLogin: boolean) => {
    const r = await api().updateSettings({ launchAtLogin });
    setSettings(r.settings);
    setError(r.error ? t('settings.loginItemRefused', { error: r.error }) : '');
  };
  return (
    <section className="notice info setup" aria-labelledby="setup-login-title">
      <h2 id="setup-login-title">{t('setup.login.title')}</h2>
      <p>{t('setup.login.body')}</p>
      <div className="row">
        <button className="btn btn-primary" onClick={() => void choose(true)}>{t('setup.login.yes')}</button>
        <button className="btn" onClick={() => void choose(false)}>{t('setup.login.no')}</button>
      </div>
    </section>
  );
}

interface Props { status: AppStatus; products: Product[]; open: (key: string) => void; act: (key: string, action: 'restart' | 'start' | 'update') => void; goSpend: () => void }

/** Needs attention shows this many rows; the rest wait behind "Show all" (ADR-0014). */
const ATTENTION_VISIBLE = 3;

export function Overview({ status, products, open, act, goSpend }: Props) {
  const { t, reason } = useT();
  const [showAll, setShowAll] = useState(false);
  const services = status.services;
  const attention = services
    .map((s) => ({ s, rank: attentionRank(s.state, s.wellKnown) }))
    .filter((x) => x.rank !== null)
    .sort((a, b) => a.rank! - b.rank!);

  if (status.dirError) {
    return (
      <div className="notice error" role="alert">
        <p>{t('overview.dirError', { error: status.dirError })}</p>
        <p className="mono">{status.servicesDir}</p>
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
        <button className="btn btn-primary" onClick={() => void api().showPath(status.servicesDir)}>{t('overview.empty.show')}</button>
      </section>
    );
  }

  const action = (s: ServiceSnapshot) => {
    if (s.busy) return <span className="row meta"><Spinner /> {t(`busy.${s.busy}`)}</span>;
    // DEC-0019: an online service is supervised by its platform — nothing here can restart it.
    if (isOnline(s)) return <button className="btn" onClick={() => open(s.key)}>{t('action.open')}</button>;
    if (s.state === 'down' || s.state === 'duplicate') return <button className="btn btn-primary" onClick={() => act(s.key, 'restart')}>{t('action.restart')}</button>;
    if (s.wellKnown?.update?.available && s.descriptor?.commands?.update && s.state !== 'degraded') {
      return <button className="btn" onClick={() => act(s.key, 'update')}>{t('action.update', { version: s.wellKnown.update.available })}</button>;
    }
    return <button className="btn" onClick={() => open(s.key)}>{t('action.open')}</button>;
  };

  // ADR-0012: one card per product, placed by its primary; Attention above stays per instance.
  const local = products.filter((p) => !isOnline(p.primary));
  const online = products.filter((p) => isOnline(p.primary));

  const attentionLine = (s: ServiceSnapshot) => {
    if (s.reasons.length) return s.reasons.map(reason).join(' ');
    const tile = s.wellKnown?.summary?.find((x) => x.attention);
    return tile ? t('reason.attention', { label: tile.label, value: tile.value }) : '';
  };

  return (
    <>
      <StatusStrip status={status} products={products} attention={attention.length} goSpend={goSpend} />
      {attention.length > 0 && (
        <section className="attention" aria-labelledby="attention-title">
          <h2 id="attention-title">{t('overview.attention')} <span className="count">{attention.length}</span></h2>
          <ul>
            {(showAll ? attention : attention.slice(0, ATTENTION_VISIBLE)).map(({ s }) => (
              <li key={s.key}>
                <StateBadge state={s.state} />
                <button className="linkish name" onClick={() => open(s.key)}>{nameOf(s)}</button>
                <span className="why" title={attentionLine(s)}>{attentionLine(s)}</span>
                {action(s)}
              </li>
            ))}
          </ul>
          {attention.length > ATTENTION_VISIBLE && (
            <button className="btn-link more" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
              {showAll ? t('overview.attention.less') : t('overview.attention.all', { count: attention.length })}
            </button>
          )}
        </section>
      )}
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
    <button className="card" onClick={() => open(s.key)} aria-label={`${nameOf(s)} — ${t(`state.${s.state}`)}`}>
      <div className="card-head">
        <div>
          <h3>{nameOf(s)}</h3>
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
 *  what they spent — each cell one number with its label, the spend cell opening Spend. */
function StatusStrip({ status, products, attention, goSpend }: { status: AppStatus; products: Product[]; attention: number; goSpend: () => void }) {
  const { t } = useT();
  const [spend, setSpend] = useState<SpendEntry[] | null>(null);
  useEffect(() => { let alive = true; void api().spend().then((e) => { if (alive) setSpend(e); }); return () => { alive = false; }; }, []);
  const ready = products.filter((p) => p.primary.state === 'ready').length;
  const problems = status.services.filter((s) => ['down', 'duplicate', 'foreign', 'conflict', 'invalid'].includes(s.state)).length;
  const reporting = spend?.some((e) => e.kind === 'report') ?? false;
  const money = (window: 'today' | 'month') => {
    const sum = sumSpend(spend ?? [], window);
    if (sum.costUsd === null) return t('spend.unknown');
    return `${sum.partial ? '≥ ' : ''}$${sum.costUsd.toFixed(2)}`;
  };
  return (
    <div className="strip" aria-label={t('overview.strip')}>
      <div className="cell"><span className="v">{ready}<span className="of">/{products.length}</span></span><span className="l">{t('overview.strip.ready')}</span></div>
      <div className={`cell${problems ? ' bad' : ''}`}><span className="v">{problems}</span><span className="l">{t('overview.strip.down')}</span></div>
      <div className={`cell${attention ? ' attn' : ''}`}><span className="v">{attention}</span><span className="l">{t('overview.strip.attention')}</span></div>
      <button className="cell" onClick={goSpend} disabled={!reporting}>
        <span className="v">{reporting ? money('today') : '—'}</span><span className="l">{t('overview.strip.spendToday')}</span>
      </button>
      <button className="cell" onClick={goSpend} disabled={!reporting}>
        <span className="v">{reporting ? money('month') : '—'}</span><span className="l">{t('overview.strip.spendMonth')}</span>
      </button>
    </div>
  );
}
