// #region machine-page — docs: docs/ux/scenarios.md#scn-116-see-what-this-computer-gives-each-context
// FD-52 (SCN-116): This computer: what it gives each context, with sums only (agents by state, spend today).
import { useEffect, useState } from 'react';
import { machineView } from '../../core/machine-view';
import type { SpendEntry } from '../../core/spend';
import type { AppStatus } from '../../core/types';
import { api, nameOf, useT } from '../lib';
import { money } from './Spend';

/** Read again while the page is open, as Spend does; a hidden window gets the last sums (lifecycle LC-08). */
const REFRESH_MS = 60_000;

export function MachinePage({ status, onOpen, spend: given, labels = {} }: { status: AppStatus; onOpen: (key: string) => void; /** Tests pass the reports. */ spend?: SpendEntry[] | null; /** FD-248: the person's own labels. */ labels?: Record<string, string> }) {
  const { t } = useT();
  const [spend, setSpend] = useState<SpendEntry[] | null>(given ?? null);
  useEffect(() => {
    if (given !== undefined) return undefined;
    const read = (force = false) => void api().spend(force).then((r) => setSpend(r.entries)).catch(() => undefined);
    read(true);
    const timer = setInterval(() => read(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [given]);
  const personal = (status.organizations ?? []).find((o) => o.personal)?.name ?? null;
  const view = machineView(status.services, spend, personal);
  const byKey = new Map(status.services.map((s) => [s.key, s]));
  const amount = (s: typeof view.totals.spendToday) => (s ? money(s, t) : '…');
  return (
    <div className="machine">
      <p className="meta">{t('machine.body')}</p>
      <div className="machine-totals" role="group" aria-label={t('machine.title')}>
        <div className="machine-total"><span className="meta">{t('machine.agents')}</span><strong>{view.totals.agents}</strong></div>
        <div className="machine-total"><span className="meta">{t('machine.running')}</span><strong>{view.totals.running}</strong></div>
        <div className="machine-total"><span className="meta">{t('machine.attention')}</span><strong>{view.totals.attention}</strong></div>
        <div className="machine-total"><span className="meta">{t('machine.spentToday')}</span><strong>{amount(view.totals.spendToday)}</strong></div>
      </div>
      <p className="meta">{t('machine.people')}</p>
      {view.contexts.map((c) => (
        <section key={c.name || 'none'} className="machine-context" aria-labelledby={`mc-${c.name || 'none'}`}>
          <h2 id={`mc-${c.name || 'none'}`}>{c.name ? (labels[c.name] ?? c.label ?? c.name) : t('machine.noContext')}
            {c.personal && <span className="chip">{t('settings.orgs.yours')}</span>}</h2>
          <p className="meta">{t('machine.counts', { n: c.agents, running: c.running, attention: c.attention })} · {t('machine.spentToday')}: {amount(c.spendToday)}</p>
          <ul className="machine-agents">{c.keys.map((k) => {
            const s = byKey.get(k)!;
            return <li key={k}><button className="linkish" onClick={() => onOpen(k)}>{nameOf(s)}</button> <span className="meta">{t(`state.${s.state}`)}</span></li>;
          })}</ul>
        </section>
      ))}
    </div>
  );
}
// #endregion machine-page
