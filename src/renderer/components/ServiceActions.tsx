// #region service-actions — docs: docs/ux/scenarios.md#scn-006-overview-lists-what-needs-attention
// W2 (UX-01, UX-03, UX-12, VIS-09): the agent page's actions in the one-line bar and in the Dashboard tab of an agent
// that does not show its dashboard. The state's one deterministic action (Restart, Start, "Update to <v>") comes
// first, as on Overview; *Fix with coding agent* (a paid session) after it, one component with one wording
// everywhere, the short form only in the one-line bar. No assets imported: tests render these to markup.
import { offersAgentUpdate, offersFix } from '../../core/offers';
import { firstAction } from '../../core/focus';
import type { ServiceSnapshot } from '../../core/types';
import { nameOf, useT } from '../lib';

/** VIS-09: *Fix with coding agent*, the same words and look on Overview, the agent page and since-last-visit;
 *  `short` reads "Fix" (its full name stays the accessible one) where the bar has one line. */
export function FixButton({ s, onFix, short = false, small = false }: { s: ServiceSnapshot; onFix: () => void; short?: boolean; small?: boolean }) {
  const { t } = useT();
  const label = t('join.action', { action: t('agent.fix'), name: nameOf(s) });
  return <button className={`btn${small ? ' btn-sm' : ''}`} title={short ? t('agent.fix') : undefined} aria-label={label} onClick={onFix}>{t(short ? 'agent.fixShort' : 'agent.fix')}</button>;
}

/** The one-line bar's actions, shown while the full card is folded: the first action, then Fix when something is
 *  wrong, or *Update with coding agent* when an update is available that the agent's own command cannot apply. */
export function CompactActions({ s, problem, act, runUpdate, onAgent, updateFailed }: {
  s: ServiceSnapshot;
  /** Whether the bar shows a problem chip: Fix sits beside the problem it fixes. */
  problem: boolean;
  act: (action: 'restart' | 'start') => void;
  runUpdate: () => void;
  onAgent?: (key: string, task: { kind: 'fix' | 'update' }) => void;
  updateFailed: boolean;
}) {
  const { t } = useT();
  const first = firstAction(s);
  const label = (action: string) => t('join.action', { action, name: nameOf(s) });
  const primary = first?.kind === 'restart' || first?.kind === 'start';
  const firstText = first?.kind === 'update' ? t('action.update', { version: first.version }) : first ? t(`action.${first.kind}`) : '';
  const fix = problem && onAgent && !s.busy && offersFix(s);
  const agentUpdate = !fix && first?.kind !== 'update' && onAgent && !s.busy && offersAgentUpdate(s, updateFailed);
  if (!first && !fix && !agentUpdate) return null;
  return (
    <>
      {first && (
        <button className={`btn btn-sm${primary ? ' btn-primary' : ''}`} aria-label={label(firstText)}
          onClick={() => (first.kind === 'update' ? runUpdate() : act(first.kind))}>{firstText}</button>
      )}
      {fix && <FixButton s={s} short small onFix={() => onAgent!(s.key, { kind: 'fix' })} />}
      {agentUpdate && <button className="btn btn-sm" aria-label={label(t('agent.update'))} onClick={() => onAgent!(s.key, { kind: 'update' })}>{t('agent.update')}</button>}
    </>
  );
}

/** UX-12: what the Dashboard tab says when the dashboard cannot open, by state: off with Start, starting with the
 *  wait, down or running twice with its reason, Restart and Logs; a wrong program keeps the identity sentence. */
export function UnavailablePane({ s, act, openLogs }: { s: ServiceSnapshot; act: (action: 'restart' | 'start') => void; openLogs?: () => void }) {
  const { t, reason } = useT();
  const first = firstAction(s);
  const why = s.reasons.map(reason).join(' ');
  const logs = openLogs && s.descriptor?.placement !== 'remote' && s.descriptor?.paths?.logs?.length;
  if (s.state === 'stopped') {
    return (
      <div className="dash-overlay">
        <p>{why || t('reason.stopped')}</p>
        {first?.kind === 'start' && <button className="btn btn-primary" onClick={() => act('start')}>{t('action.start')}</button>}
      </div>
    );
  }
  if (s.state === 'starting' || s.state === 'stopping') return <div className="dash-overlay muted">{why || t('reason.waiting')}</div>;
  if (s.state === 'down' || s.state === 'duplicate') {
    return (
      <div className="dash-overlay">
        <p>{why || t(`state.${s.state}`)}</p>
        <div className="row">
          {first?.kind === 'restart' && <button className="btn btn-primary" onClick={() => act('restart')}>{t('action.restart')}</button>}
          {logs && <button className="btn" onClick={openLogs}>{t('action.logs')}</button>}
        </div>
      </div>
    );
  }
  return <div className="dash-overlay muted">{t('view.unavailable')}</div>;
}
// #endregion service-actions
