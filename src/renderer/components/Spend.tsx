import { Fragment, useEffect, useState } from 'react';
import type { LimitChange, LimitView, SpendDay, SpendSum, UsageMonth } from '@passioncode-ai/fabric-service-host/usage';
import { limitAmount, limitHeadline, limitName, limitUsd, limitWindow } from '../../core/limits';
import { planLimitChange } from '../../core/limit-plan';
import { sumSpend, type SpendEntry, type SpendWindow } from '../../core/spend';
import type { AppStatus, ServiceSnapshot } from '../../core/types';
import { api, nameOf, Spinner, usePoll, useT } from '../lib';

/** Read again while the page is open; a hidden window gets the last sums, not a new read (lifecycle LC-08). */
const REFRESH_MS = 60_000;

/** SCN-036…038 (ADR-0013): what every agent spent, from its own usage report. */
export function Spend({ status, onOpen }: { status: AppStatus; onOpen: (key: string) => void }) {
  const { t, time, lang, reason } = useT();
  const day = (iso: string) => new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(lang, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const [entries, setEntries] = useState<SpendEntry[] | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  // FD-324: the limit whose Change is open, as `<agent key>\u0000<limit id>`.
  const [editing, setEditing] = useState<string | null>(null);

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
  // Opening Spend is a person asking: it reads now, never the strip's cached sums (live walk, 2026-10-06).
  // LC-08: while the window is hidden the main process answers the last sums without reading.
  usePoll((first) => void read(first), REFRESH_MS, []);

  if (!entries) return <p className="muted row"><Spinner /> {t('spend.reading')}</p>;

  const byKey = new Map(status.services.map((s) => [s.key, s]));
  const name = (key: string) => { const s = byKey.get(key); return s ? nameOf(s) : key; };
  // FD-129 (UX-22): from a breached limit or an unreadable report, one click to the agent itself.
  const openAgent = (key: string) => byKey.has(key) ? <button className="btn btn-sm" aria-label={t('conn.open', { name: name(key) })} onClick={() => onOpen(key)}>{t('action.open')}</button> : null;
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
        <div className="strip strip-3 spend-totals" aria-label={t('spend.totals')}>
          {(['today', 'week', 'month'] as const).map((k) => (
            <div key={k} className="cell"><span className="v">{money(total(k), t)}</span><span className="l">{t(`spend.${k}`)}</span>{estimate(total(k), t) && <span className="l muted">{estimate(total(k), t)}</span>}</div>
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
            <tr><th scope="col">{t('spend.agent')}</th><th scope="col" className="num">{t('spend.today')}</th><th scope="col" className="num">{t('spend.week')}</th><th scope="col" className="num">{t('spend.month')}</th><th scope="col">{t('spend.budget')}</th></tr>
          </thead>
          <tbody>
            {reports.map((e) => (
              <Fragment key={e.key}>
                <tr>
                  <th scope="row">
                    <span className="spend-agent"><button className="linkish" aria-expanded={open === e.key} onClick={() => setOpen(open === e.key ? null : e.key)}>{name(e.key)}</button>{openAgent(e.key)}</span>
                  </th>
                  {(['today', 'week', 'month'] as const).map((k) => (
                    <td key={k} className="num">{money(e.summary[k], t)}{estimate(e.summary[k], t) && <span className="muted"> {estimate(e.summary[k], t)}</span>}</td>
                  ))}
                  <td>{(() => {
                    // DEC-0027: the limit that most needs a person; a report with only the older `budget` keeps that line.
                    const head = limitHeadline(e.summary.limits ?? [], t);
                    if (head) return <span className={head.state === 'tripped' || head.state === 'breach' ? 'state-down' : head.state === 'near' ? 'state-degraded' : undefined}>{head.text}</span>;
                    return e.summary.budget ? t(`spend.budget.${e.summary.budget.period}`, { spent: usd(e.summary.budget.spentUsd, t), limit: usd(e.summary.budget.limitUsd, t) }) : <span className="muted">{t('spend.noLimit')}</span>;
                  })()}</td>
                </tr>
                {open === e.key && (
                  <tr className="spend-models">
                    <td colSpan={5}>
                      {e.summary.daily && <DailyChart days={e.summary.daily} t={t} day={day} />}
                      {(e.summary.months ?? []).length > 1 && <MonthlyChart months={e.summary.months!} t={t} monthName={monthName} />}
                      {(e.summary.limits ?? []).length > 0 && (
                        <table className="spend-limits" aria-label={t('spend.limits')}>
                          <thead><tr><th scope="col">{t('spend.limits.limit')}</th><th scope="col">{t('spend.limits.window')}</th><th scope="col" className="num">{t('spend.limits.amount')}</th><th scope="col">{t('spend.limits.state')}</th>{e.canSetLimits && <th scope="col"><span className="visually-hidden">{t('spend.limits.change')}</span></th>}</tr></thead>
                          <tbody>
                            {(e.summary.limits ?? []).map((l) => (
                              <Fragment key={l.id}>
                                <tr className={l.state === 'off' ? 'muted' : undefined}>
                                  <td>{limitName(l, t)}</td>
                                  <td>{limitWindow(l, t, day)}</td>
                                  <td className="num">{limitAmount(l, t)}</td>
                                  <td className={l.state === 'tripped' || l.state === 'breach' ? 'state-down' : l.state === 'near' ? 'state-degraded' : undefined}>{t(`limit.state.${l.state}`)}</td>
                                  {e.canSetLimits && <td>{l.editable && (
                                    <button className="btn btn-sm" aria-expanded={editing === `${e.key}\u0000${l.id}`} aria-label={t('spend.limits.change.label', { limit: limitName(l, t) })} onClick={() => setEditing(editing === `${e.key}\u0000${l.id}` ? null : `${e.key}\u0000${l.id}`)}>{t('spend.limits.change')}</button>
                                  )}</td>}
                                </tr>
                                {editing === `${e.key}\u0000${l.id}` && (
                                  <tr className="spend-limit-edit"><td colSpan={5}>
                                    <LimitEditor agent={e.key} limit={l} t={t} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); void read(true); }} />
                                  </td></tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {(e.summary.limitChanges ?? []).length > 0 && <LimitChanges changes={e.summary.limitChanges!} limits={e.summary.limits ?? []} t={t} day={day} />}
                      {e.summary.models.length === 0 ? <span className="muted">{t('spend.noCalls')}</span> : (
                        <table>
                          <thead><tr><th scope="col">{t('spend.model')}</th><th scope="col" className="num">{t('spend.calls')}</th><th scope="col" className="num">{t('spend.tokens')}</th><th scope="col" className="num">{t('spend.cost')}</th></tr></thead>
                          <tbody>
                            {e.summary.models.map((m) => (
                              <tr key={`${m.provider}/${m.model}/${m.route ?? ''}`}>
                                <td><span className="mono">{m.model}</span> <span className="muted">{m.provider}</span></td>
                                <td className="num">{m.calls.toLocaleString(lang)}</td>
                                <td className="num">{tokens(m, t, lang)}</td>
                                <td className="num">{m.route === 'subscription' ? <span className="muted">{subscriptionCost(m, t)}</span> : money(m, t)}</td>
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
          <ul>{errors.map((e) => <li key={e.key}><b>{name(e.key)}</b>: {e.reason ? reason(e.reason) : e.error} {openAgent(e.key)}</li>)}</ul>
        </section>
      )}
      {silent.length > 0 && <p className="meta">{t('spend.silent', { names: silent.map(nameOf).join(', ') })}</p>}
      {reports.some((e) => e.summary.today.partial || e.summary.week.partial || e.summary.month.partial) && <p className="meta">{t('spend.partialNote')}</p>}
      {reports.some((e) => e.summary.models.some((m) => m.tokensPartial)) && <p className="meta">{t('spend.tokensPartialNote')}</p>}
      {reports.some((e) => (e.summary.month.estimateUsd ?? 0) > 0) && <p className="meta">{t('spend.estimateNote')}</p>}
    </>
  );
}

export type T = (key: string, params?: Record<string, string | number>) => string;

// #region limit-edit-ui — docs: docs/ux/scenarios.md#scn-036-see-what-every-agent-spent
/** The refusals that read as words here; any other comes in the agent's or this app's own words. */
const EDIT_ERRORS = new Set(['invalid-amount', 'no-change', 'reason-required', 'report-unreadable']);

/** FD-324 (contract DEC-0183 SL-2): Change on one editable limit: its amount, whether it is enforced, and the reason the
 *  agent records with it. A change that does more than tighten is the person's decision, and says so before Save. */
export function LimitEditor({ agent, limit, t, onCancel, onDone }: { agent: string; limit: LimitView; t: T; onCancel: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(limit.limitUsd === null ? '' : String(limit.limitUsd));
  const [enforced, setEnforced] = useState(limit.enforced);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = amount.trim() === '' ? undefined : Number(amount);
  const change = { limitId: limit.id, reason, ...(parsed !== undefined && parsed !== limit.limitUsd ? { limitUsd: parsed } : {}), ...(enforced !== limit.enforced ? { enforced } : {}) };
  const plan = planLimitChange([limit], change);
  const id = `limit-edit-${limit.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api().spendLimitSet(agent, change);
      if (r.ok) onDone();
      else setError(t('spend.limits.edit.failed', { reason: EDIT_ERRORS.has(r.code) ? t(`spend.limits.err.${r.code}`) : r.message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="limit-edit" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
      <label htmlFor={`${id}-amount`}>{t('spend.limits.edit.amount')}</label>
      <input id={`${id}-amount`} type="number" inputMode="decimal" step="0.01" min={limit.minUsd ?? 0.01} {...(limit.maxUsd !== undefined ? { max: limit.maxUsd } : {})} value={amount} onChange={(ev) => setAmount(ev.target.value)} aria-describedby={limit.minUsd !== undefined || limit.maxUsd !== undefined ? `${id}-bounds` : undefined} />
      {(limit.minUsd !== undefined || limit.maxUsd !== undefined) && <span id={`${id}-bounds`} className="meta">{t('spend.limits.edit.bounds', { min: usd(limit.minUsd ?? 0, t), max: limit.maxUsd !== undefined ? usd(limit.maxUsd, t) : '∞' })}</span>}
      <label className="row"><input type="checkbox" checked={enforced} onChange={(ev) => setEnforced(ev.target.checked)} /> {t('spend.limits.edit.enforced')}</label>
      <label htmlFor={`${id}-reason`}>{t('spend.limits.edit.reason')}</label>
      <input id={`${id}-reason`} type="text" maxLength={500} required value={reason} onChange={(ev) => setReason(ev.target.value)} aria-describedby={`${id}-reason-hint`} />
      <span id={`${id}-reason-hint`} className="meta">{t('spend.limits.edit.reasonHint')}</span>
      {plan.ok && !plan.tightens && <p className="meta">{t('spend.limits.edit.yours')}</p>}
      {error && <p className="state-down" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="btn btn-sm" disabled={busy || !plan.ok}>{busy ? <><Spinner /> {t('spend.limits.edit.saving')}</> : t('spend.limits.edit.save')}</button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={onCancel}>{t('action.cancel')}</button>
      </div>
    </form>
  );
}

/** FD-324 (DEC-0183 SL-4): the latest changes of an agent's limits, newest first, as the agent recorded them. */
export function LimitChanges({ changes, limits, t, day }: { changes: LimitChange[]; limits: LimitView[]; t: T; day: (iso: string) => string }) {
  const byId = new Map(limits.map((l) => [l.id, l]));
  const setting = (x: { limitUsd: number | null; enforced: boolean }) => (x.enforced ? usd(x.limitUsd, t) : t('spend.changes.off', { amount: usd(x.limitUsd, t) }));
  return (
    <section className="limit-changes" aria-label={t('spend.changes')}>
      <h3>{t('spend.changes')}</h3>
      <ul>
        {changes.slice(0, 5).map((c) => {
          const l = byId.get(c.limitId);
          const what = c.before === null ? t('spend.changes.created', { after: setting(c.after) }) : `${setting(c.before)} → ${setting(c.after)}`;
          return <li key={c.id}>{t('spend.changes.row', { date: day(c.at), limit: l ? limitName(l, t) : c.limitId, what, who: t(`spend.changes.by.${c.by}`), reason: c.reason })}</li>;
        })}
      </ul>
    </section>
  );
}
// #endregion limit-edit-ui

// #region spend-daily — docs: docs/ux/scenarios.md#scn-036-see-what-every-agent-spent
/** FD-324: one agent's money by day over the last 30 UTC days, oldest first. An unknown day is drawn as an empty frame
 *  and a lower bound as a hatched bar, never as $0; each bar names its day and amount for a screen reader. */
export function DailyChart({ days, t, day }: { days: SpendDay[]; t: T; day: (iso: string) => string }) {
  const top = Math.max(0, ...days.map((d) => d.costUsd ?? 0));
  const W = 6, GAP = 2, H = 48;
  const label = (d: SpendDay) => t(d.costUsd === null ? 'spend.daily.unknownDay' : 'spend.daily.day', { date: day(`${d.date}T00:00:00Z`), amount: money(d, t) });
  return (
    <figure className="spend-daily">
      <figcaption>{t('spend.daily')}</figcaption>
      <svg role="img" aria-label={t('spend.daily.summary', { count: days.filter((d) => d.calls > 0).length })} width={days.length * (W + GAP)} height={H} viewBox={`0 0 ${days.length * (W + GAP)} ${H}`}>
        {days.map((d, i) => {
          const x = i * (W + GAP);
          if (d.costUsd === null) return <rect key={d.date} className="unknown" x={x + 0.5} y={0.5} width={W - 1} height={H - 1}><title>{label(d)}</title></rect>;
          const h = top > 0 ? Math.max(d.costUsd > 0 ? 2 : 0, Math.round((d.costUsd / top) * H)) : 0;
          return <rect key={d.date} className={d.partial ? 'partial' : undefined} x={x} y={H - h} width={W} height={Math.max(h, 1)} opacity={h === 0 ? 0.25 : 1}><title>{label(d)}</title></rect>;
        })}
      </svg>
    </figure>
  );
}
// #endregion spend-daily

// #region spend-monthly — docs: docs/ux/scenarios.md#scn-036-see-what-every-agent-spent
/** FD-324 (contract DEC-0183 SL-6): one agent's money by month as its report gives it (up to 12, oldest first, the last
 *  one still running). An unknown month is an empty frame and a lower bound a hatched bar, as on the daily chart. */
export function MonthlyChart({ months, t, monthName }: { months: UsageMonth[]; t: T; monthName: (m: string) => string }) {
  const top = Math.max(0, ...months.map((m) => m.costUsd ?? 0));
  const W = 18, GAP = 4, H = 48;
  const last = months.length - 1;
  const label = (m: UsageMonth, i: number) => t(i === last ? 'spend.monthly.current' : 'spend.monthly.month', { month: monthName(m.month), amount: money({ costUsd: m.costUsd, partial: m.unpricedCalls > 0 }, t) });
  return (
    <figure className="spend-daily spend-monthly">
      <figcaption>{t('spend.monthly')}</figcaption>
      <svg role="img" aria-label={t('spend.monthly.summary', { count: months.length })} width={months.length * (W + GAP)} height={H} viewBox={`0 0 ${months.length * (W + GAP)} ${H}`}>
        {months.map((m, i) => {
          const x = i * (W + GAP);
          if (m.costUsd === null) return <rect key={m.month} className="unknown" x={x + 0.5} y={0.5} width={W - 1} height={H - 1}><title>{label(m, i)}</title></rect>;
          const h = top > 0 ? Math.max(m.costUsd > 0 ? 2 : 0, Math.round((m.costUsd / top) * H)) : 0;
          return <rect key={m.month} className={m.unpricedCalls > 0 ? 'partial' : undefined} x={x} y={H - h} width={W} height={Math.max(h, 1)} opacity={h === 0 ? 0.25 : 1}><title>{label(m, i)}</title></rect>;
        })}
      </svg>
    </figure>
  );
}
// #endregion spend-monthly

export function usd(x: number | null, t: T): string {
  return limitUsd(x, t);
}

/** Tokens in / out; «≥» while some calls' tokens were not measured in full (DEC-0091). */
export function tokens(s: Pick<SpendSum, 'inputTokens' | 'outputTokens' | 'tokensPartial'>, t: T, lang: string): string {
  const value = t('spend.tokensValue', { input: s.inputTokens.toLocaleString(lang), output: s.outputTokens.toLocaleString(lang) });
  return s.tokensPartial ? `≥ ${value}` : value;
}

/** FD-88: a subscription's list-price value beside the money, or '' when there is none. Never added to it. */
export function estimate(s: Pick<SpendSum, 'estimateUsd' | 'estimatePartial' | 'subscriptionCalls'>, t: T): string {
  // FD-97: subscription calls with no price are unknown, never ~$0.
  if (s.estimateUsd === null) return s.subscriptionCalls > 0 ? t('spend.estimateUnknown') : '';
  // FD-97 review: $0 with some calls unpriced is still a lower bound, shown; $0 with all priced, or none, shows nothing.
  if (s.estimateUsd <= 0 && !(s.estimatePartial && s.subscriptionCalls > 0)) return '';
  return t(s.estimatePartial ? 'spend.estimateAtLeast' : 'spend.estimate', { amount: usd(s.estimateUsd, t) });
}

/** FD-97: one subscription model's list-price value: unknown when none of its calls is priced, «at least» when some are not. */
export function subscriptionCost(s: Pick<SpendSum, 'estimateUsd' | 'estimatePartial'>, t: T): string {
  if (s.estimateUsd === null) return t('spend.subscriptionUnknown');
  return t(s.estimatePartial ? 'spend.subscriptionCostAtLeast' : 'spend.subscriptionCost', { amount: usd(s.estimateUsd, t) });
}

/** Unknown is never $0: a sum with unpriced calls reads «≥ $x». Shared with the Overview strip (D-3). */
export function money(s: Pick<SpendSum, 'costUsd' | 'partial'>, t: T): string {
  if (s.costUsd === null) return t('spend.unknown');
  return s.partial ? `≥ ${usd(s.costUsd, t)}` : usd(s.costUsd, t);
}
