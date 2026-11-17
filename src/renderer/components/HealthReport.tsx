// #region health-report — docs: docs/ux/scenarios.md#scn-116-see-what-this-computer-gives-each-context
// FD-285 wave 2 and FD-298: one product's own `agent-health/1` report as a person reads it: its state, when it was
// read, the episodes it holds open, why it could not be read, and each check that is not ok. Codes and counts only
// (DEC-0157). This Mac lists every report with it; an agent's Health tab shows its own.
import type { HealthRow } from '../../core/agent-health';
import { useT } from '../lib';

export function HealthEntry({ h, name = true }: { h: HealthRow; /** This Mac names the product; an agent's own page does not. */ name?: boolean }) {
  const { t, time } = useT();
  return (
    <>
      {name && <><strong>{h.name}</strong>{h.version && <span className="meta"> {h.version}</span>} </>}
      {!name && h.version && <span className="meta">{h.version} </span>}
      <span className={`chip health-${h.state}`}>{t(`machine.health.${h.state}`)}</span>
      <span className="meta"> · {t('machine.health.read', { time: time(new Date(h.readAt).toISOString()) })}{h.open > 0 && <> · {t('machine.health.open', { n: h.open })}</>}</span>
      {h.reason && <p className="meta">{t('machine.health.unread', { reason: t(`machine.health.reason.${h.reason}`) })}</p>}
      {h.checks.length > 0 && <ul className="machine-health-checks">{h.checks.map((c) => (
        <li key={c.id}><code>{c.id}</code> <span className="meta">{t(`machine.health.${c.state}`)} · {t('machine.health.check', { area: c.area, count: c.count })}{c.fix && <> · {t('machine.health.fix', { fix: c.fix })}</>}</span></li>
      ))}</ul>}
    </>
  );
}
// #endregion health-report
