import { SetupCheck } from './Overview';
import { useEffect, useRef, useState } from 'react';
import type { AppStatus, Listener, Settings as SettingsValue } from '../../core/types';
import { api, nameOf, Spinner, useT } from '../lib';
import { REFERENCE_THEMES } from '../../core/appearance';
import { revealScrollTop } from '../../core/layout';
import { productIdOf } from '../../core/products';

export function Settings({ status, onTheme, onLanguage, onSetup, section, nonce }: { status: AppStatus; onTheme: (theme: SettingsValue['theme']) => void; onLanguage: () => void;
  /** FD-39 SCN-058: the Setup console stays reachable after the card is hidden. */
  onSetup?: () => void;
  /** FD-103 (SCN-079): "Choose where sessions continue" opens Settings on its Sessions section. */
  section?: 'sessions'; nonce?: number }) {
  const { t, time } = useT();
  const [value, setValue] = useState<SettingsValue | null>(null);
  const [error, setError] = useState('');
  const [listeners, setListeners] = useState<{ listeners: Listener[]; error?: string } | null>(null);
  const [uninstallError, setUninstallError] = useState('');
  const [pathError, setPathError] = useState('');

  // FD-103 (SCN-086): Switchboard's own switch for handing sessions over here, read and written through its CLI.
  const [handovers, setHandovers] = useState<{ available: boolean; enabled: boolean | null } | null>(null);
  const [handoverError, setHandoverError] = useState('');
  useEffect(() => {
    void api().settings().then(setValue);
    void api().listeners().then(setListeners);
    void api().sessionsHandovers().then(setHandovers).catch(() => setHandovers({ available: false, enabled: null }));
  }, []);
  const sessionsRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (section !== 'sessions' || !value) return;
    // FD-107: scrolled only as far as needed to show the whole section, never past its heading, so when it fits under
    // the page title the title stays in view (scrollIntoView start put the section at the window's edge, title gone).
    const el = sessionsRef.current;
    const box = el?.closest<HTMLElement>('.page');
    if (el && box) {
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      box.scrollTop = revealScrollTop({ scrollTop: box.scrollTop, height: box.clientHeight }, { top, height: el.offsetHeight }, 16);
    }
    el?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, [section, nonce, Boolean(value)]);
  const flipHandovers = async (on: boolean) => {
    setHandoverError('');
    const r = await api().setSessionsHandovers(on).catch((e: unknown) => ({ ok: false, enabled: handovers?.enabled ?? null, detail: String((e as Error)?.message ?? e) }));
    setHandovers((h) => ({ available: h?.available ?? true, enabled: r.enabled }));
    if (!r.ok) setHandoverError(t('settings.handovers.refused', { reason: r.detail ?? '' }));
  };

  if (!value) return <p className="row muted" role="status"><Spinner /> {t('app.loading')}</p>;
  const save = async (patch: Partial<SettingsValue>) => {
    const r = await api().updateSettings(patch);
    setValue(r.settings);
    setError(r.error ? t('settings.loginItemRefused', { error: r.error }) : '');
    if (patch.theme) onTheme(patch.theme);
    if (patch.language) onLanguage();
  };
  const n = value.notifications;
  const setN = (patch: Partial<SettingsValue['notifications']>) => void save({ notifications: { ...n, ...patch } });
  const paused = n.pausedUntil && new Date(n.pausedUntil) > new Date();

  return (
    <div className="settings">
      {/* UX-20 (FD-129): a page of nine groups gets an index; each entry brings its group into view. */}
      <nav className="settings-index" aria-label={t('settings.index')}>
        {SECTIONS.filter((x) => x.id !== 'g-setup' || onSetup).map((x) => (
          <button key={x.id} type="button" className="btn-link btn" onClick={() => { const h = document.getElementById(x.id); h?.scrollIntoView({ block: 'start' }); h?.setAttribute('tabindex', '-1'); h?.focus({ preventScroll: true }); }}>{x.id === 'g-app' ? t('app.name') : t(x.label)}</button>
        ))}
      </nav>
      <section className="group" aria-labelledby="g-app">
        <h2 id="g-app">{t('app.name')}</h2>
        <label className="setting">{t('settings.launchAtLogin')}
          <input type="checkbox" role="switch" className="switch" checked={value.launchAtLogin} onChange={(e) => void save({ launchAtLogin: e.target.checked })} />
        </label>
        {error && <p className="notice error" role="alert">{error}</p>}
        <label className="setting">{t('settings.theme')}
          <select value={value.theme} onChange={(e) => void save({ theme: e.target.value as SettingsValue['theme'] })}>
            <option value="system">{t('settings.theme.system')}</option>
            <option value="dark">{t('settings.theme.dark')}</option>
            <option value="light">{t('settings.theme.light')}</option>
          </select>
        </label>
        {/* FD-42 (ED-8, ED-10): the theme dashboards are asked to use, carried with the scheme above. */}
        <label className="setting">{t('settings.pageTheme')}
          <select value={value.pageTheme} onChange={(e) => void save({ pageTheme: e.target.value })}>
            {REFERENCE_THEMES.map((id) => <option key={id} value={id}>{t(`settings.pageTheme.${id}`)}</option>)}
          </select>
        </label>
        <p className="meta">{t('settings.pageTheme.hint')}</p>
        <label className="setting">{t('settings.language')}
          <select value={value.language} onChange={(e) => void save({ language: e.target.value as SettingsValue['language'] })}>
            <option value="system">{t('settings.language.system')}</option>
            <option value="en" lang="en">English</option>
            <option value="ru" lang="ru">Русский</option>
          </select>
        </label>
        <p className="meta">v{status.version}</p>
      </section>

      {/* #region sessions-settings — docs: docs/ux/scenarios.md#scn-086-settings-sessions */}
      <section className="group" aria-labelledby="g-sessions" ref={sessionsRef}>
        <h2 id="g-sessions" tabIndex={-1}>{t('settings.sessions')}</h2>
        <label className="setting">{t('settings.handovers')}
          <input type="checkbox" role="switch" className="switch" aria-describedby="handovers-body" checked={handovers?.enabled === true}
            disabled={!handovers || !handovers.available || handovers.enabled === null} onChange={(e) => void flipHandovers(e.target.checked)} />
        </label>
        <p className="meta" id="handovers-body">{t('settings.handovers.body')}</p>
        {handovers && !handovers.available && <p className="meta" role="status">{t('settings.handovers.absent')}</p>}
        {handovers?.available && handovers.enabled === null && <p className="meta" role="status">{t('settings.handovers.old')}</p>}
        {handoverError && <p className="notice error" role="alert">{handoverError}</p>}
        <label className="setting">{t('settings.resumeAfterLimit')}
          <input type="checkbox" role="switch" className="switch" aria-describedby="resume-body" checked={value.resumeAfterLimit} onChange={(e) => void save({ resumeAfterLimit: e.target.checked })} />
        </label>
        <p className="meta" id="resume-body">{t('settings.resumeAfterLimit.body')}</p>
      </section>
      {/* #endregion sessions-settings */}
      <section className="group" aria-labelledby="g-updates">
        <h2 id="g-updates">{t('settings.updates')}</h2>
        <label className="setting">{t('settings.autoUpdate')}
          <input type="checkbox" role="switch" className="switch" checked={value.autoUpdate} onChange={(e) => void save({ autoUpdate: e.target.checked })} />
        </label>
        {/* U-11: the explanation and the state read as one note under the switch. */}
        <div className="setting-note">
          <p className="meta">{t('settings.autoUpdate.body')}</p>
          <UpdateState status={status} />
        </div>
      </section>

      {/* #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision */}
      <section className="group" aria-labelledby="g-estate">
        <h2 id="g-estate">{t('settings.estate')}</h2>
        <label className="setting">{t('settings.estate.enabled')}
          <input type="checkbox" role="switch" className="switch" checked={value.estate.enabled} onChange={(e) => void save({ estate: { ...value.estate, enabled: e.target.checked } })} />
        </label>
        <p className="meta">{t('settings.estate.enabled.body')}</p>
        <label className="setting">{t('settings.estate.autoSkills')}
          <input type="checkbox" role="switch" className="switch" checked={value.estate.autoSkills} onChange={(e) => void save({ estate: { ...value.estate, autoSkills: e.target.checked } })} />
        </label>
        <p className="meta">{t('settings.estate.autoSkills.body')}</p>
        <label className="setting">{t('settings.estate.contractClone')}
          <ClonePath value={value.estate.contractClone} onSave={(contractClone) => void save({ estate: { ...value.estate, contractClone } })} />
        </label>
        <p className="meta">{t('settings.estate.contractClone.body')}</p>
        <EstateState status={status} />
      </section>
      {/* #endregion estate-update */}

      <section className="group" aria-labelledby="g-notify">
        <h2 id="g-notify">{t('settings.notifications')}</h2>
        {/* U-10: Electron cannot read macOS's notification permission, so the app never claims it is
            off; the way to check is always one click away. */}
        <p className="meta row">{t('settings.notifications.system')} <button className="btn-link btn" onClick={() => void api().openNotificationSettings()}>{t('settings.notifications.openSystem')}</button></p>
        <label className="setting">{t('settings.notifications.enabled')}
          <input type="checkbox" role="switch" className="switch" checked={n.enabled} onChange={(e) => setN({ enabled: e.target.checked })} />
        </label>
        <div className="setting">
          <span>{t('settings.quiet')}</span>
          <span className="row">
            <input type="checkbox" role="switch" className="switch" aria-label={t('settings.quiet')} checked={n.quietHours.enabled} onChange={(e) => setN({ quietHours: { ...n.quietHours, enabled: e.target.checked } })} />
            <span className="meta">{t('settings.quiet.from')}</span>
            <input type="time" aria-label={t('settings.quiet.from')} value={n.quietHours.from} onChange={(e) => setN({ quietHours: { ...n.quietHours, from: e.target.value } })} />
            <span className="meta">{t('settings.quiet.to')}</span>
            <input type="time" aria-label={t('settings.quiet.to')} value={n.quietHours.to} onChange={(e) => setN({ quietHours: { ...n.quietHours, to: e.target.value } })} />
          </span>
        </div>
        <div className="setting">
          <span>{paused ? t('settings.paused', { time: time(n.pausedUntil!) }) : t('settings.pause')}</span>
          {paused
            ? <button className="btn" onClick={() => setN({ pausedUntil: null })}>{t('settings.resume')}</button>
            : <button className="btn" onClick={() => setN({ pausedUntil: new Date(Date.now() + 3600_000).toISOString() })}>{t('settings.pause')}</button>}
        </div>
        <AlertChannel status={status} choice={n.channel} onChoose={(channel) => setN({ channel })} />
        {(() => {
          // UX-20 (FD-129): agents the person hid from the sidebar fold here too; they still alert, so they stay listed.
          const hiddenIds = new Set(value.layout.list.hidden);
          const shown = status.services.filter((s) => !hiddenIds.has(productIdOf(s.key)));
          const folded = status.services.filter((s) => hiddenIds.has(productIdOf(s.key)));
          const table = (rows: typeof status.services) => (
          <table>
            <thead><tr><th>{t('settings.perService')}</th><th>{t('settings.notifications.enabled')}</th><th>{t('settings.minLevel')}</th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const per = n.perService[s.key] ?? { enabled: true, minLevel: 'notice' as const };
                const set = (p: Partial<typeof per>) => setN({ perService: { ...n.perService, [s.key]: { ...per, ...p } } });
                return (
                  <tr key={s.key}>
                    <td>{nameOf(s)}</td>
                    <td><input type="checkbox" role="switch" className="switch" aria-label={`${nameOf(s)}: ${t('settings.notifications.enabled')}`} checked={per.enabled} onChange={(e) => set({ enabled: e.target.checked })} /></td>
                    <td>
                      <select aria-label={`${nameOf(s)}: ${t('settings.minLevel')}`} value={per.minLevel} onChange={(e) => set({ minLevel: e.target.value as 'notice' | 'warning' | 'error' })}>
                        <option value="notice">{t('level.notice')}</option>
                        <option value="warning">{t('level.warning')}</option>
                        <option value="error">{t('level.error')}</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          );
          return (
            <>
              {shown.length > 0 && table(shown)}
              {folded.length > 0 && <details className="settings-hidden"><summary>{t('nav.hidden', { count: folded.length })}</summary>{table(folded)}</details>}
            </>
          );
        })()}
      </section>

      <section className="group" aria-labelledby="g-folder">
        <h2 id="g-folder">{t('settings.folder')}</h2>
        <p className="mono">{status.servicesDir}</p>
        <div><button className="btn" onClick={() => void api().showPath(status.servicesDir).then((r) => setPathError(r.ok ? '' : t('overview.showFailed', { path: status.servicesDir, error: r.error ?? '' })))}>{t('overview.empty.show')}</button></div>
        {pathError && <p className="notice error" role="alert">{pathError}</p>}
      </section>

      {onSetup && (
        <section className="group" aria-labelledby="g-setup">
          <h2 id="g-setup">{t('settings.setup')}</h2>
          <p className="meta">{t('settings.setup.body')}</p>
          <div><button className="btn" onClick={onSetup}>{t('setup.agent.start')}</button></div>
          <SetupCheck onRepair={onSetup} />
        </section>
      )}

      <section className="group" aria-labelledby="g-listeners">
        <h2 id="g-listeners">{t('settings.listeners')}</h2>
        <p className="meta">{t('settings.listeners.body')}</p>
        {!listeners && <p className="row muted" role="status"><Spinner /> {t('app.loading')}</p>}
        {listeners?.error && <p className="notice error">{t('settings.listeners.error', { error: listeners.error })}</p>}
        {listeners && !listeners.error && listeners.listeners.length === 0 && <p className="state state-ready">{t('settings.listeners.none')}</p>}
        {listeners && listeners.listeners.length > 0 && (
          <table>
            <thead><tr><th>{t('listeners.port')}</th><th>{t('listeners.address')}</th><th>{t('listeners.program')}</th><th>{t('listeners.pid')}</th></tr></thead>
            <tbody>{listeners.listeners.map((l) => <tr key={`${l.pid}-${l.port}-${l.address}`}><td className="mono">{l.port}</td><td className="mono">{l.address}</td><td>{l.command}</td><td className="mono">{l.pid}</td></tr>)}</tbody>
          </table>
        )}
        <div><button className="btn" onClick={() => { setListeners(null); void api().listeners().then(setListeners); }}>{t('settings.listeners.scan')}</button></div>
      </section>

      {/* VIS-21 (FD-129): the one destructive group comes last. */}
      <section className="group" aria-labelledby="g-uninstall">
        <h2 id="g-uninstall">{t('settings.uninstall')}</h2>
        <p className="meta">{t('settings.uninstall.body')}</p>
        {uninstallError && <p className="notice error" role="alert">{uninstallError}</p>}
        <div><button className="btn btn-danger" onClick={() => void api().uninstall().then((r) => setUninstallError(r.ok || r.cancelled ? '' : r.error ?? ''))}>{t('settings.uninstall.action')}</button></div>
      </section>
    </div>
  );
}

/** UX-20: the index's entries, in the page's order; their labels are the groups' own headings. */
const SECTIONS = [
  { id: 'g-app', label: 'app.name' },
  { id: 'g-sessions', label: 'settings.sessions' },
  { id: 'g-updates', label: 'settings.updates' },
  { id: 'g-estate', label: 'settings.estate' },
  { id: 'g-notify', label: 'settings.notifications' },
  { id: 'g-folder', label: 'settings.folder' },
  { id: 'g-setup', label: 'settings.setup' },
  { id: 'g-listeners', label: 'settings.listeners' },
  { id: 'g-uninstall', label: 'settings.uninstall' },
] as const;

/** Where the self-update stands, with the one action that state needs (ADR-0015). */
function UpdateState({ status }: { status: AppStatus }) {
  const { t, time } = useT();
  const u = status.update;
  if (u.state === 'unsupported') return <p className="meta">{t('update.unsupported')}</p>;
  // FD-37 M4 (PL-04): a .deb copy never checks; a Windows copy does not update itself until M4c.
  if (u.state === 'package') return <p className="meta">{t('update.package')}</p>;
  if (u.state === 'notyet') return <p className="meta">{t('update.notYet')}</p>;
  if (u.state === 'misplaced') return <p className="notice warning">{t('update.misplaced')} <button className="btn" onClick={() => void api().moveToApplications()}>{t('move.confirm')}</button></p>;
  if (u.state === 'held') return <div className="row"><span className="meta">{t('update.held', { version: u.version ?? '' })}</span>{u.steps && <button className="btn" onClick={() => void api().openUpdateSteps()}>{t('update.steps')}</button>}<button className="btn btn-primary" onClick={() => void api().restartToUpdate()}>{t('update.installNow')}</button></div>;
  if (u.state === 'ready') return <div className="row"><span className="meta">{(u.version ? t('update.ready', { version: u.version }) : t('update.readyUnnamed'))}</span><button className="btn btn-primary" onClick={() => void api().restartToUpdate()}>{t('update.restart')}</button></div>;
  if (u.state === 'checking' || u.state === 'downloading') return <p className="meta row"><Spinner /> {t(`update.${u.state}`)}</p>;
  return (
    <div className="row">
      <span className={u.state === 'error' ? 'meta state-down' : 'meta'}>{u.state === 'error' ? t('update.error', { error: u.error ?? '' }) : u.checkedAt ? t('update.idle', { time: time(u.checkedAt) }) : t('update.notChecked')}</span>
      <button className="btn" onClick={() => void api().checkForUpdates()}>{t('settings.updates.check')}</button>
    </div>
  );
}

// #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
/** The clone path is typed locally and committed on blur or Enter, so settings.json is not
 *  rewritten on every keystroke; the person's spelling is kept while they type. */
function ClonePath({ value, onSave }: { value: string; onSave: (next: string) => void }) {
  const { t } = useT();
  const [text, setText] = useState(value);
  // The saved value is the truth: a save that was refused, or a change from another window, shows here
  // instead of the typed text staying on screen as if it had been kept (review finding 7).
  useEffect(() => { setText(value); }, [value]);
  const trimmed = text.trim();
  const invalid = trimmed !== '' && !trimmed.startsWith('/') && !trimmed.startsWith('~/');
  const commit = () => { if (!invalid && trimmed !== value) onSave(trimmed); };
  return (
    <>
      <input
        type="text"
        className="mono"
        value={text}
        placeholder="~/DATA/fabric-agent-contract"
        aria-invalid={invalid}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      {invalid && <span className="meta state-down" role="alert">{t('settings.estate.contractClone.invalid')}</span>}
    </>
  );
}

/** What the estate watcher saw last: the contract clone vs the remote, the consumer pins, the skills. */
function EstateState({ status }: { status: AppStatus }) {
  const { t, time } = useT();
  const e = status.estate;
  const short = (sha: string | null) => (sha ? sha.slice(0, 12) : '');
  const contractLine = () => {
    const c = e.contract;
    if (c.state === 'unconfigured') return <span className="meta">{t('estate.contract')}: {t('estate.contract.unconfigured')}</span>;
    if (c.state === 'missing') return <span className="meta state-down">{t('estate.contract')}: {t('estate.contract.missing')}</span>;
    if (c.state === 'not-a-clone') return <span className="meta state-down">{t('estate.contract')}: {t('estate.contract.notAClone')}</span>;
    const fetched = c.fetched === 'yes' ? ` · ${t('estate.contract.fetched')}` : c.fetched === 'failed' ? ` · ${t('estate.contract.fetchFailed')}` : '';
    // The clone's own main is reported, never moved: a pull stays the person's choice.
    const local = c.localTip && c.remoteTip && c.localTip !== c.remoteTip ? ` · ${t('estate.contract.localMain', { sha: short(c.localTip) })}` : '';
    if (c.state === 'current') return <span className="meta">{t('estate.contract')}: {t('estate.contract.current', { sha: short(c.remoteTip) })}{fetched}{local}</span>;
    if (c.state === 'behind') return <span className="meta note-info">{t('estate.contract')}: {t('estate.contract.behind', { local: short(c.knownTip ?? c.localTip), remote: short(c.remoteTip) })}{fetched}</span>;
    return <span className="meta state-down">{t('estate.contract')}: {t('estate.contract.unknown')}</span>;
  };
  const skillsLine = () => {
    const s = e.skills;
    if (s.state === 'updating') return <span className="meta">{t('estate.skills')}: {t('estate.skills.updating', { latest: s.latest ?? '?' })}</span>;
    if (s.state === 'current') return <span className="meta">{t('estate.skills')}: {t('estate.skills.current', { version: s.installed ?? '?' })}</span>;
    if (s.state === 'update-available') return <span className="meta note-info">{t('estate.skills')}: {t('estate.skills.behind', { installed: s.installed ?? '?', latest: s.latest ?? '?' })}</span>;
    // A failed probe is never shown as the harmless "not tracked yet" (review finding 5, SCN-051).
    if (s.state === 'absent') return <span className="meta">{t('estate.skills')}: {t('estate.skills.absent')}</span>;
    if (s.state === 'error') return <span className="meta state-down">{t('estate.skills')}: {t('estate.skills.error')}</span>;
    if (s.latest) return <span className="meta">{t('estate.skills')}: {t('estate.skills.untracked', { latest: s.latest })}</span>;
    return <span className="meta">{t('estate.skills')}: {t('estate.skills.unknown')}</span>;
  };
  return (
    <div className="setting-note">
      <p className="meta">{e.checkedAt ? t('estate.checked', { time: time(e.checkedAt) }) : t('estate.notChecked')}</p>
      <p className="meta">{contractLine()}</p>
      {e.pins.length > 0 && (
        <p className="meta">{t('estate.pins')}: {e.pins.map((p) => `${p.key}: ${p.pinned ? short(p.pinned) : t('estate.pin.unknown')}${p.state === 'behind' ? ` (${t('estate.pin.older')})` : ''}`).join(' · ')}</p>
      )}
      <p className="meta">{skillsLine()}</p>
    </div>
  );
}
// #endregion estate-update

// #region outage-alerts — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48
/** FD-48: where outages also go — automatic (the one agent offering a notify capability), off, or a chosen agent. */
function AlertChannel({ status, choice, onChoose }: { status: AppStatus; choice: string; onChoose: (channel: string) => void }) {
  const { t, time } = useT();
  const a = status.alerts;
  const name = (key: string) => { const s = status.services.find((x) => x.key === key); return s ? nameOf(s) : key; };
  const autoName = choice === 'auto' && a?.channel ? name(a.channel.key) : null;
  return (
    <div className="setting setting-stack">
      <label htmlFor="alert-channel">{t('settings.alerts.label')}</label>
      <select id="alert-channel" value={choice} onChange={(e) => onChoose(e.target.value)}>
        <option value="auto">{autoName ? t('settings.alerts.autoNamed', { name: autoName }) : t('settings.alerts.auto')}</option>
        {(a?.candidates ?? []).map((key) => <option key={key} value={key}>{name(key)}</option>)}
        {choice !== 'auto' && choice !== 'off' && !(a?.candidates ?? []).includes(choice) && <option value={choice}>{name(choice)}</option>}
        <option value="off">{t('settings.alerts.off')}</option>
      </select>
      <p className="meta">{t('settings.alerts.help')}</p>
      {/* Off, or nothing to send to, is a plain fact; a choice that is gone or does not answer needs the person. */}
      {a?.none && <p className={a.none === 'off' || a.none === 'none-installed' ? 'meta' : 'notice warning'} role="status">{t(`settings.alerts.none.${a.none}`)}</p>}
      {a?.last && <p className={a.last.ok ? 'meta' : 'meta state-down'} role="status">{a.last.ok ? t('settings.alerts.lastOk', { time: time(a.last.at), subject: a.last.subject }) : t('settings.alerts.lastFailed', { time: time(a.last.at), error: a.last.error ?? '' })}</p>}
    </div>
  );
}
// #endregion outage-alerts
