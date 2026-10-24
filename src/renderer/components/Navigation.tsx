// FD-103 (SCN-077, SCN-078): the sidebar's two modes. Agents lists the agents as before, without any session; Sessions
// lists every coding session of this computer by what it needs. The switch above them says which is shown.
import { useEffect, useRef, useState } from 'react';
import type { AppStatus, ListSort, Settings as AppSettings, SettingsPatch } from '../../core/types';
import type { Product } from '../../core/products';
import type { SessionGroup, SessionRow } from '../../core/sessions';
import { groupRows, navLines, stateShort, waitingForYou } from '../../core/sessions-view';
import { api, GLYPH, Icon, nameOf, Spinner, useT } from '../lib';

export type Mode = 'agents' | 'sessions';

/** Two letters for a rail entry: the first letters of the first two words, else the first two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** SCN-077: the two-part switch under the mark; in the rail, two icons. The Sessions part carries the count of
 *  sessions that need the person, named to a screen reader. */
export function ModeSwitch({ mode, rows, rail, onMode }: { mode: Mode; rows: readonly SessionRow[]; rail: boolean; onMode: (m: Mode) => void }) {
  const { t } = useT();
  const waiting = waitingForYou(rows);
  return (
    <div className="mode-switch" role="group" aria-label={t('mode.switch')}>
      <button type="button" className="mode-btn" aria-pressed={mode === 'agents'} title={rail ? t('mode.agents') : undefined} onClick={() => onMode('agents')}>
        <Icon name="agents" /><span className="mode-label">{t('mode.agents')}</span>
      </button>
      <button type="button" className="mode-btn" aria-pressed={mode === 'sessions'} aria-label={waiting ? t('mode.sessionsWaiting', { n: waiting }) : undefined}
        title={rail ? (waiting ? t('mode.sessionsWaiting', { n: waiting }) : t('mode.sessions')) : undefined} onClick={() => onMode('sessions')}>
        <Icon name="sessions" /><span className="mode-label">{t('mode.sessions')}</span>
        {waiting > 0 && <span className="count alert" aria-hidden="true">{waiting}</span>}
      </button>
    </div>
  );
}

/** FD-78: what a row's menu can do. */
export interface RowActions {
  pin: (id: string) => void;
  hide: (id: string) => void;
  kind: (p: Product, kind: 'agent' | 'service') => void;
  isPinned: (id: string) => boolean;
  isHidden: (id: string) => boolean;
  isService: (p: Product) => boolean;
}

export type AgentsPage = 'overview' | 'activity' | 'map' | 'spend' | 'service' | 'settings' | 'other';

interface AgentsNavProps {
  page: AgentsPage;
  status: AppStatus;
  arranged: { pinned: Product[]; local: Product[]; online: Product[]; service: Product[]; hidden: Product[] };
  products: Product[];
  currentProduct: Product | undefined;
  layout: AppSettings['layout'];
  changeLayout: (patch: NonNullable<SettingsPatch['layout']>) => void;
  open: (key: string) => void;
  go: (page: 'overview' | 'activity' | 'map' | 'spend') => void;
  rail: boolean;
  queue: number;
  urgent: boolean;
  auditErrors: number;
  hiddenProblem: boolean;
  menu: RowActions;
}

/** SCN-077 step 3: the Agents mode is the sidebar as it was, with no session and no hand-over section in it. */
export function AgentsNav({ page, status, arranged, products, currentProduct, layout, changeLayout, open, go, rail, queue, urgent, auditErrors, hiddenProblem, menu }: AgentsNavProps) {
  const { t } = useT();
  const { pinned, hidden } = arranged;
  return (
    <>
      <div className="nav">
        <button className="nav-item" aria-current={page === 'overview' ? 'page' : undefined} title={rail ? t('nav.overview') : undefined} onClick={() => go('overview')}>
          <Icon name="overview" /><span className="nav-label">{t('nav.overview')}</span>
          {queue > 0 && <span className={`count${urgent ? ' alert' : ''}`}>{queue}</span>}
        </button>
        <button className="nav-item" aria-current={page === 'activity' ? 'page' : undefined} title={rail ? t('nav.activity') : undefined} onClick={() => go('activity')}>
          <Icon name="activity" /><span className="nav-label">{t('nav.activity')}</span>
          {status.unread > 0 && <span className="count">{status.unread}</span>}
        </button>
        <button className="nav-item" aria-current={page === 'map' ? 'page' : undefined} title={rail ? t('nav.map') : undefined} onClick={() => go('map')}>
          <Icon name="map" /><span className="nav-label">{t('nav.map')}</span>
          {auditErrors > 0 && <span className="count alert">{auditErrors}</span>}
        </button>
        <button className="nav-item" aria-current={page === 'spend' ? 'page' : undefined} title={rail ? t('nav.spend') : undefined} onClick={() => go('spend')}>
          <Icon name="spend" /><span className="nav-label">{t('nav.spend')}</span>
        </button>
      </div>
      <div className="nav nav-scroll">
        {pinned.length > 0 && <div className="nav-section">{t('nav.pinned')}</div>}
        {pinned.map((p) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} rail={rail} pinned menu={menu} />)}
        {/* FD-78: on this Mac, online, services; the sort applies inside each section. */}
        {(['local', 'online', 'service'] as const).map((c, i) => arranged[c].length > 0 && (
          <div key={c} role="group" aria-labelledby={`nav-${c}`}>
            <div className="nav-section nav-section-row">
              <span id={`nav-${c}`}>{t(`nav.${c}`)}</span>
              {!rail && i === (['local', 'online', 'service'] as const).findIndex((x) => arranged[x].length > 0) && products.length > 1 && (
                <select className="sort-select" aria-label={t('list.sort')} value={layout.list.sort} onChange={(e) => changeLayout({ list: { sort: e.target.value as ListSort } })}>
                  <option value="name">{t('list.sort.name')}</option>
                  <option value="status">{t('list.sort.status')}</option>
                  <option value="activity">{t('list.sort.activity')}</option>
                </select>
              )}
            </div>
            {arranged[c].map((p) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} rail={rail} pinned={false} menu={menu} />)}
          </div>
        ))}
        {/* FD-78: hidden agents, folded at the bottom; a problem among them still shows on the fold. */}
        {hidden.length > 0 && (
          <div className="nav-hidden">
            {/* In the narrow rail the fold is an entry of its own, so hidden agents stay one click away. */}
            <button className={rail ? 'nav-item' : 'nav-section nav-fold-section'} aria-expanded={layout.list.hiddenOpen} title={rail ? t('nav.hidden', { count: hidden.length }) : undefined} onClick={() => changeLayout({ list: { hiddenOpen: !layout.list.hiddenOpen } })}>
              <span aria-hidden="true">{layout.list.hiddenOpen ? '▾' : '▸'}</span> <span className={rail ? 'nav-label' : undefined}>{t('nav.hidden', { count: hidden.length })}</span>
              {hiddenProblem && <span className="count alert" title={t('nav.hiddenProblem')} aria-hidden="true">!</span>}
              {hiddenProblem && <span className="visually-hidden">{t('nav.hiddenProblem')}</span>}
            </button>
            {layout.list.hiddenOpen && hidden.map((p) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} rail={rail} pinned={false} menu={menu} />)}
          </div>
        )}
      </div>
    </>
  );
}

/** A product in the sidebar: the primary's name and state; a member in trouble adds a mark, never a changed state (ADR-0012). */
function ProductItem({ p, current, open, rail, pinned, menu }: { p: Product; current: boolean; open: (key: string) => void; rail: boolean; pinned: boolean; menu: RowActions }) {
  const { t } = useT();
  const s = p.primary;
  return (
    <div className={`nav-row${pinned ? ' pinned' : ''}`}>
      <button className="nav-item" aria-current={current ? 'page' : undefined} title={rail ? t('join.nameState', { name: nameOf(s), state: t(`state.${s.state}`) }) : undefined} onClick={() => open(s.key)}>
        <span className={`state state-${s.state}`} aria-hidden="true"><span className="glyph">{GLYPH[s.state]}</span></span>
        {rail && <span className="initials" aria-hidden="true">{initialsOf(nameOf(s))}</span>}
        <span className="nav-label">{nameOf(s)}</span>
        {p.memberProblem && <span className="count alert" title={t('nav.memberProblem')} aria-hidden="true">!</span>}
        <span className="visually-hidden">{t(`state.${s.state}`)}{p.memberProblem ? `, ${t('nav.memberProblem')}` : ''}</span>
      </button>
      {!rail && <RowMenu p={p} menu={menu} />}
    </div>
  );
}

/** FD-78: one small button per row opens its actions (global rule: one primary action, the rest in a menu). */
function RowMenu({ p, menu }: { p: Product; menu: RowActions }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // The list scrolls, so the menu is placed against the window: below the button, or above it near the bottom.
  const [at, setAt] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const box = useRef<HTMLDivElement | null>(null);
  const toggle = () => {
    const r = box.current?.querySelector('.row-menu-btn')?.getBoundingClientRect();
    if (r) setAt(window.innerHeight - r.bottom < 140 ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right } : { top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(!open);
  };
  const name = nameOf(p.primary);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); (box.current?.querySelector('.row-menu-btn') as HTMLButtonElement | null)?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    (box.current?.querySelector('[role="menuitem"]') as HTMLButtonElement | null)?.focus();
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  const pinned = menu.isPinned(p.id), hidden = menu.isHidden(p.id), service = menu.isService(p);
  const act = (f: () => void) => () => { f(); setOpen(false); };
  return (
    <div className={`row-menu${open || pinned ? ' shown' : ''}`} ref={box}>
      <button className="row-menu-btn pin-btn" aria-haspopup="menu" aria-expanded={open} title={t('list.menu', { name })} aria-label={t('list.menu', { name })} onClick={toggle}>
        {pinned
          ? <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 1h4l-.5 4 2.5 2.5V9H8.6L8 15l-.6-6H4V7.5L6.5 5z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
          : <span aria-hidden="true">⋯</span>}
      </button>
      {open && (
        <div className="menu" role="menu" aria-label={name} style={at} onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          const items = [...(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
        }}>
          {!hidden && <button role="menuitem" onClick={act(() => menu.pin(p.id))}>{t(pinned ? 'list.unpin' : 'list.pin', { name })}</button>}
          <button role="menuitem" onClick={act(() => menu.kind(p, service ? 'agent' : 'service'))}>{t(service ? 'list.asAgent' : 'list.asService')}</button>
          <button role="menuitem" onClick={act(() => menu.hide(p.id))}>{t(hidden ? 'list.unhide' : 'list.hide')}</button>
        </div>
      )}
    </div>
  );
}

/** The mark a session row carries beside its words: the shapes of the agents' states (VIS-08), never alone. Waiting for
 *  a limit reset has no agent state of its own: it is a clock in the info colour (R1-V2: the starting ring ◌ in the muted
 *  colour was almost invisible), drawn by SessionMark. */
export const SESSION_MARK: Record<SessionGroup, { glyph: string; cls: string }> = {
  'needs-you': { glyph: GLYPH.degraded, cls: 'state-degraded' },
  running: { glyph: GLYPH.ready, cls: 'state-ready' },
  waiting: { glyph: '', cls: 'state-waiting' },
  ended: { glyph: GLYPH.stopped, cls: 'state-stopped' },
};

/** The glyph of a session's group, the waiting clock as a small drawing (a font may lack a clock character). */
export function SessionMark({ group }: { group: SessionGroup }) {
  return (
    <span className="glyph session-mark" aria-hidden="true">
      {group === 'waiting'
        ? <svg className="mark-clock" viewBox="0 0 12 12" width="11" height="11" focusable="false"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 3.4V6l1.9 1.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        : SESSION_MARK[group].glyph}
    </span>
  );
}

/** SCN-078: the Sessions mode's list: All sessions, then the groups in their order, each heading with its count; the
 *  Ended group folds (folded by default, the fold remembered) and offers Clear. An empty group is not drawn. */
export function SessionsNav({ sessions, currentId, allCurrent, rail, endedOpen, onEndedOpen, openAll, openRow }: {
  sessions: AppStatus['sessions']; currentId: string | null; allCurrent: boolean; rail: boolean; endedOpen: boolean;
  onEndedOpen: (open: boolean) => void; openAll: () => void; openRow: (id: string) => void;
}) {
  const { t, lang } = useT();
  const groups = groupRows(sessions?.rows ?? []);
  return (
    <>
      <div className="nav">
        <button className="nav-item" aria-current={allCurrent ? 'page' : undefined} title={rail ? t('sessions.all') : undefined} onClick={openAll}>
          <Icon name="sessions" /><span className="nav-label">{t('sessions.all')}</span>
        </button>
      </div>
      <div className="nav nav-scroll">
        {!sessions && !rail && <p className="meta nav-note row" role="status"><Spinner /> {t('sessions.reading')}</p>}
        {groups.map(({ group, rows }) => {
          // R1-V3: the sidebar's ended heading is short ("Ended: 2"); the All sessions page keeps the long one.
          const heading = t(group === 'ended' ? 'sessions.navGroup.ended' : `sessions.group.${group}`, { n: rows.length });
          const folded = group === 'ended' && !endedOpen;
          return (
            <div key={group} role="group" aria-labelledby={`snav-${group}`}>
              {group === 'ended'
                ? (
                  <div className="nav-section-row session-fold">
                    <button id={`snav-${group}`} className={rail ? 'nav-item' : 'nav-section nav-fold-section'} aria-expanded={!folded} title={rail ? heading : undefined} onClick={() => onEndedOpen(folded)}>
                      <span aria-hidden="true">{folded ? '▸' : '▾'}</span> <span className={rail ? 'nav-label' : undefined}>{heading}</span>
                    </button>
                    {!rail && <button type="button" className="btn-link nav-clear" aria-label={t('sessions.clear.label')} onClick={() => void api().sessionsClearEnded()}>{t('sessions.clear')}</button>}
                  </div>
                )
                : <div className="nav-section" id={`snav-${group}`}>{heading}</div>}
              {!folded && rows.map((r) => {
                const lines = navLines(lang, r);
                return (
                  <button key={r.id} className="nav-item session-item" aria-current={currentId === r.id ? 'page' : undefined}
                    title={rail ? t('join.nameState', { name: r.project, state: stateShort(lang, r) }) : undefined} onClick={() => openRow(r.id)}>
                    <span className={`state ${SESSION_MARK[r.group].cls}`} aria-hidden="true"><SessionMark group={r.group} /></span>
                    {rail && <span className="initials" aria-hidden="true">{initialsOf(r.project)}</span>}
                    {/* R1-V1: the time beside the project, never cut; account and origin below, the agent only when it is not Claude Code. */}
                    <span className="nav-label session-lines">
                      <span className="session-line1"><span className="session-project">{r.project}</span>{lines.time && <span className="session-time">{lines.time}</span>}</span>
                      <span className="session-sub">{lines.sub}</span>
                    </span>
                    <span className="visually-hidden">{stateShort(lang, r)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
