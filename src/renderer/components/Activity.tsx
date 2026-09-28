import { useEffect, useState } from 'react';
import type { ActivityItem, AppStatus } from '../../core/types';
import { api, nameOf, Spinner, useT } from '../lib';

interface Props { status: AppStatus; openAt: (key: string, link?: string) => void }

export function Activity({ status, openAt }: Props) {
  const { t, reason } = useT();
  const [serviceKey, setServiceKey] = useState('');
  const [minLevel, setMinLevel] = useState<'' | ActivityItem['level']>('');
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const tick = status.services.map((s) => s.latestEvent?.id ?? '').join('|') + status.unread;

  useEffect(() => { void api().markActivitySeen(); }, []);
  useEffect(() => {
    void api().activity({ serviceKey: serviceKey || undefined, minLevel: minLevel || undefined }).then(setItems);
  }, [serviceKey, minLevel, tick]);

  const failing = status.services.filter((s) => s.feedError);
  return (
    <>
      {failing.map((s) => (
        <p key={s.key} className="notice warning" role="status">{t('activity.feedError', { name: nameOf(s), error: reason(s.feedError) })}</p>
      ))}
      <div className="filters">
        <label className="visually-hidden" htmlFor="flt-svc">{t('activity.all')}</label>
        <select id="flt-svc" value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}>
          <option value="">{t('activity.all')}</option>
          {status.services.map((s) => <option key={s.key} value={s.key}>{nameOf(s)}</option>)}
        </select>
        <label className="visually-hidden" htmlFor="flt-lvl">{t('activity.level.all')}</label>
        <select id="flt-lvl" value={minLevel} onChange={(e) => setMinLevel(e.target.value as ActivityItem['level'] | '')}>
          <option value="">{t('activity.level.all')}</option>
          <option value="notice">{t('activity.level.notice')}</option>
          <option value="warning">{t('activity.level.warning')}</option>
          <option value="error">{t('activity.level.error')}</option>
        </select>
      </div>
      <Feed items={items} openAt={openAt} />
    </>
  );
}

export function Feed({ items, openAt }: { items: ActivityItem[] | null; openAt?: (key: string, link?: string) => void }) {
  const { t, time, lang } = useT();
  if (!items) return <p className="row muted"><Spinner /></p>;
  if (!items.length) return <p className="muted">{t('activity.empty')}</p>;
  const dayOf = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t('activity.today');
    if (d.toDateString() === y.toDateString()) return t('activity.yesterday');
    return d.toLocaleDateString(lang, { day: 'numeric', month: 'long' });
  };
  let lastDay = '';
  return (
    <ul className="feed">
      {items.map((e) => {
        const day = dayOf(e.at);
        const header = day !== lastDay ? <li className="day" key={`d-${day}`}>{day}</li> : null;
        lastDay = day;
        const body = (
          <>
            <span className="mono muted">{time(e.at)}</span>
            <span>{e.serviceName}</span>
            <span className={`level level-${e.level}`}>{t(`level.${e.level}`)}</span>
            <span>{e.text}</span>
          </>
        );
        return [
          header,
          <li key={`${e.serviceKey}-${e.source}-${e.id}`}>
            {openAt && e.source === 'service'
              ? <button className="feed-row" onClick={() => openAt(e.serviceKey, e.link)}>{body}</button>
              : <div className="feed-row">{body}</div>}
          </li>,
        ];
      })}
    </ul>
  );
}
