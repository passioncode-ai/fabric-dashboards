// #region open-agents — docs: docs/ux/scenarios.md#scn-105-keep-several-agents-open-and-move-between-them
// FD-220: the agents whose dashboards are open, as a strip above the page: one press moves to an agent, the current one
// folds away (its dashboard stays loaded), and closing one releases its dashboard. The order is the order they were opened.
import type { ServiceSnapshot } from '../../core/types';
import { shownState } from '../../core/setup-wait';
import { GLYPH, Icon, nameOf, useT } from '../lib';

interface Props {
  tabs: string[];
  services: ServiceSnapshot[];
  current: string | null;
  open: (key: string) => void;
  fold: () => void;
  close: (key: string) => void;
}

export function OpenAgents({ tabs, services, current, open, fold, close }: Props) {
  const { t } = useT();
  const shown = tabs.map((key) => services.find((s) => s.key === key)).filter((s): s is ServiceSnapshot => Boolean(s));
  if (!shown.length) return null;
  return (
    <div className="open-agents" role="toolbar" aria-label={t('tabs.label')}>
      {shown.map((s) => {
        const here = s.key === current;
        const name = nameOf(s);
        return (
          <div key={s.key} className={`open-agent${here ? ' current' : ''}`}>
            <button className="open-agent-name" aria-current={here ? 'page' : undefined} title={name} onClick={() => open(s.key)}>
              <span className={`state state-${shownState(s)}`} aria-hidden="true"><span className="glyph">{GLYPH[shownState(s)]}</span></span>
              <span className="open-agent-label">{name}</span>
            </button>
            {here && (
              <button className="icon-btn open-agent-btn" title={t('tabs.fold', { name })} aria-label={t('tabs.fold', { name })} onClick={fold}><Icon name="minimize" /></button>
            )}
            <button className="icon-btn open-agent-btn" title={t('tabs.close', { name })} aria-label={t('tabs.close', { name })} onClick={() => close(s.key)}><Icon name="close" /></button>
          </div>
        );
      })}
    </div>
  );
}
// #endregion open-agents
