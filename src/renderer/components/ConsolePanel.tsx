// ADR-0017 (SCN-048…050): the agent console beside a service's dashboard. A real terminal (xterm.js)
// on the PTY the main process holds: the runtime's own interface, nothing of our own in between.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { ConsoleInfo, ConsoleStartResult } from '../../core/api';
import { CONSOLE_WIDTH } from '../../core/types';
import { api, Icon, Spinner, useT } from '../lib';

interface Props {
  serviceKey: string;
  width: number;
  onWidth: (width: number, commit: boolean) => void;
  onHide: () => void;
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

export function ConsolePanel({ serviceKey, width, onWidth, onHide }: Props) {
  const { t } = useT();
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  /** How far into the session's output the terminal shows: events and snapshots meet here. */
  const shown = useRef(0);
  const [info, setInfo] = useState<ConsoleInfo | null>(null);
  const [notice, setNotice] = useState<{ text: string; terminalOnly?: boolean } | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [starting, setStarting] = useState(false);

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
    const x = new Terminal({ fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--pc-font-data').trim() || 'ui-monospace, Menlo, monospace', fontSize: 12.5, cursorBlink: true, scrollback: 5000, theme: themeOf(), allowProposedApi: false });
    const f = new FitAddon();
    x.loadAddon(f);
    term.current = x;
    fit.current = f;
    if (host.current) x.open(host.current);
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
    setConfirmStop(false);
    void refresh();
    return () => { off(); typed.dispose(); sized.dispose(); observer.disconnect(); document.removeEventListener('visibilitychange', onVisible); x.dispose(); term.current = null; };
  }, [serviceKey, refresh]);

  const say = (r: ConsoleStartResult) => {
    if (r.ok) { setNotice(null); return; }
    const detail = r.detail ?? '';
    if (r.reason === 'terminal-only') setNotice({ text: t('console.terminalOnly', { name: r.project ?? '' }), terminalOnly: true });
    else if (r.reason === 'switchboard') setNotice({ text: t('console.sbError', { detail }) });
    else if (r.reason === 'spawn') setNotice({ text: t('console.spawnError', { detail }) });
    else if (r.reason === 'running') setNotice({ text: t('console.running') });
    else if (r.reason === 'no-continue') setNotice({ text: detail });
    else setNotice(null); // no-runtime, no-folder: the panel's own state says it
  };

  const start = async (mode: 'new' | 'continue') => {
    setStarting(true);
    try {
      const x = term.current;
      try { fit.current?.fit(); } catch { /* not laid out */ }
      x?.write('\x1bc');
      shown.current = 0; // a new session counts from its own first character
      say(await api().consoleStart(serviceKey, mode, { cols: x?.cols ?? 80, rows: x?.rows ?? 24 }));
      x?.focus();
    } catch (error) {
      setNotice({ text: t('console.spawnError', { detail: String((error as Error)?.message ?? error) }) });
    } finally {
      setStarting(false);
      void refresh();
    }
  };
  const openTerminal = async (mode: 'new' | 'continue') => {
    const r = await api().consoleOpenTerminal(serviceKey, mode).catch((e: unknown) => ({ ok: false, error: String((e as Error)?.message ?? e) }));
    if (!r.ok) setNotice({ text: t('console.terminalFailed', { detail: r.error ?? '' }) });
  };

  // The left edge drags the width; the shell keeps it between the bounds and remembers it on release.
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const startX = e.clientX;
    const startW = width;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => onWidth(startW + (startX - m.clientX), false);
    const up = (u: PointerEvent) => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); onWidth(startW + (startX - u.clientX), true); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  const nudge = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') onWidth(width + 24, true);
    if (e.key === 'ArrowRight') onWidth(width - 24, true);
  };

  const running = info?.session.state === 'running';
  const runtime = info?.runtimes.find((r) => r.id === info.runtime) ?? null;
  const bound = info?.binding.kind === 'project' ? info.binding : null;
  const terminalOnly = Boolean(bound && runtime?.viaSwitchboard && !bound.inPlace);
  const folderOk = Boolean(info?.folder?.exists);

  return (
    <aside className="console-panel" style={{ width }} aria-label={t('console.title')}>
      <div className="console-edge" role="separator" aria-orientation="vertical" aria-label={t('console.resize')} aria-valuemin={CONSOLE_WIDTH.min} aria-valuemax={CONSOLE_WIDTH.max} aria-valuenow={width} tabIndex={0} onPointerDown={drag} onKeyDown={nudge} />
      <div className="console-head">
        <div className="console-row">
          <label className="visually-hidden" htmlFor="console-runtime">{t('console.runtime')}</label>
          <select id="console-runtime" value={info?.runtime ?? ''} disabled={!info?.runtimes.length || running} onChange={(e) => void api().consoleChoose(serviceKey, { runtime: e.target.value }).then((i) => { setInfo(i); setNotice(null); })}>
            {info?.runtimes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <span className="spacer" />
          {running && !confirmStop && <button className="btn btn-sm" onClick={() => setConfirmStop(true)}>{t('console.stop')}</button>}
          {running && confirmStop && (
            <span className="row" role="group" aria-label={t('console.stopConfirm')}>
              <span className="meta">{t('console.stopConfirm')}</span>
              <button className="btn btn-sm btn-danger" onClick={() => { setConfirmStop(false); void api().consoleStop(serviceKey); }}>{t('console.stop')}</button>
              <button className="btn btn-sm" autoFocus onClick={() => setConfirmStop(false)}>{t('action.cancel')}</button>
            </span>
          )}
          <button className="icon-btn" title={t('console.hide')} onClick={onHide}><Icon name="close" /><span className="visually-hidden">{t('console.hide')}</span></button>
        </div>
        <div className="console-row meta">
          {info?.folder
            ? <span className="console-folder" title={`${info.folder.path}${info.folder.source === 'found' ? ` — ${t('console.foundFrom')}` : ''}`}>{shortPath(info.folder.path)}</span>
            : <span className="console-folder muted">{t('console.folder')}: —</span>}
          <button className="btn btn-sm" disabled={running} onClick={() => void api().consolePickFolder(serviceKey).then((i) => { setInfo(i); setNotice(null); })}>{info?.folder ? t('console.other') : t('console.chooseFolder')}</button>
          {bound && <span className="chip" title={t('console.project', { name: bound.name })}>{t('console.project', { name: bound.name })}</span>}
        </div>
      </div>
      {!info && <p className="console-state muted row" role="status"><Spinner /> {t('console.loading')}</p>}
      {info && !info.runtimes.length && <p className="console-state notice">{t('console.noRuntime', { list: 'claude, codex, gemini, opencode, qwen, goose, aider, agent, copilot, amp' })}</p>}
      {info && info.runtimes.length > 0 && !folderOk && (
        <div className="console-state notice">
          <p>{info.folder && !info.folder.exists ? t('console.folderGone', { path: info.folder.path }) : t('console.noFolder')}</p>
          <button className="btn" onClick={() => void api().consolePickFolder(serviceKey).then(setInfo)}>{t('console.chooseFolder')}</button>
        </div>
      )}
      {info?.binding.kind === 'error' && <p className="console-state notice error" role="alert">{t('console.sbError', { detail: info.binding.detail })}</p>}
      {notice && <div className={`console-state notice${notice.terminalOnly ? '' : ' error'}`} role="alert">
        <p>{notice.text}</p>
        {notice.terminalOnly && <button className="btn btn-primary" onClick={() => void openTerminal('new')}>{t('console.openTerminalSb')}</button>}
      </div>}
      {info && runtime && folderOk && !running && (
        <div className="console-actions row">
          {terminalOnly
            ? <button className="btn btn-primary" onClick={() => void openTerminal('new')}>{t('console.openTerminalSb')}</button>
            : <>
                <button className="btn btn-primary" disabled={starting} onClick={() => void start('new')}>{t('console.new')}</button>
                {runtime.canContinue && <button className="btn" disabled={starting} onClick={() => void start('continue')}>{t('console.continue')}</button>}
                {/* Review R-8: through Switchboard, Terminal opens a new session on the project's account. */}
                {bound && runtime.viaSwitchboard
                  ? <button className="btn" onClick={() => void openTerminal('new')}>{t('console.openTerminalSb')}</button>
                  : <button className="btn" onClick={() => void openTerminal(runtime.canContinue ? 'continue' : 'new')}>{t('console.openTerminal')}</button>}
              </>}
          {info.session.state === 'exited' && <span className="meta" role="status">{info.session.signal ? t('console.stopped') : info.session.exitCode === null ? t('console.ended') : t('console.exited', { code: info.session.exitCode })}</span>}
        </div>
      )}
      <div className="console-term" ref={host} onClick={() => term.current?.focus()} />
    </aside>
  );
}
