// #region new-session-dialog — docs: docs/ux/scenarios.md#scn-101-start-a-new-session-in-a-folder
// FD-191 (SCN-101, SCN-102): New session in the Sessions mode and New agent in the agent list. The person picks the
// coding agent, the folder (the system picker only, operator rule 2026-10-09), whether it runs without permission
// prompts and whether it runs isolated; Start opens the session's page, where its console runs.
import { useEffect, useRef, useState } from 'react';
import type { MachineFolders, NewSessionOptions, NewSessionResult } from '../../core/api';
import { api, Spinner, useT } from '../lib';
import { shortPath } from './Sessions';

type T = (key: string, params?: Record<string, string | number>) => string;

/** Why the isolated box cannot be ticked for this coding agent, as the dialog says it; null when it can. */
export function isolatedWhy(o: Pick<NewSessionOptions, 'switchboard' | 'inPlace'>, provider: 'claude' | 'codex' | null): 'no-switchboard' | 'old-switchboard' | 'provider' | null {
  if (!o.switchboard) return 'no-switchboard';
  if (!o.inPlace) return 'old-switchboard';
  return provider ? null : 'provider';
}

/** What a refused start says, in one sentence. */
export function newSessionFailText(t: T, r: Extract<NewSessionResult, { ok: false }>): string {
  if (r.reason === 'admission') return r.why === 'disk' ? t('console.admission.disk', { free: r.freeGb ?? 0 }) : r.why === 'cap' ? t('console.admission.cap', { cap: r.cap ?? 0 }) : t('console.admission.swap');
  if (r.reason === 'no-folder') return t('newSession.failed.noFolder');
  if (r.reason === 'no-runtime') return t('newSession.failed.noRuntime');
  if (r.reason === 'isolated') return t(`newSession.isolated.${r.detail === 'old-switchboard' || r.detail === 'provider' ? r.detail : 'no-switchboard'}`);
  if (r.reason === 'switchboard') return t('console.sbError', { detail: r.detail ?? '' });
  if (r.reason === 'spawn') return t('console.spawnError', { detail: r.detail ?? '' });
  // FD-206: a session on another machine refused before it started.
  if (r.reason === 'remote' && ['provider', 'old-switchboard', 'no-switchboard', 'unknown-machine'].includes(r.detail ?? '')) return t(`newSession.remote.${r.detail}`);
  return t('newSession.failed');
}

export function NewSessionDialog({ kind, onClose, onStarted }: { kind: 'session' | 'agent'; onClose: () => void; onStarted: (key: string) => void }) {
  const { t } = useT();
  const [options, setOptions] = useState<NewSessionOptions | null>(null);
  const [runtime, setRuntime] = useState<string | null>(null);
  const [folder, setFolder] = useState('');
  const [bypass, setBypass] = useState(true);
  const [isolated, setIsolated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // FD-206: '' is this computer; another machine's folder is chosen from what that machine has.
  const [machine, setMachine] = useState('');
  const [remoteFolder, setRemoteFolder] = useState('');
  const [there, setThere] = useState<MachineFolders | 'loading' | null>(null);
  const first = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    let live = true;
    void api().newSessionOptions().then((o) => {
      if (!live) return;
      setOptions(o);
      setRuntime(o.runtime);
      setFolder(o.folder);
      setBypass(o.bypass);
      setIsolated(o.isolated);
      if (o.machine) { setMachine(o.machine); setRemoteFolder(o.remoteFolder ?? ''); }
    }).catch((e: Error) => { if (live) setError(t('newSession.failed.read', { detail: e.message })); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (options) first.current?.focus(); }, [options]);
  useEffect(() => {
    if (!machine) { setThere(null); return; }
    let live = true;
    setThere('loading');
    void api().newSessionMachineFolders(machine).then((f) => {
      if (!live) return;
      setThere(f);
      // The last folder there stays chosen while the machine still has it; else its first project, else its home.
      if (f.ok) setRemoteFolder((cur) => (cur && (cur === f.home || f.folders.includes(cur)) ? cur : f.folders[0] ?? f.home));
    }).catch(() => { if (live) setThere({ ok: false, why: 'unreachable' }); });
    return () => { live = false; };
  }, [machine]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  // FD-206: on another machine only the coding agents its Switchboard starts.
  const runtimes = options ? (machine ? options.runtimes.filter((r) => r.provider) : options.runtimes) : [];
  const chosen = runtimes.find((r) => r.id === runtime) ?? (machine ? runtimes[0] ?? null : null);
  const target = machine ? (there && there !== 'loading' && there.ok ? remoteFolder : '') : folder;
  const why = options ? isolatedWhy(options, chosen?.provider ?? null) : 'no-switchboard';
  const canBypass = Boolean(chosen?.bypass);
  const pick = async () => {
    const p = await api().newSessionPickFolder(folder).catch(() => null);
    if (p) { setFolder(p); setError(null); }
  };
  const start = async () => {
    if (!chosen || !target) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api().newSessionStart({ kind, runtime: chosen.id, folder: target, bypass: canBypass && bypass, isolated: !why && isolated, ...(machine ? { machine } : {}) }, { cols: 100, rows: 30 });
      if (r.ok) { onStarted(r.key); return; }
      setError(newSessionFailText(t, r));
    } catch (e) {
      setError(newSessionFailText(t, { ok: false, reason: 'spawn', detail: String((e as Error)?.message ?? e) }));
    } finally {
      setBusy(false);
    }
  };
  const title = kind === 'agent' ? t('newAgent.title') : t('newSession.title');
  return (
    <div className="scrim" role="presentation">
      <form className="dialog new-session" role="dialog" aria-modal="true" aria-labelledby="new-session-title" aria-describedby="new-session-lead"
        onSubmit={(e) => { e.preventDefault(); if (!busy) void start(); }}>
        <h2 id="new-session-title">{title}</h2>
        <p id="new-session-lead" className="meta">{kind === 'agent' ? t('newAgent.lead') : t('newSession.lead')}</p>
        {!options && !error && <p className="muted row" role="status"><Spinner /> {t('console.loading')}</p>}
        {options && options.runtimes.length === 0 && <p className="notice" role="status">{t('console.noRuntime', { list: 'claude, codex, gemini, opencode, qwen, goose, aider, agent, copilot, amp' })}</p>}
        {options && options.runtimes.length > 0 && (
          <>
            <fieldset className="new-session-field">
              <legend>{t('newSession.runtime')}</legend>
              <div className="new-session-runtimes" role="radiogroup" aria-label={t('newSession.runtime')}>
                {runtimes.map((r, i) => (
                  <label key={r.id} className={`choice${r.id === chosen?.id ? ' chosen' : ''}`}>
                    <input type="radio" name="new-session-runtime" ref={i === 0 ? first : undefined} value={r.id} checked={r.id === chosen?.id} disabled={busy} onChange={() => setRuntime(r.id)} />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {options.machines.length > 0 && (
              <div className="new-session-field">
                <label className="new-session-label" htmlFor="new-session-machine">{t('newSession.machine')}</label>
                <select id="new-session-machine" value={machine} disabled={busy} aria-describedby={machine ? 'new-session-machine-hint' : undefined} onChange={(e) => { setMachine(e.target.value); setError(null); }}>
                  <option value="">{t('newSession.machine.here')}</option>
                  {options.machines.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {machine && <p id="new-session-machine-hint" className="meta new-session-hint">{t('newSession.machine.hint', { machine })}</p>}
              </div>
            )}
            <div className="new-session-field">
              {machine
                ? <>
                  <label className="new-session-label" htmlFor="new-session-remote-folder">{t('newSession.folder')}</label>
                  {there === 'loading' && <p className="muted row" role="status"><Spinner /> {t('newSession.machine.loading', { machine })}</p>}
                  {there && there !== 'loading' && !there.ok && <p className="notice" role="status">{t(there.why === 'unknown-machine' ? 'newSession.remote.unknown-machine' : 'newSession.machine.unreachable', { machine })}</p>}
                  {there && there !== 'loading' && there.ok && <>
                    <select id="new-session-remote-folder" className="mono" value={remoteFolder} disabled={busy} onChange={(e) => setRemoteFolder(e.target.value)}>
                      {there.folders.map((f) => <option key={f} value={f}>{shortPath(f.startsWith(`${there.home}/`) ? `~${f.slice(there.home.length)}` : f)}</option>)}
                      <option value={there.home}>{t('newSession.machine.home')}</option>
                    </select>
                    {there.folders.length === 0 && <p className="meta new-session-hint">{t('newSession.machine.noFolders', { machine })}</p>}
                  </>}
                </>
                : <>
                  <span className="new-session-label" id="new-session-folder-label">{t('newSession.folder')}</span>
                  <div className="row new-session-folder">
                    <span className="mono" title={folder} aria-labelledby="new-session-folder-label">{shortPath(folder)}</span>
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void pick()}>{t('newSession.change')}</button>
                  </div>
                </>}
            </div>
            <label className="check new-session-check">
              <input type="checkbox" checked={canBypass && bypass} disabled={busy || !canBypass} aria-describedby="new-session-bypass-hint" onChange={(e) => setBypass(e.target.checked)} />
              <span>{t('newSession.bypass')}</span>
            </label>
            <p id="new-session-bypass-hint" className="meta new-session-hint">{canBypass ? t('newSession.bypass.hint') : t('newSession.bypass.none', { agent: chosen?.name ?? '' })}</p>
            <label className="check new-session-check">
              <input type="checkbox" checked={!why && isolated} disabled={busy || Boolean(why)} aria-describedby="new-session-isolated-hint" onChange={(e) => setIsolated(e.target.checked)} />
              <span>{t('newSession.isolated')}</span>
            </label>
            <p id="new-session-isolated-hint" className="meta new-session-hint">{why ? t(`newSession.isolated.${why}`) : t('newSession.isolated.hint')}</p>
          </>
        )}
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="row">
          {busy && <span className="meta row"><Spinner /> {t('newSession.starting')}</span>}
          <button type="button" className="btn" disabled={busy} onClick={onClose}>{t('action.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !chosen || !target}>{kind === 'agent' ? t('newAgent.start') : t('newSession.start')}</button>
        </div>
      </form>
    </div>
  );
}
// #endregion new-session-dialog
