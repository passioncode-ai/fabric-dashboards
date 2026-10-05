import { Fragment, useEffect, useState } from 'react';
import type { SpendSum } from '@passioncode-ai/fabric-service-host/usage';
import { sumSpend, type SpendEntry, type SpendWindow } from '../../core/spend';
import type { AppStatus, ServiceSnapshot } from '../../core/types';
import { api, nameOf, Spinner, useT } from '../lib';

/** Read again while the page is open; a hidden window gets the last sums, not a new read (lifecycle LC-08). */
const REFRESH_MS = 60_000;

/** SCN-036…038 (ADR-0013): what every agent spent, from its own usage report. */
export function Spend({ status }: { status: AppStatus }) {
  const { t, time, lang } = useT();
  const [entries, setEntries] = useState<SpendEntry[] | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const read = async (force = false) => {
    setBusy(true);
    try {
      const r = await api().spend(force);
      setEntries(r.entries);
      setReadAt(r.readAt);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void read();
    // LC-08: while the window is hidden the main process answers the last sums without reading.
    const timer = setInterval(() => void read(), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  if (!entries) return <p className="muted row"><Spinner /> {t('spend.reading')}</p>;

  const byKey = new Map(status.services.map((s) => [s.key, s]));
  const name = (key: string) => { const s = byKey.get(key); return s ? nameOf(s) : key; };
  const reports = entries.filter((e): e is Extract<SpendEntry, { kind: 'report' }> => e.kind === 'report');
  const errors = entries.filter((e): e is Extract<SpendEntry, { kind: 'error' }> => e.kind === 'error');
  const silent = entries.filter((e) => e.kind === 'none').map((e) => byKey.get(e.key)).filter((s): s is ServiceSnapshot => Boolean(s));
  const total = (window: SpendWindow): SpendSum => sumSpend(entries, window);

  return (
    <>
      <div className="row spend-head">
        <span className="meta">{readAt ? t('spend.readAt', { time: time(readAt) }) : ''}</span>
        <button className="btn" disabled={busy} onClick={() => void read(true)}>{busy ? <Spinner /> : null} {t('spend.refresh')}</button>
      </div>
      {reports.length > 0 && (
        <div className="tiles spend-totals" aria-label={t('spend.totals')}>
          {(['today', 'week', 'month'] as const).map((k) => (
            <div key={k} className="tile"><div className="v">{money(total(k), t)}</div><div className="l">{t(`spend.${k}`)}</div></div>
          ))}
        </div>
      )}
      {reports.length === 0 && errors.length === 0 && (
        <section className="empty" aria-labelledby="spend-empty-title">
          <h2 id="spend-empty-title">{t('spend.empty.title')}</h2>
          <p>{t('spend.empty.body')}</p>
        </section>
      )}
      {reports.length > 0 && (
        <table className="spend">
          <thead>
            <tr><th scope="col">{t('spend.agent')}</th><th scope="col">{t('spend.today')}</th><th scope="col">{t('spend.week')}</th><th scope="col">{t('spend.month')}</th><th scope="col">{t('spend.budget')}</th></tr>
          </thead>
          <tbody>
            {reports.map((e) => (
              <Fragment key={e.key}>
                <tr>
                  <th scope="row">
                    <button className="linkish" aria-expanded={open === e.key} onClick={() => setOpen(open === e.key ? null : e.key)}>{name(e.key)}</button>
                  </th>
                  <td>{money(e.summary.today, t)}</td>
                  <td>{money(e.summary.week, t)}</td>
                  <td>{money(e.summary.month, t)}</td>
                  <td>{e.summary.budget ? t(`spend.budget.${e.summary.budget.period}`, { spent: usd(e.summary.budget.spentUsd, t), limit: usd(e.summary.budget.limitUsd, t) }) : '—'}</td>
                </tr>
                {open === e.key && (
                  <tr className="spend-models">
                    <td colSpan={5}>
                      {e.summary.models.length === 0 ? <span className="muted">{t('spend.noCalls')}</span> : (
                        <table>
                          <thead><tr><th scope="col">{t('spend.model')}</th><th scope="col">{t('spend.calls')}</th><th scope="col">{t('spend.tokens')}</th><th scope="col">{t('spend.cost')}</th></tr></thead>
                          <tbody>
                            {e.summary.models.map((m) => (
                              <tr key={`${m.provider}/${m.model}`}>
                                <td><span className="mono">{m.model}</span> <span className="muted">{m.provider}</span></td>
                                <td>{m.calls}</td>
                                <td>{t('spend.tokensValue', { input: m.inputTokens.toLocaleString(lang), output: m.outputTokens.toLocaleString(lang) })}</td>
                                <td>{money(m, t)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      {errors.length > 0 && (
        <section className="notice error" aria-labelledby="spend-errors-title">
          <h2 id="spend-errors-title">{t('spend.errors')}</h2>
          <ul>{errors.map((e) => <li key={e.key}><b>{name(e.key)}</b> — {e.error}</li>)}</ul>
        </section>
      )}
      {silent.length > 0 && <p className="meta">{t('spend.silent', { names: silent.map(nameOf).join(', ') })}</p>}
      {reports.some((e) => e.summary.today.partial || e.summary.week.partial || e.summary.month.partial) && <p className="meta">{t('spend.partialNote')}</p>}
    </>
  );
}

export type T = (key: string, params?: Record<string, string | number>) => string;

export function usd(x: number | null, t: T): string {
  if (x === null) return t('spend.unknown');
  if (x > 0 && x < 0.01) return '<$0.01';
  return `$${x.toFixed(2)}`;
}

/** Unknown is never $0: a sum with unpriced calls reads «≥ $x». Shared with the Overview strip (D-3). */
export function money(s: Pick<SpendSum, 'costUsd' | 'partial'>, t: T): string {
  if (s.costUsd === null) return t('spend.unknown');
  return s.partial ? `≥ ${usd(s.costUsd, t)}` : usd(s.costUsd, t);
}
