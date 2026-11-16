// #region open-agents — docs: docs/ux/scenarios.md#scn-105-keep-several-agents-open-and-move-between-them
// FD-220: the agents whose dashboards are open, as a strip above the page: one press moves to an agent, the current one
// folds away (its dashboard stays loaded), and closing one releases its dashboard. The order is the order they were
// opened, until the person drags a tab elsewhere or moves it with Option and an arrow key (FD-240). FD-280: a pinned tab
// stands first, shows only its state and keeps no close button until unpinned.
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
  /** FD-280: the pinned tabs (first in the strip, no close button), and pinning or unpinning one. */
  pinned?: string[];
  pin?: (key: string, on: boolean) => void;
}

export function OpenAgents({ tabs, services, current, open, fold, close, move, pinned = [], pin }: Props) {
  const { t } = useT();
  const strip = useRef<HTMLDivElement>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // FD-281: the strip scrolls with no bar over the tabs; a fade on the side that has more says there is more.
  const [more, setMore] = useState('');
  const measure = () => {
    const el = strip.current;
    if (!el) return;
    const left = el.scrollLeft > 1, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setMore(left && right ? 'both' : left ? 'start' : right ? 'end' : '');
  };
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(el);
    // A vertical wheel (a mouse) scrolls the strip sideways; a trackpad's sideways swipe scrolls it as it is.
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { seen.disconnect(); el.removeEventListener('wheel', wheel); };
  });
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
    <div ref={strip} className="open-agents" role="toolbar" aria-label={t('tabs.label')} data-more={more || undefined} onScroll={measure}>
      {shown.map((s) => {
        const here = s.key === current;
        const name = nameOf(s);
        const isPinned = pinned.includes(s.key);
        return (
          <div key={s.key} data-tab={s.key} className={`open-agent${here ? ' current' : ''}${isPinned ? ' pinned' : ''}${dragged === s.key ? ' dragging' : ''}${over === s.key && dragged && dragged !== s.key ? ' drop-target' : ''}`}
            draggable={Boolean(move)}
            onDragStart={(e) => { setDragged(s.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.key); }}
            onDragOver={(e) => { if (!dragged) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== s.key) setOver(s.key); }}
            onDragLeave={() => { if (over === s.key) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); if (dragged && dragged !== s.key) move?.(dragged, s.key); setDragged(null); setOver(null); }}
            onDragEnd={() => { setDragged(null); setOver(null); }}>
            <button className="open-agent-name" aria-current={here ? 'page' : undefined} aria-label={isPinned ? t('tabs.pinnedName', { name }) : undefined} title={move ? `${name}\n${t('tabs.moveHint')}` : name} onClick={() => open(s.key)}
              onKeyDown={(e) => { if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); step(s.key, e.key === 'ArrowRight' ? 1 : -1); } }}>
              <span className={`state state-${shownState(s)}`} aria-hidden="true"><span className="glyph">{GLYPH[shownState(s)]}</span></span>
              <span className="open-agent-label">{name}</span>
            </button>
            {here && (
              <button className="icon-btn open-agent-btn" title={t('tabs.fold', { name })} aria-label={t('tabs.fold', { name })} onClick={fold}><Icon name="minimize" /></button>
            )}
            {pin && (
              <button className={`icon-btn open-agent-btn open-agent-pin${isPinned ? ' on' : ''}`} aria-pressed={isPinned} title={t(isPinned ? 'tabs.unpin' : 'tabs.pin', { name })} aria-label={t(isPinned ? 'tabs.unpin' : 'tabs.pin', { name })}
                onClick={() => pin(s.key, !isPinned)}><Icon name="pin" /></button>
            )}
            {!isPinned && <button className="icon-btn open-agent-btn" title={t('tabs.close', { name })} aria-label={t('tabs.close', { name })} onClick={() => close(s.key)}><Icon name="close" /></button>}
          </div>
        );
      })}
    </div>
  );
}
// #endregion open-agents
