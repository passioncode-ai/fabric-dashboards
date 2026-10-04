import { attentionRank } from '@passioncode-ai/fabric-service-host/state';
import { useEffect, useState } from 'react';
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

interface Props { status: AppStatus; products: Product[]; open: (key: string) => void; act: (key: string, action: 'restart' | 'start' | 'update') => void }

export function Overview({ status, products, open, act }: Props) {
  const { t, reason } = useT();
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
      {attention.length > 0 && (
        <section className="attention" aria-labelledby="attention-title">
          <h2 id="attention-title">{t('overview.attention')}</h2>
          <ul>
            {attention.map(({ s }) => (
              <li key={s.key}>
                <span><StateBadge state={s.state} /> <b>{nameOf(s)}</b></span>
                <span className="muted">{attentionLine(s)}</span>
                {action(s)}
              </li>
            ))}
          </ul>
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
      {wk?.summary && wk.summary.length > 0 && (
        <div className="tiles">
          {wk.summary.slice(0, 6).map((tile) => (
            <div key={tile.label} className={`tile${tile.attention ? ' attn' : ''}`}>
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
