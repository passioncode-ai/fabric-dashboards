import { useEffect, useState } from 'react';
import type { AppStatus, Listener, Settings as SettingsValue } from '../../core/types';
import { api, nameOf, Spinner, useT } from '../lib';

export function Settings({ status, onTheme }: { status: AppStatus; onTheme: (theme: 'dark' | 'light') => void }) {
  const { t, time } = useT();
  const [value, setValue] = useState<SettingsValue | null>(null);
  const [error, setError] = useState('');
  const [listeners, setListeners] = useState<{ listeners: Listener[]; error?: string } | null>(null);
  const [uninstallError, setUninstallError] = useState('');

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
        <div><button className="btn" onClick={() => void api().showPath(status.servicesDir)}>{t('overview.empty.show')}</button></div>
      </section>

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
  if (u.state === 'ready') return <div className="row"><span className="meta">{(u.version ? t('update.ready', { version: u.version }) : t('update.readyUnnamed'))}</span><button className="btn btn-primary" onClick={() => void api().restartToUpdate()}>{t('update.restart')}</button></div>;
  if (u.state === 'checking' || u.state === 'downloading') return <p className="meta row"><Spinner /> {t(`update.${u.state}`)}</p>;
  return (
    <div className="row">
      <span className={u.state === 'error' ? 'meta state-down' : 'meta'}>{u.state === 'error' ? t('update.error', { error: u.error ?? '' }) : u.checkedAt ? t('update.idle', { time: time(u.checkedAt) }) : t('update.notChecked')}</span>
      <button className="btn" onClick={() => void api().checkForUpdates()}>{t('settings.updates.check')}</button>
    </div>
  );
}
