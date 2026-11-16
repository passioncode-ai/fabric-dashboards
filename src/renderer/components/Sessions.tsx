// FD-103 (SCN-078 to SCN-084): the Sessions mode's pages. All sessions lists every coding session of this computer by
// what it needs, each with its state's actions; a session's page heads its console (the console itself is the drawer's
// view, placed under this header by src/electron/drawer.ts).
import { remoteRefusal } from '../../core/remote-words';
import { useEffect, useRef, useState } from 'react';
import type { AppStatus } from '../../core/types';
import type { DuplicateSession } from '../../core/duplicate-sessions';
import type { SessionActionResult, SessionRow } from '../../core/sessions';
import { agentName, chainFacts, clock, contextChip, continueLabel, filterActive, filterRows, groupRows, machineGroups, machineStatusWords, NO_FILTER, originChip, originKey, projectName, revealLabel, searchRows, secondLine, stateShort, stateWords, tableStateWords, type SessionFilter } from '../../core/sessions-view';
import { GROUP_ORDER } from '../../core/sessions';
import { api, useT } from '../lib';
import { SESSION_MARK, SessionMark } from './Navigation';

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
export function failText(t: T, r: Extract<SessionActionResult, { ok: false }>, o: { action: 'end' | 'reveal' | 'continue' | 'dismiss' | 'attach'; folder: string }): string {
  if (o.action === 'end') return t('sessions.endFailed', { reason: r.detail ?? r.reason });
  if (o.action === 'reveal') return r.reason === 'no-folder' ? t('sessions.reason.no-folder') : t('sessions.revealFailed', { path: o.folder, reason: r.detail ?? r.reason });
  // R1-B: the refusal says the cause the check found (disk, the console cap, swap, FD-261's machine pool: wave 1, T-01).
  if (r.reason === 'admission') return t(r.detail === 'disk' || r.detail === 'cap' || r.detail === 'swap' || r.detail === 'pool' ? `sessions.reason.busy-${r.detail}` : 'sessions.reason.busy');
  if (o.action === 'attach') return t('sessions.attachFailed', { reason: r.detail ?? r.reason }); // FD-211
  if (r.reason === 'held' || (r.reason === 'running' && r.detail === 'held')) return t('sessions.reason.held'); // wave 1 (C-01, C-03)
  if (r.reason === 'no-folder') return t('sessions.reason.no-folder');
  if (r.reason === 'remote') return t(remoteRefusal(r.detail)); // FD-199, FD-200
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
  const run = async (action: 'reveal' | 'continue' | 'dismiss' | 'attach', call: () => Promise<SessionActionResult>) => {
    setBusy(true);
    setError('');
    try {
      const r = await call();
      if (!r.ok) setError(failText(t, r, { action, folder: row.folder }));
      else if ((action === 'continue' || action === 'attach') && r.key) continued(r.key);
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
    // FD-211: a session Switchboard's session host holds opens in this app; closing it here leaves it running.
    has('attach') && <button key="attach" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run('attach', () => api().sessionsAttach(row.id, size))}>{t('sessions.attach')}</button>,
    has('end') && <button key="end" className="btn btn-sm btn-danger" onClick={() => askEnd(row)}>{t('sessions.end')}</button>,
    has('reveal') && <button key="reveal" className="btn btn-sm" disabled={busy} onClick={() => void run('reveal', () => api().sessionsReveal(row.id))}>{revealLabel(lang, platformOf())}</button>,
    has('dontContinue') && <button key="dont" className="btn btn-sm" disabled={busy} onClick={() => void run('dismiss', () => api().sessionsDismiss(row.id))}>{t('sessions.dontContinue')}</button>,
    has('dismiss') && <button key="dismiss" className="btn btn-sm" disabled={busy} onClick={() => void run('dismiss', () => api().sessionsDismiss(row.id))}>{t('sessions.remove')}</button>,
  ].filter(Boolean);
  if (!buttons.length && !error) return null;
  return (
    <div className="session-actions" role="group" aria-label={t('sessions.actions', { project: projectName(lang, row) })}>
      <div className="row-actions">{buttons}</div>
      {waitingNoCandidate && <span id={`nocand-${row.id}`} className="meta">{t(row.waitReason ? `sessions.noCandidate.${row.waitReason}` : 'sessions.noCandidate')}</span>}
      {error && <p className="notice error session-error" role="alert">{error}</p>}
    </div>
  );
}

/** SCN-078 step 3: one session as a card: the two lines, the state in words, the state's actions. */
function SessionCard({ row, autoContinue, stale, ...actions }: Omit<ActionsProps, 'place'> & { row: SessionRow; autoContinue: boolean; stale?: boolean }) {
  const { lang } = useT();
  const mark = SESSION_MARK[row.group];
  return (
    <li className={`session-card sg-${row.group}${stale ? ' session-stale' : ''}`}>
      <div className="session-card-head">
        <h3><button className="linkish session-title" onClick={() => actions.open(row.id)}>{projectName(lang, row)}</button></h3>
        <p className="meta session-sub">{secondLine(lang, row)}</p>
      </div>
      <p className={`session-state state ${mark.cls}`}><SessionMark group={row.group} /><span className="session-state-text">{stateWords(lang, row, { autoContinue })}</span></p>
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
  /** FD-247 (step 6, SCN-109): the filters kept in Settings.layout. */
  filter?: SessionFilter;
  onFilter?: (f: SessionFilter) => void;
  /** FD-247: New session on a machine's heading, the dialog with that machine chosen. */
  onNewThere?: (machine: string) => void;
}

// #region duplicate-sessions — docs: docs/ux/scenarios.md#scn-118-close-the-quiet-copy-of-a-session-that-runs-twice
/** FD-277: one session in two processes; the button asks Switchboard to close the quiet copy and says what it did. */
function DuplicateNotice({ d }: { d: DuplicateSession }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const close = async () => {
    setBusy(true);
    try {
      const r = await api().sessionsCloseCopy(d.sessionId);
      setSaid(r.ok ? (r.closedPid ? t('sessions.closeCopy.done', { pid: String(r.closedPid) }) : t('sessions.closeCopy.doneAny'))
        : r.why === 'not-two' ? t('sessions.closeCopy.notTwo') : r.why === 'all-working' ? t('sessions.closeCopy.allWorking') : t('sessions.closeCopy.failed', { detail: r.detail ?? '' }));
    } catch (error) {
      setSaid(t('sessions.closeCopy.failed', { detail: (error as Error).message }));
    } finally { setBusy(false); }
  };
  return (
    <section className="notice warning session-duplicate" role="status">
      <p>{t('sessions.duplicate', { label: d.label })}</p>
      <p className="meta">{t('sessions.duplicate.hint')}</p>
      <div className="row">
        {/* Switchboard 0.7.100: both copies answer, so none may be closed; the warning says so instead of a button. */}
        {d.close === null ? <span className="meta">{t('sessions.closeCopy.allWorking')}</span>
          : <button className="btn btn-sm" disabled={busy} onClick={() => void close()}>{t('sessions.closeCopy')}</button>}
        {said && <span className="meta" role="status">{said}</span>}
      </div>
    </section>
  );
}
// #endregion duplicate-sessions

/** SCN-078, SCN-079: All sessions. */
export function AllSessions({ sessions, noteSeen, onNoteSeen, onSetUp, endedOpen, onEndedOpen, open, askEnd, continued, filter = NO_FILTER, onFilter, onNewThere }: AllProps) {
  const { t, lang } = useT();
  const [query, setQuery] = useState('');
  const all = sessions?.rows ?? [];
  const rows = searchRows(lang, filterRows(all, filter), query);
  const failing = sessions?.degraded[0];
  const machines = sessions?.machines ?? [];
  // FD-247 (step 6): machines are headings only once another machine is read or named; one Mac reads as before.
  const byMachine = machineGroups(rows, machines);
  const several = machines.length > 0 || all.some((r) => r.machine);
  // UI wave 7: the Account column only when a shown row has an account (sessions started by hand have none).
  const withAccount = rows.some((r) => Boolean(r.account));
  const filtering = filterActive(filter, query);
  const toggle = <K extends keyof SessionFilter>(k: K, v: SessionFilter[K][number]) => {
    const list = filter[k] as readonly string[];
    onFilter?.({ ...filter, [k]: list.includes(v as string) ? list.filter((x) => x !== v) : [...list, v] });
  };
  const machineNames = ['', ...machines.map((m) => m.machine), ...all.map((r) => r.machine).filter((m): m is string => Boolean(m))].filter((m, i, a) => a.indexOf(m) === i);
  const origins = [...new Set(all.map(originKey))];
  const chip = <K extends keyof SessionFilter>(k: K, v: SessionFilter[K][number], label: string) => (
    <button key={`${k}-${v}`} type="button" className="chip filter-chip" aria-pressed={(filter[k] as readonly string[]).includes(v as string)} onClick={() => toggle(k, v)}>{label}</button>
  );
  const groupsOf = (list: SessionRow[], stale: boolean, scope: string) => groupRows(list).map(({ group, rows: inGroup }) => {
    // Under a machine's heading a state is a level lower; with one Mac it is the page's first level, as before.
    const H = several ? 'h3' : 'h2';
    const heading = t(`sessions.group.${group}`, { n: inGroup.length });
    // A search or a filter shows what it found: the Ended group unfolds while one is on.
    const folded = group === 'ended' && !endedOpen && !filtering;
    const id = `sg-${scope}-${group}`;
    return (
      <section key={group} className="session-group" aria-labelledby={id}>
        {group === 'ended'
          ? (
            <div className="session-group-head">
              <H id={id}><button className="fold-btn" aria-expanded={!folded} onClick={() => onEndedOpen(folded)}><span aria-hidden="true">{folded ? '▸' : '▾'}</span> {heading}</button></H>
              <button className="btn btn-sm" aria-label={t('sessions.clear.label')} onClick={() => void api().sessionsClearEnded()}>{t('sessions.clear')}</button>
            </div>
          )
          : <H id={id} className="session-group-head">{heading}</H>}
        {!folded && <ul className="session-cards">{inGroup.map((r) => <SessionCard key={r.id} row={r} stale={stale} autoContinue={sessions?.autoContinue !== false} open={open} askEnd={askEnd} continued={continued} />)}</ul>}
        {/* FD-247 (step 6): on a wide window the same rows as a table; the cards above show below that width (CSS). */}
        {!folded && (
          <table className={`session-table${withAccount ? '' : ' no-account'}`}>
            <caption className="visually-hidden">{heading}</caption>
            {/* Fixed widths, so the columns of one machine's groups line up; the machine is its section's heading. */}
            <colgroup><col className="c-state" /><col className="c-project" /><col className="c-agent" />{withAccount && <col className="c-account" />}<col className="c-origin" /><col className="c-time" /><col className="c-actions" /></colgroup>
            <thead><tr>
              <th scope="col">{t('sessions.filter.state')}</th><th scope="col">{t('sessions.col.project')}</th>
              <th scope="col">{t('sessions.col.agent')}</th>{withAccount && <th scope="col">{t('sessions.col.account')}</th>}<th scope="col">{t('sessions.filter.origin')}</th>
              <th scope="col">{t('sessions.col.time')}</th><th scope="col">{t('sessions.col.actions')}</th>
            </tr></thead>
            <tbody>{inGroup.map((r) => {
              const when = r.group === 'ended' ? (r.endedAt ?? r.at) : (r.startedAt ?? r.at);
              return (
                <tr key={r.id} className={`sg-${r.group}${stale ? ' session-stale' : ''}`}>
                  <td><span className={`state ${SESSION_MARK[r.group].cls}`}><SessionMark group={r.group} /> {tableStateWords(lang, r, { autoContinue: sessions?.autoContinue !== false })}</span></td>
                  <th scope="row" title={projectName(lang, r)}><button className="linkish session-title" onClick={() => open(r.id)}>{projectName(lang, r)}</button></th>
                  <td>{agentName(r.agent)}</td>
                  {withAccount && <td title={r.account ?? undefined}>{r.account ?? ''}</td>}
                  <td>{t(`sessions.origin.${originKey(r)}`)}</td>
                  <td className="num">{when ? clock(lang, when) : ''}</td>
                  <td><SessionActions row={r} place="card" open={open} askEnd={askEnd} continued={continued} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </section>
    );
  });
  return (
    <div className="sessions">
      {/* V-7 of FIX-2: without Switchboard one notice says how to get it; the note and its button to Switchboard's
          setting are for a computer that has it. */}
      {!noteSeen && sessions?.switchboard !== false && (
        <section className="notice info sessions-note" aria-label={t('sessions.all')}>
          <p>{t('sessions.note')}</p>
          <div className="row">
            <button className="btn btn-sm btn-primary" onClick={onSetUp}>{t('sessions.setUp')}</button>
            <button className="btn btn-sm" aria-label={t('sessions.gotIt.label')} onClick={onNoteSeen}>{t('sessions.gotIt')}</button>
          </div>
        </section>
      )}
      {(!sessions || sessions.switchboard === null) && <p className="muted row" role="status"><span className="spinner" aria-hidden="true" /> {t('sessions.reading')}</p>}
      {sessions && sessions.switchboard === false && <p className="notice" role="status">{`${t('sessions.noSwitchboard')} ${t('sessions.note.install')}`}</p>}
      {sessions?.switchboard && failing && <p className="notice warning" role="status">{t('sessions.degraded', { time: clock(lang, failing.since) })}</p>}
      {/* FD-277 (SCN-118): a session that runs in two processes, with Switchboard's Close the quiet copy. */}
      {(sessions?.duplicates ?? []).map((d) => <DuplicateNotice key={d.sessionId} d={d} />)}
      {/* FD-247 (step 6, SCN-109): search and filters; the filters are kept, the search is not. */}
      {all.length > 0 && (
        <div className="session-filters" role="search">
          <input type="search" className="session-search" aria-label={t('sessions.search')} placeholder={t('sessions.search.hint')} value={query} onChange={(e) => setQuery(e.target.value)} />
          {machineNames.length > 1 && (
            <div className="row filter-row" role="group" aria-label={t('sessions.filter.machine')}><span className="meta">{t('sessions.filter.machine')}</span>{machineNames.map((m) => chip('machines', m, m || t('sessions.machine.this')))}</div>
          )}
          <div className="row filter-row" role="group" aria-label={t('sessions.filter.state')}><span className="meta">{t('sessions.filter.state')}</span>{GROUP_ORDER.map((g) => chip('groups', g, t(`sessions.filter.group.${g}`)))}</div>
          {origins.length > 1 && (
            <div className="row filter-row" role="group" aria-label={t('sessions.filter.origin')}><span className="meta">{t('sessions.filter.origin')}</span>{origins.map((o) => chip('origins', o, t(`sessions.origin.${o}`)))}</div>
          )}
          {filtering && (
            <p className="meta row" role="status">{t('sessions.filter.shown', { n: rows.length, m: all.length })}
              <button type="button" className="btn-link" onClick={() => { setQuery(''); onFilter?.(NO_FILTER); }}>{t('sessions.filter.clear')}</button></p>
          )}
        </div>
      )}
      {sessions && sessions.switchboard !== null && all.length === 0 && machines.length === 0 && <div className="empty"><p>{t('sessions.empty')}</p></div>}
      {all.length > 0 && rows.length === 0 && <div className="empty"><p>{t('sessions.filter.none')}</p></div>}
      {several
        ? byMachine.map(({ machine, status, rows: list }) => {
          const stale = Boolean(status && status.state !== 'ok');
          const words = machine ? machineStatusWords(lang, status) : null;
          return (
            <section key={machine || 'here'} className={`session-machine${stale ? ' session-machine-stale' : ''}`} aria-labelledby={`sm-${machine || 'here'}`}>
              <div className="session-machine-bar">
              <h2 id={`sm-${machine || 'here'}`} className="session-machine-head">{machine || t('sessions.machine.this')}
                {words && !stale && <span className="meta"> · {words}</span>}
                {list.length === 0 && !stale && <span className="meta"> · {t('sessions.machine.empty')}</span>}
              </h2>
              {/* FD-247 (step 7b, SCN-111): a login shell on that machine, in a console of its own. */}
              {machine && onNewThere && <button type="button" className="btn btn-sm session-machine-new" aria-label={t('sessions.machine.new.label', { machine })} onClick={() => onNewThere(machine)}>{t('newSession.button')}</button>}
              {machine && <button type="button" className="btn btn-sm session-machine-terminal" aria-label={t('sessions.machine.terminal.label', { machine })} onClick={() => void api().sessionsMachineTerminal(machine).then((r) => { if (r.ok && r.key) continued(r.key); })}>{t('sessions.machine.terminal')}</button>}
              </div>
              {/* FD-247 (step 5): a machine whose list is not fresh says why; its last rows stay, greyed, up to 24 h. */}
              {stale && words && <p className="meta" role="status">{words}</p>}
              {groupsOf(list, stale, machine || 'here')}
            </section>
          );
        })
        : groupsOf(rows, false, 'here')}
      {/* FD-107: the footnote speaks of the list, so it waits for the list; under the loading line it is not drawn. */}
      {sessions && !sessions.machine && <p className="meta sessions-footnote">{t('sessions.footnote')}</p>}
    </div>
  );
}

/** Whether a session's page shows its console: a console of this app holds or held it. */
export const hasConsole = (row: SessionRow): boolean => Boolean(row.key) && (row.state === 'running-ours' || row.state === 'needs-you-resume-failed' || (row.group === 'ended' && !row.consoleEmpty));

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
        <h1 id="session-title" tabIndex={-1}>{projectName(lang, row)}</h1>
        <span className={`state ${mark.cls}`}><SessionMark group={row.group} />{long ? stateShort(lang, row) : stateWords(lang, row)}</span>
        <span className="spacer" />
        <SessionActions row={row} place="page" open={open} askEnd={askEnd} continued={continued} onMenu={onMenu} />
      </div>
      <div className="session-meta">
        <span className="chip">{originChip(lang, row)}</span>
        {row.account && row.origin !== 'limit' && <span className="chip">{t('sessions.account', { account: row.account })}</span>}
        {row.paid && <span className="chip">{t(`sessions.paid.${row.paid}`)}</span>}
        {ctx && <span className="chip">{ctx}</span>}
        <span className="meta">{agentName(row.agent)}</span>
        <span className="meta mono session-folder" title={row.folder}>{shortPath(row.folder)}</span>
      </div>
      <SessionChain row={row} />
      {long && <p className="session-why">{stateWords(lang, row, { autoContinue })}</p>}
      {row.origin === 'resume' && row.group === 'running' && <p className="meta session-why">{t('console.resumed', { agent: agentName(row.agent) })}</p>}
    </header>
  );
}

/** FD-124 (SCN-080): what Switchboard's launch record says, folded under one line so the console keeps its height: who
 *  started the session, how it ended, where its work went, and the transcript shown in the file manager. */
function SessionChain({ row }: { row: SessionRow }) {
  const { t, lang } = useT();
  const [gone, setGone] = useState(false);
  const facts = chainFacts(lang, row);
  if (!facts.length && !row.launch?.transcript) return null;
  const reveal = async () => {
    const r = await api().sessionsRevealTranscript(row.id).catch(() => null);
    setGone(!r?.ok);
  };
  return (
    <details className="session-chain" aria-label={t('sessions.chain.label')}>
      <summary>{t('sessions.chain.summary')}</summary>
      {facts.length > 0 && <dl className="session-facts">{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
      {row.launch?.transcript && <button className="btn btn-sm" aria-label={t('sessions.transcript.label')} onClick={() => void reveal()}>{t('sessions.transcript')}</button>}
      {gone && <p className="meta" role="status">{t('sessions.transcript.gone')}</p>}
    </details>
  );
}

/** SCN-080 alt paths: what the page says where no console of this app holds the session. FD-107: no state leaves the
 *  body blank. A waiting session says what happens next, the way out now, its folder and when it stopped; a hand-over
 *  that did not open says where it is and what Remove does; any other state without a console says there is none. */
export function SessionBody({ row, autoContinue = true }: { row: SessionRow; autoContinue?: boolean }) {
  const { t, lang } = useT();
  if (row.state === 'running-terminal') return <div className="page session-body"><p>{t('sessions.inTerminal')}</p></div>;
  if (row.state === 'running-background') return <div className="page session-body"><p>{t('sessions.inBackground')}</p></div>;
  if (row.state === 'running-unmanaged') return <div className="page session-body"><p>{t('sessions.inMachine')}</p></div>; // FD-231
  // FD-108: a limit stop that cannot be continued here never had a console of this app: its card says why, its page that
  // nothing of it runs here and that Remove takes it off the list.
  if (row.state === 'ended-cannot-continue') return <div className="page session-body"><section className="session-panel"><p>{t('sessions.body.notOpened')}</p></section></div>;
  // V-5 of FIX-2: an ended row whose console holds nothing (the app restarted since) says so, never a blank page.
  if (row.group === 'ended' && (!row.key || row.consoleEmpty)) return <div className="page session-body"><p className="muted">{t('sessions.notKept')}</p></div>;
  if (row.state === 'waiting-reset') {
    const next = !autoContinue ? t('sessions.body.autoOff') : row.expectedAt ? t('sessions.body.waitingAt', { time: clock(lang, row.expectedAt) }) : t('sessions.body.waiting');
    // FD-118: Switchboard 0.6.83 says why a waiting stop is not ready; "no other account has capacity" only when it names nothing.
    const now = row.actions.includes('continueNow') ? t('sessions.body.waitingActions')
      : row.waitReason ? t('sessions.body.waitingWhy', { why: t(`sessions.noCandidate.${row.waitReason}`) }) : t('sessions.body.waitingNoCandidate');
    return (
      <div className="page session-body">
        <section className="session-panel" aria-label={t('sessions.short.waiting')}>
          <p>{next}</p>
          <p>{now}</p>
          <dl className="session-facts">
            <div><dt>{t('sessions.body.folder')}</dt><dd className="mono" title={row.folder}>{shortPath(row.folder)}</dd></div>
            {row.startedAt && <div><dt>{t('sessions.body.stopped')}</dt><dd>{clock(lang, row.startedAt)}</dd></div>}
          </dl>
        </section>
      </div>
    );
  }
  if (row.state === 'needs-you-not-opened') {
    return <div className="page session-body"><section className="session-panel"><p>{t(row.openedInTerminal ? 'sessions.body.inTerminal' : 'sessions.body.notOpened')}</p></section></div>;
  }
  return <div className="page session-body"><section className="session-panel"><p className="muted">{t('sessions.body.noConsole')}</p></section></div>;
}
