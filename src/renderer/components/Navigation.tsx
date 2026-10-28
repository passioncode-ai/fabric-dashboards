// FD-103 (SCN-077, SCN-078): the sidebar's two modes. Agents lists the agents as before, without any session; Sessions
// lists every coding session of this computer by what it needs. The switch above them says which is shown.
import { useEffect, useRef, useState } from 'react';
import type { AppStatus, ListSort, Settings as AppSettings, SettingsPatch } from '../../core/types';
import { moveInSection, type MoveSection, type Product } from '../../core/products';
import type { SessionGroup, SessionRow } from '../../core/sessions';
import { groupRows, navLines, stateShort, waitingForYou } from '../../core/sessions-view';
import { revealScrollTop } from '../../core/layout';
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
  /** FD-123: turn an agent off (hidden, not watched, no alerts) or back on. */
  setOff: (id: string, off: boolean) => void;
  kind: (p: Product, kind: 'agent' | 'service') => void;
  isPinned: (id: string) => boolean;
  isHidden: (id: string) => boolean;
  isService: (p: Product) => boolean;
  /** A row menu opened or closed: a dashboard to the right of the sidebar is drawn above the page and must step aside. */
  onMenu?: (open: boolean) => void;
}

// #region list-drag — docs: docs/ux/scenarios.md#scn-087-arrange-the-sidebar-width-and-order
/** FD-121 (SCN-087): what dragging a row needs: where it is, and the move it asks for (null: no move). */
interface RowDrag {
  section: MoveSection;
  index: number;
  count: number;
  /** The row being dragged, and where a drop would put it, for the line the person sees. */
  dragging: string | null;
  dropAt: number | null;
  start: (id: string) => void;
  over: (index: number, after: boolean) => void;
  drop: () => void;
  end: () => void;
  /** Alt+Up / Alt+Down: one place up or down. */
  step: (id: string, by: -1 | 1) => void;
}
const DRAG_TYPE = 'application/x-fabric-dashboards-agent';
// #endregion list-drag

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
  // FD-123: agents turned off are on disk but not watched; they sit greyed at the end of Hidden.
  const off = status.off ?? [];
  const hiddenCount = hidden.length + off.length;
  // FD-121 (SCN-087): one drag at a time, within one section; what a screen reader hears after a move.
  const [drag, setDrag] = useState<{ section: MoveSection; id: string; dropAt: number | null } | null>(null);
  const [said, setSaid] = useState('');
  const move = (section: MoveSection, id: string, to: number) => {
    const patch = moveInSection(arranged, section, id, to);
    if (!patch) return;
    changeLayout({ list: patch });
    const p = arranged[section].find((x) => x.id === id);
    const total = arranged[section].length;
    if (p) setSaid(t('list.moved', { name: nameOf(p.primary), n: Math.max(1, Math.min(total, to + 1)), total }));
  };
  const dragFor = (section: MoveSection, index: number, count: number): RowDrag | null => (rail ? null : {
    section, index, count,
    dragging: drag?.section === section ? drag.id : null,
    dropAt: drag?.section === section ? drag.dropAt : null,
    start: (id) => setDrag({ section, id, dropAt: null }),
    // The line goes between rows; dropping below oneself counts the row taken out.
    over: (i, after) => setDrag((d) => (d && d.section === section ? { ...d, dropAt: i + (after ? 1 : 0) } : d)),
    drop: () => {
      if (drag?.section === section && drag.dropAt !== null) {
        const from = arranged[section].findIndex((x) => x.id === drag.id);
        move(section, drag.id, drag.dropAt > from ? drag.dropAt - 1 : drag.dropAt);
      }
      setDrag(null);
    },
    end: () => setDrag(null),
    step: (id, by) => move(section, id, arranged[section].findIndex((x) => x.id === id) + by),
  });
  return (
    <>
      <p className="visually-hidden" role="status" aria-live="polite">{said}</p>
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
        {pinned.map((p, i) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} rail={rail} pinned menu={menu} drag={dragFor('pinned', i, pinned.length)} />)}
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
                  <option value="manual">{t('list.sort.manual')}</option>
                </select>
              )}
            </div>
            {arranged[c].map((p, i) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} rail={rail} pinned={false} menu={menu} drag={dragFor(c, i, arranged[c].length)} />)}
          </div>
        ))}
        {/* FD-78: hidden agents, folded at the bottom; a problem among them still shows on the fold. */}
        {hiddenCount > 0 && (
          <div className="nav-hidden">
            {/* In the narrow rail the fold is an entry of its own, so hidden agents stay one click away. */}
            <button className={rail ? 'nav-item' : 'nav-section nav-fold-section'} aria-expanded={layout.list.hiddenOpen} title={rail ? t('nav.hidden', { count: hiddenCount }) : undefined} onClick={() => changeLayout({ list: { hiddenOpen: !layout.list.hiddenOpen } })}>
              <span aria-hidden="true">{layout.list.hiddenOpen ? '▾' : '▸'}</span> <span className={rail ? 'nav-label' : undefined}>{t('nav.hidden', { count: hiddenCount })}</span>
              {hiddenProblem && <span className="count alert" title={t('nav.hiddenProblem')} aria-hidden="true">!</span>}
              {hiddenProblem && <span className="visually-hidden">{t('nav.hiddenProblem')}</span>}
            </button>
            {layout.list.hiddenOpen && hidden.map((p, i) => <ProductItem key={p.id} p={p} current={currentProduct === p} open={open} rail={rail} pinned={false} menu={menu} drag={dragFor('hidden', i, hidden.length)} hiddenRow />)}
            {layout.list.hiddenOpen && off.map((o) => <OffItem key={o.product} name={o.name} id={o.product} rail={rail} menu={menu} />)}
          </div>
        )}
      </div>
    </>
  );
}

/** A product in the sidebar: the primary's name and state; a member in trouble adds a mark, never a changed state (ADR-0012). */
function ProductItem({ p, current, open, rail, pinned, menu, drag = null, hiddenRow = false }: { p: Product; current: boolean; open: (key: string) => void; rail: boolean; pinned: boolean; menu: RowActions; drag?: RowDrag | null; hiddenRow?: boolean }) {
  const { t } = useT();
  const s = p.primary;
  // FD-121 (SCN-087): the line shows above the row the drop lands before, or below the last one.
  const line = drag && drag.dragging && drag.dropAt !== null ? (drag.dropAt === drag.index ? ' drop-before' : drag.dropAt === drag.index + 1 && drag.index === drag.count - 1 ? ' drop-after' : '') : '';
  // FD-129 (UX-23): a right-click, or the context-menu key, opens the row's menu in both widths; the rail has no ⋯ button.
  const [ask, setAsk] = useState<MenuAsk | null>(null);
  return (
    <div className={`nav-row${pinned ? ' pinned' : ''}${drag?.dragging === p.id ? ' dragging' : ''}${line}`}
      draggable={Boolean(drag) && drag!.count > 1}
      onDragStart={drag ? (e) => { e.dataTransfer.setData(DRAG_TYPE, p.id); e.dataTransfer.effectAllowed = 'move'; drag.start(p.id); } : undefined}
      onDragOver={drag ? (e) => {
        if (!drag.dragging || !e.dataTransfer.types.includes(DRAG_TYPE)) return; // another section's row, or not ours
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const r = e.currentTarget.getBoundingClientRect();
        drag.over(drag.index, e.clientY > r.top + r.height / 2);
      } : undefined}
      onDrop={drag ? (e) => { if (drag.dragging) { e.preventDefault(); drag.drop(); } } : undefined}
      onDragEnd={drag ? () => drag.end() : undefined}>
      {/* VIS-15 (FD-113): the title in both widths, since an expanded row cuts a long name too. */}
      <button className="nav-item" aria-current={current ? 'page' : undefined} title={t('join.nameState', { name: nameOf(s), state: t(`state.${s.state}`) })} onClick={() => open(s.key)}
        aria-keyshortcuts={drag && drag.count > 1 ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
        onContextMenu={(e) => { e.preventDefault(); setAsk({ rect: e.currentTarget.getBoundingClientRect(), n: (ask?.n ?? 0) + 1 }); }}
        onKeyDown={drag ? (e) => { if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); drag.step(p.id, e.key === 'ArrowUp' ? -1 : 1); } } : undefined}>
        <span className={`state state-${s.state}`} aria-hidden="true"><span className="glyph">{GLYPH[s.state]}</span></span>
        {rail && <span className="initials" aria-hidden="true">{initialsOf(nameOf(s))}</span>}
        <span className="nav-label">{nameOf(s)}</span>
        {p.memberProblem && <span className="count alert" title={t('nav.memberProblem')} aria-hidden="true">!</span>}
        <span className="visually-hidden">{t(`state.${s.state}`)}{p.memberProblem ? `, ${t('nav.memberProblem')}` : ''}</span>
      </button>
      {/* FD-121 (SCN-072): a hidden agent comes back with one press on its eye. */}
      {!rail && hiddenRow && (
        <button className="pin-btn unhide-btn" title={t('list.showAgain', { name: nameOf(s) })} aria-label={t('list.showAgain', { name: nameOf(s) })} onClick={() => menu.hide(p.id)}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><circle cx="8" cy="8" r="2" fill="currentColor" /></svg>
        </button>
      )}
      <RowMenu p={p} menu={menu} rail={rail} ask={ask} />
    </div>
  );
}

/** FD-78: one small button per row opens its actions (global rule: one primary action, the rest in a menu). */
/** The row menu's width bounds: from MENU_EDGE px inside the window to the button's right edge; its usual 200 px
 *  minimum shrinks when the sidebar is narrower than that. */
export const MENU_EDGE = 8;
export function menuWidth(buttonRight: number): { maxWidth: number; minWidth: number } {
  const maxWidth = Math.max(120, Math.round(buttonRight - MENU_EDGE));
  return { maxWidth, minWidth: Math.min(200, maxWidth) };
}

/** Where a right-click asked for the menu: the row's box, and a count so the same row can ask twice. */
interface MenuAsk { rect: DOMRect; n: number }

function RowMenu({ p, menu, rail, ask }: { p: Product; menu: RowActions; rail: boolean; ask: MenuAsk | null }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // The list scrolls, so the menu is placed against the window: below the button, or above it near the bottom.
  // It ends at the button's right edge and never starts left of the window: a long item wraps instead of
  // pushing the menu out (seen 2026-10-27). It stays over the sidebar, since a dashboard to its right is drawn
  // above the page and would cover it.
  const [at, setAt] = useState<{ top?: number; bottom?: number; right?: number; left?: number; maxWidth?: number; minWidth?: number }>({ right: 0 });
  const box = useRef<HTMLDivElement | null>(null);
  const place = (r: DOMRect) => {
    const room = { right: window.innerWidth - r.right, ...menuWidth(r.right) };
    setAt(window.innerHeight - r.bottom < 140 ? { bottom: window.innerHeight - r.top + 4, ...room } : { top: r.bottom + 4, ...room });
  };
  const toggle = () => {
    const r = box.current?.querySelector('.row-menu-btn')?.getBoundingClientRect();
    if (r) place(r);
    setOpen(!open);
  };
  // FD-129 (UX-23): a right-click opens it under the ⋯ button, or in the rail beside the row (the dashboard steps aside).
  useEffect(() => {
    if (!ask) return;
    const r = box.current?.querySelector('.row-menu-btn')?.getBoundingClientRect();
    if (r) place(r);
    else {
      // Beside the rail, not over it: the row ends inside the rail's padding, so the rail's own edge is the start.
      const left = Math.max(ask.rect.right, box.current?.closest('.sidebar')?.getBoundingClientRect().right ?? 0) + 4;
      setAt(window.innerHeight - ask.rect.bottom < 140 ? { bottom: window.innerHeight - ask.rect.bottom, left, minWidth: 200 } : { top: ask.rect.top, left, minWidth: 200 });
    }
    setOpen(true);
  }, [ask]);
  useEffect(() => {
    if (!open) return;
    menu.onMenu?.(true);
    return () => menu.onMenu?.(false);
  }, [open]);
  const name = nameOf(p.primary);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); ((box.current?.querySelector('.row-menu-btn') ?? box.current?.parentElement?.querySelector('.nav-item')) as HTMLButtonElement | null)?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    (box.current?.querySelector('[role="menuitem"]') as HTMLButtonElement | null)?.focus();
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  const pinned = menu.isPinned(p.id), hidden = menu.isHidden(p.id), service = menu.isService(p);
  const act = (f: () => void) => () => { f(); setOpen(false); };
  return (
    <div className={`row-menu${open || pinned ? ' shown' : ''}`} ref={box}>
      {!rail && <button className="row-menu-btn pin-btn" aria-haspopup="menu" aria-expanded={open} title={t('list.menu', { name })} aria-label={t('list.menu', { name })} onClick={toggle}>
        {pinned
          ? <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 1h4l-.5 4 2.5 2.5V9H8.6L8 15l-.6-6H4V7.5L6.5 5z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
          : <span aria-hidden="true">⋯</span>}
      </button>}
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
          <button role="menuitem" onClick={act(() => menu.setOff(p.id, true))}>{t('list.turnOff')}</button>
        </div>
      )}
    </div>
  );
}

// #region agent-off — docs: docs/ux/scenarios.md#scn-072-hide-an-agent-without-stopping-it
/** FD-123: an agent turned off: its name greyed, the word "Off", and one button that turns it back on (it stays hidden
 *  and watched). No page opens from it: nothing about it is read. The narrow rail shows the name only. */
function OffItem({ id, name, rail, menu }: { id: string; name: string; rail: boolean; menu: RowActions }) {
  const { t } = useT();
  return (
    <div className="nav-item nav-off" title={t('list.offRow', { name })}>
      <span className="glyph" aria-hidden="true">○</span>
      <span className="nav-label">{name}</span>
      {!rail && <span className="off-word">{t('list.off')}</span>}
      {!rail && (
        <button className="pin-btn turn-on-btn" title={t('list.turnOn', { name })} aria-label={t('list.turnOn', { name })} onClick={() => menu.setOff(id, false)}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 1.5v6M4.6 3.8a5.2 5.2 0 1 0 6.8 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
  );
}
// #endregion agent-off

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
  // FD-107: the current session's row is kept in view: scrolled to only as far as needed when the page changes to it,
  // the list fills in, or the Ended group unfolds.
  const scroller = useRef<HTMLDivElement | null>(null);
  const shown = (sessions?.rows ?? []).some((r) => r.id === currentId);
  useEffect(() => {
    const box = scroller.current;
    const item = box?.querySelector<HTMLElement>('[data-current]');
    if (!box || !item) return;
    const top = item.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    const next = revealScrollTop({ scrollTop: box.scrollTop, height: box.clientHeight }, { top, height: item.offsetHeight }, 8);
    if (next !== box.scrollTop) box.scrollTop = next;
  }, [currentId, shown, endedOpen, rail]);
  return (
    <>
      <div className="nav">
        <button className="nav-item" aria-current={allCurrent ? 'page' : undefined} title={rail ? t('sessions.all') : undefined} onClick={openAll}>
          <Icon name="sessions" /><span className="nav-label">{t('sessions.all')}</span>
        </button>
      </div>
      <div className="nav nav-scroll" ref={scroller}>
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
              {/* FD-107: a folded Ended group still shows the session whose page is open, so it is never out of sight. */}
              {rows.filter((r) => !folded || r.id === currentId).map((r) => {
                const lines = navLines(lang, r);
                return (
                  <button key={r.id} className="nav-item session-item" aria-current={currentId === r.id ? 'page' : undefined} data-current={currentId === r.id ? '' : undefined}
                    title={rail ? [t('join.nameState', { name: r.project, state: stateShort(lang, r) }), lines.time, lines.sub].filter(Boolean).join(' · ') : undefined} onClick={() => openRow(r.id)}>
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
