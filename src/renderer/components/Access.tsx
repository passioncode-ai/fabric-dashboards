// #region access-tab — docs: docs/ux/scenarios.md#scn-123-see-who-holds-access-and-what-each-agent-holds
// FD-351 (contract DEC-0187): what an agent holds and who has access to it, from every product's own access list. A
// product that does not list access is counted, never read as granting nothing; a holder a product could not name as an
// agent stays as the product wrote it. No key value reaches this page.
import { useState } from 'react';
import type { GrantHolder } from '@passioncode-ai/fabric-service-host/access-grants';
import type { AccessView, GrantRow } from '../../core/access-view';
import type { ServiceSnapshot } from '../../core/types';
import { api, nameOf, Spinner, usePoll, useT } from '../lib';

/** Read again while the tab is open; a hidden window gets the last read (lifecycle LC-08). */
const REFRESH_MS = 60_000;

export function Access({ s, all }: { s: ServiceSnapshot; all: readonly ServiceSnapshot[] }) {
  const { t, time } = useT();
  const [view, setView] = useState<AccessView | null>(null);
  const [busy, setBusy] = useState(false);
  const read = async (live: { on: boolean }, force = false) => {
    setBusy(true);
    try {
      const v = await api().access(s.key, force);
      if (live.on) setView(v);
    } finally { if (live.on) setBusy(false); }
  };
  usePoll((first, alive) => {
    if (first) setView(null);
    void read({ get on() { return alive(); } });
  }, REFRESH_MS, [s.key]);

  const nameOfKey = (key: string) => { const o = all.find((x) => x.key === key); return o ? nameOf(o) : key; };
  const holder = (h: GrantHolder) => (h.kind === 'agent' ? nameOfKey(h.agent)
    : h.kind === 'unresolved' ? t('access.holder.unresolved', { label: h.label })
      : t(`access.holder.${h.kind}`, { ref: h.ref }));
  const limit = (r: GrantRow) => (typeof r.grant.limitUsd === 'number' && r.grant.limitPeriod
    ? t(`access.limit.${r.grant.limitPeriod}`, { usd: r.grant.limitUsd })
    : t('access.limit.none'));
  const spent = (r: GrantRow) => (typeof r.grant.spentDayUsd === 'number' ? `$${r.grant.spentDayUsd}` : r.grant.spentDayUsd === null ? t('access.spent.unknown') : '');
  const issued = (r: GrantRow) => t('access.issued', {
    time: time(r.grant.issued.at),
    by: t(`access.by.${r.grant.issued.by}`),
    via: r.grant.issued.via === 'agent' ? t('access.via.agent', { agent: nameOfKey(r.grant.issued.agent ?? '') }) : t(`access.via.${r.grant.issued.via}`),
  });
  const state = (r: GrantRow) => (r.state === 'active' ? t('access.state.active')
    : r.state === 'revoked' ? t('access.state.revoked', { time: time(r.grant.revoked!.at) })
      : t('access.state.expired', { time: time(r.grant.expiresAt!) }));

  const table = (rows: GrantRow[], who: 'issuer' | 'holder', id: string) => (
    <table className="spend access-grants" aria-labelledby={id}>
      <thead>
        <tr>
          <th scope="col">{t(who === 'issuer' ? 'access.col.product' : 'access.col.holder')}</th>
          <th scope="col">{t('access.col.scopes')}</th>
          <th scope="col">{t('access.col.limit')}</th>
          <th scope="col">{t('access.col.spent')}</th>
          <th scope="col">{t('access.col.issued')}</th>
          <th scope="col">{t('access.col.state')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.issuer}/${r.grant.id}`} className={r.state === 'active' ? undefined : 'muted'}>
            <th scope="row">{who === 'issuer' ? nameOfKey(r.issuer) : holder(r.grant.holder)}</th>
            <td>{r.grant.scopes.join(', ')}</td>
            <td>{limit(r)}</td>
            <td>{spent(r)}</td>
            <td>{issued(r)}</td>
            <td>{state(r)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const head = (
    <div className="row spend-head">
      <span className="meta">{view?.readAt ? t('access.readAt', { time: time(view.readAt) }) : ''}</span>
      <button className="btn" disabled={busy} onClick={() => void read({ on: true }, true)}>{busy ? <Spinner /> : null} {t('access.refresh')}</button>
    </div>
  );
  if (!view) return <p className="muted row"><Spinner /> {t('access.reading')}</p>;
  const notDeclared = view.products.filter((p) => p.state === 'not-declared').length;
  const unread = view.products.filter((p) => p.state === 'unreadable' || p.state === 'refused');
  return (
    <section className="access" aria-labelledby="access-title">
      <h2 id="access-title" className="visually-hidden">{t('tab.access')}</h2>
      {head}
      <h3 id="access-holds">{t('access.holds')}</h3>
      {view.holds.length ? table(view.holds, 'issuer', 'access-holds') : <p className="muted">{t('access.holds.none')}</p>}
      <h3 id="access-granted">{t('access.grantedTo')}</h3>
      {view.grantedTo.length ? table(view.grantedTo, 'holder', 'access-granted') : <p className="muted">{t('access.grantedTo.none')}</p>}
      {unread.map((p) => <p key={p.key} className="notice warning">{t('access.unreadable', { name: nameOfKey(p.key), why: p.why ?? '' })}</p>)}
      {notDeclared > 0 && <p className="meta">{t('access.notDeclared', { count: notDeclared })}</p>}
    </section>
  );
}
// #endregion access-tab
