import { useEffect, useState } from 'react';
import type { AppStatus, Listener, Settings as SettingsValue } from '../../core/types';
import { api, nameOf, Spinner, useT } from '../lib';

export function Settings({ status, onTheme, onLanguage, onSetup }: { status: AppStatus; onTheme: (theme: 'dark' | 'light') => void; onLanguage: () => void;
  /** FD-39 SCN-058: the Setup console stays reachable after the card is hidden. */
  onSetup?: () => void }) {
  const { t, time } = useT();
  const [value, setValue] = useState<SettingsValue | null>(null);
  const [error, setError] = useState('');
  const [listeners, setListeners] = useState<{ listeners: Listener[]; error?: string } | null>(null);
  const [uninstallError, setUninstallError] = useState('');
  const [pathError, setPathError] = useState('');

  useEffect(() => {
    void api().settings().then(setValue);
    void api().listeners().then(setListeners);
  }, []);

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
      <section className="group" aria-labelledby="g-app">
        <h2 id="g-app">{t('app.name')}</h2>
        <label className="setting">{t('settings.launchAtLogin')}
          <input type="checkbox" checked={value.launchAtLogin} onChange={(e) => void save({ launchAtLogin: e.target.checked })} />
        </label>
        {error && <p className="notice error" role="alert">{error}</p>}
        <label className="setting">{t('settings.theme')}
          <select value={value.theme} onChange={(e) => void save({ theme: e.target.value as 'dark' | 'light' })}>
            <option value="dark">{t('settings.theme.dark')}</option>
            <option value="light">{t('settings.theme.light')}</option>
          </select>
        </label>
        <label className="setting">{t('settings.language')}
          <select value={value.language} onChange={(e) => void save({ language: e.target.value as SettingsValue['language'] })}>
            <option value="system">{t('settings.language.system')}</option>
            <option value="en" lang="en">English</option>
            <option value="ru" lang="ru">Русский</option>
          </select>
        </label>
        <p className="meta">v{status.version}</p>
      </section>

      <section className="group" aria-labelledby="g-updates">
        <h2 id="g-updates">{t('settings.updates')}</h2>
        <label className="setting">{t('settings.autoUpdate')}
          <input type="checkbox" checked={value.autoUpdate} onChange={(e) => void save({ autoUpdate: e.target.checked })} />
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
          <input type="checkbox" checked={value.estate.enabled} onChange={(e) => void save({ estate: { ...value.estate, enabled: e.target.checked } })} />
        </label>
        <p className="meta">{t('settings.estate.enabled.body')}</p>
        <label className="setting">{t('settings.estate.autoSkills')}
          <input type="checkbox" checked={value.estate.autoSkills} onChange={(e) => void save({ estate: { ...value.estate, autoSkills: e.target.checked } })} />
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
          <input type="checkbox" checked={n.enabled} onChange={(e) => setN({ enabled: e.target.checked })} />
        </label>
        <div className="setting">
          <span>{t('settings.quiet')}</span>
          <span className="row">
            <input type="checkbox" aria-label={t('settings.quiet')} checked={n.quietHours.enabled} onChange={(e) => setN({ quietHours: { ...n.quietHours, enabled: e.target.checked } })} />
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
        {status.services.length > 0 && (
          <table>
            <thead><tr><th>{t('settings.perService')}</th><th>{t('settings.notifications.enabled')}</th><th>{t('settings.minLevel')}</th></tr></thead>
            <tbody>
              {status.services.map((s) => {
                const per = n.perService[s.key] ?? { enabled: true, minLevel: 'notice' as const };
                const set = (p: Partial<typeof per>) => setN({ perService: { ...n.perService, [s.key]: { ...per, ...p } } });
                return (
                  <tr key={s.key}>
                    <td>{nameOf(s)}</td>
                    <td><input type="checkbox" aria-label={`${nameOf(s)}: ${t('settings.notifications.enabled')}`} checked={per.enabled} onChange={(e) => set({ enabled: e.target.checked })} /></td>
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
        )}
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
        </section>
      )}

      <section className="group" aria-labelledby="g-uninstall">
        <h2 id="g-uninstall">{t('settings.uninstall')}</h2>
        <p className="meta">{t('settings.uninstall.body')}</p>
        {uninstallError && <p className="notice error" role="alert">{uninstallError}</p>}
        <div><button className="btn btn-danger" onClick={() => void api().uninstall().then((r) => setUninstallError(r.ok || r.cancelled ? '' : r.error ?? ''))}>{t('settings.uninstall.action')}</button></div>
      </section>

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
    </div>
  );
}

/** Where the self-update stands, with the one action that state needs (ADR-0015). */
function UpdateState({ status }: { status: AppStatus }) {
  const { t, time } = useT();
  const u = status.update;
  if (u.state === 'unsupported') return <p className="meta">{t('update.unsupported')}</p>;
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
    if (c.state === 'behind') return <span className="meta state-down">{t('estate.contract')}: {t('estate.contract.behind', { local: short(c.knownTip ?? c.localTip), remote: short(c.remoteTip) })}{fetched}</span>;
    return <span className="meta state-down">{t('estate.contract')}: {t('estate.contract.unknown')}</span>;
  };
  const skillsLine = () => {
    const s = e.skills;
    if (s.state === 'updating') return <span className="meta">{t('estate.skills')}: {t('estate.skills.updating', { latest: s.latest ?? '?' })}</span>;
    if (s.state === 'current') return <span className="meta">{t('estate.skills')}: {t('estate.skills.current', { version: s.installed ?? '?' })}</span>;
    if (s.state === 'update-available') return <span className="meta state-down">{t('estate.skills')}: {t('estate.skills.behind', { installed: s.installed ?? '?', latest: s.latest ?? '?' })}</span>;
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
