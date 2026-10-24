// FD-103 (SCN-078 to SCN-084): the Sessions mode's pages. All sessions lists every coding session of this computer by
// what it needs, each with its state's actions; a session's page heads its console (the console itself is the drawer's
// view, placed under this header by src/electron/drawer.ts).
import { useEffect, useRef, useState } from 'react';
import type { AppStatus } from '../../core/types';
import type { SessionActionResult, SessionRow } from '../../core/sessions';
import { agentName, contextChip, continueLabel, groupRows, originChip, revealLabel, secondLine, stateShort, stateWords } from '../../core/sessions-view';
import { api, useT } from '../lib';
import { SESSION_MARK } from './Navigation';

type T = (key: string, params?: Record<string, string | number>) => string;

/** The platform words for Show in Finder (SCN-081); a renderer has no `process`, so its user agent says. */
export function platformOf(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): 'mac' | 'windows' | 'other' {
  return /Windows/.test(ua) ? 'windows' : /Macintosh|Mac OS X/.test(ua) ? 'mac' : 'other';
}

/** `~/…` for a path under the home folder. */
export function shortPath(p: string): string {
  const home = /^(\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)/.exec(p)?.[0];
  return home ? `~${p.slice(home.length)}` : p;
}

/** What a refused action says, in one sentence. */
export function failText(t: T, r: Extract<SessionActionResult, { ok: false }>, o: { action: 'end' | 'reveal' | 'continue' | 'dismiss'; folder: string }): string {
  if (o.action === 'end') return t('sessions.endFailed', { reason: r.detail ?? r.reason });
  if (o.action === 'reveal') return r.reason === 'no-folder' ? t('sessions.reason.no-folder') : t('sessions.revealFailed', { path: o.folder, reason: r.detail ?? r.reason });
  if (r.reason === 'admission') return t('sessions.reason.busy');
  if (r.reason === 'no-folder') return t('sessions.reason.no-folder');
  return t('sessions.reason.resume-failed');
}

interface ActionsProps {
  row: SessionRow;
  /** On the session's page Open console is the page itself, so it is not offered there. */
  place: 'card' | 'page';
  open: (id: string) => void;
  /** End asks first (SCN-081 step 2): the shell owns the question. */
  askEnd: (row: SessionRow) => void;
  /** A Continue that started a console: the shell follows the new session by its console key. */
  continued: (key: string) => void;
  /** The account menu is open: on the session's page it drops over the console's view, which steps aside meanwhile. */
  onMenu?: (open: boolean) => void;
}

/** The state's actions (the dossier's table "Every state has an action"). */
export function SessionActions({ row, place, open, askEnd, continued, onMenu }: ActionsProps) {
  const { t, lang } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => { onMenu?.(menu); return () => onMenu?.(false); }, [menu]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); (box.current?.querySelector('[aria-haspopup]') as HTMLButtonElement | null)?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    (box.current?.querySelector('[role="menuitem"]') as HTMLButtonElement | null)?.focus();
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [menu]);
  const run = async (action: 'reveal' | 'continue' | 'dismiss', call: () => Promise<SessionActionResult>) => {
    setBusy(true);
    setError('');
    try {
      const r = await call();
      if (!r.ok) setError(failText(t, r, { action, folder: row.folder }));
      else if (action === 'continue' && r.key) continued(r.key);
    } catch (e) {
      setError(failText(t, { ok: false, reason: 'spawn', detail: String((e as Error)?.message ?? e) }, { action, folder: row.folder }));
    } finally {
      setBusy(false);
    }
  };
  const size = { cols: 100, rows: 30 };
  const has = (a: SessionRow['actions'][number]) => row.actions.includes(a);
  const waitingNoCandidate = row.state === 'waiting-reset' && !has('continueNow');
  const buttons = [
    has('openConsole') && place === 'card' && <button key="open" className="btn btn-sm btn-primary" onClick={() => open(row.id)}>{t('sessions.openConsole')}</button>,
    has('continue') && <button key="continue" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run('continue', () => api().sessionsContinue(row.id, size))}>{continueLabel(lang, row)}</button>,
    has('continueNow') && (
      <div key="now" className="action-menu" ref={box}>
        <button className="btn btn-sm btn-primary" aria-haspopup="menu" aria-expanded={menu} disabled={busy} onClick={() => setMenu(!menu)}>{t('sessions.continueNow')}</button>
        {menu && (
          <div className="menu" role="menu" aria-label={t('sessions.continueNow')} onKeyDown={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const items = [...(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
            const i = items.indexOf(document.activeElement as HTMLButtonElement);
            items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
          }}>
            {row.candidates.map((c) => (
              <button key={c.id} role="menuitem" onClick={() => { setMenu(false); void run('continue', () => api().sessionsContinue(row.id, size, c.id)); }}>{`${c.label} · ${agentName(row.agent)}`}</button>
            ))}
          </div>
        )}
      </div>
    ),
    waitingNoCandidate && <button key="now-off" className="btn btn-sm" disabled aria-describedby={`nocand-${row.id}`}>{t('sessions.continueNow')}</button>,
    has('end') && <button key="end" className="btn btn-sm btn-danger" onClick={() => askEnd(row)}>{t('sessions.end')}</button>,
    has('reveal') && <button key="reveal" className="btn btn-sm" disabled={busy} onClick={() => void run('reveal', () => api().sessionsReveal(row.id))}>{revealLabel(lang, platformOf())}</button>,
    has('dontContinue') && <button key="dont" className="btn btn-sm" disabled={busy} onClick={() => void run('dismiss', () => api().sessionsDismiss(row.id))}>{t('sessions.dontContinue')}</button>,
    has('dismiss') && <button key="dismiss" className="btn btn-sm" disabled={busy} onClick={() => void run('dismiss', () => api().sessionsDismiss(row.id))}>{t('sessions.remove')}</button>,
  ].filter(Boolean);
  if (!buttons.length && !error) return null;
  return (
    <div className="session-actions" role="group" aria-label={t('sessions.actions', { project: row.project })}>
      <div className="row-actions">{buttons}</div>
      {waitingNoCandidate && <span id={`nocand-${row.id}`} className="meta">{t('sessions.noCandidate')}</span>}
      {error && <p className="notice error session-error" role="alert">{error}</p>}
    </div>
  );
}

/** SCN-078 step 3: one session as a card: the two lines, the state in words, the state's actions. */
function SessionCard({ row, autoContinue, ...actions }: Omit<ActionsProps, 'place'> & { row: SessionRow; autoContinue: boolean }) {
  const { lang } = useT();
  const mark = SESSION_MARK[row.group];
  return (
    <li className={`session-card sg-${row.group}`}>
      <div className="session-card-head">
        <h3><button className="linkish session-title" onClick={() => actions.open(row.id)}>{row.project}</button></h3>
        <p className="meta session-sub">{secondLine(lang, row)}</p>
      </div>
      <p className={`session-state state ${mark.cls}`}><span className="glyph" aria-hidden="true">{mark.glyph}</span><span className="session-state-text">{stateWords(lang, row, { autoContinue })}</span></p>
      <SessionActions row={row} place="card" {...actions} />
    </li>
  );
}

interface AllProps {
  sessions: AppStatus['sessions'];
  noteSeen: boolean;
  onNoteSeen: () => void;
  onSetUp: () => void;
  endedOpen: boolean;
  onEndedOpen: (open: boolean) => void;
  open: (id: string) => void;
  askEnd: (row: SessionRow) => void;
  continued: (key: string) => void;
}

/** SCN-078, SCN-079: All sessions. */
export function AllSessions({ sessions, noteSeen, onNoteSeen, onSetUp, endedOpen, onEndedOpen, open, askEnd, continued }: AllProps) {
  const { t, lang } = useT();
  const rows = sessions?.rows ?? [];
  const groups = groupRows(rows);
  const failing = sessions?.degraded[0];
  return (
    <div className="sessions">
      {!noteSeen && (
        <section className="notice info sessions-note" aria-label={t('sessions.all')}>
          <p>{sessions && !sessions.switchboard ? `${t('sessions.note.first')} ${t('sessions.note.install')}` : t('sessions.note')}</p>
          <div className="row">
            <button className="btn btn-sm btn-primary" onClick={onSetUp}>{t('sessions.setUp')}</button>
            <button className="btn btn-sm" aria-label={t('sessions.gotIt.label')} onClick={onNoteSeen}>{t('sessions.gotIt')}</button>
          </div>
        </section>
      )}
      {!sessions && <p className="muted row" role="status"><span className="spinner" aria-hidden="true" /> {t('sessions.reading')}</p>}
      {sessions && !sessions.switchboard && <p className="notice" role="status">{t('sessions.noSwitchboard')}</p>}
      {sessions?.switchboard && failing && <p className="notice warning" role="status">{t('sessions.degraded', { time: new Date(failing.since).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) })}</p>}
      {sessions && rows.length === 0 && <div className="empty"><p>{t('sessions.empty')}</p></div>}
      {groups.map(({ group, rows: list }) => {
        const heading = t(`sessions.group.${group}`, { n: list.length });
        const folded = group === 'ended' && !endedOpen;
        return (
          <section key={group} className="session-group" aria-labelledby={`sg-${group}`}>
            {group === 'ended'
              ? (
                <div className="session-group-head">
                  <h2 id={`sg-${group}`}><button className="fold-btn" aria-expanded={!folded} onClick={() => onEndedOpen(folded)}><span aria-hidden="true">{folded ? '▸' : '▾'}</span> {heading}</button></h2>
                  <button className="btn btn-sm" aria-label={t('sessions.clear.label')} onClick={() => void api().sessionsClearEnded()}>{t('sessions.clear')}</button>
                </div>
              )
              : <h2 id={`sg-${group}`} className="session-group-head">{heading}</h2>}
            {!folded && <ul className="session-cards">{list.map((r) => <SessionCard key={r.id} row={r} autoContinue={sessions?.autoContinue !== false} open={open} askEnd={askEnd} continued={continued} />)}</ul>}
          </section>
        );
      })}
      <p className="meta sessions-footnote">{t('sessions.footnote')}</p>
    </div>
  );
}

/** Whether a session's page shows its console: a console of this app holds or held it. */
export const hasConsole = (row: SessionRow): boolean => Boolean(row.key) && (row.state === 'running-ours' || row.state === 'needs-you-resume-failed' || row.group === 'ended');

/** SCN-080: a session's page header: the project, the state in words, the origin, account and context chips, the coding
 *  agent and the folder, and the state's actions on the right. Its bottom edge is where the console starts. */
export function SessionHeader({ row, autoContinue, open, askEnd, continued, onMenu }: Omit<ActionsProps, 'place'> & { row: SessionRow; autoContinue: boolean }) {
  const { t, lang } = useT();
  const mark = SESSION_MARK[row.group];
  const ctx = contextChip(lang, row);
  const long = row.group === 'needs-you' || row.group === 'waiting';
  return (
    <header className="session-head" data-drawer-top="">
      <div className="session-bar">
        <h1 id="session-title" tabIndex={-1}>{row.project}</h1>
        <span className={`state ${mark.cls}`}><span className="glyph" aria-hidden="true">{mark.glyph}</span>{long ? stateShort(lang, row) : stateWords(lang, row)}</span>
        <span className="spacer" />
        <SessionActions row={row} place="page" open={open} askEnd={askEnd} continued={continued} onMenu={onMenu} />
      </div>
      <div className="session-meta">
        <span className="chip">{originChip(lang, row)}</span>
        {row.account && <span className="chip">{t('sessions.account', { account: row.account })}</span>}
        {ctx && <span className="chip">{ctx}</span>}
        <span className="meta">{agentName(row.agent)}</span>
        <span className="meta mono session-folder" title={row.folder}>{shortPath(row.folder)}</span>
      </div>
      {long && <p className="session-why">{stateWords(lang, row, { autoContinue })}</p>}
      {row.origin === 'resume' && row.group === 'running' && <p className="meta session-why">{t('console.resumed', { agent: agentName(row.agent) })}</p>}
    </header>
  );
}

/** SCN-080 alt paths: what the page says where no console of this app holds the session. */
export function SessionBody({ row }: { row: SessionRow }) {
  const { t } = useT();
  if (row.state === 'running-terminal') return <div className="page session-body"><p>{t('sessions.inTerminal')}</p></div>;
  if (row.group === 'ended' && !row.key) return <div className="page session-body"><p className="muted">{t('sessions.notKept')}</p></div>;
  return <div className="page session-body" />;
}
