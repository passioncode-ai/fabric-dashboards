// ADR-0017 (SCN-048…050), FD-92: the agent console, a drawer from the top of the content area over the dashboard.
// A real terminal (xterm.js) on the PTY the main process holds: the runtime's own interface, nothing of our own in
// between. It is drawn in the drawer's own view (src/electron/drawer.ts), so it lies over the dashboard, never beside it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { ConsoleInfo, ConsoleSessions, ConsoleStartResult, ConsoleTask } from '../../core/api';
import { CONSOLE_HEIGHT } from '../../core/types';
import { pageExitLine, terminalKey } from '../../core/sessions-view';
import { api, Icon, Spinner, useT } from '../lib';

interface Props {
  serviceKey: string;
  /** The drawer's height now, and the tallest it may be (src/core/layout.ts drawerHeightFor). */
  height: number;
  maxHeight: number;
  onHeight: (height: number, commit: boolean) => void;
  /** While the bottom edge is dragged: the drawer covers the area to keep the pointer (drawer.ts). */
  onDrag: (active: boolean) => void;
  /** Folds the drawer; whatever runs in it keeps running. */
  onHide: () => void;
  /** FD-39 D-3: a job to start with (Fix / Update with agent); taken once, then cleared by the shell. */
  task?: { task?: ConsoleTask; mode?: 'new' | 'continue'; nonce: number } | null;
  onTaskTaken?: () => void;
  /** FD-103 (SCN-080): a session's page: the terminal fills the page under its header; no fold, no edge, no start
   *  controls of its own (the header holds the session's actions). */
  page?: boolean;
  /** VIS-05: Esc, then Tab within a second, left the terminal (`back`: Shift+Tab). */
  onFocusOut?: (back: boolean) => void;
}

/** The terminal's colours, from the app's theme tokens. */
function themeOf(): { background: string; foreground: string; cursor: string; selectionBackground: string } {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { background: v('--pc-bg', '#0a070d'), foreground: v('--pc-text', '#ececec'), cursor: v('--pc-accent', '#f5c518'), selectionBackground: v('--pc-border', '#444') };
}

/** `~/…` for a path under the home folder. */
function shortPath(p: string): string {
  const home = /^\/Users\/[^/]+/.exec(p)?.[0];
  return home ? `~${p.slice(home.length)}` : p;
}

export function ConsolePanel({ serviceKey, height, maxHeight, onHeight, onDrag, onHide, task, onTaskTaken, page = false, onFocusOut }: Props) {
  const { t, lang } = useT();
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  /** How far into the session's output the terminal shows: events and snapshots meet here. */
  const shown = useRef(0);
  const [info, setInfo] = useState<ConsoleInfo | null>(null);
  const [notice, setNotice] = useState<{ text: string; terminalOnly?: boolean; info?: boolean } | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sessions, setSessions] = useState<ConsoleSessions | null>(null);
  /** SCN-080 step 3: the keyboard line shows while the terminal has focus. */
  const [termFocus, setTermFocus] = useState(false);
  const leave = useRef(onFocusOut);
  leave.current = onFocusOut;

  // FD-43: what Switchboard launched in this folder, read at the console's cadence (15 s) and only while
  // the console is on screen in a visible window (LC-08); FD-51: where each managed session runs now.
  useEffect(() => {
    let stop = false;
    const read = () => {
      if (document.visibilityState !== 'visible') return;
      void api().consoleSessions(serviceKey).then((s) => { if (!stop) setSessions(s); }).catch(() => undefined);
    };
    read();
    const timer = setInterval(read, 15_000);
    document.addEventListener('visibilitychange', read);
    return () => { stop = true; clearInterval(timer); document.removeEventListener('visibilitychange', read); };
  }, [serviceKey]);

  // Replays what the session printed: on mount, on another service, when the window shows again.
  const refresh = useCallback(async () => {
    let next: ConsoleInfo;
    try {
      next = await api().consoleInfo(serviceKey);
    } catch (error) {
      setNotice({ text: String((error as Error)?.message ?? error) });
      return;
    }
    setInfo(next);
    const x = term.current;
    if (x) {
      // Review R-5: the reset goes through the write queue (RIS), behind chunks still waiting there.
      x.write('\x1bc');
      if (next.session.output) x.write(next.session.output);
      shown.current = next.session.end;
    }
  }, [serviceKey]);

  useEffect(() => {
    const x = new Terminal({ fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--pc-font-data').trim() || 'ui-monospace, Menlo, monospace', fontSize: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fd-type-terminal')) || 12.5, cursorBlink: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, scrollback: 5000, theme: themeOf(), allowProposedApi: false });
    const f = new FitAddon();
    x.loadAddon(f);
    term.current = x;
    fit.current = f;
    if (host.current) x.open(host.current);
    // VIS-05: Esc always reaches the coding agent; a Tab within a second after it moves focus out of the terminal.
    let lastEsc: number | null = null;
    x.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.key === 'Escape') { lastEsc = Date.now(); return true; }
      const k = terminalKey(e, lastEsc, Date.now());
      if (k === 'pass') return true;
      if (e.type === 'keydown') { lastEsc = null; e.preventDefault(); x.blur(); leave.current?.(k === 'leave-back'); }
      return false;
    });
    const focusIn = () => setTermFocus(true);
    const focusOut = () => setTermFocus(false);
    x.textarea?.addEventListener('focus', focusIn);
    x.textarea?.addEventListener('blur', focusOut);
    // VIS-06: the scheme follows at once: a changed theme attribute, or the system switching while `system` is chosen.
    const repaint = () => { x.options.theme = themeOf(); };
    const themes = new MutationObserver(repaint);
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const system = window.matchMedia?.('(prefers-color-scheme: light)');
    system?.addEventListener?.('change', repaint);
    const typed = x.onData((data) => api().consoleInput(serviceKey, data));
    const sized = x.onResize(({ cols, rows }) => api().consoleResize(serviceKey, cols, rows));
    const observer = new ResizeObserver(() => { try { f.fit(); } catch { /* not laid out yet */ } });
    if (host.current) observer.observe(host.current);
    const off = api().onConsoleEvent((e) => {
      if (e.key !== serviceKey) return;
      if (e.kind === 'data') {
        // Only what the terminal has not shown yet: a chunk the last snapshot already held is skipped.
        const start = e.end - e.data.length;
        if (e.end <= shown.current) return;
        x.write(start >= shown.current ? e.data : e.data.slice(shown.current - start));
        shown.current = e.end;
      } else void refresh();
    });
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    setNotice(null);
    setConfirmClose(false);
    void refresh();
    return () => {
      off(); typed.dispose(); sized.dispose(); observer.disconnect(); themes.disconnect(); system?.removeEventListener?.('change', repaint);
      x.textarea?.removeEventListener('focus', focusIn); x.textarea?.removeEventListener('blur', focusOut);
      document.removeEventListener('visibilitychange', onVisible); x.dispose(); term.current = null;
    };
  }, [serviceKey, refresh]);

  const say = (r: ConsoleStartResult) => {
    if (r.ok) { setNotice(null); return; }
    if (r.reason === 'admission') {
      // FD-49 (LC-17): what the machine lacks, and what frees it.
      setNotice({ text: r.why === 'disk' ? t('console.admission.disk', { free: r.freeGb ?? 0 }) : r.why === 'cap' ? t('console.admission.cap', { cap: r.cap ?? 0 }) : t('console.admission.swap') });
      return;
    }
    const detail = r.detail ?? '';
    if (r.reason === 'terminal-only') setNotice({ text: t('console.terminalOnly', { name: r.project ?? '' }), terminalOnly: true });
    else if (r.reason === 'switchboard') setNotice({ text: t('console.sbError', { detail }) });
    else if (r.reason === 'spawn') setNotice({ text: t('console.spawnError', { detail }) });
    else if (r.reason === 'running') setNotice({ text: t('console.running') });
    else if (r.reason === 'no-continue') setNotice({ text: detail });
    else setNotice(null); // no-runtime, no-folder: the panel's own state says it
  };

  const start = async (mode: 'new' | 'continue', job?: ConsoleTask) => {
    setStarting(true);
    try {
      const x = term.current;
      try { fit.current?.fit(); } catch { /* not laid out */ }
      x?.write('\x1bc');
      shown.current = 0; // a new session counts from its own first character
      say(await api().consoleStart(serviceKey, mode, { cols: x?.cols ?? 80, rows: x?.rows ?? 24 }, job));
      x?.focus();
    } catch (error) {
      setNotice({ text: t('console.spawnError', { detail: String((error as Error)?.message ?? error) }) });
    } finally {
      setStarting(false);
      void refresh();
    }
  };
  // FD-50 (LC-18): a session closed after the idle time continues when the console is opened again —
  // once per opening, and only with a runtime that can continue; otherwise the panel says New starts afresh.
  const resumed = useRef<string | null>(null);
  useEffect(() => {
    if (page || !info?.idle || info.key !== serviceKey || resumed.current === serviceKey || task || starting) return;
    if (info.session.state === 'running') return;
    resumed.current = serviceKey;
    const rt = info.runtimes.find((r) => r.id === info.runtime);
    if (rt?.canContinue && info.folder?.exists) {
      // VIS-14 (FD-113): the idle close is news, not an error: a calm notice a screen reader reads politely.
      setNotice({ text: t('console.idle.resumed', { account: info.idle.account ?? t('word.notRecorded') }), info: true });
      void start('continue').then(() => setNotice({ text: t('console.idle.resumed', { account: info.idle?.account ?? t('word.notRecorded') }), info: true }));
    } else setNotice({ text: t('console.idle.closed'), info: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.key, info?.idle?.at]);

  // FD-39 SCN-054/055: a handed-over task starts once the panel knows its session; a running session
  // is never doubled — the person sees it and the notice says why.
  useEffect(() => {
    if (!task || !info || info.key !== serviceKey || starting) return;
    onTaskTaken?.();
    if (info.session.state === 'running') { setNotice({ text: t('console.running') }); return; }
    void start(task.mode ?? 'new', task.task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.nonce, info?.key]);

  const openTerminal = async (mode: 'new' | 'continue') => {
    const r = await api().consoleOpenTerminal(serviceKey, mode).catch((e: unknown) => ({ ok: false, error: String((e as Error)?.message ?? e) }));
    if (!r.ok) setNotice({ text: r.error === 'continue-unsupported' ? t('console.continueUnsupported') : t('console.terminalFailed', { detail: r.error ?? '' }) });
  };

  // FD-92: the bottom edge drags the height; the drawer is remembered at the height it is let go at.
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const startY = e.clientY;
    const startH = height;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    onDrag(true);
    const move = (m: PointerEvent) => onHeight(startH + (m.clientY - startY), false);
    const up = (u: PointerEvent) => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
      onHeight(startH + (u.clientY - startY), true);
      onDrag(false);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  const nudge = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') onHeight(height + 24, true);
    if (e.key === 'ArrowUp') onHeight(height - 24, true);
  };
  // FD-92: the red cross closes the console: a running session is ended after a confirmation, then the drawer folds.
  const close = () => {
    if (info?.session.state === 'running') { setConfirmClose(true); return; }
    onHide();
  };

  const running = info?.session.state === 'running';
  const runtime = info?.runtimes.find((r) => r.id === info.runtime) ?? null;
  const bound = info?.binding.kind === 'project' ? info.binding : null;
  const terminalOnly = Boolean(bound && runtime?.viaSwitchboard && !bound.inPlace);
  const folderOk = Boolean(info?.folder?.exists);
  // FD-62 (SB-108): a hand-over's own console runs only what Switchboard handed over — no runtime, folder or start of its own.
  const ownHandover = /^handover\./.test(serviceKey);
  const handover = info?.handover ?? null;

  if (page) {
    // R1-V4: the page's header says how the session ended; the strip adds only an unclean exit's code.
    const exitLine = info ? pageExitLine(lang, info.session, Boolean(info.idle)) : null;
    return (
      <section className="console-drawer console-page" aria-label={t('console.title')}>
        {!info && <p className="console-state muted row" role="status"><Spinner /> {t('console.loading')}</p>}
        {info?.session.state === 'idle' && <p className="console-state muted">{t('sessions.notKept')}</p>}
        {notice && <div className={`console-state notice${notice.info ? '' : ' error'}`} role={notice.info ? 'status' : 'alert'}><p>{notice.text}</p></div>}
        {exitLine && <p className="console-line console-exit-line meta" role="status">{exitLine}</p>}
        <div className="console-term" ref={host} onClick={() => term.current?.focus()} />
        <p className={`console-line console-keys meta${termFocus ? '' : ' quiet'}`} aria-hidden={!termFocus}>{t('sessions.keys')}</p>
      </section>
    );
  }

  return (
    <section className="console-drawer" style={{ height }} aria-label={t('console.title')}>
      <div className="console-head">
        <div className="console-row">
          {ownHandover
            ? <span className="chip">{handover?.agent || t('console.title')}</span>
            : <>
              <label className="visually-hidden" htmlFor="console-runtime">{t('console.runtime')}</label>
              <select id="console-runtime" value={info?.runtime ?? ''} disabled={!info?.runtimes.length || running} onChange={(e) => void api().consoleChoose(serviceKey, { runtime: e.target.value }).then((i) => { setInfo(i); setNotice(null); })}>
                {info?.runtimes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </>}
          <span className="spacer" />
          {running && confirmClose && (
            <span className="row" role="group" aria-label={t('console.closeConfirm')}>
              <span className="meta">{t('console.closeConfirm')}</span>
              <button className="btn btn-sm btn-danger" onClick={() => { setConfirmClose(false); void api().consoleStop(serviceKey).finally(onHide); }}>{t('console.close')}</button>
              <button className="btn btn-sm" autoFocus onClick={() => setConfirmClose(false)}>{t('action.cancel')}</button>
            </span>
          )}
          <button className="icon-btn" title={t('console.hide')} aria-label={t('console.hide')} onClick={onHide}><Icon name="chevronUp" /></button>
          <button className="icon-btn icon-btn-close" title={t('console.close')} aria-label={t('console.close')} onClick={close}><Icon name="close" /></button>
        </div>
        {handover && <p className="console-row console-line meta" role="status">{handover.kind === 'resume' ? t('console.resumed', { agent: handover.agent }) : t('console.handover', { workflow: handover.workflow || handover.agent, account: handover.account || t('word.notRecorded') })}</p>}
        {!ownHandover && <div className="console-row meta">
          {info?.folder
            ? <span className="console-folder" title={`${info.folder.path}${info.folder.source === 'found' ? ` (${t('console.foundFrom')})` : ''}`}>{shortPath(info.folder.path)}</span>
            : <span className="console-folder muted">{t('console.folder')}: {t('console.folderNone')}</span>}
          <button className="btn btn-sm" disabled={running} onClick={() => void api().consolePickFolder(serviceKey).then((i) => { setInfo(i); setNotice(null); })}>{info?.folder ? t('console.other') : t('console.chooseFolder')}</button>
          {bound && <span className="chip" title={t('console.project', { name: bound.name })}>{t('console.project', { name: bound.name })}</span>}
        </div>}
      </div>
      {!info && <p className="console-state muted row" role="status"><Spinner /> {t('console.loading')}</p>}
      {info && !ownHandover && !info.runtimes.length && <p className="console-state notice">{t('console.noRuntime', { list: 'claude, codex, gemini, opencode, qwen, goose, aider, agent, copilot, amp' })}</p>}
      {info && !ownHandover && info.runtimes.length > 0 && !folderOk && (
        <div className="console-state notice">
          <p>{info.folder && !info.folder.exists ? t('console.folderGone', { path: info.folder.path }) : t('console.noFolder')}</p>
          <button className="btn" onClick={() => void api().consolePickFolder(serviceKey).then(setInfo)}>{t('console.chooseFolder')}</button>
        </div>
      )}
      {info?.binding.kind === 'error' && <p className="console-state notice error" role="alert">{t('console.sbError', { detail: info.binding.detail })}</p>}
      {sessions && 'sessions' in sessions && sessions.sessions.filter((x) => x.state === 'starting' || x.state === 'running').map((x, i) => (
        <div key={i} className="console-row console-line meta" role="status">
          <span className="chip">{t(`console.sb.state.${x.state}`)}</span>
          <span>{t('console.sb.session', { label: x.label, mode: x.mode, since: x.launchedAt ? new Date(x.launchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('word.notRecorded') })}</span>
          {x.movedTo && <span className="notice">{t('console.sb.moved', { label: x.movedTo })}</span>}
        </div>
      ))}
      {sessions && 'unavailable' in sessions && (sessions.unavailable === 'old' || sessions.unavailable === 'error' || (sessions.unavailable === 'absent' && runtime?.viaSwitchboard)) && (
        <p className="console-row console-line meta muted">{sessions.unavailable === 'old' ? t('console.sb.old') : sessions.unavailable === 'absent' ? t('console.sb.absent') : t('console.sb.error', { detail: sessions.detail })}</p>
      )}
      {notice && <div className={`console-state notice${notice.terminalOnly || notice.info ? '' : ' error'}`} role={notice.info ? 'status' : 'alert'}>
        <p>{notice.text}</p>
        {notice.terminalOnly && <button className="btn btn-primary" onClick={() => void openTerminal('new')}>{t('console.openTerminalSb')}</button>}
      </div>}
      {ownHandover && info?.session.state === 'exited' && <p className="console-actions meta" role="status">{info.session.signal ? t('console.stopped') : info.session.exitCode === null ? t('console.ended') : t('console.exited', { code: info.session.exitCode })}</p>}
      {/* FD-74: one compact row: the session buttons on the left, Terminal as an icon on the right. */}
      {info && !ownHandover && runtime && folderOk && !running && (
        <div className="console-actions">
          {terminalOnly
            ? <button className="btn btn-sm btn-primary" onClick={() => void openTerminal('new')} title={t('console.openTerminalSb')} aria-label={t('console.openTerminalSb')}>{t('console.openTerminalSb.short')}</button>
            : <>
                <button className="btn btn-sm btn-primary" disabled={starting} onClick={() => void start('new')}>{starting ? <Spinner /> : null}{t('console.new')}</button>
                {runtime.canContinue && <button className="btn btn-sm" disabled={starting} onClick={() => void start('continue')}>{t('console.continue')}</button>}
                {info.session.state === 'exited' && <span className="meta console-exit" role="status">{info.session.signal ? t('console.stopped') : info.session.exitCode === null ? t('console.ended') : t('console.exited', { code: info.session.exitCode })}</span>}
                <span className="spacer" />
                {/* Review R-8: through Switchboard, Terminal opens a new session on the project's account. */}
                {bound && runtime.viaSwitchboard
                  ? <button className="icon-btn" onClick={() => void openTerminal('new')} aria-label={t('console.openTerminalSb')} title={t('console.openTerminalSb')}><Icon name="external" /></button>
                  : <button className="icon-btn" onClick={() => void openTerminal(runtime.canContinue ? 'continue' : 'new')} aria-label={t('console.openTerminal')} title={t('console.openTerminal')}><Icon name="external" /></button>}
              </>}
          {terminalOnly && info.session.state === 'exited' && <span className="meta console-exit" role="status">{info.session.signal ? t('console.stopped') : info.session.exitCode === null ? t('console.ended') : t('console.exited', { code: info.session.exitCode })}</span>}
        </div>
      )}
      <div className="console-term" ref={host} onClick={() => term.current?.focus()} />
      <div className="console-edge" role="separator" aria-orientation="horizontal" aria-label={t('console.resize')} aria-valuemin={CONSOLE_HEIGHT.min} aria-valuemax={maxHeight} aria-valuenow={height} tabIndex={0} onPointerDown={drag} onKeyDown={nudge}><span className="console-grip" /></div>
      <div className="console-shadow" aria-hidden="true" />
    </section>
  );
}
