// #region load-tab — docs: docs/ux/scenarios.md#scn-076-see-how-busy-an-agent-is
// FD-93: how busy an agent is, from its own load report (contract DEC-0104). The numbers a person acts on first (running
// against the limit, waiting against the queue), then what ended in a day, the times, and the contexts. A wrong
// declaration or an unreadable report says so with its reason; nothing is guessed past it.
import { useEffect, useState } from 'react';
import type { LoadEntry } from '../../core/load';
import type { ServiceSnapshot } from '../../core/types';
import { api, Spinner, useT } from '../lib';

/** Read again while the tab is open; a hidden window gets the last read, not a new one (lifecycle LC-08). */
const REFRESH_MS = 60_000;

export function Load({ s }: { s: ServiceSnapshot }) {
  const { t, time, reason, duration, lang } = useT();
  const [entry, setEntry] = useState<LoadEntry | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const read = async (live: { on: boolean }) => {
    setBusy(true);
    try {
      const r = await api().load(s.key);
      if (live.on) { setEntry(r.entry); setReadAt(r.readAt); }
    } finally { if (live.on) setBusy(false); }
  };
  useEffect(() => {
    const live = { on: true };
    setEntry(null);
    void read(live);
    const timer = setInterval(() => void read(live), REFRESH_MS);
    return () => { live.on = false; clearInterval(timer); };
  }, [s.key]);

  // Sub-second waits are common: a person reads "40 ms", never "0 s".
  const ms = (n: number) => (n < 1000 ? t('duration.ms', { n }) : n < 10_000 ? t('duration.s', { n: (Math.round(n / 100) / 10).toLocaleString(lang) }) : duration(n));
  const contextName = (c: string) => (c === 'personal' ? t('load.personal') : t('load.org', { id: c.slice(4) }));
  const head = (
    <div className="row spend-head">
      <span className="meta">{readAt ? t('load.readAt', { time: time(readAt) }) : ''}</span>
      <button className="btn" disabled={busy} onClick={() => void read({ on: true })}>{busy ? <Spinner /> : null} {t('load.refresh')}</button>
    </div>
  );

  if (!entry) return <p className="muted row"><Spinner /> {t('load.reading')}</p>;
  if (entry.kind === 'none') return <section className="load">{head}<p className="muted">{t('load.none')}</p></section>;
  if (entry.kind === 'invalid') {
    return (
      <section className="load">
        {head}
        <div className="notice warning" aria-labelledby="load-invalid">
          <h2 id="load-invalid">{t('load.invalid.title')}</h2>
          <p>{t('load.invalid.body')}</p>
          <ul className="load-errors">{entry.errors.map((e) => <li key={e}><code>{e}</code></li>)}</ul>
        </div>
      </section>
    );
  }
  const limits = entry.declaration?.limits;
  const limitLine = limits && <p className="meta">{t(limits.queueMax === 0 ? 'load.limitsNoQueue' : 'load.limits', { ...limits })}</p>;
  if (entry.kind === 'error') {
    return (
      <section className="load">
        {head}
        <div className="notice error" role="alert" aria-labelledby="load-error">
          <h2 id="load-error">{t('load.error.title')}</h2>
          <p>{reason(entry.reason)}</p>
        </div>
        {limitLine}
      </section>
    );
  }

  const x = entry.summary;
  // The limits are per context (DEC-0104): "of N" only when there is one, and a context at its limit marks the sum.
  const single = x.contexts.length <= 1;
  const full = Boolean(limits && x.contexts.some((c) => c.running >= limits.concurrency));
  const queueFull = Boolean(limits && limits.queueMax > 0 && x.contexts.some((c) => c.queued >= limits.queueMax));
  const max = Math.max(1, ...x.series.map((w) => w.completed + w.failed));
  const latestWait = x.contexts.map((c) => c.wait).filter((w): w is NonNullable<typeof w> => w !== null).sort((a, b) => b.start.localeCompare(a.start))[0];
  const latestRun = x.contexts.map((c) => c.run).filter((w): w is NonNullable<typeof w> => w !== null).sort((a, b) => b.start.localeCompare(a.start))[0];
  return (
    <section className="load" aria-labelledby="load-title">
      <h2 id="load-title" className="visually-hidden">{t('tab.load')}</h2>
      {head}
      {x.stale && <p className="notice warning">{t('load.stale', { time: new Date(x.generatedAt).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>}
      <div className="strip load-strip" aria-label={t('tab.load')}>
        <div className={`cell${full ? ' attn' : ''}`}><span className="v">{x.running}{limits && single && <span className="of"> {t('load.of', { n: limits.concurrency })}</span>}</span><span className="l">{t('load.running')}</span></div>
        <div className={`cell${queueFull ? ' bad' : x.queued > 0 ? ' attn' : ''}`}><span className="v">{x.queued}{limits && single && limits.queueMax > 0 && <span className="of"> {t('load.of', { n: limits.queueMax })}</span>}</span><span className="l">{t('load.queued')}</span></div>
        <div className="cell"><span className="v">{x.completed}</span><span className="l">{t('load.completed')}</span></div>
        <div className={`cell${x.failed > 0 ? ' bad' : ''}`}><span className="v">{x.failed}</span><span className="l">{t('load.failed')}</span></div>
      </div>
      {limitLine}
      {x.empty && <p className="muted">{t('load.empty')}</p>}
      {latestWait && <p className="meta">{t('load.waitTimes', { p50: ms(latestWait.p50), p95: ms(latestWait.p95) })}</p>}
      {latestRun && <p className="meta">{t('load.runTimes', { p50: ms(latestRun.p50), p95: ms(latestRun.p95) })}</p>}
      {x.series.length > 1 && (
        <figure className="load-chart">
          <figcaption className="meta">{t('load.chart', { count: x.series.length, duration: duration(x.windowSeconds * 1000) })}</figcaption>
          <svg viewBox={`0 0 ${x.series.length * 12} 48`} preserveAspectRatio="none" role="img" aria-label={t('load.chart', { count: x.series.length, duration: duration(x.windowSeconds * 1000) })}>
            {x.series.map((w, i) => {
              const done = (w.completed / max) * 46;
              const bad = (w.failed / max) * 46;
              return (
                <g key={w.start}>
                  <title>{`${time(w.start)}: ${w.completed} / ${w.failed}`}</title>
                  <rect className="load-done" x={i * 12 + 1} y={48 - done - bad} width={10} height={Math.max(done, w.completed > 0 ? 1 : 0)} />
                  {w.failed > 0 && <rect className="load-failed" x={i * 12 + 1} y={48 - bad} width={10} height={Math.max(bad, 1)} />}
                </g>
              );
            })}
          </svg>
        </figure>
      )}
      {x.contexts.length > 1 && (
        <table className="spend load-contexts">
          <caption className="visually-hidden">{t('load.contexts')}</caption>
          <thead><tr><th scope="col">{t('load.context')}</th><th scope="col">{t('load.running')}</th><th scope="col">{t('load.queued')}</th><th scope="col">{t('load.completed')}</th><th scope="col">{t('load.failed')}</th><th scope="col">{t('load.wait')}</th><th scope="col">{t('load.run')}</th></tr></thead>
          <tbody>
            {x.contexts.map((c) => (
              <tr key={c.context}>
                <th scope="row">{contextName(c.context)}</th>
                <td className={limits && c.running >= limits.concurrency ? 'attn' : undefined}>{c.running}</td>
                <td className={limits && limits.queueMax > 0 && c.queued >= limits.queueMax ? 'bad' : undefined}>{c.queued}</td>
                <td>{c.completed}</td><td className={c.failed > 0 ? 'bad' : undefined}>{c.failed}</td>
                <td>{c.wait ? ms(c.wait.p95) : <span className="muted">{t('load.none.short')}</span>}</td>
                <td>{c.run ? ms(c.run.p95) : <span className="muted">{t('load.none.short')}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
// #endregion load-tab
