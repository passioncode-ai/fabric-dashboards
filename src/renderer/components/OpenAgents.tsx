// #region open-agents — docs: docs/ux/scenarios.md#scn-105-keep-several-agents-open-and-move-between-them
// FD-220: the agents whose dashboards are open, as a strip above the page: one press moves to an agent, the current one
// folds away (its dashboard stays loaded), and closing one releases its dashboard. The order is the order they were
// opened, until the person drags a tab elsewhere or moves it with Option and an arrow key (FD-240).
import { useEffect, useRef, useState } from 'react';
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
  /** FD-240: put `key` where `target` stands. */
  move?: (key: string, target: string) => void;
}

export function OpenAgents({ tabs, services, current, open, fold, close, move }: Props) {
  const { t } = useT();
  const strip = useRef<HTMLDivElement>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // FD-223: the agent on screen is always in view in the strip, however many are open.
  useEffect(() => { strip.current?.querySelector('.open-agent.current')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [current, tabs.length]);
  const shown = tabs.map((key) => services.find((s) => s.key === key)).filter((s): s is ServiceSnapshot => Boolean(s));
  if (!shown.length) return null;
  const step = (key: string, by: 1 | -1) => {
    const at = shown.findIndex((s) => s.key === key);
    const target = shown[at + by];
    if (!move || !target) return;
    move(key, target.key);
    // The moved tab keeps the keyboard focus.
    requestAnimationFrame(() => strip.current?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(key)}"] .open-agent-name`)?.focus());
  };
  return (
    <div ref={strip} className="open-agents" role="toolbar" aria-label={t('tabs.label')}>
      {shown.map((s) => {
        const here = s.key === current;
        const name = nameOf(s);
        return (
          <div key={s.key} data-tab={s.key} className={`open-agent${here ? ' current' : ''}${dragged === s.key ? ' dragging' : ''}${over === s.key && dragged && dragged !== s.key ? ' drop-target' : ''}`}
            draggable={Boolean(move)}
            onDragStart={(e) => { setDragged(s.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.key); }}
            onDragOver={(e) => { if (!dragged) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== s.key) setOver(s.key); }}
            onDragLeave={() => { if (over === s.key) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); if (dragged && dragged !== s.key) move?.(dragged, s.key); setDragged(null); setOver(null); }}
            onDragEnd={() => { setDragged(null); setOver(null); }}>
            <button className="open-agent-name" aria-current={here ? 'page' : undefined} title={move ? `${name}\n${t('tabs.moveHint')}` : name} onClick={() => open(s.key)}
              onKeyDown={(e) => { if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); step(s.key, e.key === 'ArrowRight' ? 1 : -1); } }}>
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
