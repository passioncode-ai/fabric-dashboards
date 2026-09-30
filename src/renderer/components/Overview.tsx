import { attentionRank } from '@passioncode-ai/fabric-service-host/state';
import type { AppStatus, ServiceSnapshot } from '../../core/types';
import { api, nameOf, shortBuild, Spinner, StateBadge, useT } from '../lib';

interface Props { status: AppStatus; open: (key: string) => void; act: (key: string, action: 'restart' | 'start' | 'update') => void }

export function Overview({ status, open, act }: Props) {
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
    if (s.state === 'down' || s.state === 'duplicate') return <button className="btn btn-primary" onClick={() => act(s.key, 'restart')}>{t('action.restart')}</button>;
    if (s.wellKnown?.update?.available && s.descriptor?.commands?.update && s.state !== 'degraded') {
      return <button className="btn" onClick={() => act(s.key, 'update')}>{t('action.update', { version: s.wellKnown.update.available })}</button>;
    }
    return <button className="btn" onClick={() => open(s.key)}>{t('action.open')}</button>;
  };

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
        {services.map((s) => <Card key={s.key} s={s} open={open} />)}
      </div>
    </>
  );
}

function Card({ s, open }: { s: ServiceSnapshot; open: (key: string) => void }) {
  const { t, duration, time } = useT();
  const wk = s.wellKnown;
  const uptime = wk ? Date.now() - new Date(wk.process.startedAt).getTime() : null;
  return (
    <button className="card" onClick={() => open(s.key)} aria-label={`${nameOf(s)} — ${t(`state.${s.state}`)}`}>
      <div className="card-head">
        <div>
          <h3>{nameOf(s)}</h3>
          <div className="meta">
            {wk ? <span className="mono">{wk.service.version} · {shortBuild(s)}</span> : <span className="mono">{s.key}</span>}
            {uptime !== null && <> · {t('card.uptime', { uptime: duration(uptime) })}</>}
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
      <div className="event">
        {s.latestEvent ? <><span className="mono">{time(s.latestEvent.at)}</span> {s.latestEvent.text}</> : t('card.noEvent')}
      </div>
    </button>
  );
}
